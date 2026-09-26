-- Verity: two-step verification becomes optional for every role (owner decision 2026-09-26).
-- Anyone who HAS a verified factor must still complete it: until the session is aal2, RLS and
-- the privileged RPCs treat them exactly as before. Users without a factor pass at aal1.
-- Supersedes REQ-GW-05 ("2FA mandatory for Notaris, Partner, Super Admin"); see ADR 0005.

-- True when the session satisfies the user's own 2FA setting: verified at aal2, or no verified
-- factor enrolled. Reads auth.mfa_factors, so it is security definer.
create function private.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;
grant execute on function private.mfa_ok() to authenticated;

-- The restrictive "MFA gate" on every table now follows the user's own setting, for all roles.
create or replace function private.aal_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.mfa_ok()
$$;

-- Same functions as before, with "must be aal2" replaced by private.mfa_ok().
create or replace function public.transition_akta_status(p_akta uuid, p_to public.akta_status, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare a public.akta; v_notaris boolean; v_member boolean;
begin
  select * into a from public.akta where id = p_akta for update;
  if a.id is null or a.tenant_id is distinct from private.tenant_id() or not private.can_access_berkas(a.berkas_id)
     or not private.can_write_content(a.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_notaris := private.has_active_role(a.tenant_id, 'notaris') and private.mfa_ok();
  v_member := true;

  if (a.status, p_to) in (('draft', 'verifikasi'), ('verifikasi', 'draft')) then
    null;  -- any content member of the berkas
  elsif (a.status, p_to) in (('verifikasi', 'menunggu_ttd'), ('menunggu_ttd', 'verifikasi'), ('selesai', 'diarsipkan')) then
    if not v_notaris then
      raise exception 'hanya Notaris yang dapat mengubah status ini' using errcode = '42501';
    end if;
  elsif p_to = 'selesai' then
    raise exception 'akta difinalkan lewat finalize_akta' using errcode = '22023';
  else
    raise exception 'perpindahan status % ke % tidak diizinkan', a.status, p_to using errcode = '22023';
  end if;

  if p_to = 'menunggu_ttd' and not exists (
       select 1 from public.akta_parties p where p.akta_id = a.id and p.role <> 'saksi') then
    raise exception 'tambahkan minimal satu penghadap sebelum diajukan untuk tanda tangan' using errcode = '23514';
  end if;

  perform set_config('verity.akta_change', a.id::text, true);
  update public.akta set status = p_to where id = a.id;
  perform set_config('verity.akta_change', '', true);
  insert into public.akta_status_history (tenant_id, akta_id, from_status, to_status, note, changed_by)
  values (a.tenant_id, a.id, a.status, p_to, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  perform private.audit(a.tenant_id, 'akta.status_changed', 'akta', a.id, a.berkas_id,
                        jsonb_build_object('from', a.status, 'to', p_to));
end $$;

create or replace function public.finalize_akta(p_akta uuid, p_akta_date date)
returns table (akta_number integer, period text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare a public.akta; o public.officials; v_period text; v_no integer; v_entry uuid; v_summary text;
begin
  select * into a from public.akta where id = p_akta for update;
  if a.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  select * into o from public.officials where id = a.official_id;
  if a.tenant_id is distinct from private.tenant_id() or o.user_id is distinct from auth.uid()
     or not private.has_active_role(a.tenant_id, 'notaris') or not private.mfa_ok() then
    raise exception 'hanya pejabat akta ini yang dapat memfinalkan (selesaikan verifikasi dua langkah bila sudah dipasang)'
      using errcode = '42501';
  end if;
  if a.status <> 'menunggu_ttd' or a.number is not null then
    raise exception 'akta harus berstatus menunggu tanda tangan' using errcode = '22023';
  end if;
  if p_akta_date is null or p_akta_date > (now() at time zone o.timezone)::date then
    raise exception 'tanggal akta tidak valid' using errcode = '22023';
  end if;

  v_period := private.numbering_period(p_akta_date);
  insert into public.number_sequences as s (official_id, appointment, period, last_value)
       values (o.id, a.appointment, v_period, 1)
  on conflict (official_id, appointment, period) do update set last_value = s.last_value + 1
  returning last_value into v_no;

  perform set_config('verity.akta_change', a.id::text, true);
  update public.akta
     set number = v_no, number_period = v_period, akta_date = p_akta_date,
         status = 'selesai', finalized_at = now(), finalized_by = auth.uid()
   where id = a.id;
  perform set_config('verity.akta_change', '', true);

  select string_agg(coalesce(pe.full_name, co.legal_form::text || ' ' || co.name), '; ' order by p.sort_order, p.created_at)
    into v_summary
    from public.akta_parties p
    left join public.persons pe on pe.id = p.person_id
    left join public.companies co on co.id = p.company_id
   where p.akta_id = a.id and p.role <> 'saksi';

  insert into public.repertorium_entries (tenant_id, official_id, appointment, period, entry_no, akta_id, akta_number,
                                          akta_date, akta_type, title, parties_summary, created_by)
  values (a.tenant_id, o.id, a.appointment, v_period, v_no, a.id, v_no, p_akta_date, a.akta_type, a.title,
          coalesce(v_summary, '-'), auth.uid())
  returning id into v_entry;

  -- Klapper: every party except witnesses, indexed by name (PLAN.md N-04 to confirm).
  insert into public.klapper_entries (tenant_id, official_id, appointment, period, repertorium_entry_id, akta_id,
                                      indexed_name, entity_kind, initial_letter, party_role, akta_number, akta_date)
  select a.tenant_id, o.id, a.appointment, v_period, v_entry, a.id, n.name,
         case when p.person_id is not null then 'perorangan' else 'badan_usaha' end,
         case when upper(left(n.sort_name, 1)) ~ '^[A-Z]$' then upper(left(n.sort_name, 1)) else '#' end,
         p.role, v_no, p_akta_date
    from public.akta_parties p
    left join public.persons pe on pe.id = p.person_id
    left join public.companies co on co.id = p.company_id
    cross join lateral (select coalesce(pe.full_name, co.legal_form::text || ' ' || co.name) as name,
                               trim(coalesce(pe.full_name, co.name)) as sort_name) n
   where p.akta_id = a.id and p.role <> 'saksi';

  insert into public.akta_status_history (tenant_id, akta_id, from_status, to_status, changed_by)
  values (a.tenant_id, a.id, 'menunggu_ttd', 'selesai', auth.uid());
  perform private.audit(a.tenant_id, 'akta.finalized', 'akta', a.id, a.berkas_id,
                        jsonb_build_object('number', v_no, 'period', v_period));
  return query select v_no, v_period;
end $$;

create or replace function public.correct_repertorium_entry(p_entry uuid, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.repertorium_entries; v_id uuid;
begin
  select * into e from public.repertorium_entries where id = p_entry;
  if e.id is null or e.tenant_id is distinct from private.tenant_id()
     or not private.has_active_role(e.tenant_id, 'notaris') or not private.mfa_ok() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'jelaskan koreksinya' using errcode = '22023';
  end if;
  insert into public.repertorium_entries (tenant_id, official_id, appointment, period, entry_no, akta_id, akta_number,
                                          akta_date, akta_type, title, parties_summary, corrects_entry_id,
                                          correction_note, source, created_by)
  values (e.tenant_id, e.official_id, e.appointment, e.period, e.entry_no, e.akta_id, e.akta_number, e.akta_date,
          e.akta_type, e.title, e.parties_summary, e.id, trim(p_note), 'correction', auth.uid())
  returning id into v_id;
  perform private.audit(e.tenant_id, 'repertorium.corrected', 'repertorium_entry', v_id, null,
                        jsonb_build_object('corrects', e.id));
  return v_id;
end $$;

create or replace function public.verify_legal_reference(p_reference uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.legal_references;
begin
  select * into r from public.legal_references where id = p_reference;
  if r.id is null or r.tenant_id is distinct from private.tenant_id()
     or not private.has_active_role(r.tenant_id, 'notaris') or not private.mfa_ok() then
    raise exception 'hanya Notaris yang dapat memverifikasi dasar hukum' using errcode = '42501';
  end if;
  perform set_config('verity.legal_verify', r.id::text, true);
  update public.legal_references set verified_by = auth.uid(), verified_at = now() where id = r.id;
  perform set_config('verity.legal_verify', '', true);
end $$;

create or replace function private.can_approve_tier(p_tenant uuid, p_berkas uuid, p_tier text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_tier
    when 'staf' then private.can_write_content(p_tenant) and private.can_access_berkas(p_berkas)
    when 'notaris' then (private.has_active_role(p_tenant, 'notaris') or private.has_active_role(p_tenant, 'partner'))
                        and private.can_access_berkas(p_berkas) and private.mfa_ok()
    else false
  end
$$;

create or replace function private.is_office_admin(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (private.has_active_role(p_tenant, 'notaris') or private.has_active_role(p_tenant, 'super_admin'))
     and private.mfa_ok()
$$;
