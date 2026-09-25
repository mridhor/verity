-- Verity: remaining office features of the earlier prototype (docs/old-version/old.jsx), on the
-- same access rules: office settings (session timeout, yearly target), user administration
-- views, sign-in audit, office-wide session control, notifications, legal reference files.

-- ─────────────────────────────  Office settings  ─────────────────────────────

create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants (id),
  annual_akta_target integer check (annual_akta_target is null or annual_akta_target between 1 and 100000),
  session_timeout_hours integer not null default 8 check (session_timeout_hours between 1 and 24),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

revoke all on public.tenant_settings from anon, authenticated;
grant select on public.tenant_settings to authenticated;
alter table public.tenant_settings enable row level security;
create policy tenant_settings_aal2 on public.tenant_settings as restrictive for all to authenticated using ((select private.aal_ok()));
create policy tenant_settings_read on public.tenant_settings for select to authenticated
  using (tenant_id = (select private.tenant_id()) and private.is_tenant_member(tenant_id));
-- The access token hook reads the session timeout.
grant select on public.tenant_settings to supabase_auth_admin;
create policy tenant_settings_hook on public.tenant_settings for select to supabase_auth_admin using (true);

-- Notaris or Super Admin of the active office, with MFA.
create function private.is_office_admin(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (private.has_active_role(p_tenant, 'notaris') or private.has_active_role(p_tenant, 'super_admin'))
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
grant execute on function private.is_office_admin(uuid) to authenticated;

create function public.update_tenant_settings(p_annual_akta_target integer, p_session_timeout_hours integer)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id();
begin
  if v_tenant is null or not private.is_office_admin(v_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.tenant_settings (tenant_id, annual_akta_target, session_timeout_hours, updated_by, updated_at)
  values (v_tenant, p_annual_akta_target, p_session_timeout_hours, auth.uid(), now())
  on conflict (tenant_id) do update
    set annual_akta_target = excluded.annual_akta_target,
        session_timeout_hours = excluded.session_timeout_hours,
        updated_by = excluded.updated_by, updated_at = now();
  perform private.audit(v_tenant, 'tenant_settings.updated', 'tenant', v_tenant, null,
    jsonb_build_object('annual_akta_target', p_annual_akta_target, 'session_timeout_hours', p_session_timeout_hours));
end $$;

-- Same hook as before, plus the office session timeout (enforced by the web proxy from `amr`).
create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_user uuid := (event ->> 'user_id')::uuid;
  v_pref uuid;
  v_tenant uuid;
  v_role public.app_role;
  v_timeout integer;
begin
  select s.active_tenant_id into v_pref from public.user_settings s where s.user_id = v_user;

  select tm.tenant_id, tm.role into v_tenant, v_role
    from public.tenant_members tm
   where tm.user_id = v_user and tm.active
   order by (tm.tenant_id = v_pref) desc nulls last, tm.created_at, tm.tenant_id
   limit 1;

  if v_tenant is null then
    v_claims := v_claims - 'tenant_id' - 'app_role' - 'session_timeout_h';
  else
    select ts.session_timeout_hours into v_timeout from public.tenant_settings ts where ts.tenant_id = v_tenant;
    v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_tenant::text));
    v_claims := jsonb_set(v_claims, '{app_role}', to_jsonb(v_role::text));
    v_claims := jsonb_set(v_claims, '{session_timeout_h}', to_jsonb(coalesce(v_timeout, 8)));
  end if;
  return jsonb_set(event, '{claims}', v_claims);
end $$;

-- ─────────────────────────────  User administration  ─────────────────────────────

