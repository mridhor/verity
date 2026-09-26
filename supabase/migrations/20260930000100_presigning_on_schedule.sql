-- Pre-signing check right after a signing is scheduled (ADR 0006, "pemeriksaan awal").
-- A signing booked from chat (or the Jadwal page) is checked on commit, so the team learns what is
-- missing now rather than at H-3. The check itself is unchanged: report, notify, propose checklist.

alter table public.agent_background_runs drop constraint agent_background_runs_stage_check;
alter table public.agent_background_runs add constraint agent_background_runs_stage_check
  check (stage in ('awal', 'h3', 'h1', 'manual'));

-- Same check; only the opening line knows the new stage.
create or replace function private.presigning_run(p_schedule uuid, p_stage text) returns bigint
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
        case p_stage when 'h3' then 'Pemeriksaan otomatis H-3' when 'h1' then 'Pemeriksaan otomatis H-1'
                     when 'awal' then 'Penandatanganan sudah dijadwalkan. Pemeriksaan awal' else 'Pemeriksaan atas permintaan' end
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

-- The stage a signing is in now: the same H-3 / H-1 the hourly job uses, else the first check.
create function private.presigning_stage(p_starts_at timestamptz) returns text
language sql stable set search_path = '' as $$
  select case when p_starts_at <= now() + interval '24 hours' then 'h1'
              when p_starts_at <= now() + interval '72 hours' then 'h3'
              else 'awal' end
$$;

-- Runs at commit (deferred), after the proposal or dialog that made the schedule has finished.
-- A failed check never undoes the schedule. Re-reads the row: it may have changed or gone since.
create function private.presigning_on_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.schedules; v_stage text;
begin
  select * into s from public.schedules where id = new.id;
  if s.id is null or s.berkas_id is null or s.kind <> 'penandatanganan' or s.starts_at <= now() then return null; end if;
  v_stage := private.presigning_stage(s.starts_at);
  if exists (select 1 from public.agent_background_runs x
              where x.schedule_id = s.id and x.stage = v_stage and x.scheduled_for = s.starts_at) then return null; end if;
  begin
    perform private.presigning_run(s.id, v_stage);
  exception when others then
    raise warning 'presigning check % failed: %', s.id, sqlerrm;
  end;
  return null;
end $$;

create constraint trigger schedules_presigning after insert or update of starts_at, kind, berkas_id on public.schedules
  deferrable initially deferred for each row
  when (new.kind = 'penandatanganan' and new.berkas_id is not null)
  execute function private.presigning_on_schedule();

revoke execute on function private.presigning_stage(timestamptz), private.presigning_on_schedule() from public, anon, authenticated;
