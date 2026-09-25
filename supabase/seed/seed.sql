-- Synthetic seed for local development only (no real client data, ever).
-- Accounts are created with `scripts/invite_user.py`; this file only creates the tenants.
insert into public.tenants (id, kind, name) values
  ('00000000-0000-4000-8000-000000000001', 'kantor_notaris', 'Kantor Notaris Sari Rahayu (dev)'),
  ('00000000-0000-4000-8000-000000000002', 'firma', 'Firma Hukum Rahayu & Rekan (dev)')
on conflict (id) do nothing;

-- Starter legal references for the notary office (public law, no client data). Deliberately left
-- "belum terverifikasi": a Notaris must check each entry and its status before relying on it.
insert into public.legal_references (tenant_id, category, number_label, title, year, status) values
  ('00000000-0000-4000-8000-000000000001', 'undang_undang', 'UU 30/2004', 'Undang-Undang Nomor 30 Tahun 2004 tentang Jabatan Notaris', 2004, 'diubah'),
  ('00000000-0000-4000-8000-000000000001', 'undang_undang', 'UU 2/2014', 'Undang-Undang Nomor 2 Tahun 2014 tentang Perubahan atas Undang-Undang Nomor 30 Tahun 2004 tentang Jabatan Notaris', 2014, 'berlaku'),
  ('00000000-0000-4000-8000-000000000001', 'undang_undang', 'UU 40/2007', 'Undang-Undang Nomor 40 Tahun 2007 tentang Perseroan Terbatas', 2007, 'diubah'),
  ('00000000-0000-4000-8000-000000000001', 'undang_undang', 'UU 5/1960', 'Undang-Undang Nomor 5 Tahun 1960 tentang Peraturan Dasar Pokok-Pokok Agraria', 1960, 'berlaku'),
  ('00000000-0000-4000-8000-000000000001', 'undang_undang', 'UU 4/1996', 'Undang-Undang Nomor 4 Tahun 1996 tentang Hak Tanggungan atas Tanah beserta Benda-Benda yang Berkaitan dengan Tanah', 1996, 'berlaku'),
  ('00000000-0000-4000-8000-000000000001', 'undang_undang', 'UU 42/1999', 'Undang-Undang Nomor 42 Tahun 1999 tentang Jaminan Fidusia', 1999, 'berlaku'),
  ('00000000-0000-4000-8000-000000000001', 'undang_undang', 'UU 27/2022', 'Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi', 2022, 'berlaku'),
  ('00000000-0000-4000-8000-000000000001', 'undang_undang', 'KUHPerdata', 'Kitab Undang-Undang Hukum Perdata (Burgerlijk Wetboek)', 1847, 'berlaku'),
  ('00000000-0000-4000-8000-000000000001', 'peraturan_pemerintah', 'PP 24/1997', 'Peraturan Pemerintah Nomor 24 Tahun 1997 tentang Pendaftaran Tanah', 1997, 'berlaku'),
  ('00000000-0000-4000-8000-000000000001', 'peraturan_pemerintah', 'PP 37/1998', 'Peraturan Pemerintah Nomor 37 Tahun 1998 tentang Peraturan Jabatan Pejabat Pembuat Akta Tanah', 1998, 'diubah')
on conflict do nothing;
