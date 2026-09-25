-- Verity Phase 0: tenancy, roles, officials, berkas membership, audit log, RLS helpers.
-- See docs/PLAN.md §6 and §10.1. Every client-data table gets:
--   * RLS keyed on the verified JWT claims (tenant_id, app_role) plus live membership tables,
--   * a restrictive policy that requires aal2 (MFA) for notaris, partner and super_admin,
--   * no direct writes from API roles: mutations go through SECURITY DEFINER RPCs that audit.

-- ─────────────────────────────  Schemas and types  ─────────────────────────────

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, supabase_auth_admin;
alter default privileges in schema private revoke execute on functions from public;

create type public.tenant_kind as enum ('kantor_notaris', 'firma');
create type public.app_role as enum ('notaris', 'partner', 'associate', 'staf_admin', 'super_admin');
create type public.appointment as enum ('notaris', 'ppat');
create type public.actor_type as enum ('human', 'agent', 'worker', 'system');

-- ─────────────────────────────  Tables  ─────────────────────────────

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  kind public.tenant_kind not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (tenant_id, user_id)
);
create index tenant_members_user_idx on public.tenant_members (user_id);

-- Which tenant a user works in when they belong to more than one (D-11). Read by the
-- access token hook; written only by switch_tenant().
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_tenant_id uuid references public.tenants (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- One row per appointment. One person holding both Notaris and PPAT appointments has two rows.
create table public.officials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  appointment public.appointment not null,
  display_name text not null,
  kedudukan text,
  sk_ref text,
  timezone text not null default 'Asia/Jakarta',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, appointment)
);
create index officials_tenant_idx on public.officials (tenant_id);

-- Skeleton; Phase 1 adds type-specific columns, parties and akta.
create table public.berkas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  type text not null,
  title text not null,
  pic_user_id uuid references auth.users (id),
  official_id uuid references public.officials (id),
  workflow_step text,
  status text not null default 'aktif' check (status in ('aktif', 'selesai', 'ditutup')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index berkas_tenant_idx on public.berkas (tenant_id);

create table public.berkas_members (
  berkas_id uuid not null references public.berkas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id),
  added_by uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (berkas_id, user_id)
);
create index berkas_members_user_idx on public.berkas_members (user_id, berkas_id);

create table public.notifications (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Append-only, hash-chained per tenant. `details` holds ids, counts and probabilities only:
-- never document text, prompts or decision-model state (rule 9).
create table public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id),
  berkas_id uuid,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_type public.actor_type not null,
  actor_user_id uuid,
  on_behalf_of uuid,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  prev_hash bytea,
  row_hash bytea not null
);
create index audit_log_tenant_idx on public.audit_log (tenant_id, id);
create index audit_log_berkas_idx on public.audit_log (berkas_id, id) where berkas_id is not null;

-- ─────────────────────────────  Claim and membership helpers  ─────────────────────────────

create function private.tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;

create function private.app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select nullif(auth.jwt() ->> 'app_role', '')::public.app_role
$$;

-- MFA gate used by the restrictive policies (REQ-GW-05).
create function private.aal_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'app_role', '') not in ('notaris', 'partner', 'super_admin')
      or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create function private.is_tenant_member(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = p_tenant and tm.user_id = auth.uid() and tm.active
  )
$$;

