-- Verity Phase 1: system of record. PLAN.md §6, rules 2 and 6.
--   * persons / companies: master data per tenant (PRD-B-03)
--   * akta + parties + status history; number assigned ONLY inside finalize_akta()
--   * repertorium and klapper: generated at finalization, append-only at DB level
--   * checklist per berkas
-- Administrative tables allow direct writes under RLS and are audited by trigger; akta status,
-- numbering and registers change only through SECURITY DEFINER functions.

-- ─────────────────────────────  Shared helpers  ─────────────────────────────

-- A human member of the active tenant with a content role (every role except super_admin).
create function private.can_write_content(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_tenant = private.tenant_id()
     and private.app_role() is not null
     and private.app_role() <> 'super_admin'
     and private.has_active_role(p_tenant, private.app_role())
$$;

create function private.can_read_content(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_write_content(p_tenant)
$$;

create function private.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- Fill tenant_id from the verified claim on insert (RLS `with check` still verifies it).
create function private.set_tenant_from_claim() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tenant_id is null then new.tenant_id := private.tenant_id(); end if;
  return new;
end $$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Generic audit for administrative tables. Records ids and changed column NAMES only,
-- never values (rule 9: no client content in the audit log).
create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb; v_changed jsonb := '[]'::jsonb;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb) into v_changed
      from jsonb_each(to_jsonb(new)) as n(key, value)
      join jsonb_each(to_jsonb(old)) as o(key, value) using (key)
     where n.value is distinct from o.value and n.key <> 'updated_at';
    if v_changed = '[]'::jsonb then return null; end if;
  end if;
  perform private.audit(
    (r ->> 'tenant_id')::uuid,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    private.try_uuid(r ->> 'id'),
    private.try_uuid(r ->> 'berkas_id'),
    case when tg_op = 'UPDATE' then jsonb_build_object('changed', v_changed) else '{}'::jsonb end);
  return null;
end $$;

grant execute on function private.can_write_content(uuid), private.can_read_content(uuid), private.try_uuid(text)
  to authenticated;

-- ─────────────────────────────  Types  ─────────────────────────────

create type public.akta_status as enum ('draft', 'verifikasi', 'menunggu_ttd', 'selesai', 'diarsipkan');
create type public.party_role as enum ('penghadap', 'pihak_pertama', 'pihak_kedua', 'kuasa', 'saksi');
create type public.company_form as enum ('PT', 'CV', 'Firma', 'Yayasan', 'Koperasi', 'Perkumpulan', 'Lainnya');

-- ─────────────────────────────  Persons and companies  ─────────────────────────────

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  full_name text not null check (length(trim(full_name)) between 2 and 200),
  nik text check (nik ~ '^[0-9]{16}$'),
  birth_place text,
  birth_date date,
  address text,
  occupation text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index persons_tenant_nik_key on public.persons (tenant_id, nik) where nik is not null;
create index persons_tenant_name_idx on public.persons (tenant_id, lower(full_name));

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  name text not null check (length(trim(name)) between 2 and 200),
  legal_form public.company_form not null default 'PT',
  nib text check (nib ~ '^[0-9]{13}$'),
  npwp text,
  domicile text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index companies_tenant_nib_key on public.companies (tenant_id, nib) where nib is not null;
create index companies_tenant_name_idx on public.companies (tenant_id, lower(name));

-- ─────────────────────────────  Akta  ─────────────────────────────

create table public.akta (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  berkas_id uuid not null references public.berkas (id) on delete restrict,
  official_id uuid not null references public.officials (id),
  appointment public.appointment not null,
  akta_type text not null check (length(trim(akta_type)) between 2 and 60),
  title text not null check (length(trim(title)) between 2 and 300),
  notes text,
  status public.akta_status not null default 'draft',
  number integer check (number > 0),
  number_period text,
  akta_date date,
  finalized_at timestamptz,
  finalized_by uuid,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A number exists exactly when the akta is final (PRD-R-03).
  constraint akta_number_only_when_final
    check ((number is null) = (status in ('draft', 'verifikasi', 'menunggu_ttd'))),
  constraint akta_number_unique unique (official_id, appointment, number_period, number)
);
create index akta_berkas_idx on public.akta (berkas_id);
create index akta_tenant_status_idx on public.akta (tenant_id, status);
create index akta_tenant_date_idx on public.akta (tenant_id, akta_date);

create table public.akta_parties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  akta_id uuid not null references public.akta (id) on delete cascade,
  person_id uuid references public.persons (id),
  company_id uuid references public.companies (id),
  role public.party_role not null,
  capacity text,
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint akta_parties_one_subject check ((person_id is null) <> (company_id is null))
);
create index akta_parties_akta_idx on public.akta_parties (akta_id);

