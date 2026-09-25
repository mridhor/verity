"""Rule 4 and 5: per-tenant and per-berkas isolation from verified claims (TRD §6.3)."""

import psycopg
import pytest


def titles(actor):
    return {r["title"] for r in actor.all("select title from public.berkas")}


def test_notaris_sees_all_berkas_of_own_tenant_only(world):
    assert titles(world.as_(world.sari)) == {"Pendirian PT Sinar Kopi Nusantara", "AJB Kavling 14 Cilandak"}


def test_staff_sees_only_assigned_berkas(world):
    assert titles(world.as_(world.andi)) == {"Pendirian PT Sinar Kopi Nusantara"}
    assert titles(world.as_(world.retno)) == {"AJB Kavling 14 Cilandak"}


def test_firm_and_notary_tenants_are_isolated(world):
    assert titles(world.as_(world.assoc)) == {"Review Kontrak Distribusi"}
    # Partner is not assigned (PRD §4: only the Notaris sees all), so sees nothing.
    assert titles(world.as_(world.partner)) == set()


def test_forged_tenant_claim_does_not_grant_access(world):
    # Andi claims the firm tenant: he is not a member there, so membership checks fail.
    forged = world.as_(world.andi, tenant_id=str(world.firm))
    assert titles(forged) == set()


def test_forged_role_claim_does_not_grant_notaris_view(world):
    # Claim says notaris but tenant_members says staf_admin: live role check wins.
    forged = world.as_(world.andi, app_role="notaris")
    assert titles(forged) == {"Pendirian PT Sinar Kopi Nusantara"}


def test_no_claims_sees_nothing(world):
    anon_like = world.as_(world.andi, tenant_id=None, app_role=None)
    assert titles(anon_like) == set()


def test_privileged_roles_need_mfa(world):
    assert titles(world.as_(world.sari, aal="aal1")) == set()
    assert world.as_(world.sari, aal="aal1").all("select * from public.tenant_members") == []
    # Staff are not forced to aal2 by policy (PRD); MFA for them is a login-policy decision.
    assert titles(world.as_(world.andi, aal="aal1")) == {"Pendirian PT Sinar Kopi Nusantara"}


def test_super_admin_sees_berkas_metadata_but_is_not_content_member(world):
    admin = world.as_(world.bambang)
    assert titles(admin) == {"Pendirian PT Sinar Kopi Nusantara", "AJB Kavling 14 Cilandak"}
    assert admin.one("select private.can_access_berkas(%s)", (world.berkas_pt,)) is False


def test_revoked_member_loses_access_immediately(world, conn):
    conn.execute("update public.tenant_members set active = false where user_id = %s", (world.andi,))
    assert titles(world.as_(world.andi)) == set()


def test_api_role_cannot_write_tables_directly(world):
    andi = world.as_(world.andi)
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        andi.run(
            "insert into public.berkas (tenant_id, type, title, created_by) values (%s, 'x', 'x', %s)",
            (world.notary, world.andi),
        )
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        andi.run("update public.tenant_members set role = 'notaris' where user_id = %s", (world.andi,))
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        andi.run(
            "insert into public.berkas_members (berkas_id, user_id, tenant_id, added_by) values (%s, %s, %s, %s)",
            (world.berkas_ajb, world.andi, world.notary, world.andi),
        )


def test_colleagues_visible_only_within_active_tenant(world):
    names = {r["display_name"] for r in world.as_(world.andi).all("select display_name from public.tenant_members")}
    assert "Dewi Partner" not in names and "Sari Rahayu" in names
