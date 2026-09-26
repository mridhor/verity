"""Office settings, user administration, sign-in audit, sessions, notifications, legal files."""

import json
import uuid

import psycopg
import pytest

from test_hook import run_hook

forbidden = pytest.raises(psycopg.errors.InsufficientPrivilege)


def test_settings_only_office_admin_with_mfa(world):
    world.as_(world.sari).run("select public.update_tenant_settings(200, 4)")
    row = world.as_(world.andi).all("select annual_akta_target, session_timeout_hours from public.tenant_settings")
    assert row == [{"annual_akta_target": 200, "session_timeout_hours": 4}]
    world.as_(world.bambang).run("select public.update_tenant_settings(null, 12)")
    with forbidden:
        world.as_(world.andi).run("select public.update_tenant_settings(10, 8)")
    world.enroll_mfa(world.sari)
    with forbidden:
        world.as_(world.sari, aal="aal1").run("select public.update_tenant_settings(10, 8)")


def test_settings_range_is_checked(world):
    with pytest.raises(psycopg.errors.CheckViolation):
        world.as_(world.sari).run("select public.update_tenant_settings(10, 25)")


def test_settings_are_per_office(world):
    world.as_(world.sari).run("select public.update_tenant_settings(50, 6)")
    assert world.as_(world.assoc).all("select * from public.tenant_settings") == []


def test_hook_adds_session_timeout(world, conn):
    assert run_hook(conn, world.andi)["session_timeout_h"] == 8
    world.as_(world.sari).run("select public.update_tenant_settings(null, 3)")
    assert run_hook(conn, world.andi)["session_timeout_h"] == 3


def test_member_list_with_email_is_super_admin_only(world):
    rows = world.as_(world.bambang).all("select email, role::text from public.list_tenant_members()")
    assert {r["email"] for r in rows} == {"sari@kantor.id", "andi@kantor.id", "retno@kantor.id", "bambang@kantor.id"}
    for user in (world.sari, world.andi, world.partner):
        with forbidden:
            world.as_(user).all("select * from public.list_tenant_members()")


def test_rename_member(world):
    world.as_(world.bambang).run("select public.update_member_profile(%s, 'Andi P.')", (world.andi,))
    assert world.as_(world.andi).one("select display_name from public.tenant_members where user_id = %s", (world.andi,)) == "Andi P."
    with forbidden:
        world.as_(world.sari).run("select public.update_member_profile(%s, 'X Y')", (world.andi,))
    # Another office's member cannot be renamed.
    with pytest.raises(psycopg.errors.NoDataFound):
        world.as_(world.bambang).run("select public.update_member_profile(%s, 'Dewi')", (world.partner,))


def test_clear_must_change_password_only_for_self(world, conn):
    for u in (world.andi, world.retno):
        conn.execute("update auth.users set raw_app_meta_data = '{\"must_change_password\": true}' where id = %s", (u,))
    world.as_(world.andi).run("select public.clear_must_change_password()")
    meta = {r["id"]: r["raw_app_meta_data"] for r in conn.execute("select id, raw_app_meta_data from auth.users").fetchall()}
    assert "must_change_password" not in meta[world.andi]
    assert meta[world.retno]["must_change_password"] is True


def test_auth_events_are_allowlisted_and_audited(world):
    world.as_(world.andi).run("select public.log_auth_event('auth.login')")
    assert world.as_(world.sari).one(
        "select count(*) from public.audit_log where action = 'auth.login' and actor_user_id = %s", (world.andi,)) == 1
    with pytest.raises(psycopg.errors.InvalidParameterValue):
        world.as_(world.andi).run("select public.log_auth_event('akta.finalized')")


def test_auth_event_without_office_is_ignored(world, conn):
    uid = conn.execute("insert into auth.users (email) values ('baru@x.id') returning id").fetchone()["id"]
    world.actor_cls(conn, {"sub": str(uid), "role": "authenticated", "aal": "aal1"}).run(
        "select public.log_auth_event('auth.login')")
    assert conn.execute("select count(*) as n from public.audit_log where actor_user_id = %s", (uid,)).fetchone()["n"] == 0


def sessions(conn, *users):
    for u in users:
        conn.execute("insert into auth.sessions (user_id) values (%s)", (u,))


