-- Verity: pre-signing checks run by the agent in the background (ADR 0006).
-- Before a scheduled signing (H-3 and H-1, hourly via pg_cron) the agent reads the berkas, posts
-- its findings into the berkas conversation, notifies the official and the team, and proposes
-- checklist items. It never changes akta, parties or documents. Verifying an akta and approving
-- it for signing stay manual on the akta page, so status changes are no longer agent proposals.

-- ─────────────────────────────  No akta status changes through the agent  ─────────────────────────────

delete from public.approval_policies where op like 'akta.%';
update public.proposed_changes set status = 'expired'
 where status = 'pending'
   and exists (select 1 from jsonb_array_elements(items) i where i ->> 'op' like 'akta.%');

-- ─────────────────────────────  Agent as the actor in the audit log  ─────────────────────────────

-- Background work runs with simulated claims carrying verity_actor = 'agent'. The audit then
-- records the agent as the actor, on behalf of the member whose rights it used.
create or replace function private.audit(
  p_tenant uuid, p_action text, p_target_type text default null, p_target_id uuid default null,
  p_berkas uuid default null, p_details jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_agent boolean := coalesce(auth.jwt() ->> 'verity_actor', '') = 'agent';
begin
  insert into public.audit_log (tenant_id, berkas_id, actor_type, actor_user_id, on_behalf_of, action, target_type, target_id, details)
  values (p_tenant, p_berkas,
          case when v_agent then 'agent' when auth.uid() is null then 'system' else 'human' end::public.actor_type,
          case when v_agent then null else auth.uid() end,
          case when v_agent then auth.uid() end,
          p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
end $$;

-- Same hook as before; it also drops any verity_actor claim so no user token can carry it.
create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb) - 'verity_actor';
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

-- ─────────────────────────────  Runs  ─────────────────────────────

create table public.agent_background_runs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id),
  berkas_id uuid not null references public.berkas (id) on delete cascade,
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  stage text not null check (stage in ('h3', 'h1', 'manual')),
  scheduled_for timestamptz not null,
  findings integer not null default 0,
  message_id bigint references public.agent_messages (id) on delete set null,
  ran_at timestamptz not null default now()
);
-- H-3 and H-1 once per signing time; moving the schedule makes a new signing time.
create unique index agent_background_runs_once on public.agent_background_runs (schedule_id, stage, scheduled_for)
  where stage <> 'manual';
create index agent_background_runs_schedule_idx on public.agent_background_runs (schedule_id, ran_at desc);

revoke all on public.agent_background_runs from anon, authenticated;
grant select on public.agent_background_runs to authenticated;
alter table public.agent_background_runs enable row level security;
create policy agent_background_runs_aal2 on public.agent_background_runs as restrictive for all to authenticated
  using ((select private.aal_ok()));
create policy agent_background_runs_read on public.agent_background_runs for select to authenticated
  using (tenant_id = (select private.tenant_id()) and private.can_access_berkas(berkas_id));

-- ─────────────────────────────  The check  ─────────────────────────────