create table public.akta_status_history (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id),
  akta_id uuid not null references public.akta (id) on delete cascade,
  from_status public.akta_status,
  to_status public.akta_status not null,
  note text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index akta_status_history_akta_idx on public.akta_status_history (akta_id, id);

create table public.number_sequences (
  official_id uuid not null references public.officials (id),
  appointment public.appointment not null,
  period text not null,
  last_value integer not null check (last_value >= 0),
  primary key (official_id, appointment, period)
);

-- ─────────────────────────────  Registers (append-only)  ─────────────────────────────

create table public.repertorium_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  official_id uuid not null references public.officials (id),
  appointment public.appointment not null,
  period text not null,
  entry_no integer not null,
  akta_id uuid references public.akta (id),
  akta_number integer not null,
  akta_date date not null,
  akta_type text not null,
  title text not null,
  parties_summary text not null,
  corrects_entry_id uuid references public.repertorium_entries (id),
  correction_note text,
  source text not null default 'system' check (source in ('system', 'legacy_import', 'correction')),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint repertorium_correction_shape
    check ((source = 'correction') = (corrects_entry_id is not null and correction_note is not null))
);
create unique index repertorium_entry_key on public.repertorium_entries (official_id, appointment, period, entry_no)
  where corrects_entry_id is null;
create index repertorium_tenant_idx on public.repertorium_entries (tenant_id, period, entry_no);

create table public.klapper_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  official_id uuid not null references public.officials (id),
  appointment public.appointment not null,
  period text not null,
  repertorium_entry_id uuid not null references public.repertorium_entries (id),
  akta_id uuid references public.akta (id),
  indexed_name text not null,
  entity_kind text not null check (entity_kind in ('perorangan', 'badan_usaha')),
  initial_letter text not null check (initial_letter ~ '^[A-Z#]$'),
  party_role public.party_role not null,
  akta_number integer not null,
  akta_date date not null,
  created_at timestamptz not null default now()
);
create index klapper_tenant_letter_idx on public.klapper_entries (tenant_id, initial_letter, indexed_name);

-- ─────────────────────────────  Checklist  ─────────────────────────────

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  berkas_id uuid not null references public.berkas (id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 300),
  assignee_user_id uuid references auth.users (id),
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checklist_items_berkas_idx on public.checklist_items (berkas_id, created_at);

-- ─────────────────────────────  Integrity triggers  ─────────────────────────────

-- Akta: derive tenant and appointment; block any status/number/finalization change that does
-- not come from transition_akta_status() or finalize_akta() (rule 2 and 6).
create function private.guard_akta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_official public.officials; v_berkas_tenant uuid;
begin
  if tg_op = 'INSERT' then
    select * into v_official from public.officials where id = new.official_id;
    select tenant_id into v_berkas_tenant from public.berkas where id = new.berkas_id;
    if v_official.id is null or not v_official.active or v_official.tenant_id is distinct from v_berkas_tenant then
      raise exception 'pejabat tidak valid untuk berkas ini' using errcode = '23514';
    end if;
    new.tenant_id := v_berkas_tenant;
    new.appointment := v_official.appointment;
    if new.status <> 'draft' or new.number is not null or new.number_period is not null
       or new.akta_date is not null or new.finalized_at is not null then
      raise exception 'akta baru harus berstatus draft tanpa nomor' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.tenant_id is distinct from old.tenant_id or new.berkas_id is distinct from old.berkas_id
     or new.official_id is distinct from old.official_id or new.appointment is distinct from old.appointment then
    raise exception 'berkas, kantor dan pejabat akta tidak dapat diubah' using errcode = '42501';
  end if;
  if old.number is not null and (new.number is distinct from old.number
        or new.number_period is distinct from old.number_period or new.akta_date is distinct from old.akta_date) then
    raise exception 'nomor akta tidak dapat diubah' using errcode = '42501';
  end if;
  if (new.status is distinct from old.status or new.number is distinct from old.number
      or new.number_period is distinct from old.number_period or new.akta_date is distinct from old.akta_date
      or new.finalized_at is distinct from old.finalized_at or new.finalized_by is distinct from old.finalized_by)
     and current_setting('verity.akta_change', true) is distinct from old.id::text then
    raise exception 'status dan nomor akta hanya berubah lewat alur status' using errcode = '42501';
  end if;
  if old.status not in ('draft', 'verifikasi')
     and (new.title is distinct from old.title or new.akta_type is distinct from old.akta_type
          or new.notes is distinct from old.notes) then
    raise exception 'akta yang sudah diajukan tidak dapat diedit' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger akta_guard before insert or update on public.akta
  for each row execute function private.guard_akta();
