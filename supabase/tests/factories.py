from __future__ import annotations

import uuid

import psycopg


class World:
    """Seed data written directly as the table owner (bypasses RPC checks on purpose)."""

    def __init__(self, conn: psycopg.Connection, actor_cls):
        self.conn = conn
        self.actor_cls = actor_cls
        self.notary = self._tenant("kantor_notaris", "Kantor Notaris Sari Rahayu")
        self.firm = self._tenant("firma", "Firma Hukum Rahayu & Rekan")

        self.sari = self.user("sari@kantor.id", self.notary, "notaris", "Sari Rahayu")
        self.andi = self.user("andi@kantor.id", self.notary, "staf_admin", "Andi Pratama")
        self.retno = self.user("retno@kantor.id", self.notary, "staf_admin", "Retno Wulandari")
        self.bambang = self.user("bambang@kantor.id", self.notary, "super_admin", "Bambang Admin")
        self.partner = self.user("partner@firma.id", self.firm, "partner", "Dewi Partner")
        self.assoc = self.user("assoc@firma.id", self.firm, "associate", "Fitriani Associate")

        self.berkas_pt = self.berkas(self.notary, "pendirian_pt", "Pendirian PT Sinar Kopi Nusantara", [self.andi])
        self.berkas_ajb = self.berkas(self.notary, "ajb", "AJB Kavling 14 Cilandak", [self.retno])
        self.berkas_firm = self.berkas(self.firm, "review_kontrak", "Review Kontrak Distribusi", [self.assoc])

        self.off_notaris = self.official(self.sari, "notaris")
        self.off_ppat = self.official(self.sari, "ppat")

    def _tenant(self, kind: str, name: str) -> uuid.UUID:
        return self.conn.execute(
            "insert into public.tenants (kind, name) values (%s, %s) returning id", (kind, name)
        ).fetchone()["id"]

    def user(self, email: str, tenant: uuid.UUID, role: str, name: str) -> uuid.UUID:
        uid = self.conn.execute("insert into auth.users (email) values (%s) returning id", (email,)).fetchone()["id"]
        self.conn.execute(
            "insert into public.tenant_members (tenant_id, user_id, role, display_name) values (%s, %s, %s, %s)",
            (tenant, uid, role, name),
        )
        return uid

    def berkas(self, tenant: uuid.UUID, type_: str, title: str, members: list[uuid.UUID]) -> uuid.UUID:
        bid = self.conn.execute(
            "insert into public.berkas (tenant_id, type, title, created_by) values (%s, %s, %s, %s) returning id",
            (tenant, type_, title, members[0]),
        ).fetchone()["id"]
        for m in members:
            self.conn.execute(
                "insert into public.berkas_members (berkas_id, user_id, tenant_id, added_by) values (%s, %s, %s, %s)",
                (bid, m, tenant, m),
            )
        return bid

    def official(self, user: uuid.UUID, appointment: str) -> uuid.UUID:
        return self.conn.execute(
            "insert into public.officials (tenant_id, user_id, appointment, display_name) "
            "values (%s, %s, %s, 'Sari Rahayu, S.H., M.Kn.') returning id",
            (self.notary, user, appointment),
        ).fetchone()["id"]

    def person(self, name: str, tenant: uuid.UUID | None = None, nik: str | None = None) -> uuid.UUID:
        return self.conn.execute(
            "insert into public.persons (tenant_id, full_name, nik, created_by) values (%s, %s, %s, %s) returning id",
            (tenant or self.notary, name, nik, self.andi),
        ).fetchone()["id"]

    def akta(self, berkas: uuid.UUID, official: uuid.UUID | None = None, title: str = "Akta Pendirian",
             parties: list[uuid.UUID] | None = None) -> uuid.UUID:
        aid = self.conn.execute(
            "insert into public.akta (berkas_id, official_id, akta_type, title, created_by) "
            "values (%s, %s, 'Pendirian PT', %s, %s) returning id",
            (berkas, official or self.off_notaris, title, self.andi),
        ).fetchone()["id"]
        for i, p in enumerate(parties or []):
            self.conn.execute(
                "insert into public.akta_parties (akta_id, person_id, role, sort_order, created_by) "
                "values (%s, %s, 'penghadap', %s, %s)",
                (aid, p, i, self.andi),
            )
        return aid

    def enroll_mfa(self, user: uuid.UUID) -> None:
        """A verified TOTP factor: from now on this user's sessions must be aal2."""
        self.conn.execute("insert into auth.mfa_factors (user_id, status) values (%s, 'verified')", (user,))

    def ready_for_signing(self, akta: uuid.UUID) -> None:
        sari = self.as_(self.sari)
        sari.run("select public.transition_akta_status(%s, 'verifikasi')", (akta,))
        sari.run("select public.transition_akta_status(%s, 'menunggu_ttd')", (akta,))

    def role_of(self, user: uuid.UUID) -> tuple[uuid.UUID, str]:
        row = self.conn.execute(
            "select tenant_id, role::text from public.tenant_members where user_id = %s", (user,)
        ).fetchone()
        return row["tenant_id"], row["role"]

    def as_(self, user: uuid.UUID, *, aal: str = "aal2", **overrides):
        tenant, role = self.role_of(user)
        claims = {"sub": str(user), "role": "authenticated", "aal": aal, "tenant_id": str(tenant), "app_role": role}
        claims.update({k: v for k, v in overrides.items()})
        claims = {k: v for k, v in claims.items() if v is not None}
        return self.actor_cls(self.conn, claims)
