-- Helpers for the synthetic demo seed (supabase/demo/seed.mjs). Everything is written through
-- the same RPCs and triggers the app uses, acting as a given member via simulated JWT claims,
-- so numbering, registers, status history, notifications and the audit chain come out right.
-- Created in a throwaway schema and dropped at the end of the run.

create schema if not exists verity_seed;

create table if not exists verity_seed.ctx (tenant uuid primary key, notaris uuid not null, staf uuid not null,
                                             off_notaris uuid, off_ppat uuid);

create or replace function verity_seed.act(p_user uuid, p_aal text default 'aal2') returns void
language plpgsql as $$
declare v_tenant uuid := (select tenant from verity_seed.ctx); v_role text;
begin
  select role::text into v_role from public.tenant_members where tenant_id = v_tenant and user_id = p_user;
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user, 'role', 'authenticated', 'aal', p_aal, 'tenant_id', v_tenant, 'app_role', v_role)::text, true);
end $$;

-- A colleague account that cannot sign in (no password): only there so work is assigned to people.
create or replace function verity_seed.colleague(p_email text, p_name text, p_role public.app_role) returns uuid
language plpgsql as $$
declare v_id uuid; v_tenant uuid := (select tenant from verity_seed.ctx);
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is null then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change,
                            email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', p_email, '',
            now(), '{"provider": "email", "providers": ["email"], "demo_seed": true}', '{}', now(), now(),
            '', '', '', '', '', '', '', '')
    returning id into v_id;
  end if;
  insert into public.tenant_members (tenant_id, user_id, role, display_name)
  values (v_tenant, v_id, p_role, p_name) on conflict do nothing;
  return v_id;
end $$;

create or replace function verity_seed.person(p_name text, p_nik text, p_place text, p_birth date, p_address text,
                                              p_job text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  perform verity_seed.act((select staf from verity_seed.ctx));
  select id into v_id from public.persons where tenant_id = (select tenant from verity_seed.ctx)
     and (nik = p_nik or (p_nik is null and nik is null and full_name = p_name));
  if v_id is null then
    insert into public.persons (tenant_id, full_name, nik, birth_place, birth_date, address, occupation)
    values ((select tenant from verity_seed.ctx), p_name, p_nik, p_place, p_birth, p_address, p_job)
    returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function verity_seed.company(p_form public.company_form, p_name text, p_nib text, p_npwp text,
                                               p_domicile text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  perform verity_seed.act((select staf from verity_seed.ctx));
  select id into v_id from public.companies where tenant_id = (select tenant from verity_seed.ctx) and nib = p_nib;
  if v_id is null then
    insert into public.companies (tenant_id, legal_form, name, nib, npwp, domicile)
    values ((select tenant from verity_seed.ctx), p_form, p_name, p_nib, p_npwp, p_domicile)
    returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function verity_seed.berkas(p_type text, p_title text, p_pic uuid, p_members uuid[], p_step text,
                                              p_status text, p_created timestamptz) returns uuid
language plpgsql as $$
declare v_id uuid; m uuid;
begin
  perform verity_seed.act(p_pic);
  v_id := public.create_berkas(p_type, p_title);
  perform verity_seed.act((select notaris from verity_seed.ctx));
  foreach m in array coalesce(p_members, '{}') loop
    if m <> p_pic then perform public.set_berkas_member(v_id, m, true); end if;
  end loop;
  update public.berkas set workflow_step = p_step, status = p_status, created_at = p_created where id = v_id;
  return v_id;
end $$;

-- Draft → up to the target status (never 'selesai': that goes through verity_seed.finalize).
create or replace function verity_seed.akta(p_berkas uuid, p_appointment public.appointment, p_type text, p_title text,
                                            p_notes text, p_parties jsonb, p_target public.akta_status,
                                            p_creator uuid, p_created timestamptz) returns uuid
language plpgsql as $$
declare v_id uuid; p jsonb; i integer := 0;
  v_official uuid := case when p_appointment = 'ppat' then (select off_ppat from verity_seed.ctx)
                          else (select off_notaris from verity_seed.ctx) end;
  v_notaris uuid := (select notaris from verity_seed.ctx);
begin
  perform verity_seed.act(p_creator);
  insert into public.akta (berkas_id, official_id, akta_type, title, notes)
  values (p_berkas, v_official, p_type, p_title, p_notes) returning id into v_id;
  for p in select * from jsonb_array_elements(p_parties) loop
    insert into public.akta_parties (akta_id, person_id, company_id, role, capacity, sort_order)
    values (v_id, (p ->> 'person')::uuid, (p ->> 'company')::uuid, (p ->> 'role')::public.party_role,
            p ->> 'capacity', i);
    i := i + 1;
  end loop;
  update public.akta set created_at = p_created where id = v_id;
  if p_target in ('verifikasi', 'menunggu_ttd', 'selesai', 'diarsipkan') then
    perform public.transition_akta_status(v_id, 'verifikasi', null);
  end if;
  if p_target in ('menunggu_ttd', 'selesai', 'diarsipkan') then
    perform verity_seed.act(v_notaris);
    perform public.transition_akta_status(v_id, 'menunggu_ttd', 'Data pihak dan draft sudah diperiksa.');
  end if;
  return v_id;
end $$;

create or replace function verity_seed.finalize(p_akta uuid, p_date date, p_archive boolean) returns void
language plpgsql as $$
begin
  perform verity_seed.act((select notaris from verity_seed.ctx));
  perform public.finalize_akta(p_akta, p_date);
  if p_archive then perform public.transition_akta_status(p_akta, 'diarsipkan', 'Minuta disimpan di lemari protokol.'); end if;
end $$;

create or replace function verity_seed.checklist(p_berkas uuid, p_title text, p_assignee uuid, p_due date, p_done boolean)
returns void language plpgsql as $$
declare v_id uuid;
begin
  perform verity_seed.act(coalesce(p_assignee, (select staf from verity_seed.ctx)));
  insert into public.checklist_items (berkas_id, title, assignee_user_id, due_date)
  values (p_berkas, p_title, p_assignee, p_due) returning id into v_id;
  if p_done then update public.checklist_items set done = true where id = v_id; end if;
end $$;

create or replace function verity_seed.schedule(p_berkas uuid, p_kind public.schedule_kind, p_title text,
                                                p_starts timestamptz, p_location text, p_notes text, p_creator uuid)
returns void language plpgsql as $$
begin
  perform verity_seed.act(p_creator);
  insert into public.schedules (berkas_id, kind, title, starts_at, location, notes)
  values (p_berkas, p_kind, p_title, p_starts, p_location, p_notes);
end $$;

-- The file itself is uploaded afterwards by seed.mjs to exactly this storage path.
create or replace function verity_seed.document(p_berkas uuid, p_akta uuid, p_type public.document_type, p_title text,
                                                p_file text, p_mime text, p_size bigint, p_at timestamptz, p_by uuid)
returns void language plpgsql as $$
declare v_tenant uuid := (select tenant from verity_seed.ctx);
begin
  perform verity_seed.act(p_by);
  insert into public.documents (berkas_id, akta_id, doc_type, title, file_name, storage_path, mime_type, size_bytes,
                                uploaded_at)
  values (p_berkas, p_akta, p_type, p_title, p_file,
          v_tenant || '/' || p_berkas || '/' || gen_random_uuid() || '/' || p_file, p_mime, p_size, p_at);
end $$;
