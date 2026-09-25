-- Verity: office operations modules from the earlier prototype (docs/old-version/old.jsx),
-- rebuilt on the same access rules: Jadwal, Dokumen/Minuta, Transfer Protokol, Dasar Hukum.

create type public.schedule_kind as enum ('pertemuan_klien', 'penandatanganan', 'internal');
create type public.document_type as enum
  ('minuta', 'salinan', 'ktp', 'kk', 'npwp', 'sertifikat', 'akta_lama', 'surat_kuasa', 'lainnya');
create type public.protokol_status as enum ('dalam_proses', 'diterima');
create type public.legal_category as enum
  ('undang_undang', 'peraturan_pemerintah', 'peraturan_presiden', 'peraturan_menteri', 'peraturan_daerah',
   'putusan_pengadilan', 'surat_edaran', 'lainnya');
create type public.legal_status as enum ('berlaku', 'diubah', 'dicabut');

-- ─────────────────────────────  Jadwal  ─────────────────────────────

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  berkas_id uuid references public.berkas (id) on delete cascade,
  kind public.schedule_kind not null,
  title text not null check (length(trim(title)) between 2 and 200),
  starts_at timestamptz not null,
  location text,
  notes text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index schedules_tenant_start_idx on public.schedules (tenant_id, starts_at);

-- ─────────────────────────────  Dokumen / minuta  ─────────────────────────────

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  berkas_id uuid not null references public.berkas (id) on delete restrict,
  akta_id uuid references public.akta (id) on delete set null,
  doc_type public.document_type not null,
  title text not null check (length(trim(title)) between 1 and 200),
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid not null default auth.uid(),
  uploaded_at timestamptz not null default now()
);
create index documents_berkas_idx on public.documents (berkas_id, uploaded_at desc);
create index documents_tenant_type_idx on public.documents (tenant_id, doc_type);

-- ─────────────────────────────  Transfer protokol  ─────────────────────────────

-- Protokol received from another (retired, moved or deceased) Notaris (PLAN.md N-03).
create table public.protokol_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  source_notaris_name text not null check (length(trim(source_notaris_name)) between 2 and 200),
  sk_ref text,
  wilayah text,
  handover_date date not null,
  akta_count integer not null default 0 check (akta_count >= 0),
  year_range text,
  status public.protokol_status not null default 'dalam_proses',
  notes text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_by uuid,
  completed_at timestamptz
);

-- ─────────────────────────────  Dasar hukum  ─────────────────────────────

-- Reference library. Entries stay "belum terverifikasi" until a Notaris verifies them (rule 8).
create table public.legal_references (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  category public.legal_category not null,
  number_label text not null check (length(trim(number_label)) between 1 and 120),
  title text not null check (length(trim(title)) between 3 and 400),
  year integer check (year between 1800 and 2100),
  status public.legal_status not null default 'berlaku',
  source_url text check (source_url is null or source_url ~ '^https://'),
  notes text,
  verified_by uuid,
  verified_at timestamptz,
  created_by uuid default auth.uid(),  -- null for entries seeded by the system
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index legal_references_tenant_idx on public.legal_references (tenant_id, category, year desc);

create table public.legal_bookmarks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reference_id uuid not null references public.legal_references (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, reference_id)
);

-- ─────────────────────────────  Triggers  ─────────────────────────────

create function private.set_tenant_from_berkas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.berkas_id is not null then
    select b.tenant_id into new.tenant_id from public.berkas b where b.id = new.berkas_id;
  elsif new.tenant_id is null then
    new.tenant_id := private.tenant_id();
  end if;
  return new;
end $$;
create trigger schedules_tenant before insert or update on public.schedules
  for each row execute function private.set_tenant_from_berkas();

create function private.check_document() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_akta_berkas uuid;
begin
  select b.tenant_id into new.tenant_id from public.berkas b where b.id = new.berkas_id;
  if new.akta_id is not null then
    select a.berkas_id into v_akta_berkas from public.akta a where a.id = new.akta_id;
    if v_akta_berkas is distinct from new.berkas_id then
      raise exception 'akta tidak termasuk dalam berkas ini' using errcode = '23514';
    end if;
  end if;
  -- Files live at <tenant>/<berkas>/<uuid>/<name> so storage policies can check access.
  if split_part(new.storage_path, '/', 1) <> new.tenant_id::text
     or split_part(new.storage_path, '/', 2) <> new.berkas_id::text then
    raise exception 'lokasi file tidak sesuai berkas' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger documents_check before insert on public.documents
  for each row execute function private.check_document();
-- Documents are records of what was received and signed; they are never edited or removed
-- through the API (minuta belong to the protokol, PLAN.md N-07).
create trigger documents_no_update before update or delete on public.documents
  for each row execute function private.reject_mutation();

-- Named "a_..." because Postgres fires same-event triggers in name order; tenant_id must be set
-- before the check trigger reads it.
create trigger a_protokol_transfers_tenant before insert on public.protokol_transfers
  for each row execute function private.set_tenant_from_claim();

