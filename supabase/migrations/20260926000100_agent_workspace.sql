-- Agent workspace: conversation threads, append-only messages, proposed changes and approvals.
-- PLAN.md §7.5 and rules 1 and 2: the agent only PROPOSES. A proposal is applied by
-- decide_proposed_change(), in one transaction, when a human with the required role approves.
-- Numbering, finalization and signing never exist as proposal operations.

create type public.agent_message_role as enum ('user', 'agent');
create type public.proposal_status as enum ('pending', 'applied', 'rejected', 'stale', 'expired');

-- ─────────────────────────────  Threads and messages  ─────────────────────────────

-- berkas_id set  → shared with everyone who can access the berkas (the mockup's conversation).
-- berkas_id null → an office-wide thread, private to its owner.
create table public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  owner_user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  berkas_id uuid references public.berkas (id) on delete cascade,
  context jsonb not null default '{}'::jsonb,
  title text not null check (length(trim(title)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_threads_owner_idx on public.agent_threads (owner_user_id, updated_at desc);
create index agent_threads_berkas_idx on public.agent_threads (berkas_id, updated_at desc) where berkas_id is not null;

create table public.agent_messages (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id),
  thread_id uuid not null references public.agent_threads (id) on delete cascade,
  role public.agent_message_role not null,
  body text check (body is null or length(body) <= 4000),
  events jsonb not null default '[]'::jsonb check (jsonb_typeof(events) = 'array' and pg_column_size(events) < 262144),
  author_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint agent_messages_shape check ((role = 'user') = (body is not null))
);
create index agent_messages_thread_idx on public.agent_messages (thread_id, id);

-- ─────────────────────────────  Proposals  ─────────────────────────────

-- Which approval tier each operation needs. Seeded here; not editable through the API.
create table public.approval_policies (
  op text primary key,
  tier text not null check (tier in ('staf', 'notaris')),
  description text not null
);
insert into public.approval_policies (op, tier, description) values
  ('checklist.add', 'staf', 'Menambah item checklist berkas'),
  ('schedule.add', 'staf', 'Menambah jadwal'),
  ('akta.submit_verification', 'staf', 'Mengajukan draft akta untuk verifikasi'),
  ('akta.approve_for_signing', 'notaris', 'Menyetujui akta untuk penandatanganan');

create table public.proposed_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  berkas_id uuid not null references public.berkas (id) on delete cascade,
  thread_id uuid references public.agent_threads (id) on delete set null,
  message_id bigint references public.agent_messages (id) on delete set null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  tier text not null check (tier in ('staf', 'notaris')),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20),
  base_versions jsonb not null default '{}'::jsonb,
  status public.proposal_status not null default 'pending',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  decided_by uuid,
  decided_at timestamptz,
  unique (idempotency_key, tier)
);
create index proposed_changes_berkas_idx on public.proposed_changes (berkas_id, created_at desc);
create index proposed_changes_pending_idx on public.proposed_changes (tenant_id, status) where status = 'pending';

create table public.approvals (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id),
  proposed_change_id uuid not null unique references public.proposed_changes (id),
  decision text not null check (decision in ('approve', 'reject')),
  decided_by uuid not null,
  decided_role public.app_role not null,
  aal text not null,
  reason text,
  decided_at timestamptz not null default now()
);

-- ─────────────────────────────  Helpers and triggers  ─────────────────────────────

create function private.can_access_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.agent_threads t
    where t.id = p_thread and t.tenant_id = private.tenant_id()
      and ((t.berkas_id is null and t.owner_user_id = auth.uid() and private.is_tenant_member(t.tenant_id))
           or (t.berkas_id is not null and private.can_access_berkas(t.berkas_id)))
  )
$$;

