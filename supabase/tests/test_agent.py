"""Agent workspace: threads, append-only messages, proposals (rule 1) and who may approve them."""

import json
import uuid

import psycopg
import pytest

forbidden = pytest.raises(psycopg.errors.InsufficientPrivilege)


def thread(actor, berkas=None, title="Utas"):
    return actor.one(
        "insert into public.agent_threads (berkas_id, title) values (%s, %s) returning id", (berkas, title))


def items(*ops):
    return json.dumps(list(ops))


CHECKLIST = {"op": "checklist.add", "label": "Tambah checklist: minta NPWP", "params": {"title": "Minta NPWP Laras"}}


def approve_signing(akta):
    return {"op": "akta.approve_for_signing", "label": "Setujui untuk penandatanganan", "params": {"akta_id": str(akta)}}


def propose(actor, berkas, ops, key=None):
    rows = actor.all("select * from public.create_proposed_changes(%s, %s::jsonb, %s)",
                     (berkas, items(*ops), key or f"k-{uuid.uuid4()}"))
    return [r["create_proposed_changes"] for r in rows]


def test_berkas_threads_shared_with_berkas_members_only(world):
    tid = thread(world.as_(world.andi), world.berkas_pt)
    world.as_(world.andi).run("insert into public.agent_messages (thread_id, role, body) values (%s, 'user', 'halo')", (tid,))
    assert len(world.as_(world.sari).all("select id from public.agent_messages")) == 1
    assert world.as_(world.retno).all("select id from public.agent_threads") == []
    assert world.as_(world.bambang).all("select id from public.agent_threads") == []


def test_office_threads_are_private_to_owner(world):
    thread(world.as_(world.andi))
    assert world.as_(world.sari).all("select id from public.agent_threads") == []
    assert len(world.as_(world.andi).all("select id from public.agent_threads")) == 1
    # The Super Admin may use office-wide threads, never berkas threads.
    thread(world.as_(world.bambang))
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        thread(world.as_(world.bambang), world.berkas_pt)


def test_cannot_open_thread_on_unassigned_berkas(world):
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        thread(world.as_(world.retno), world.berkas_pt)


def test_messages_are_append_only(world, conn):
    tid = thread(world.as_(world.andi), world.berkas_pt)
    world.as_(world.andi).run("insert into public.agent_messages (thread_id, role, body) values (%s, 'user', 'halo')", (tid,))
    conn.execute("savepoint s")
    with pytest.raises(psycopg.errors.InsufficientPrivilege, match="append-only"):
        conn.execute("update public.agent_messages set body = 'diubah'")
    conn.execute("rollback to savepoint s")


def test_proposals_split_by_tier_and_are_idempotent(world):
    aid = world.akta(world.berkas_pt, parties=[world.person("Rahmat Hidayat")])
    world.as_(world.andi).run("select public.transition_akta_status(%s, 'verifikasi')", (aid,))
    andi = world.as_(world.andi)
    ids = propose(andi, world.berkas_pt, [CHECKLIST, approve_signing(aid)], key="key-00000001")
    assert len(ids) == 2
    tiers = {r["tier"] for r in andi.all("select tier from public.proposed_changes")}
    assert tiers == {"staf", "notaris"}
    assert sorted(propose(andi, world.berkas_pt, [CHECKLIST, approve_signing(aid)], key="key-00000001")) == sorted(ids)
    assert andi.one("select count(*) from public.proposed_changes") == 2


@pytest.mark.parametrize("op", ["akta.finalize", "akta.assign_number", "akta.sign", "berkas_member.add", "register.write"])
def test_forbidden_operations_cannot_be_proposed(world, op):
    with forbidden:
        propose(world.as_(world.andi), world.berkas_pt, [{"op": op, "label": "coba", "params": {}}])


def test_non_member_and_super_admin_cannot_propose(world):
    with forbidden:
        propose(world.as_(world.retno), world.berkas_pt, [CHECKLIST])
    with forbidden:
        propose(world.as_(world.bambang), world.berkas_pt, [CHECKLIST])