create function private.check_protokol_transfer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.tenants t where t.id = new.tenant_id and t.kind = 'kantor_notaris') then
    raise exception 'protokol hanya untuk kantor notaris' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.status = 'diterima' then
    raise exception 'serah terima yang sudah diterima tidak dapat diubah' using errcode = '42501';
  end if;
  if new.status = 'diterima' and (tg_op = 'INSERT' or old.status <> 'diterima') then
    new.completed_by := auth.uid();
    new.completed_at := now();
  end if;
  return new;
end $$;
create trigger protokol_transfers_check before insert or update on public.protokol_transfers
  for each row execute function private.check_protokol_transfer();

create trigger a_legal_references_tenant before insert on public.legal_references
  for each row execute function private.set_tenant_from_claim();
create trigger legal_references_touch before update on public.legal_references
  for each row execute function private.touch_updated_at();

-- Verification fields can only be set by the verify RPC, and any content edit clears them so
-- an edited reference goes back to "belum terverifikasi".
create function private.guard_legal_reference() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('verity.legal_verify', true) is distinct from coalesce(new.id::text, '') then
    if tg_op = 'INSERT' then
      new.verified_by := null;
      new.verified_at := null;
    elsif (new.category, new.number_label, new.title, new.year, new.status, new.source_url)
          is distinct from (old.category, old.number_label, old.title, old.year, old.status, old.source_url) then
      new.verified_by := null;
      new.verified_at := null;
    else
      new.verified_by := old.verified_by;
      new.verified_at := old.verified_at;
    end if;
  end if;
  return new;
end $$;
create trigger legal_references_guard before insert or update on public.legal_references
  for each row execute function private.guard_legal_reference();

create trigger schedules_audit after insert or update or delete on public.schedules
  for each row execute function private.audit_row();
create trigger documents_audit after insert on public.documents
  for each row execute function private.audit_row();
create trigger protokol_transfers_audit after insert or update on public.protokol_transfers
  for each row execute function private.audit_row();
create trigger legal_references_audit after insert or update or delete on public.legal_references
  for each row execute function private.audit_row();

-- ─────────────────────────────  Grants and RLS  ─────────────────────────────

revoke all on public.schedules, public.documents, public.protokol_transfers, public.legal_references,
  public.legal_bookmarks from anon, authenticated;
grant select, insert, update, delete on public.schedules to authenticated;
grant select on public.documents to authenticated;
grant select, insert, update on public.protokol_transfers to authenticated;
grant select, insert, update, delete on public.legal_references to authenticated;
grant select, insert, delete on public.legal_bookmarks to authenticated;

alter table public.schedules enable row level security;
alter table public.documents enable row level security;
alter table public.protokol_transfers enable row level security;
alter table public.legal_references enable row level security;
alter table public.legal_bookmarks enable row level security;

create policy schedules_aal2 on public.schedules as restrictive for all to authenticated using ((select private.aal_ok()));
create policy documents_aal2 on public.documents as restrictive for all to authenticated using ((select private.aal_ok()));
create policy protokol_aal2 on public.protokol_transfers as restrictive for all to authenticated using ((select private.aal_ok()));
create policy legal_references_aal2 on public.legal_references as restrictive for all to authenticated using ((select private.aal_ok()));
create policy legal_bookmarks_aal2 on public.legal_bookmarks as restrictive for all to authenticated using ((select private.aal_ok()));

-- Jadwal linked to a berkas follow berkas access; office-wide agenda is visible to the tenant.
create policy schedules_read on public.schedules for select to authenticated
  using (private.can_read_content(tenant_id) and (berkas_id is null or private.can_access_berkas(berkas_id)));
create policy schedules_insert on public.schedules for insert to authenticated
  with check (private.can_write_content(tenant_id) and (berkas_id is null or private.can_access_berkas(berkas_id)));
create policy schedules_update on public.schedules for update to authenticated
  using (private.can_write_content(tenant_id) and (berkas_id is null or private.can_access_berkas(berkas_id))
         and (created_by = (select auth.uid()) or private.has_active_role(tenant_id, 'notaris')))
  with check (private.can_write_content(tenant_id) and (berkas_id is null or private.can_access_berkas(berkas_id)));
create policy schedules_delete on public.schedules for delete to authenticated
  using (private.can_write_content(tenant_id) and (berkas_id is null or private.can_access_berkas(berkas_id))
         and (created_by = (select auth.uid()) or private.has_active_role(tenant_id, 'notaris')));

create policy documents_read on public.documents for select to authenticated
  using (tenant_id = (select private.tenant_id()) and private.can_access_berkas(berkas_id));

create policy protokol_read on public.protokol_transfers for select to authenticated
  using (private.can_read_content(tenant_id));
create policy protokol_insert on public.protokol_transfers for insert to authenticated
  with check (private.has_active_role(tenant_id, 'notaris'));