create trigger akta_touch before update on public.akta
  for each row execute function private.touch_updated_at();

-- Parties can change only while the akta is still being drafted or verified.
create function private.guard_akta_party() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_akta public.akta; v_subject_tenant uuid; r public.akta_parties;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  select * into v_akta from public.akta where id = r.akta_id;
  if v_akta.id is null then return r; end if;  -- cascade from a deleted draft
  if v_akta.status not in ('draft', 'verifikasi') then
    raise exception 'pihak akta terkunci setelah diajukan untuk tanda tangan' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' then
    new.tenant_id := v_akta.tenant_id;
    if new.person_id is not null then
      select tenant_id into v_subject_tenant from public.persons where id = new.person_id;
    else
      select tenant_id into v_subject_tenant from public.companies where id = new.company_id;
    end if;
    if v_subject_tenant is distinct from v_akta.tenant_id then
      raise exception 'pihak berasal dari kantor lain' using errcode = '23514';
    end if;
    return new;
  end if;
  return old;
end $$;
create trigger akta_parties_guard before insert or update or delete on public.akta_parties
  for each row execute function private.guard_akta_party();

create function private.check_checklist_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select b.tenant_id into new.tenant_id from public.berkas b where b.id = new.berkas_id;
  if new.done and not coalesce(old.done, false) then
    new.done_at := now();
    new.done_by := auth.uid();
  elsif not new.done then
    new.done_at := null;
    new.done_by := null;
  end if;
  return new;
end $$;
create trigger checklist_items_check before insert or update on public.checklist_items
  for each row execute function private.check_checklist_item();
create trigger checklist_items_touch before update on public.checklist_items
  for each row execute function private.touch_updated_at();

create trigger persons_tenant before insert on public.persons
  for each row execute function private.set_tenant_from_claim();
create trigger companies_tenant before insert on public.companies
  for each row execute function private.set_tenant_from_claim();
create trigger persons_touch before update on public.persons
  for each row execute function private.touch_updated_at();
create trigger companies_touch before update on public.companies
  for each row execute function private.touch_updated_at();

-- Append-only registers and history (rule 6).
create trigger repertorium_no_update before update or delete on public.repertorium_entries
  for each row execute function private.reject_mutation();
create trigger repertorium_no_truncate before truncate on public.repertorium_entries
  for each statement execute function private.reject_mutation();
create trigger klapper_no_update before update or delete on public.klapper_entries
  for each row execute function private.reject_mutation();
create trigger klapper_no_truncate before truncate on public.klapper_entries
  for each statement execute function private.reject_mutation();
create trigger akta_status_history_no_update before update on public.akta_status_history
  for each row execute function private.reject_mutation();
create trigger akta_status_history_no_truncate before truncate on public.akta_status_history
  for each statement execute function private.reject_mutation();

-- Audit of administrative writes.
create trigger persons_audit after insert or update or delete on public.persons
  for each row execute function private.audit_row();
create trigger companies_audit after insert or update or delete on public.companies
  for each row execute function private.audit_row();
create trigger akta_audit after insert or update or delete on public.akta
  for each row execute function private.audit_row();
create trigger akta_parties_audit after insert or update or delete on public.akta_parties
  for each row execute function private.audit_row();
create trigger checklist_items_audit after insert or update or delete on public.checklist_items
  for each row execute function private.audit_row();

-- ─────────────────────────────  Grants and RLS  ─────────────────────────────

revoke all on public.persons, public.companies, public.akta, public.akta_parties, public.akta_status_history,
  public.number_sequences, public.repertorium_entries, public.klapper_entries, public.checklist_items
  from anon, authenticated;