create function private.presigning_run(p_schedule uuid, p_stage text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  s public.schedules; b public.berkas; v_actor uuid; v_role public.app_role; v_old text;
  v_when timestamp; v_due date; v_label text; v_thread uuid; v_msg bigint;
  v_events jsonb := '[]'::jsonb; v_rows jsonb := '[]'::jsonb; v_findings jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb; v_props uuid[] := '{}'; v_cites integer := 0; v_seq integer := 0;
  r record; v_cite text; v_title text; v_count integer;
  c_months constant text[] := array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  c_status constant jsonb := '{"draft":"Draft","verifikasi":"Verifikasi","menunggu_ttd":"Menunggu TTD"}';
begin
  select * into s from public.schedules where id = p_schedule;
  if s.id is null or s.berkas_id is null or s.kind <> 'penandatanganan' then return null; end if;
  select * into b from public.berkas where id = s.berkas_id;
  if b.id is null or b.status <> 'aktif' then return null; end if;

  -- Act with the rights of the person in charge (else another active member, else the Notaris).
  select tm.user_id, tm.role into v_actor, v_role
    from public.tenant_members tm
    left join public.berkas_members m on m.berkas_id = b.id and m.user_id = tm.user_id and m.active
   where tm.tenant_id = b.tenant_id and tm.active and tm.role <> 'super_admin'
     and (tm.user_id = b.pic_user_id or m.user_id is not null or tm.role = 'notaris')
   order by (tm.user_id = b.pic_user_id) desc, (m.user_id is not null) desc, tm.created_at
   limit 1;
  if v_actor is null then return null; end if;
  v_old := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_actor, 'role', 'authenticated', 'aal', 'aal2', 'tenant_id', b.tenant_id,
    'app_role', v_role, 'verity_actor', 'agent')::text, true);

  v_when := s.starts_at at time zone 'Asia/Jakarta';
  v_due := greatest(v_when::date - 1, (now() at time zone 'Asia/Jakarta')::date);
  v_label := extract(day from v_when)::int || ' ' || c_months[extract(month from v_when)::int] || ' ' || extract(year from v_when)::int
             || ' pukul ' || to_char(v_when, 'HH24.MI') || ' WIB';

  -- Akta that are not final yet: status only reported; the Notaris decides on the akta page.
  for r in select a.id, a.title, a.status::text as status from public.akta a
            where a.berkas_id = b.id and a.status not in ('selesai', 'diarsipkan') order by a.created_at loop
    v_cites := v_cites + 1; v_cite := '[[c' || v_cites || ']]';
    v_events := v_events || jsonb_build_object('type', 'citation', 'seq', 0, 'marker', 'c' || v_cites,
      'target', jsonb_build_object('kind', 'akta', 'id', r.id, 'label', r.title, 'href', '/akta/' || r.id));
    v_rows := v_rows || jsonb_build_object('cells', jsonb_build_array('Status akta ' || v_cite, c_status ->> r.status),
      'tone', case when r.status = 'menunggu_ttd' then 'ok' else 'bad' end);
    if r.status <> 'menunggu_ttd' then
      v_findings := v_findings || to_jsonb(r.title || ' masih berstatus ' || (c_status ->> r.status)
        || '. Notaris perlu memeriksa dan menyetujuinya untuk penandatanganan langsung di halaman akta ' || v_cite || '.');
    end if;
  end loop;
  select count(*) into v_count from public.akta a where a.berkas_id = b.id and a.status not in ('selesai', 'diarsipkan');
  if v_count = 0 then
    v_findings := v_findings || to_jsonb('Belum ada akta yang akan ditandatangani di berkas ini.'::text);
    v_rows := v_rows || jsonb_build_object('cells', jsonb_build_array('Akta', 'Belum ada'), 'tone', 'bad');
  end if;

  -- Parties (except witnesses) of those akta: identity data and identity documents on file.
  for r in select distinct on (coalesce(p.person_id, p.company_id))
                  p.person_id, p.company_id, a.id as akta_id,
                  pe.full_name, pe.nik, pe.address, co.legal_form::text as legal_form, co.name as company, co.nib
             from public.akta_parties p join public.akta a on a.id = p.akta_id
             left join public.persons pe on pe.id = p.person_id left join public.companies co on co.id = p.company_id
            where a.berkas_id = b.id and a.status not in ('selesai', 'diarsipkan') and p.role <> 'saksi'
            order by coalesce(p.person_id, p.company_id), p.sort_order loop
    v_cites := v_cites + 1; v_cite := '[[c' || v_cites || ']]';
    if r.person_id is not null then
      v_events := v_events || jsonb_build_object('type', 'citation', 'seq', 0, 'marker', 'c' || v_cites,
        'target', jsonb_build_object('kind', 'person', 'id', r.person_id, 'label', r.full_name, 'href', '/akta/' || r.akta_id));
      v_title := case when r.nik is null then 'Paspor' else 'KTP' end;
      if not exists (
        select 1 from public.documents d
         where d.berkas_id = b.id
           and (d.doc_type = 'ktp' or (r.nik is null and d.doc_type = 'lainnya'))
           and exists (select 1 from regexp_split_to_table(lower(r.full_name), '\s+') t
                        where length(t) >= 3 and lower(d.title || ' ' || d.file_name) like '%' || t || '%')) then
        v_findings := v_findings || to_jsonb(v_title || ' ' || r.full_name || ' belum ada di berkas ' || v_cite || '.');
        if not exists (select 1 from public.checklist_items ci where ci.berkas_id = b.id and not ci.done
                        and lower(ci.title) = lower('Minta ' || v_title || ' ' || r.full_name)) then
          v_items := v_items || jsonb_build_object('op', 'checklist.add',
            'label', 'Tambah ke checklist: Minta ' || v_title || ' ' || r.full_name || ', tenggat ' || to_char(v_due, 'DD/MM/YYYY'),
            'params', jsonb_build_object('title', 'Minta ' || v_title || ' ' || r.full_name, 'due_date', v_due::text));
        end if;
        v_rows := v_rows || jsonb_build_object('cells', jsonb_build_array(r.full_name || ' ' || v_cite, v_title || ' belum ada'), 'tone', 'bad');
      elsif r.nik is null or r.address is null then
        v_rows := v_rows || jsonb_build_object('cells', jsonb_build_array(r.full_name || ' ' || v_cite,
          case when r.nik is null then 'Tanpa NIK (paspor ada)' else 'Alamat belum diisi' end), 'tone', 'warn');
      else
        v_rows := v_rows || jsonb_build_object('cells', jsonb_build_array(r.full_name || ' ' || v_cite, 'Data dan KTP lengkap'), 'tone', 'ok');
      end if;
      if r.address is null then
        v_findings := v_findings || to_jsonb('Alamat ' || r.full_name || ' belum tercatat ' || v_cite || '.');
      end if;
    else
      v_events := v_events || jsonb_build_object('type', 'citation', 'seq', 0, 'marker', 'c' || v_cites,
        'target', jsonb_build_object('kind', 'company', 'id', r.company_id, 'label', r.legal_form || ' ' || r.company, 'href', '/akta/' || r.akta_id));
      v_rows := v_rows || jsonb_build_object('cells', jsonb_build_array(r.legal_form || ' ' || r.company || ' ' || v_cite,
        case when r.nib is null then 'NIB belum diisi' else 'NIB ada' end), 'tone', case when r.nib is null then 'warn' else 'ok' end);
      if r.nib is null then
        v_findings := v_findings || to_jsonb('NIB ' || r.legal_form || ' ' || r.company || ' belum tercatat ' || v_cite || '.');
      end if;
    end if;
  end loop;

  -- Open checklist items due on or before the signing day.
  for r in select ci.id, ci.title, ci.due_date from public.checklist_items ci
            where ci.berkas_id = b.id and not ci.done and ci.due_date is not null and ci.due_date <= v_when::date
            order by ci.due_date limit 8 loop
    v_cites := v_cites + 1; v_cite := '[[c' || v_cites || ']]';
    v_events := v_events || jsonb_build_object('type', 'citation', 'seq', 0, 'marker', 'c' || v_cites,
      'target', jsonb_build_object('kind', 'checklist', 'id', r.id, 'label', r.title, 'href', '/berkas/' || b.id || '?tab=checklist'));
    v_findings := v_findings || to_jsonb('Checklist belum selesai: ' || r.title
      || case when r.due_date < (now() at time zone 'Asia/Jakarta')::date then ' (terlambat, tenggat ' else ' (tenggat ' end
      || to_char(r.due_date, 'DD/MM/YYYY') || ') ' || v_cite || '.');
  end loop;

  -- The conversation of the berkas (shared with its members), created if needed.
  select t.id into v_thread from public.agent_threads t
   where t.berkas_id = b.id and t.context ->> 'key' = 'berkas:' || b.id order by t.updated_at desc limit 1;
  if v_thread is null then
    insert into public.agent_threads (tenant_id, owner_user_id, berkas_id, context, title)
    values (b.tenant_id, v_actor, b.id, jsonb_build_object('key', 'berkas:' || b.id, 'label', 'Berkas: ' || b.title), 'Percakapan berkas')
    returning id into v_thread;
  end if;

  -- Proposals: checklist items only (staff tier), decided by a person.
  if jsonb_array_length(v_items) > 0 then
    select array_agg(x) into v_props from public.create_proposed_changes(b.id, v_items,
      'presign-' || s.id || '-' || p_stage || '-' || extract(epoch from s.starts_at)::bigint
        || case when p_stage = 'manual' then '-' || extract(epoch from clock_timestamp())::bigint else '' end,
      v_thread) x;
  end if;

  -- The message, in the same event contract as the chat agent (numbered in order below).
  v_events := jsonb_build_array(
      jsonb_build_object('type', 'step', 'id', 's1', 'label', 'Membaca jadwal, akta, pihak, dan dokumen', 'status', 'done'),
      jsonb_build_object('type', 'step', 'id', 's2', 'label', 'Memeriksa kelengkapan sebelum penandatanganan', 'status', 'done'))
    || v_events
    || jsonb_build_array(
      jsonb_build_object('type', 'text', 'blockId', 'b0', 'delta',
        case p_stage when 'h3' then 'Pemeriksaan otomatis H-3' when 'h1' then 'Pemeriksaan otomatis H-1' else 'Pemeriksaan atas permintaan' end
        || ' sebelum ' || s.title || ', ' || v_label || coalesce(' di ' || s.location, '') || '.'),
      jsonb_build_object('type', 'table', 'blockId', 't1', 'columns', jsonb_build_array('Pemeriksaan', 'Keadaan'), 'rows', v_rows));
  if jsonb_array_length(v_findings) = 0 then
    v_events := v_events || jsonb_build_array(jsonb_build_object('type', 'text', 'blockId', 'b1',
      'delta', 'Tidak ada kekurangan yang tercatat. Berkas tampak siap untuk penandatanganan.'));
  else
    v_events := v_events || jsonb_build_array(jsonb_build_object('type', 'text', 'blockId', 'b1',
      'delta', 'Ada ' || jsonb_array_length(v_findings) || ' hal yang perlu ditindaklanjuti sebelum penandatanganan:'));
    for r in select value #>> '{}' as t, ordinality as n from jsonb_array_elements(v_findings) with ordinality loop
      v_events := v_events || jsonb_build_array(jsonb_build_object('type', 'text', 'blockId', 'f' || r.n, 'delta', r.t));
    end loop;
  end if;
  v_events := v_events || jsonb_build_array(
      jsonb_build_object('type', 'text', 'blockId', 'b9', 'delta',
        'Verifikasi dan persetujuan akta tetap dilakukan Notaris langsung di halaman akta; saya hanya memeriksa dan menyiapkan usulan checklist.'))
    || case when coalesce(array_length(v_props, 1), 0) > 0
            then jsonb_build_array(jsonb_build_object('type', 'proposal', 'proposedChangeIds', to_jsonb(v_props))) else '[]'::jsonb end
    || jsonb_build_array(
      jsonb_build_object('type', 'suggestions', 'items', jsonb_build_array('cek kelengkapan dokumen pendiri', 'siapa saja pihaknya', 'apa yang kurang sebelum difinalkan?')),
      jsonb_build_object('type', 'done'));
  select coalesce(jsonb_agg(e || jsonb_build_object('seq', n - 1) order by n), '[]'::jsonb) into v_events
    from jsonb_array_elements(v_events) with ordinality as x(e, n);

  insert into public.agent_messages (tenant_id, thread_id, role, events, author_user_id)
  values (b.tenant_id, v_thread, 'agent', v_events, v_actor) returning id into v_msg;

  -- Everyone on the berkas plus the officials of its akta (never the Super Admin).
  insert into public.notifications (tenant_id, user_id, kind, payload)
  select distinct b.tenant_id, u.user_id, 'agent.presigning',
         jsonb_build_object('berkas_id', b.id, 'schedule_id', s.id, 'findings', jsonb_array_length(v_findings), 'stage', p_stage)
    from (select m.user_id from public.berkas_members m where m.berkas_id = b.id and m.active
          union select o.user_id from public.akta a join public.officials o on o.id = a.official_id
                 where a.berkas_id = b.id and a.status not in ('selesai', 'diarsipkan')) u
    join public.tenant_members tm on tm.tenant_id = b.tenant_id and tm.user_id = u.user_id and tm.active and tm.role <> 'super_admin';

  insert into public.agent_background_runs (tenant_id, berkas_id, schedule_id, stage, scheduled_for, findings, message_id)
  values (b.tenant_id, b.id, s.id, p_stage, s.starts_at, jsonb_array_length(v_findings), v_msg);
  perform private.audit(b.tenant_id, 'agent.presigning_checked', 'schedule', s.id, b.id,
                        jsonb_build_object('stage', p_stage, 'findings', jsonb_array_length(v_findings),
                                           'proposals', coalesce(array_length(v_props, 1), 0)));

  perform set_config('request.jwt.claims', coalesce(v_old, ''), true);
  return v_msg;