create policy protokol_update on public.protokol_transfers for update to authenticated
  using (private.has_active_role(tenant_id, 'notaris')) with check (private.has_active_role(tenant_id, 'notaris'));

-- Public legal material: every member of the tenant, including the Super Admin, may read it.
create policy legal_references_read on public.legal_references for select to authenticated
  using (private.is_tenant_member(tenant_id) and tenant_id = (select private.tenant_id()));
create policy legal_references_insert on public.legal_references for insert to authenticated
  with check (private.can_write_content(tenant_id));
create policy legal_references_update on public.legal_references for update to authenticated
  using (private.can_write_content(tenant_id) and (verified_by is null or private.has_active_role(tenant_id, 'notaris')))
  with check (private.can_write_content(tenant_id));
create policy legal_references_delete on public.legal_references for delete to authenticated
  using (private.can_write_content(tenant_id) and verified_by is null
         and (created_by = (select auth.uid()) or private.has_active_role(tenant_id, 'notaris')));

create policy legal_bookmarks_own on public.legal_bookmarks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.legal_references r where r.id = reference_id
                          and r.tenant_id = (select private.tenant_id())));

-- ─────────────────────────────  RPCs  ─────────────────────────────

-- Registers a file already uploaded to the `documents` bucket (the upload itself is checked by
-- the storage policies below).
create function public.register_document(
  p_berkas uuid, p_akta uuid, p_doc_type public.document_type, p_title text,
  p_file_name text, p_storage_path text, p_mime_type text, p_size_bytes bigint
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_id uuid; v_uploaded boolean := true;
begin
  select b.tenant_id into v_tenant from public.berkas b where b.id = p_berkas;
  if v_tenant is null or not private.can_access_berkas(p_berkas) or not private.can_write_content(v_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where bucket_id = $1 and name = $2)'
      into v_uploaded using 'documents', p_storage_path;
  end if;
  if not v_uploaded then
    raise exception 'file belum terunggah' using errcode = 'P0002';
  end if;
  insert into public.documents (berkas_id, akta_id, doc_type, title, file_name, storage_path, mime_type, size_bytes)
  values (p_berkas, p_akta, p_doc_type, coalesce(nullif(trim(p_title), ''), p_file_name), p_file_name,
          p_storage_path, p_mime_type, p_size_bytes)
  returning id into v_id;
  return v_id;
end $$;

-- Every open/download of a document is logged, for humans and (later) the agent (PRD-H-03).
create function public.log_document_access(p_document uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare d public.documents;
begin
  select * into d from public.documents where id = p_document;
  if d.id is null or d.tenant_id is distinct from private.tenant_id() or not private.can_access_berkas(d.berkas_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.audit(d.tenant_id, 'document.read', 'document', d.id, d.berkas_id, '{}'::jsonb);
  return d.storage_path;
end $$;

create function public.verify_legal_reference(p_reference uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.legal_references;
begin
  select * into r from public.legal_references where id = p_reference;
  if r.id is null or r.tenant_id is distinct from private.tenant_id()
     or not private.has_active_role(r.tenant_id, 'notaris') or (auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'hanya Notaris yang dapat memverifikasi dasar hukum' using errcode = '42501';
  end if;
  perform set_config('verity.legal_verify', r.id::text, true);
  update public.legal_references set verified_by = auth.uid(), verified_at = now() where id = r.id;
  perform set_config('verity.legal_verify', '', true);
end $$;

revoke execute on function public.register_document(uuid, uuid, public.document_type, text, text, text, text, bigint),
  public.log_document_access(uuid), public.verify_legal_reference(uuid) from public, anon;
grant execute on function public.register_document(uuid, uuid, public.document_type, text, text, text, text, bigint),
  public.log_document_access(uuid), public.verify_legal_reference(uuid) to authenticated;

-- ─────────────────────────────  Storage (Supabase only)  ─────────────────────────────
-- Private bucket; path <tenant>/<berkas>/<uuid>/<file>. Upload and download follow berkas
-- access; nobody can overwrite or delete files through the API.
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;  -- plain Postgres test database
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documents', 'documents', false, 26214400,
          array['application/pdf', 'image/jpeg', 'image/png',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'])
  on conflict (id) do nothing;

  execute $p$
    create policy documents_bucket_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'documents'
                and (storage.foldername(name))[1] = (select private.tenant_id())::text
                and private.can_access_berkas(private.try_uuid((storage.foldername(name))[2]))
                and private.can_write_content((select private.tenant_id()))
                and (select private.aal_ok()))
  $p$;
  execute $p$
    create policy documents_bucket_read on storage.objects for select to authenticated
    using (bucket_id = 'documents'
           and (storage.foldername(name))[1] = (select private.tenant_id())::text
           and private.can_access_berkas(private.try_uuid((storage.foldername(name))[2]))
           and (select private.aal_ok()))
  $p$;
end $$;
