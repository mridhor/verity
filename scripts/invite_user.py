"""Create a login account (bastion only). PLAN.md §6: accounts are created with the admin API;
roles and tenant membership are then granted in the app by the Super Admin (add_tenant_member).

Usage (from the bastion, never from an app container):
    SUPABASE_URL=https://auth.internal SUPABASE_SECRET_KEY=... uv run scripts/invite_user.py user@kantor.id
"""

from __future__ import annotations

import os
import secrets
import sys

import httpx


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    email = sys.argv[1].strip().lower()
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SECRET_KEY"]
    temp_password = secrets.token_urlsafe(18)
    response = httpx.post(
        f"{url}/auth/v1/admin/users",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "User-Agent": "verity-ops"},
        json={"email": email, "password": temp_password, "email_confirm": True},
        timeout=10,
    )
    if response.status_code >= 300:
        print(f"failed: HTTP {response.status_code}", file=sys.stderr)
        return 1
    print(f"account created for {email}")
    print(f"temporary password (share out of band, user must change it): {temp_password}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