revoke insert, update, delete, truncate on public.repertorium_entries, public.klapper_entries,
  public.akta_status_history, public.number_sequences from service_role;

grant select, insert, update on public.persons, public.companies to authenticated;
grant select on public.akta, public.akta_status_history, public.repertorium_entries, public.klapper_entries
  to authenticated;
grant insert (berkas_id, official_id, akta_type, title, notes) on public.akta to authenticated;
grant update (akta_type, title, notes) on public.akta to authenticated;
grant delete on public.akta to authenticated;
grant select, insert, delete on public.akta_parties to authenticated;
grant select, insert, update, delete on public.checklist_items to authenticated;

alter table public.persons enable row level security;
alter table public.companies enable row level security;
alter table public.akta enable row level security;
alter table public.akta_parties enable row level security;
alter table public.akta_status_history enable row level security;
alter table public.number_sequences enable row level security;
alter table public.repertorium_entries enable row level security;
alter table public.klapper_entries enable row level security;
alter table public.checklist_items enable row level security;

create policy persons_aal2 on public.persons as restrictive for all to authenticated using ((select private.aal_ok()));
create policy companies_aal2 on public.companies as restrictive for all to authenticated using ((select private.aal_ok()));
create policy akta_aal2 on public.akta as restrictive for all to authenticated using ((select private.aal_ok()));
create policy akta_parties_aal2 on public.akta_parties as restrictive for all to authenticated using ((select private.aal_ok()));
create policy akta_status_history_aal2 on public.akta_status_history as restrictive for all to authenticated using ((select private.aal_ok()));
create policy repertorium_aal2 on public.repertorium_entries as restrictive for all to authenticated using ((select private.aal_ok()));
create policy klapper_aal2 on public.klapper_entries as restrictive for all to authenticated using ((select private.aal_ok()));
create policy checklist_items_aal2 on public.checklist_items as restrictive for all to authenticated using ((select private.aal_ok()));

-- Master data: shared within the tenant (PRD-B-03), never visible to super_admin.
create policy persons_read on public.persons for select to authenticated using (private.can_read_content(tenant_id));
create policy persons_insert on public.persons for insert to authenticated with check (private.can_write_content(tenant_id));
create policy persons_update on public.persons for update to authenticated
  using (private.can_write_content(tenant_id)) with check (private.can_write_content(tenant_id));
create policy companies_read on public.companies for select to authenticated using (private.can_read_content(tenant_id));
create policy companies_insert on public.companies for insert to authenticated with check (private.can_write_content(tenant_id));
create policy companies_update on public.companies for update to authenticated
  using (private.can_write_content(tenant_id)) with check (private.can_write_content(tenant_id));

-- Akta: follows berkas access.
create policy akta_read on public.akta for select to authenticated
  using (tenant_id = (select private.tenant_id()) and private.can_access_berkas(berkas_id));
create policy akta_insert on public.akta for insert to authenticated
  with check (private.can_access_berkas(berkas_id)
              and private.can_write_content((select b.tenant_id from public.berkas b where b.id = berkas_id)));
create policy akta_update on public.akta for update to authenticated
  using (private.can_access_berkas(berkas_id) and private.can_write_content(tenant_id) and status in ('draft', 'verifikasi'))
  with check (private.can_access_berkas(berkas_id) and private.can_write_content(tenant_id));
-- Only drafts that never had a number can be removed, by their creator or the Notaris.
create policy akta_delete on public.akta for delete to authenticated
  using (status = 'draft' and number is null and private.can_access_berkas(berkas_id)
         and private.can_write_content(tenant_id)
         and (created_by = (select auth.uid()) or private.has_active_role(tenant_id, 'notaris')));

create policy akta_parties_read on public.akta_parties for select to authenticated
  using (exists (select 1 from public.akta a where a.id = akta_id and private.can_access_berkas(a.berkas_id)));
create policy akta_parties_insert on public.akta_parties for insert to authenticated
  with check (exists (select 1 from public.akta a where a.id = akta_id
                      and private.can_access_berkas(a.berkas_id) and private.can_write_content(a.tenant_id)));
create policy akta_parties_delete on public.akta_parties for delete to authenticated
  using (exists (select 1 from public.akta a where a.id = akta_id
                 and private.can_access_berkas(a.berkas_id) and private.can_write_content(a.tenant_id)));