-- Live role check. Privileged RPCs require the JWT claim AND this, so a revoked role stops
-- working before the token expires.
create function private.has_active_role(p_tenant uuid, p_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.app_role() = p_role
     and private.tenant_id() = p_tenant
     and exists (
       select 1 from public.tenant_members tm
       where tm.tenant_id = p_tenant and tm.user_id = auth.uid() and tm.role = p_role and tm.active
     )
$$;

-- Per-berkas access: the Notaris sees every berkas of the tenant; everyone else only the
-- berkas they are an active member of (PRD §4). super_admin gets no content access here.
create function private.can_access_berkas(p_berkas uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.berkas b
    where b.id = p_berkas
      and b.tenant_id = private.tenant_id()
      and (
        private.has_active_role(b.tenant_id, 'notaris')
        or exists (
          select 1 from public.berkas_members m
          join public.tenant_members tm on tm.tenant_id = m.tenant_id and tm.user_id = m.user_id and tm.active
          where m.berkas_id = b.id and m.user_id = auth.uid() and m.active
            and tm.role <> 'super_admin'
        )
      )
  )
$$;

grant execute on function private.tenant_id(), private.app_role(), private.aal_ok(),
  private.is_tenant_member(uuid), private.has_active_role(uuid, public.app_role),
  private.can_access_berkas(uuid) to authenticated;

-- ─────────────────────────────  Audit log: chain + append-only  ─────────────────────────────

create function private.audit_canonical(a public.audit_log) returns text
language sql immutable set search_path = '' as $$
  select concat_ws('|',
    a.tenant_id::text,
    coalesce(a.berkas_id::text, ''),
    to_char(a.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    a.actor_type::text,
    coalesce(a.actor_user_id::text, ''),
    coalesce(a.on_behalf_of::text, ''),
    a.action,
    coalesce(a.target_type, ''),
    coalesce(a.target_id::text, ''),
    a.details::text)
$$;

create function private.audit_chain() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize inserts per tenant so the chain has a single order.
  perform pg_advisory_xact_lock(hashtextextended('audit_log:' || new.tenant_id::text, 0));
  select l.row_hash into new.prev_hash
    from public.audit_log l where l.tenant_id = new.tenant_id order by l.id desc limit 1;
  new.row_hash := sha256(coalesce(new.prev_hash, ''::bytea) || convert_to(private.audit_canonical(new), 'UTF8'));
  return new;
end $$;

create trigger audit_log_chain before insert on public.audit_log
  for each row execute function private.audit_chain();

create function private.reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;

create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function private.reject_mutation();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.reject_mutation();

-- Returns the id of the first row whose hash does not verify, or null if the chain is intact.
create function private.verify_audit_chain(p_tenant uuid) returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare r public.audit_log; v_prev bytea := null;
begin
  for r in select * from public.audit_log where tenant_id = p_tenant order by id loop
    if r.prev_hash is distinct from v_prev
       or r.row_hash <> sha256(coalesce(v_prev, ''::bytea) || convert_to(private.audit_canonical(r), 'UTF8')) then
      return r.id;
    end if;
    v_prev := r.row_hash;
  end loop;
  return null;
end $$;

-- The only way rows enter audit_log from application code.
create function private.audit(
  p_tenant uuid, p_action text, p_target_type text default null, p_target_id uuid default null,
  p_berkas uuid default null, p_details jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (tenant_id, berkas_id, actor_type, actor_user_id, action, target_type, target_id, details)
  values (p_tenant, p_berkas,
          case when auth.uid() is null then 'system'::public.actor_type else 'human'::public.actor_type end,
          auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
end $$;

create function private.notify_notaris(p_tenant uuid, p_kind text, p_payload jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (tenant_id, user_id, kind, payload)
  select tm.tenant_id, tm.user_id, p_kind, p_payload
  from public.tenant_members tm
  where tm.tenant_id = p_tenant and tm.role = 'notaris' and tm.active
$$;

-- ─────────────────────────────  Integrity triggers  ─────────────────────────────

create function private.check_official() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.tenant_members tm
                 where tm.tenant_id = new.tenant_id and tm.user_id = new.user_id
                   and tm.role = 'notaris' and tm.active) then
    raise exception 'an official must be an active notaris member of the tenant' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger officials_check before insert or update on public.officials
  for each row execute function private.check_official();

create function private.check_berkas_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select b.tenant_id into new.tenant_id from public.berkas b where b.id = new.berkas_id;
  if not exists (select 1 from public.tenant_members tm
                 where tm.tenant_id = new.tenant_id and tm.user_id = new.user_id and tm.active) then
    raise exception 'user is not an active member of the berkas tenant' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger berkas_members_check before insert or update on public.berkas_members
  for each row execute function private.check_berkas_member();

-- ─────────────────────────────  Grants and RLS  ─────────────────────────────

-- Supabase grants broad default privileges on public; take them back explicitly.
revoke all on public.tenants, public.tenant_members, public.user_settings, public.officials,
  public.berkas, public.berkas_members, public.notifications, public.audit_log
  from anon, authenticated;
revoke insert, update, delete, truncate on public.audit_log from service_role;

grant select on public.tenants, public.tenant_members, public.user_settings, public.officials,
  public.berkas, public.berkas_members, public.notifications, public.audit_log to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.user_settings enable row level security;
alter table public.officials enable row level security;
alter table public.berkas enable row level security;
alter table public.berkas_members enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- Restrictive MFA policy on every table above.
create policy tenants_aal2 on public.tenants as restrictive for all to authenticated using ((select private.aal_ok()));
create policy tenant_members_aal2 on public.tenant_members as restrictive for all to authenticated using ((select private.aal_ok()));
create policy user_settings_aal2 on public.user_settings as restrictive for all to authenticated using ((select private.aal_ok()));
create policy officials_aal2 on public.officials as restrictive for all to authenticated using ((select private.aal_ok()));
create policy berkas_aal2 on public.berkas as restrictive for all to authenticated using ((select private.aal_ok()));
create policy berkas_members_aal2 on public.berkas_members as restrictive for all to authenticated using ((select private.aal_ok()));
create policy notifications_aal2 on public.notifications as restrictive for all to authenticated using ((select private.aal_ok()));
create policy audit_log_aal2 on public.audit_log as restrictive for all to authenticated using ((select private.aal_ok()));

-- Tenants the user belongs to (for the tenant switcher).
create policy tenants_read on public.tenants for select to authenticated
  using (private.is_tenant_member(id));

-- Colleagues in the active tenant.
create policy tenant_members_read on public.tenant_members for select to authenticated
  using (tenant_id = (select private.tenant_id()) or user_id = (select auth.uid()));
-- The access token hook runs as supabase_auth_admin.
grant select on public.tenant_members, public.user_settings to supabase_auth_admin;
create policy tenant_members_hook on public.tenant_members for select to supabase_auth_admin using (true);
create policy user_settings_hook on public.user_settings for select to supabase_auth_admin using (true);

create policy user_settings_read on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));

create policy officials_read on public.officials for select to authenticated
  using (tenant_id = (select private.tenant_id()));

create policy berkas_read on public.berkas for select to authenticated
  using (tenant_id = (select private.tenant_id()) and private.can_access_berkas(id));
-- super_admin: metadata only (C-17, D-07); content tables never get this policy.
create policy berkas_read_admin on public.berkas for select to authenticated
  using (tenant_id = (select private.tenant_id()) and private.has_active_role(tenant_id, 'super_admin'));

create policy berkas_members_read on public.berkas_members for select to authenticated
  using (tenant_id = (select private.tenant_id())
         and (private.can_access_berkas(berkas_id) or private.has_active_role(tenant_id, 'super_admin')));

create policy notifications_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and tenant_id = (select private.tenant_id()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and tenant_id = (select private.tenant_id()))
  with check (user_id = (select auth.uid()) and tenant_id = (select private.tenant_id()));

-- Audit: Notaris and super_admin see the tenant's log; others see entries of berkas they can access.
create policy audit_log_read on public.audit_log for select to authenticated
  using (tenant_id = (select private.tenant_id())
         and (private.has_active_role(tenant_id, 'notaris')
              or private.has_active_role(tenant_id, 'super_admin')
              or (berkas_id is not null and private.can_access_berkas(berkas_id))));

-- ─────────────────────────────  Access token hook  ─────────────────────────────
-- Enabled with GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED / _URI (self-hosted compose).
-- Issues tenant_id and app_role only for an active membership (rule 5).

create function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_user uuid := (event ->> 'user_id')::uuid;
  v_pref uuid;
  v_tenant uuid;
  v_role public.app_role;
begin
  select s.active_tenant_id into v_pref from public.user_settings s where s.user_id = v_user;

  select tm.tenant_id, tm.role into v_tenant, v_role
    from public.tenant_members tm
   where tm.user_id = v_user and tm.active
   order by (tm.tenant_id = v_pref) desc nulls last, tm.created_at, tm.tenant_id
   limit 1;

  if v_tenant is null then
    v_claims := v_claims - 'tenant_id' - 'app_role';
  else
    v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_tenant::text));
    v_claims := jsonb_set(v_claims, '{app_role}', to_jsonb(v_role::text));
  end if;
  return jsonb_set(event, '{claims}', v_claims);
