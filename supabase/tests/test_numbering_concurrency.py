"""TRD §6.8: sequential numbering under concurrent finalization (real commits, separate connections)."""

import datetime as dt
import json
import threading
import uuid

import psycopg
import pytest
from conftest import MIGRATIONS, STUB
from psycopg.rows import dict_row

N = 20


@pytest.fixture()
def committed_db(server_url):
    name = f"verity_conc_{uuid.uuid4().hex[:8]}"
    with psycopg.connect(server_url, autocommit=True) as admin:
        admin.execute(f'create database "{name}"')
    url = server_url.replace("/postgres?", f"/{name}?") if "/postgres?" in server_url else f"{server_url.rsplit('/', 1)[0]}/{name}"
    with psycopg.connect(url, autocommit=True) as c:
        if not c.execute("select 1 from pg_namespace where nspname = 'auth'").fetchone():
            c.execute(STUB.read_text())
        for m in MIGRATIONS:
            c.execute(m.read_text())
    yield url
    with psycopg.connect(server_url, autocommit=True) as admin:
        admin.execute(f'drop database "{name}" with (force)')


def test_concurrent_finalizations_get_distinct_gapless_numbers(committed_db):
    with psycopg.connect(committed_db, autocommit=True, row_factory=dict_row) as c:
        tenant = c.execute("insert into public.tenants (kind, name) values ('kantor_notaris', 'T') returning id").fetchone()["id"]
        sari = c.execute("insert into auth.users (email) values ('sari@t.id') returning id").fetchone()["id"]
        c.execute("insert into public.tenant_members (tenant_id, user_id, role, display_name) values (%s, %s, 'notaris', 'Sari')",
                  (tenant, sari))
        off = c.execute("insert into public.officials (tenant_id, user_id, appointment, display_name) "
                        "values (%s, %s, 'notaris', 'Sari') returning id", (tenant, sari)).fetchone()["id"]
        berkas = c.execute("insert into public.berkas (tenant_id, type, title, created_by) values (%s, 'pendirian_pt', 'B', %s) "
                           "returning id", (tenant, sari)).fetchone()["id"]
        person = c.execute("insert into public.persons (tenant_id, full_name, created_by) values (%s, 'Ahmad Fauzi', %s) "
                           "returning id", (tenant, sari)).fetchone()["id"]
        akta_ids = []
        for i in range(N):
            aid = c.execute("insert into public.akta (berkas_id, official_id, akta_type, title, created_by) "
                            "values (%s, %s, 'Kuasa', %s, %s) returning id", (berkas, off, f"Akta {i}", sari)).fetchone()["id"]
            c.execute("insert into public.akta_parties (akta_id, person_id, role, created_by) values (%s, %s, 'penghadap', %s)",
                      (aid, person, sari))
            for to in ("verifikasi", "menunggu_ttd"):
                c.execute("select set_config('verity.akta_change', %s, false)", (str(aid),))
                c.execute("update public.akta set status = %s where id = %s", (to, aid))
            c.execute("select set_config('verity.akta_change', '', false)")
            akta_ids.append(aid)

    claims = json.dumps({"sub": str(sari), "role": "authenticated", "aal": "aal2",
                         "tenant_id": str(tenant), "app_role": "notaris"})
    results, errors = [], []
    barrier = threading.Barrier(N)

    def finalize(aid):
        try:
            with psycopg.connect(committed_db) as conn:
                conn.execute("set role authenticated")
                conn.execute("select set_config('request.jwt.claims', %s, false)", (claims,))
                barrier.wait()
                results.append(conn.execute("select akta_number from public.finalize_akta(%s, %s)",
                                            (aid, dt.date.today())).fetchone()[0])
                conn.commit()
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=finalize, args=(a,)) for a in akta_ids]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == []
    assert sorted(results) == list(range(1, N + 1))
    with psycopg.connect(committed_db) as c:
        assert c.execute("select count(*) from public.repertorium_entries").fetchone()[0] == N