end $$;

-- Hourly: every signing within 72 hours gets its H-3 and its H-1 check once.
create function private.run_presigning_checks() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; v_done integer := 0; v_stage text;
begin
  for r in select s.id, s.starts_at from public.schedules s join public.berkas b on b.id = s.berkas_id
            where s.kind = 'penandatanganan' and b.status = 'aktif'
              and s.starts_at > now() and s.starts_at <= now() + interval '72 hours' loop
    v_stage := case when r.starts_at <= now() + interval '24 hours' then 'h1' else 'h3' end;
    continue when exists (select 1 from public.agent_background_runs x
                           where x.schedule_id = r.id and x.stage = v_stage and x.scheduled_for = r.starts_at);
    begin
      if private.presigning_run(r.id, v_stage) is not null then v_done := v_done + 1; end if;
    exception when others then
      raise warning 'presigning check % failed: %', r.id, sqlerrm;
    end;
  end loop;
  return v_done;
end $$;

-- "Periksa sekarang" from the schedule, for members of the berkas.
create function public.run_presigning_check(p_schedule uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare s public.schedules; v_msg bigint;
begin
  select * into s from public.schedules where id = p_schedule;
  if s.id is null or s.berkas_id is null or s.tenant_id is distinct from private.tenant_id()
     or not private.can_access_berkas(s.berkas_id) or not private.can_write_content(s.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if s.kind <> 'penandatanganan' then
    raise exception 'hanya untuk jadwal penandatanganan' using errcode = '22023';
  end if;
  v_msg := private.presigning_run(p_schedule, 'manual');
  if v_msg is null then raise exception 'berkas tidak aktif' using errcode = '22023'; end if;
  return v_msg;
end $$;

revoke execute on function private.presigning_run(uuid, text), private.run_presigning_checks() from public, anon, authenticated;
revoke execute on function public.run_presigning_check(uuid) from public, anon;
grant execute on function public.run_presigning_check(uuid) to authenticated;

-- ─────────────────────────────  Schedule (Supabase; skipped where pg_cron is absent)  ─────────────────────────────

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('verity-presigning', '5 * * * *', 'select private.run_presigning_checks()');
  end if;
end $$;