-- Members of the active office with their login email and last sign-in (Super Admin only).
create function public.list_tenant_members()
returns table (user_id uuid, display_name text, role public.app_role, active boolean, email text,
               last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id();
begin
  if v_tenant is null or not private.has_active_role(v_tenant, 'super_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select tm.user_id, tm.display_name, tm.role, tm.active, u.email::text, u.last_sign_in_at, tm.created_at
      from public.tenant_members tm
      join auth.users u on u.id = tm.user_id
     where tm.tenant_id = v_tenant
     order by tm.active desc, tm.display_name;
end $$;

create function public.update_member_profile(p_user uuid, p_display_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id();
begin
  if v_tenant is null or not private.has_active_role(v_tenant, 'super_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_display_name, ''))) not between 2 and 120 then
    raise exception 'nama tidak valid' using errcode = '22023';
  end if;
  update public.tenant_members set display_name = trim(p_display_name)
   where tenant_id = v_tenant and user_id = p_user;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.audit(v_tenant, 'tenant_member.renamed', 'user', p_user);
end $$;

-- Accounts created with an initial password must change it at first sign-in; the user clears
-- the flag for themselves only after setting a new password.
create function public.clear_must_change_password() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update auth.users set raw_app_meta_data = raw_app_meta_data - 'must_change_password' where id = auth.uid();
end $$;

-- ─────────────────────────────  Sign-in audit  ─────────────────────────────

create function public.log_auth_event(p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id();
begin
  if p_kind not in ('auth.login', 'auth.logout', 'auth.mfa_verified', 'auth.password_changed') then
    raise exception 'unknown auth event' using errcode = '22023';
  end if;
  if auth.uid() is null or v_tenant is null or not private.is_tenant_member(v_tenant) then
    return;  -- no office yet (e.g. account without membership): nothing to attach the event to
  end if;
  perform private.audit(v_tenant, p_kind, 'user', auth.uid(), null,
                        jsonb_build_object('aal', coalesce(auth.jwt() ->> 'aal', 'aal1')));
end $$;

-- ─────────────────────────────  Sessions  ─────────────────────────────

create function public.office_session_stats() returns table (sessions integer, users integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id(); v_hours integer;
begin
  if v_tenant is null or not private.is_office_admin(v_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce((select ts.session_timeout_hours from public.tenant_settings ts where ts.tenant_id = v_tenant), 8)
    into v_hours;
  return query
    select count(*)::integer, count(distinct s.user_id)::integer
      from auth.sessions s
      join public.tenant_members tm on tm.user_id = s.user_id and tm.tenant_id = v_tenant and tm.active
     where (s.not_after is null or s.not_after > now())
       and s.created_at > now() - make_interval(hours => v_hours);
end $$;

-- Signs every other member of the office out (refresh tokens go with their sessions).
-- Access tokens already issued stay valid until they expire (at most one hour).
create function public.revoke_office_sessions() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id(); v_count integer;
begin
  if v_tenant is null or not private.is_office_admin(v_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from auth.sessions s
   using public.tenant_members tm
   where tm.user_id = s.user_id and tm.tenant_id = v_tenant and s.user_id <> auth.uid();
  get diagnostics v_count = row_count;
  perform private.audit(v_tenant, 'session.revoked_all', 'tenant', v_tenant, null, jsonb_build_object('sessions', v_count));
  return v_count;
end $$;

-- ─────────────────────────────  Notifications  ─────────────────────────────

create function private.notify_users(p_tenant uuid, p_users uuid[], p_kind text, p_payload jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (tenant_id, user_id, kind, payload)
  select distinct p_tenant, u, p_kind, p_payload
    from unnest(p_users) u
    join public.tenant_members tm on tm.tenant_id = p_tenant and tm.user_id = u and tm.active and tm.role <> 'super_admin'
   where u is distinct from auth.uid()
$$;

-- Akta waiting for signature → its official and the berkas team; returned to draft → its creator;
-- finalized → the berkas team.
create function private.notify_akta_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.akta; v_official uuid; v_team uuid[];
begin
  select * into a from public.akta where id = new.akta_id;
  select o.user_id into v_official from public.officials o where o.id = a.official_id;
  select coalesce(array_agg(m.user_id), '{}') into v_team
    from public.berkas_members m where m.berkas_id = a.berkas_id and m.active;
  if new.to_status = 'menunggu_ttd' then
    perform private.notify_users(a.tenant_id, v_team || v_official, 'akta.awaiting_signature',
                                 jsonb_build_object('akta_id', a.id, 'berkas_id', a.berkas_id));
  elsif new.to_status = 'draft' and new.from_status is not null then
    perform private.notify_users(a.tenant_id, array[a.created_by], 'akta.returned',
                                 jsonb_build_object('akta_id', a.id, 'berkas_id', a.berkas_id));
  elsif new.to_status = 'selesai' then
    perform private.notify_users(a.tenant_id, v_team, 'akta.finalized',
                                 jsonb_build_object('akta_id', a.id, 'berkas_id', a.berkas_id));
  end if;
  return null;
end $$;
create trigger akta_status_history_notify after insert on public.akta_status_history
  for each row execute function private.notify_akta_status();

-- A new agent proposal → the people who may decide it.
create function private.notify_proposal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_users uuid[];
begin
  if new.tier = 'notaris' then
    select coalesce(array_agg(tm.user_id), '{}') into v_users from public.tenant_members tm
     where tm.tenant_id = new.tenant_id and tm.active and tm.role in ('notaris', 'partner');
  else
    select coalesce(array_agg(m.user_id), '{}') into v_users from public.berkas_members m
     where m.berkas_id = new.berkas_id and m.active;
  end if;
  perform private.notify_users(new.tenant_id, v_users, 'proposal.pending',
                               jsonb_build_object('proposal_id', new.id, 'berkas_id', new.berkas_id));
  return null;
end $$;
create trigger proposed_changes_notify after insert on public.proposed_changes
  for each row execute function private.notify_proposal();

-- ─────────────────────────────  Legal reference files  ─────────────────────────────

alter table public.legal_references add column file_path text unique;

-- Attaches a PDF already uploaded to the `legal` bucket (<tenant>/<reference>/<file>).
create function public.attach_legal_file(p_reference uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.legal_references; v_uploaded boolean := true;
begin
  select * into r from public.legal_references where id = p_reference;
  if r.id is null or r.tenant_id is distinct from private.tenant_id() or not private.can_write_content(r.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if split_part(p_path, '/', 1) <> r.tenant_id::text or split_part(p_path, '/', 2) <> r.id::text then
    raise exception 'path tidak valid' using errcode = '22023';
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where bucket_id = $1 and name = $2)'
      into v_uploaded using 'legal', p_path;
  end if;
  if not v_uploaded then
    raise exception 'file belum terunggah' using errcode = 'P0002';
  end if;
  update public.legal_references set file_path = p_path where id = r.id;
end $$;

-- Every download is logged, like documents.
create function public.log_legal_download(p_reference uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare r public.legal_references;
begin
  select * into r from public.legal_references where id = p_reference;
  if r.id is null or r.tenant_id is distinct from private.tenant_id() or not private.is_tenant_member(r.tenant_id)
     or r.file_path is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.audit(r.tenant_id, 'legal.downloaded', 'legal_reference', r.id);
  return r.file_path;
end $$;

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;  -- plain Postgres test database
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('legal', 'legal', false, 26214400, array['application/pdf'])
  on conflict (id) do nothing;

  execute $p$
    create policy legal_bucket_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'legal'
                and (storage.foldername(name))[1] = (select private.tenant_id())::text
                and private.can_write_content((select private.tenant_id()))
                and (select private.aal_ok()))
  $p$;
  execute $p$
    create policy legal_bucket_read on storage.objects for select to authenticated
    using (bucket_id = 'legal'
           and (storage.foldername(name))[1] = (select private.tenant_id())::text
           and private.is_tenant_member((select private.tenant_id()))
           and (select private.aal_ok()))
  $p$;
end $$;

-- ─────────────────────────────  Grants  ─────────────────────────────

revoke execute on function public.update_tenant_settings(integer, integer), public.list_tenant_members(),
  public.update_member_profile(uuid, text), public.clear_must_change_password(), public.log_auth_event(text),
  public.office_session_stats(), public.revoke_office_sessions(), public.attach_legal_file(uuid, text),
  public.log_legal_download(uuid) from public, anon;
grant execute on function public.update_tenant_settings(integer, integer), public.list_tenant_members(),
  public.update_member_profile(uuid, text), public.clear_must_change_password(), public.log_auth_event(text),
  public.office_session_stats(), public.revoke_office_sessions(), public.attach_legal_file(uuid, text),
  public.log_legal_download(uuid) to authenticated;
revoke execute on function private.notify_users(uuid, uuid[], text, jsonb), private.notify_akta_status(),
  private.notify_proposal() from public, anon, authenticated;