def test_staff_approves_staff_tier_and_it_applies_once(world):
    andi = world.as_(world.andi)
    (pid,) = propose(andi, world.berkas_pt, [CHECKLIST])
    assert andi.one("select count(*) from public.checklist_items") == 0  # nothing applied yet (rule 1)
    assert andi.one("select public.decide_proposed_change(%s, 'approve')", (pid,)) == "applied"
    assert andi.one("select public.decide_proposed_change(%s, 'approve')", (pid,)) == "applied"
    assert andi.all("select title from public.checklist_items") == [{"title": "Minta NPWP Laras"}]
    assert andi.one("select count(*) from public.approvals") == 1


def test_notaris_tier_needs_notaris_with_mfa(world):
    aid = world.akta(world.berkas_pt, parties=[world.person("Rahmat Hidayat")])
    world.as_(world.andi).run("select public.transition_akta_status(%s, 'verifikasi')", (aid,))
    (pid,) = propose(world.as_(world.andi), world.berkas_pt, [approve_signing(aid)])
    with forbidden:
        world.as_(world.andi).one("select public.decide_proposed_change(%s, 'approve')", (pid,))
    with forbidden:
        world.as_(world.sari, aal="aal1").one("select public.decide_proposed_change(%s, 'approve')", (pid,))
    with forbidden:
        world.as_(world.bambang).one("select public.decide_proposed_change(%s, 'approve')", (pid,))
    assert world.as_(world.sari).one("select public.decide_proposed_change(%s, 'approve')", (pid,)) == "applied"
    assert world.as_(world.sari).one("select status::text from public.akta where id = %s", (aid,)) == "menunggu_ttd"


def test_changed_target_makes_proposal_stale(world):
    aid = world.akta(world.berkas_pt, parties=[world.person("Rahmat Hidayat")])
    world.as_(world.andi).run("select public.transition_akta_status(%s, 'verifikasi')", (aid,))
    (pid,) = propose(world.as_(world.andi), world.berkas_pt, [approve_signing(aid)])
    world.as_(world.andi).run("select public.transition_akta_status(%s, 'draft')", (aid,))
    sari = world.as_(world.sari)
    assert sari.one("select public.decide_proposed_change(%s, 'approve')", (pid,)) == "stale"
    assert sari.one("select status::text from public.akta where id = %s", (aid,)) == "draft"


def test_reject_changes_nothing(world):
    andi = world.as_(world.andi)
    (pid,) = propose(andi, world.berkas_pt, [CHECKLIST])
    assert andi.one("select public.decide_proposed_change(%s, 'reject', 'tidak perlu')", (pid,)) == "rejected"
    assert andi.one("select count(*) from public.checklist_items") == 0
    assert andi.one("select public.decide_proposed_change(%s, 'approve')", (pid,)) == "rejected"


def test_one_failing_item_rolls_back_the_whole_proposal(world):
    andi = world.as_(world.andi)
    aid = world.akta(world.berkas_pt, parties=[world.person("Rahmat Hidayat")])
    submit = {"op": "akta.submit_verification", "label": "Ajukan verifikasi", "params": {"akta_id": str(aid)}}
    (pid,) = propose(andi, world.berkas_pt, [CHECKLIST, submit])
    # The akta moves on after the proposal was made: the whole proposal goes stale, nothing applies.
    andi.run("select public.transition_akta_status(%s, 'verifikasi')", (aid,))
    assert andi.one("select public.decide_proposed_change(%s, 'approve')", (pid,)) == "stale"
    assert andi.one("select count(*) from public.checklist_items") == 0


def test_approvals_are_append_only(world, conn):
    (pid,) = propose(world.as_(world.andi), world.berkas_pt, [CHECKLIST])
    world.as_(world.andi).one("select public.decide_proposed_change(%s, 'approve')", (pid,))
    conn.execute("savepoint s")
    with pytest.raises(psycopg.errors.InsufficientPrivilege, match="append-only"):
        conn.execute("delete from public.approvals")
    conn.execute("rollback to savepoint s")


def test_proposals_visible_only_within_berkas(world):
    propose(world.as_(world.andi), world.berkas_pt, [CHECKLIST])
    assert world.as_(world.retno).all("select id from public.proposed_changes") == []
    assert len(world.as_(world.sari).all("select id from public.proposed_changes")) == 1
