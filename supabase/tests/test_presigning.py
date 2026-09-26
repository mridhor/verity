"""Pre-signing checks by the agent in the background (ADR 0006)."""

import json
import uuid

import psycopg
import pytest

forbidden = pytest.raises(psycopg.errors.InsufficientPrivilege)


def signing(world, conn, berkas, hours, kind="penandatanganan"):
    return conn.execute(
        "insert into public.schedules (tenant_id, berkas_id, kind, title, starts_at, created_by) "
        "values (%s, %s, %s, 'Penandatanganan akta', now() + make_interval(hours => %s), %s) returning id",
        (world.notary, berkas, kind, hours, world.andi),
    ).fetchone()["id"]


def run_all(conn):
    return conn.execute("select private.run_presigning_checks() as n").fetchone()["n"]


@pytest.fixture()
def case(world, conn):
    """Akta still in verification; one party with a KTP on file, one without."""
    laras = world.person("Laras Anggraini", nik="9971011203880001")
    rahmat = world.person("Rahmat Hidayat", nik="9971011203880002")
    aid = world.akta(world.berkas_pt, parties=[laras, rahmat])
    world.as_(world.andi).run("select public.transition_akta_status(%s, 'verifikasi')", (aid,))
    conn.execute(
        "insert into public.documents (berkas_id, doc_type, title, file_name, storage_path, mime_type, size_bytes, uploaded_by) "
        "values (%s, 'ktp', 'KTP Laras Anggraini', 'KTP_Laras.png', %s, 'image/png', 1000, %s)",
        (world.berkas_pt, f"{world.notary}/{world.berkas_pt}/{uuid.uuid4()}/KTP_Laras.png", world.andi),
    )
    return aid


def test_h1_check_posts_findings_proposes_checklist_and_notifies(world, conn, case):
    signing(world, conn, world.berkas_pt, 20)
    assert run_all(conn) == 1

    events = world.as_(world.andi).one(
        "select m.events from public.agent_messages m join public.agent_threads t on t.id = m.thread_id "
        "where t.berkas_id = %s and m.role = 'agent'", (world.berkas_pt,))
    texts = " ".join(e["delta"] for e in events if e["type"] == "text")
    assert "Pemeriksaan otomatis H-1" in texts
    assert "KTP Rahmat Hidayat belum ada" in texts
    assert "masih berstatus Verifikasi" in texts and "halaman akta" in texts
    assert [e["seq"] for e in events] == list(range(len(events)))
    assert any(e["type"] == "citation" and e["target"]["kind"] == "person" for e in events)

    proposals = world.as_(world.andi).all("select tier, items from public.proposed_changes")
    assert len(proposals) == 1 and proposals[0]["tier"] == "staf"
    assert [i["op"] for i in proposals[0]["items"]] == ["checklist.add"]
    assert proposals[0]["items"][0]["params"]["title"] == "Minta KTP Rahmat Hidayat"

    # The official (Sari) and the berkas team (Andi) are told; the Super Admin is not.
    for user in (world.sari, world.andi):
        assert world.as_(user).one("select count(*) from public.notifications where kind = 'agent.presigning'") == 1
    assert world.as_(world.bambang).one("select count(*) from public.notifications where kind = 'agent.presigning'") == 0

    row = world.as_(world.sari).all(
        "select actor_type::text, actor_user_id, on_behalf_of from public.audit_log where action = 'agent.presigning_checked'")
    assert row == [{"actor_type": "agent", "actor_user_id": None, "on_behalf_of": world.andi}]
    # The proposal itself is also recorded as the agent's.
    assert world.as_(world.sari).one(
        "select actor_type::text from public.audit_log where action = 'proposal.created'") == "agent"


def test_background_check_never_touches_the_akta(world, conn, case):
    signing(world, conn, world.berkas_pt, 20)
    run_all(conn)
    assert world.as_(world.sari).one("select status::text from public.akta where id = %s", (case,)) == "verifikasi"
    items = [i["op"] for p in world.as_(world.sari).all("select items from public.proposed_changes") for i in p["items"]]
    assert not any(op.startswith("akta.") for op in items)