def test_session_stats_and_revoke(world, conn):
    sessions(conn, world.sari, world.andi, world.andi, world.retno, world.partner)
    stats = world.as_(world.sari).all("select * from public.office_session_stats()")
    assert stats == [{"sessions": 4, "users": 3}]
    assert world.as_(world.sari).one("select public.revoke_office_sessions()") == 3
    left = conn.execute("select user_id from auth.sessions").fetchall()
    assert {r["user_id"] for r in left} == {world.sari, world.partner}  # own session and other office stay
    assert world.as_(world.sari).one(
        "select count(*) from public.audit_log where action = 'session.revoked_all'") == 1


def test_session_control_needs_office_admin_with_mfa(world):
    with forbidden:
        world.as_(world.andi).one("select public.revoke_office_sessions()")
    world.enroll_mfa(world.sari)
    with forbidden:
        world.as_(world.sari, aal="aal1").one("select public.revoke_office_sessions()")
    with forbidden:
        world.as_(world.andi).all("select * from public.office_session_stats()")


def test_awaiting_signature_notifies_official_and_team_not_actor(world):
    person = world.person("Laras Anggraini")
    akta = world.akta(world.berkas_pt, parties=[person])
    world.as_(world.andi).run("select public.transition_akta_status(%s, 'verifikasi')", (akta,))
    world.as_(world.sari).run("select public.transition_akta_status(%s, 'menunggu_ttd')", (akta,))
    andi = world.as_(world.andi).all("select kind, payload from public.notifications")
    assert [n["kind"] for n in andi] == ["akta.awaiting_signature"]
    assert andi[0]["payload"]["akta_id"] == str(akta)
    # Sari made the change: no notification to herself for it; Retno is not on the berkas.
    assert world.as_(world.sari).all("select kind from public.notifications where kind like 'akta.%'") == []
    assert world.as_(world.retno).all("select kind from public.notifications") == []


def test_returned_akta_notifies_creator(world):
    person = world.person("Laras Anggraini")
    akta = world.akta(world.berkas_pt, parties=[person])
    world.as_(world.andi).run("select public.transition_akta_status(%s, 'verifikasi')", (akta,))
    world.as_(world.sari).run("select public.transition_akta_status(%s, 'draft')", (akta,))
    assert [n["kind"] for n in world.as_(world.andi).all("select kind from public.notifications")] == ["akta.returned"]


def test_proposal_notifies_approvers(world, conn):
    # Notaris-tier ops are off by default (ADR 0006); enable one to check who is told.
    conn.execute("insert into public.approval_policies (op, tier, description) values ('akta.approve_for_signing', 'notaris', 'test')")
    person = world.person("Laras Anggraini")
    akta = world.akta(world.berkas_pt, parties=[person])
    world.as_(world.andi).run("select public.transition_akta_status(%s, 'verifikasi')", (akta,))
    ops = [{"op": "checklist.add", "label": "Minta NPWP", "params": {"title": "Minta NPWP"}},
           {"op": "akta.approve_for_signing", "label": "Setujui", "params": {"akta_id": str(akta)}}]
    world.as_(world.andi).all("select * from public.create_proposed_changes(%s, %s::jsonb, %s)",
                              (world.berkas_pt, json.dumps(ops), f"k-{uuid.uuid4()}"))
    assert world.as_(world.sari).one("select count(*) from public.notifications where kind = 'proposal.pending'") == 1
    # Andi proposed; the staff-tier proposal would go to him, but not for his own proposal.
    assert world.as_(world.andi).one("select count(*) from public.notifications where kind = 'proposal.pending'") == 0


def test_legal_file_attach_and_download_logged(world, conn):
    ref = conn.execute(
        "insert into public.legal_references (tenant_id, category, number_label, title) "
        "values (%s, 'undang_undang', 'UU 2/2014', 'Jabatan Notaris') returning id", (world.notary,)).fetchone()["id"]
    path = f"{world.notary}/{ref}/uu.pdf"
    with pytest.raises(psycopg.errors.InvalidParameterValue):
        world.as_(world.andi).run("select public.attach_legal_file(%s, %s)", (ref, f"{world.firm}/{ref}/uu.pdf"))
    world.as_(world.andi).run("select public.attach_legal_file(%s, %s)", (ref, path))
    assert world.as_(world.retno).one("select public.log_legal_download(%s)", (ref,)) == path
    assert world.as_(world.sari).one("select count(*) from public.audit_log where action = 'legal.downloaded'") == 1
    with forbidden:
        world.as_(world.assoc).one("select public.log_legal_download(%s)", (ref,))
    with forbidden:
        world.as_(world.bambang).run("select public.attach_legal_file(%s, %s)", (ref, path))