-- Can the caller approve a proposal of this tier on this berkas? Mirrors PRD §4 / REQ-AI-03.
create function private.can_approve_tier(p_tenant uuid, p_berkas uuid, p_tier text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_tier
    when 'staf' then private.can_write_content(p_tenant) and private.can_access_berkas(p_berkas)
    when 'notaris' then (private.has_active_role(p_tenant, 'notaris') or private.has_active_role(p_tenant, 'partner'))
                        and private.can_access_berkas(p_berkas) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    else false
  end
$$;

grant execute on function private.can_access_thread(uuid), private.can_approve_tier(uuid, uuid, text) to authenticated;

create function private.check_agent_thread() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.berkas_id is not null then
    select b.tenant_id into new.tenant_id from public.berkas b where b.id = new.berkas_id;
  elsif new.tenant_id is null then
    new.tenant_id := private.tenant_id();
  end if;
  return new;
end $$;
create trigger a_agent_threads_tenant before insert on public.agent_threads
  for each row execute function private.check_agent_thread();

create function private.check_agent_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select t.tenant_id into new.tenant_id from public.agent_threads t where t.id = new.thread_id;
  update public.agent_threads set updated_at = now() where id = new.thread_id;
  return new;
end $$;
create trigger a_agent_messages_tenant before insert on public.agent_messages
  for each row execute function private.check_agent_message();

create trigger agent_messages_no_update before update or delete on public.agent_messages
  for each row execute function private.reject_mutation();
create trigger approvals_no_update before update or delete on public.approvals
  for each row execute function private.reject_mutation();
create trigger approvals_no_truncate before truncate on public.approvals
  for each statement execute function private.reject_mutation();

-- ─────────────────────────────  Grants and RLS  ─────────────────────────────

revoke all on public.agent_threads, public.agent_messages, public.approval_policies, public.proposed_changes,
  public.approvals from anon, authenticated;
revoke insert, update, delete, truncate on public.approvals from service_role;
grant select, insert on public.agent_threads to authenticated;
grant update (title) on public.agent_threads to authenticated;
grant select, insert on public.agent_messages to authenticated;
grant select on public.approval_policies, public.proposed_changes, public.approvals to authenticated;

alter table public.agent_threads enable row level security;
alter table public.agent_messages enable row level security;
alter table public.approval_policies enable row level security;
alter table public.proposed_changes enable row level security;
alter table public.approvals enable row level security;

create policy agent_threads_aal2 on public.agent_threads as restrictive for all to authenticated using ((select private.aal_ok()));
create policy agent_messages_aal2 on public.agent_messages as restrictive for all to authenticated using ((select private.aal_ok()));
create policy proposed_changes_aal2 on public.proposed_changes as restrictive for all to authenticated using ((select private.aal_ok()));
create policy approvals_aal2 on public.approvals as restrictive for all to authenticated using ((select private.aal_ok()));

-- Checks the row's own columns (not a lookup by id), so INSERT ... RETURNING can see the new row.
create policy agent_threads_read on public.agent_threads for select to authenticated
  using (tenant_id = (select private.tenant_id())
         and ((berkas_id is null and owner_user_id = (select auth.uid()) and private.is_tenant_member(tenant_id))
              or (berkas_id is not null and private.can_access_berkas(berkas_id))));
create policy agent_threads_insert on public.agent_threads for insert to authenticated
  with check (owner_user_id = (select auth.uid()) and tenant_id = (select private.tenant_id())
              and ((berkas_id is null and private.is_tenant_member(tenant_id))
                   or (berkas_id is not null and private.can_access_berkas(berkas_id) and private.can_write_content(tenant_id))));
create policy agent_threads_rename on public.agent_threads for update to authenticated
  using (owner_user_id = (select auth.uid()) and private.can_access_thread(id))
  with check (owner_user_id = (select auth.uid()));

create policy agent_messages_read on public.agent_messages for select to authenticated
  using (private.can_access_thread(thread_id));
create policy agent_messages_insert on public.agent_messages for insert to authenticated
  with check (author_user_id = (select auth.uid()) and private.can_access_thread(thread_id));

create policy approval_policies_read on public.approval_policies for select to authenticated using (true);

create policy proposed_changes_read on public.proposed_changes for select to authenticated
  using (tenant_id = (select private.tenant_id()) and private.can_access_berkas(berkas_id));
create policy approvals_read on public.approvals for select to authenticated
  using (exists (select 1 from public.proposed_changes p where p.id = proposed_change_id
                 and p.tenant_id = (select private.tenant_id()) and private.can_access_berkas(p.berkas_id)));

-- ─────────────────────────────  RPCs  ─────────────────────────────

-- Validates items against the operation whitelist and splits them into one atomic proposal per
-- approval tier (PLAN.md owner decision: "atomic, split by approver"). Idempotent per key.
create function public.create_proposed_changes(
  p_berkas uuid, p_items jsonb, p_idempotency_key text, p_thread uuid default null, p_message bigint default null
) returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_item jsonb; v_tier text; v_akta public.akta; v_bases jsonb := '{}'::jsonb; v_id uuid; r record;
begin
  select b.tenant_id into v_tenant from public.berkas b where b.id = p_berkas;
  if v_tenant is null or v_tenant is distinct from private.tenant_id()
     or not private.can_access_berkas(p_berkas) or not private.can_write_content(v_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'usulan kosong' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select tier into v_tier from public.approval_policies where op = v_item ->> 'op';
    if v_tier is null then
      raise exception 'operasi % tidak diizinkan untuk usulan', coalesce(v_item ->> 'op', '?') using errcode = '42501';
    end if;
    if coalesce(length(trim(v_item ->> 'label')), 0) < 3 then
      raise exception 'setiap usulan perlu keterangan' using errcode = '22023';
    end if;
    if v_item ->> 'op' like 'akta.%' then
      select * into v_akta from public.akta where id = private.try_uuid(v_item -> 'params' ->> 'akta_id');
      if v_akta.id is null or v_akta.berkas_id <> p_berkas then
        raise exception 'akta tidak termasuk dalam berkas ini' using errcode = '23514';
      end if;
      v_bases := v_bases || jsonb_build_object(v_akta.id::text, v_akta.status);
    elsif v_item ->> 'op' = 'checklist.add' and coalesce(length(trim(v_item -> 'params' ->> 'title')), 0) < 2 then
      raise exception 'judul checklist kosong' using errcode = '22023';
    elsif v_item ->> 'op' = 'schedule.add' and (v_item -> 'params' ->> 'starts_at') is null then
      raise exception 'waktu jadwal kosong' using errcode = '22023';
    end if;
  end loop;

  for r in
    select p.tier, jsonb_agg(i.item order by i.ord) as items
      from jsonb_array_elements(p_items) with ordinality as i(item, ord)
      join public.approval_policies p on p.op = i.item ->> 'op'
     group by p.tier
  loop
    insert into public.proposed_changes (tenant_id, berkas_id, thread_id, message_id, idempotency_key, tier, items, base_versions)
    values (v_tenant, p_berkas, p_thread, p_message, p_idempotency_key, r.tier, r.items, v_bases)
    on conflict (idempotency_key, tier) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.proposed_changes where idempotency_key = p_idempotency_key and tier = r.tier;
    else
      perform private.audit(v_tenant, 'proposal.created', 'proposed_change', v_id, p_berkas,
                            jsonb_build_object('tier', r.tier, 'items', jsonb_array_length(r.items)));
    end if;
    return next v_id;
    v_id := null;
  end loop;
end $$;

-- Human decision. Applies every item in one transaction or nothing; repeated calls return the
-- stored outcome (NFR-REL-02). Changed targets make the proposal stale instead of applying it.
create function public.decide_proposed_change(p_proposal uuid, p_decision text, p_reason text default null)
returns public.proposal_status
language plpgsql security definer set search_path = '' as $$
declare pc public.proposed_changes; v_item jsonb; v_status public.akta_status; v_key text;
begin
  select * into pc from public.proposed_changes where id = p_proposal for update;
  if pc.id is null or pc.tenant_id is distinct from private.tenant_id() or not private.can_access_berkas(pc.berkas_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if pc.status <> 'pending' then
    return pc.status;
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'keputusan tidak dikenal' using errcode = '22023';
  end if;
  if not private.can_approve_tier(pc.tenant_id, pc.berkas_id, pc.tier) then
    raise exception '%', case when pc.tier = 'notaris'
      then 'perubahan ini perlu persetujuan Notaris dengan verifikasi dua langkah'
      else 'Anda tidak berhak menyetujui perubahan ini' end using errcode = '42501';
  end if;
  if pc.expires_at < now() then
    update public.proposed_changes set status = 'expired' where id = pc.id;
    return 'expired';
  end if;

  if p_decision = 'approve' then
    for v_key in select jsonb_object_keys(pc.base_versions) loop
      select status into v_status from public.akta where id = v_key::uuid;
      if v_status::text is distinct from pc.base_versions ->> v_key then
        update public.proposed_changes set status = 'stale' where id = pc.id;
        perform private.audit(pc.tenant_id, 'proposal.stale', 'proposed_change', pc.id, pc.berkas_id, '{}'::jsonb);
        return 'stale';
      end if;
    end loop;

    for v_item in select * from jsonb_array_elements(pc.items) loop
      case v_item ->> 'op'
        when 'checklist.add' then
          insert into public.checklist_items (berkas_id, title, assignee_user_id, due_date)
          values (pc.berkas_id, trim(v_item -> 'params' ->> 'title'),
                  private.try_uuid(v_item -> 'params' ->> 'assignee_user_id'),
                  nullif(v_item -> 'params' ->> 'due_date', '')::date);
        when 'schedule.add' then
          insert into public.schedules (berkas_id, kind, title, starts_at, location)
          values (pc.berkas_id, coalesce(v_item -> 'params' ->> 'kind', 'penandatanganan')::public.schedule_kind,
                  trim(v_item -> 'params' ->> 'title'), (v_item -> 'params' ->> 'starts_at')::timestamptz,
                  nullif(v_item -> 'params' ->> 'location', ''));
        when 'akta.submit_verification' then
          -- Goes through the normal workflow function, which re-checks the approver's rights.
          perform public.transition_akta_status((v_item -> 'params' ->> 'akta_id')::uuid, 'verifikasi', 'Disetujui dari usulan agen');
        when 'akta.approve_for_signing' then
          perform public.transition_akta_status((v_item -> 'params' ->> 'akta_id')::uuid, 'menunggu_ttd', 'Disetujui dari usulan agen');
        else
          raise exception 'operasi tidak dikenal' using errcode = '42501';
      end case;
    end loop;
  end if;

  update public.proposed_changes
     set status = case when p_decision = 'approve' then 'applied' else 'rejected' end::public.proposal_status,
         decided_by = auth.uid(), decided_at = now()
   where id = pc.id;
  insert into public.approvals (tenant_id, proposed_change_id, decision, decided_by, decided_role, aal, reason)
  values (pc.tenant_id, pc.id, p_decision, auth.uid(), private.app_role(), coalesce(auth.jwt() ->> 'aal', 'aal1'),
          nullif(trim(coalesce(p_reason, '')), ''));
  perform private.audit(pc.tenant_id, case when p_decision = 'approve' then 'proposal.approved' else 'proposal.rejected' end,
                        'proposed_change', pc.id, pc.berkas_id, jsonb_build_object('tier', pc.tier));
  return case when p_decision = 'approve' then 'applied' else 'rejected' end::public.proposal_status;
end $$;

revoke execute on function public.create_proposed_changes(uuid, jsonb, text, uuid, bigint),
  public.decide_proposed_change(uuid, text, text) from public, anon;
grant execute on function public.create_proposed_changes(uuid, jsonb, text, uuid, bigint),
  public.decide_proposed_change(uuid, text, text) to authenticated;
revoke execute on function private.check_agent_thread(), private.check_agent_message() from public, anon, authenticated;