create policy akta_status_history_read on public.akta_status_history for select to authenticated
  using (exists (select 1 from public.akta a where a.id = akta_id and private.can_access_berkas(a.berkas_id)));

-- Registers: the Notaris sees everything; others see entries of akta in berkas they can access.
create policy repertorium_read on public.repertorium_entries for select to authenticated
  using (tenant_id = (select private.tenant_id())
         and (private.has_active_role(tenant_id, 'notaris')
              or exists (select 1 from public.akta a where a.id = akta_id and private.can_access_berkas(a.berkas_id))));
create policy klapper_read on public.klapper_entries for select to authenticated
  using (tenant_id = (select private.tenant_id())
         and (private.has_active_role(tenant_id, 'notaris')
              or exists (select 1 from public.akta a where a.id = akta_id and private.can_access_berkas(a.berkas_id))));

create policy checklist_read on public.checklist_items for select to authenticated
  using (tenant_id = (select private.tenant_id()) and private.can_access_berkas(berkas_id));
create policy checklist_insert on public.checklist_items for insert to authenticated
  with check (private.can_access_berkas(berkas_id)
              and private.can_write_content((select b.tenant_id from public.berkas b where b.id = berkas_id)));
create policy checklist_update on public.checklist_items for update to authenticated
  using (private.can_access_berkas(berkas_id) and private.can_write_content(tenant_id))
  with check (private.can_access_berkas(berkas_id) and private.can_write_content(tenant_id));
create policy checklist_delete on public.checklist_items for delete to authenticated
  using (private.can_access_berkas(berkas_id) and private.can_write_content(tenant_id));

-- ─────────────────────────────  Akta status workflow  ─────────────────────────────

-- Allowed moves (PRD §4: the Notaris approves akta status changes; staff may only submit and
-- withdraw a draft for verification). Finalization is a separate function.
create function public.transition_akta_status(p_akta uuid, p_to public.akta_status, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare a public.akta; v_notaris boolean; v_member boolean;
begin
  select * into a from public.akta where id = p_akta for update;
  if a.id is null or a.tenant_id is distinct from private.tenant_id() or not private.can_access_berkas(a.berkas_id)
     or not private.can_write_content(a.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_notaris := private.has_active_role(a.tenant_id, 'notaris') and (auth.jwt() ->> 'aal') = 'aal2';
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

-- Display period for numbering. Yearly until the Notaris confirms the office practice (PLAN.md N-01).
create function private.numbering_period(p_date date) returns text
language sql immutable set search_path = '' as $$
  select to_char(p_date, 'YYYY')
$$;

-- Finalization: the ONLY place an akta number is assigned (PRD-R-03, REQ-SOR-02). Human
-- Notaris session with MFA, the official of the akta, one transaction with a row lock on the
-- counter; repertorium and klapper entries are written in the same transaction.
create function public.finalize_akta(p_akta uuid, p_akta_date date)
returns table (akta_number integer, period text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare a public.akta; o public.officials; v_period text; v_no integer; v_entry uuid; v_summary text;
begin
  select * into a from public.akta where id = p_akta for update;
  if a.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  select * into o from public.officials where id = a.official_id;
  if a.tenant_id is distinct from private.tenant_id() or o.user_id is distinct from auth.uid()
     or not private.has_active_role(a.tenant_id, 'notaris') or (auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'hanya pejabat akta ini, dengan verifikasi dua langkah, yang dapat memfinalkan'
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

-- Register correction: a new entry referencing the original; the original never changes (PRD-R-02).
create function public.correct_repertorium_entry(p_entry uuid, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.repertorium_entries; v_id uuid;
begin
  select * into e from public.repertorium_entries where id = p_entry;
  if e.id is null or e.tenant_id is distinct from private.tenant_id()
     or not private.has_active_role(e.tenant_id, 'notaris') or (auth.jwt() ->> 'aal') is distinct from 'aal2' then
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

revoke execute on function public.transition_akta_status(uuid, public.akta_status, text),
  public.finalize_akta(uuid, date), public.correct_repertorium_entry(uuid, text) from public, anon;
grant execute on function public.transition_akta_status(uuid, public.akta_status, text),
  public.finalize_akta(uuid, date), public.correct_repertorium_entry(uuid, text) to authenticated;
revoke execute on function private.audit_row(), private.guard_akta(), private.guard_akta_party(),
  private.check_checklist_item(), private.set_tenant_from_claim() from public, anon, authenticated;
