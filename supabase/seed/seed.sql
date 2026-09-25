-- Synthetic seed for local development only (no real client data, ever).
-- Accounts are created with `scripts/invite_user.py`; this file only creates the tenants.
insert into public.tenants (id, kind, name) values
  ('00000000-0000-4000-8000-000000000001', 'kantor_notaris', 'Kantor Notaris Sari Rahayu (dev)'),
  ('00000000-0000-4000-8000-000000000002', 'firma', 'Firma Hukum Rahayu & Rekan (dev)')
on conflict (id) do nothing;
