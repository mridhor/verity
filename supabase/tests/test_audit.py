"""Rule 6 (audit part): append-only at DB level for every role, tamper-evident chain."""

import psycopg
import pytest


def audit_rows(conn, tenant):
    return conn.execute("select * from public.audit_log where tenant_id = %s order by id", (tenant,)).fetchall()


def test_rpc_writes_chained_audit_entries(world, conn):
    andi = world.as_(world.andi)
    andi.one("select public.create_berkas('pendirian_pt', 'Pendirian PT Uji')")
    andi.one("select public.create_berkas('ajb', 'AJB Uji')")
    rows = audit_rows(conn, world.notary)
    assert [r["action"] for r in rows] == ["berkas.created", "berkas.created"]
    assert rows[0]["prev_hash"] is None and rows[1]["prev_hash"] == rows[0]["row_hash"]
    assert rows[0]["actor_type"] == "human" and rows[0]["actor_user_id"] == world.andi
    assert conn.execute("select private.verify_audit_chain(%s) as broken", (world.notary,)).fetchone()["broken"] is None


@pytest.mark.parametrize("role", ["authenticated", "service_role", "anon"])
def test_api_roles_cannot_mutate_audit_log(world, conn, role):
    world.as_(world.andi).one("select public.create_berkas('ajb', 'AJB Uji')")
    conn.execute("savepoint s")
    conn.execute(f"set local role {role}")
    for stmt in (
        "update public.audit_log set action = 'x'",
        "delete from public.audit_log",
        "insert into public.audit_log (tenant_id, actor_type, action, row_hash) values (gen_random_uuid(), 'system', 'x', '\\x00')",
    ):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute(stmt)
        conn.execute("rollback to savepoint s")
        conn.execute(f"set local role {role}")
    conn.execute("reset role")


def test_even_table_owner_cannot_update_delete_or_truncate(world, conn):
    world.as_(world.andi).one("select public.create_berkas('ajb', 'AJB Uji')")
    for stmt in (
        "update public.audit_log set action = 'x'",
        "delete from public.audit_log",
        "truncate public.audit_log",
    ):
        conn.execute("savepoint s")
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match="append-only"):
            conn.execute(stmt)
        conn.execute("rollback to savepoint s")


def test_chain_detects_tampering(world, conn):
    andi = world.as_(world.andi)
    for i in range(3):
        andi.one("select public.create_berkas('ajb', %s)", (f"AJB {i}",))
    rows = audit_rows(conn, world.notary)
    # Simulate a superuser bypassing triggers.
    conn.execute("set local session_replication_role = replica")
    conn.execute('update public.audit_log set details = \'{"type":"forged"}\' where id = %s', (rows[1]["id"],))
    conn.execute("set local session_replication_role = origin")
    assert (
        conn.execute("select private.verify_audit_chain(%s) as broken", (world.notary,)).fetchone()["broken"]
        == rows[1]["id"]
    )


def test_audit_visibility(world):
    world.as_(world.andi).one("select public.create_berkas('ajb', 'AJB Andi')")
    world.as_(world.retno).one("select public.create_berkas('ajb', 'AJB Retno')")
    assert len(world.as_(world.sari).all("select id from public.audit_log")) == 2
    assert len(world.as_(world.bambang).all("select id from public.audit_log")) == 2
    assert len(world.as_(world.andi).all("select id from public.audit_log")) == 1
    assert world.as_(world.assoc).all("select id from public.audit_log") == []


def test_api_roles_cannot_call_private_audit(world):
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        world.as_(world.andi).run("select private.audit(%s, 'forged')", (world.notary,))


def test_audit_chain_status_rpc(world):
    world.as_(world.andi).one("select public.create_berkas('ajb', 'AJB Uji')")
    assert world.as_(world.sari).one("select public.audit_chain_status()") is None
    assert world.as_(world.bambang).one("select public.audit_chain_status()") is None
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        world.as_(world.andi).one("select public.audit_chain_status()")
