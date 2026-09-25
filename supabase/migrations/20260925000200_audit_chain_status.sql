-- Lets the Notaris and Super Admin check audit-log integrity from the UI (PRD-H-02).
-- Returns null when the tenant's chain verifies, otherwise the id of the first bad row.
create function public.audit_chain_status() returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid := private.tenant_id();
begin
  if not (private.has_active_role(v_tenant, 'notaris') or private.has_active_role(v_tenant, 'super_admin')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return private.verify_audit_chain(v_tenant);
end $$;

revoke execute on function public.audit_chain_status() from public, anon;
grant execute on function public.audit_chain_status() to authenticated;