end $$;

revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- ─────────────────────────────  RPCs  ─────────────────────────────

-- Choose the active tenant; the client must refresh its session to get new claims.
create function public.switch_tenant(p_tenant uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_tenant_member(p_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.user_settings (user_id, active_tenant_id) values (auth.uid(), p_tenant)
  on conflict (user_id) do update set active_tenant_id = excluded.active_tenant_id, updated_at = now();
  perform private.audit(p_tenant, 'tenant.switched', 'user', auth.uid());
end $$;

-- Accounts are created by the ops script (scripts/invite-user) with the admin API from the
-- bastion; here the Super Admin attaches an existing account to the tenant with a role.
create function public.add_tenant_member(p_email text, p_role public.app_role, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id(); v_user uuid;
begin
  if not private.has_active_role(v_tenant, 'super_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(p_email);
  if v_user is null then
    raise exception 'akun belum dibuat' using errcode = 'P0002';
  end if;
  insert into public.tenant_members (tenant_id, user_id, role, display_name, created_by)
  values (v_tenant, v_user, p_role, p_display_name, auth.uid());
  perform private.audit(v_tenant, 'tenant_member.added', 'user', v_user, null, jsonb_build_object('role', p_role));
  perform private.notify_notaris(v_tenant, 'tenant_member.added', jsonb_build_object('user_id', v_user, 'role', p_role));
  return v_user;
end $$;

create function public.set_member_role(p_user uuid, p_role public.app_role, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id();
begin
  if not private.has_active_role(v_tenant, 'super_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot change own role' using errcode = '42501';
  end if;
  update public.tenant_members set role = p_role, active = p_active
   where tenant_id = v_tenant and user_id = p_user;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.audit(v_tenant, 'tenant_member.updated', 'user', p_user, null,
                        jsonb_build_object('role', p_role, 'active', p_active));
  perform private.notify_notaris(v_tenant, 'tenant_member.updated',
                                 jsonb_build_object('user_id', p_user, 'role', p_role, 'active', p_active));
end $$;

create function public.upsert_official(
  p_user uuid, p_appointment public.appointment, p_display_name text,
  p_kedudukan text, p_sk_ref text, p_timezone text default 'Asia/Jakarta'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id(); v_id uuid;
begin
  if not private.has_active_role(v_tenant, 'super_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.officials (tenant_id, user_id, appointment, display_name, kedudukan, sk_ref, timezone)
  values (v_tenant, p_user, p_appointment, p_display_name, p_kedudukan, p_sk_ref, p_timezone)
  on conflict (tenant_id, user_id, appointment) do update
    set display_name = excluded.display_name, kedudukan = excluded.kedudukan,
        sk_ref = excluded.sk_ref, timezone = excluded.timezone
  returning id into v_id;
  perform private.audit(v_tenant, 'official.upserted', 'official', v_id, null,
                        jsonb_build_object('appointment', p_appointment));
  return v_id;
end $$;

create function public.create_berkas(p_type text, p_title text, p_pic uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id(); v_role public.app_role := private.app_role(); v_id uuid;
begin
  if v_tenant is null or v_role is null or v_role = 'super_admin'
     or not private.has_active_role(v_tenant, v_role) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.berkas (tenant_id, type, title, pic_user_id, created_by)
  values (v_tenant, p_type, p_title, coalesce(p_pic, auth.uid()), auth.uid())
  returning id into v_id;
  insert into public.berkas_members (berkas_id, user_id, tenant_id, added_by)
  values (v_id, auth.uid(), v_tenant, auth.uid());
  if p_pic is not null and p_pic <> auth.uid() then
    insert into public.berkas_members (berkas_id, user_id, tenant_id, added_by)
    values (v_id, p_pic, v_tenant, auth.uid());
  end if;
  perform private.audit(v_tenant, 'berkas.created', 'berkas', v_id, v_id, jsonb_build_object('type', p_type));
  return v_id;
end $$;

-- Membership changes: Notaris/Partner, a member of the berkas who is not super_admin, or the
-- Super Admin (who can never add themselves, C-17). Every change notifies the Notaris.
create function public.set_berkas_member(p_berkas uuid, p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  select b.tenant_id into v_tenant from public.berkas b where b.id = p_berkas;
  if v_tenant is null or v_tenant <> private.tenant_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (private.has_active_role(v_tenant, 'notaris')
          or private.has_active_role(v_tenant, 'partner')
          or private.has_active_role(v_tenant, 'super_admin')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if private.has_active_role(v_tenant, 'super_admin') and p_user = auth.uid() then
    raise exception 'super admin cannot assign themselves to a berkas' using errcode = '42501';
  end if;
  if exists (select 1 from public.tenant_members tm
             where tm.tenant_id = v_tenant and tm.user_id = p_user and tm.role = 'super_admin') then
    raise exception 'super admin accounts cannot be berkas members' using errcode = '42501';
  end if;
  insert into public.berkas_members (berkas_id, user_id, tenant_id, added_by, active)
  values (p_berkas, p_user, v_tenant, auth.uid(), p_active)
  on conflict (berkas_id, user_id) do update set active = excluded.active;
  perform private.audit(v_tenant, case when p_active then 'berkas_member.added' else 'berkas_member.removed' end,
                        'user', p_user, p_berkas);
  perform private.notify_notaris(v_tenant, 'berkas_member.changed',
                                 jsonb_build_object('berkas_id', p_berkas, 'user_id', p_user, 'active', p_active));
end $$;

revoke execute on function public.switch_tenant(uuid), public.add_tenant_member(text, public.app_role, text),
  public.set_member_role(uuid, public.app_role, boolean),
  public.upsert_official(uuid, public.appointment, text, text, text, text),
  public.create_berkas(text, text, uuid), public.set_berkas_member(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.switch_tenant(uuid), public.add_tenant_member(text, public.app_role, text),
  public.set_member_role(uuid, public.app_role, boolean),
  public.upsert_official(uuid, public.appointment, text, text, text, text),
  public.create_berkas(text, text, uuid), public.set_berkas_member(uuid, uuid, boolean)
  to authenticated;

-- Helpers in `private` are not callable by API roles unless granted above.
revoke execute on function private.audit(uuid, text, text, uuid, uuid, jsonb),
  private.notify_notaris(uuid, text, jsonb), private.verify_audit_chain(uuid)
  from public, anon, authenticated;