def test_each_stage_runs_once_and_a_moved_schedule_is_checked_again(world, conn, case):
    sid = signing(world, conn, world.berkas_pt, 60)
    assert run_all(conn) == 1          # H-3
    assert run_all(conn) == 0          # nothing new
    conn.execute("update public.schedules set starts_at = now() + interval '10 hours' where id = %s", (sid,))
    assert run_all(conn) == 1          # H-1
    conn.execute("update public.schedules set starts_at = now() + interval '12 hours' where id = %s", (sid,))
    assert run_all(conn) == 1          # moved: new signing time
    stages = [r["stage"] for r in conn.execute("select stage from public.agent_background_runs order by id").fetchall()]
    assert stages == ["h3", "h1", "h1"]


def test_ignores_other_kinds_far_or_past_schedules_and_office_agenda(world, conn, case):
    signing(world, conn, world.berkas_pt, 20, kind="pertemuan_klien")
    signing(world, conn, world.berkas_pt, 100)
    signing(world, conn, world.berkas_pt, -2)
    conn.execute(
        "insert into public.schedules (tenant_id, kind, title, starts_at, created_by) "
        "values (%s, 'penandatanganan', 'Tanpa berkas', now() + interval '5 hours', %s)", (world.notary, world.andi))
    assert run_all(conn) == 0


def test_ready_berkas_reports_no_findings(world, conn):
    laras = world.person("Laras Anggraini", nik="9971011203880001")
    conn.execute("update public.persons set address = 'Jl. Wijaya II' where id = %s", (laras,))
    aid = world.akta(world.berkas_pt, parties=[laras])
    world.ready_for_signing(aid)
    conn.execute(
        "insert into public.documents (berkas_id, doc_type, title, file_name, storage_path, mime_type, size_bytes, uploaded_by) "
        "values (%s, 'ktp', 'KTP Laras Anggraini', 'KTP_Laras.png', %s, 'image/png', 1000, %s)",
        (world.berkas_pt, f"{world.notary}/{world.berkas_pt}/{uuid.uuid4()}/k.png", world.andi))
    signing(world, conn, world.berkas_pt, 20)
    run_all(conn)
    assert conn.execute("select findings from public.agent_background_runs").fetchone()["findings"] == 0
    assert world.as_(world.andi).all("select id from public.proposed_changes") == []


def test_manual_check_for_members_only(world, conn, case):
    sid = signing(world, conn, world.berkas_pt, 30)
    assert world.as_(world.andi).one("select public.run_presigning_check(%s)", (sid,)) is not None
    # The caller's own claims are back afterwards.
    assert world.as_(world.andi).one("select auth.jwt() ->> 'verity_actor'") is None
    for user in (world.retno, world.bambang):
        with forbidden:
            world.as_(user).one("select public.run_presigning_check(%s)", (sid,))
    meeting = signing(world, conn, world.berkas_pt, 30, kind="pertemuan_klien")
    with pytest.raises(psycopg.errors.InvalidParameterValue):
        world.as_(world.andi).one("select public.run_presigning_check(%s)", (meeting,))


def test_runs_visible_to_berkas_members_only(world, conn, case):
    signing(world, conn, world.berkas_pt, 20)
    run_all(conn)
    assert len(world.as_(world.andi).all("select id from public.agent_background_runs")) == 1
    assert world.as_(world.retno).all("select id from public.agent_background_runs") == []


def test_akta_status_changes_are_no_longer_agent_proposals(world, case):
    for op in ("akta.submit_verification", "akta.approve_for_signing"):
        item = {"op": op, "label": "Ubah status akta", "params": {"akta_id": str(case)}}
        with forbidden:
            world.as_(world.andi).all("select * from public.create_proposed_changes(%s, %s::jsonb, %s)",
                                      (world.berkas_pt, json.dumps([item]), f"k-{uuid.uuid4()}"))


