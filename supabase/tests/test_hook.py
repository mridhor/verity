"""Rule 5: claims come from the access token hook, based on active memberships only."""

import json


def run_hook(conn, user):
    conn.execute("savepoint h")
    conn.execute("set local role supabase_auth_admin")
    event = {
        "user_id": str(user),
        "claims": {
            "sub": str(user),
            "role": "authenticated",
            "aal": "aal1",
            "tenant_id": "forged",
            "app_role": "notaris",
        },
    }
    out = conn.execute("select public.custom_access_token_hook(%s::jsonb) as e", (json.dumps(event),)).fetchone()["e"]
    conn.execute("reset role")
    return out["claims"]


def test_hook_sets_tenant_and_role(world, conn):
    claims = run_hook(conn, world.andi)
    assert claims["tenant_id"] == str(world.notary) and claims["app_role"] == "staf_admin"


def test_hook_strips_forged_claims_for_users_without_membership(world, conn):
    uid = conn.execute("insert into auth.users (email) values ('x@x.id') returning id").fetchone()["id"]
    claims = run_hook(conn, uid)
    assert "tenant_id" not in claims and "app_role" not in claims


def test_hook_honours_active_tenant_choice(world, conn):
    conn.execute(
        "insert into public.tenant_members (tenant_id, user_id, role, display_name) values (%s, %s, 'associate', 'Andi')",
        (world.firm, world.andi),
    )
    conn.execute(
        "insert into public.user_settings (user_id, active_tenant_id) values (%s, %s)", (world.andi, world.firm)
    )
    claims = run_hook(conn, world.andi)
    assert claims["tenant_id"] == str(world.firm) and claims["app_role"] == "associate"


def test_hook_skips_inactive_membership(world, conn):
    conn.execute("update public.tenant_members set active = false where user_id = %s", (world.andi,))
    assert "tenant_id" not in run_hook(conn, world.andi)


def test_api_roles_cannot_call_hook(world, conn):
    import psycopg
    import pytest

    conn.execute("savepoint h")
    conn.execute("set local role authenticated")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("select public.custom_access_token_hook('{}'::jsonb)")
    conn.execute("rollback to savepoint h")
