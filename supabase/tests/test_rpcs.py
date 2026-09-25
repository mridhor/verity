"""Phase 0 RPC authorization: membership, roles, officials, tenant switching."""

import psycopg
import pytest

forbidden = pytest.raises(psycopg.errors.InsufficientPrivilege)


def test_create_berkas_adds_creator_and_pic(world):
    andi = world.as_(world.andi)
    bid = andi.one("select public.create_berkas('pendirian_pt', 'PT Baru', %s)", (world.retno,))
    members = {
        r["user_id"]
        for r in world.as_(world.sari).all("select user_id from public.berkas_members where berkas_id = %s", (bid,))
    }
    assert members == {world.andi, world.retno}


def test_super_admin_cannot_create_berkas(world):
    with forbidden:
        world.as_(world.bambang).one("select public.create_berkas('ajb', 'x')")


def test_super_admin_cannot_assign_self(world):
    with forbidden:
        world.as_(world.bambang).run("select public.set_berkas_member(%s, %s, true)", (world.berkas_pt, world.bambang))


def test_staff_cannot_change_membership(world):
    with forbidden:
        world.as_(world.andi).run("select public.set_berkas_member(%s, %s, true)", (world.berkas_ajb, world.andi))


def test_membership_change_notifies_notaris(world, conn):
    world.as_(world.bambang).run("select public.set_berkas_member(%s, %s, true)", (world.berkas_ajb, world.andi))
    assert {r["title"] for r in world.as_(world.andi).all("select title from public.berkas")} >= {
        "AJB Kavling 14 Cilandak"
    }
    notes = world.as_(world.sari).all("select kind, payload from public.notifications")
    assert [n["kind"] for n in notes] == ["berkas_member.changed"]
    assert world.as_(world.andi).all("select id from public.notifications") == []


def test_cross_tenant_membership_rejected(world):
    with pytest.raises(psycopg.errors.Error):
        world.as_(world.sari).run("select public.set_berkas_member(%s, %s, true)", (world.berkas_pt, world.assoc))


def test_only_super_admin_manages_roles_and_not_own(world):
    with forbidden:
        world.as_(world.sari).run("select public.set_member_role(%s, 'notaris', true)", (world.andi,))
    with forbidden:
        world.as_(world.bambang).run("select public.set_member_role(%s, 'notaris', true)", (world.bambang,))
    world.as_(world.bambang).run("select public.set_member_role(%s, 'staf_admin', false)", (world.retno,))


def test_add_tenant_member_requires_existing_account(world, conn):
    admin = world.as_(world.bambang)
    with pytest.raises(psycopg.errors.NoDataFound):
        admin.one("select public.add_tenant_member('baru@kantor.id', 'staf_admin', 'Baru')")
    conn.execute("insert into auth.users (email) values ('baru@kantor.id')")
    uid = admin.one("select public.add_tenant_member('BARU@kantor.id', 'staf_admin', 'Baru')")
    assert uid is not None


def test_officials_must_be_notaris_members(world):
    admin = world.as_(world.bambang)
    oid = admin.one(
        "select public.upsert_official(%s, 'notaris', 'Sari Rahayu, S.H., M.Kn.', 'Kota Administrasi Jakarta Selatan', 'AHU-1')",
        (world.sari,),
    )
    oid2 = admin.one(
        "select public.upsert_official(%s, 'ppat', 'Sari Rahayu, S.H., M.Kn.', 'Kota Administrasi Jakarta Selatan', 'BPN-1')",
        (world.sari,),
    )
    assert oid != oid2
    with pytest.raises(psycopg.errors.CheckViolation):
        admin.one("select public.upsert_official(%s, 'notaris', 'Andi', null, null)", (world.andi,))


def test_switch_tenant_requires_membership(world):
    with forbidden:
        world.as_(world.andi).run("select public.switch_tenant(%s)", (world.firm,))
    world.as_(world.andi).run("select public.switch_tenant(%s)", (world.notary,))