def test_hook_drops_forged_agent_claim(world, conn):
    conn.execute("savepoint h")
    conn.execute("set local role supabase_auth_admin")
    event = {"user_id": str(world.andi), "claims": {"sub": str(world.andi), "verity_actor": "agent", "aal": "aal1"}}
    out = conn.execute("select public.custom_access_token_hook(%s::jsonb) as e", (json.dumps(event),)).fetchone()["e"]
    conn.execute("reset role")
    assert "verity_actor" not in out["claims"]


# ─────────────────────────────  Checked as soon as a signing is scheduled  ─────────────────────────────

def commit_point(conn):
    """Deferred triggers fire here, as they would at commit."""
    conn.execute("set constraints all immediate")
    conn.execute("set constraints all deferred")


def runs(conn):
    return [r["stage"] for r in conn.execute("select stage from public.agent_background_runs order by id").fetchall()]


def test_signing_far_ahead_gets_a_first_check_on_commit(world, conn, case):
    signing(world, conn, world.berkas_pt, 24 * 10)
    assert runs(conn) == []                     # nothing until the transaction commits
    commit_point(conn)
    assert runs(conn) == ["awal"]
    texts = " ".join(e["delta"] for e in world.as_(world.andi).one(
        "select m.events from public.agent_messages m where m.role = 'agent'") if e["type"] == "text")
    assert "Penandatanganan sudah dijadwalkan. Pemeriksaan awal" in texts
    assert world.as_(world.sari).one("select count(*) from public.notifications where kind = 'agent.presigning'") == 1
    assert run_all(conn) == 0                   # the hourly job does not repeat it (still > 72h)


def test_signing_soon_takes_the_current_stage_and_the_job_does_not_repeat_it(world, conn, case):
    signing(world, conn, world.berkas_pt, 20)
    commit_point(conn)
    assert runs(conn) == ["h1"]
    assert run_all(conn) == 0


def test_moving_a_signing_checks_it_again(world, conn, case):
    sid = signing(world, conn, world.berkas_pt, 24 * 10)
    commit_point(conn)
    conn.execute("update public.schedules set starts_at = now() + interval '5 days' where id = %s", (sid,))
    conn.execute("update public.schedules set title = 'Penandatanganan AJB' where id = %s", (sid,))  # no new time
    commit_point(conn)
    assert runs(conn) == ["awal", "awal"]


def test_other_kinds_office_agenda_and_past_are_not_checked_on_commit(world, conn, case):
    signing(world, conn, world.berkas_pt, 24 * 10, kind="pertemuan_klien")
    signing(world, conn, world.berkas_pt, -2)
    conn.execute(
        "insert into public.schedules (tenant_id, kind, title, starts_at, created_by) "
        "values (%s, 'penandatanganan', 'Tanpa berkas', now() + interval '5 days', %s)", (world.notary, world.andi))
    commit_point(conn)
    assert runs(conn) == []


def test_a_failed_check_keeps_the_schedule(world, conn, case):
    conn.execute("alter table public.agent_background_runs add constraint no_runs check (false) not valid")
    sid = signing(world, conn, world.berkas_pt, 24 * 10)
    commit_point(conn)
    assert conn.execute("select count(*) as n from public.schedules where id = %s", (sid,)).fetchone()["n"] == 1
    assert runs(conn) == []


def test_signing_booked_from_chat_is_checked_once_approved(world, conn, case):
    item = {"op": "schedule.add", "label": "Jadwalkan penandatanganan",
            "params": {"title": "Penandatanganan akta", "kind": "penandatanganan",
                       "starts_at": conn.execute("select (now() + interval '10 days')::text as t").fetchone()["t"]}}
    sari = world.as_(world.sari)
    (pid,) = [r["create_proposed_changes"] for r in sari.all("select * from public.create_proposed_changes(%s, %s::jsonb, %s)",
                                                             (world.berkas_pt, json.dumps([item]), f"k-{uuid.uuid4()}"))]
    commit_point(conn)
    assert runs(conn) == []                     # a proposal is not a schedule
    assert sari.one("select public.decide_proposed_change(%s, 'approve')", (pid,)) == "applied"
    commit_point(conn)
    assert runs(conn) == ["awal"]
