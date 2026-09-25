"""Database test harness.

Uses $VERITY_TEST_DATABASE_URL if set (e.g. a local Supabase stack), otherwise starts a
throwaway Postgres 17 cluster from the Homebrew binaries. Each test session gets a fresh
database with the Supabase stub (only when `auth` is missing) and all migrations applied.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import psycopg
import pytest
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
STUB = Path(__file__).parent / "bootstrap" / "supabase_stub.sql"
PG_BIN_CANDIDATES = [
    os.environ.get("PG_BIN", ""),
    "/opt/homebrew/opt/postgresql@17/bin",
    "/usr/lib/postgresql/17/bin",
]


def _pg_bin() -> Path:
    for candidate in PG_BIN_CANDIDATES:
        if candidate and (Path(candidate) / "initdb").exists():
            return Path(candidate)
    found = shutil.which("initdb")
    if found:
        return Path(found).parent
    pytest.skip("No Postgres binaries found; set PG_BIN or VERITY_TEST_DATABASE_URL")


@pytest.fixture(scope="session")
def server_url() -> Iterator[str]:
    url = os.environ.get("VERITY_TEST_DATABASE_URL")
    if url:
        yield url
        return
    pg_bin = _pg_bin()
    tmp = Path(tempfile.mkdtemp(prefix="verity-pg-"))
    data = tmp / "data"
    # macOS limits Unix socket paths to ~104 bytes, so keep the socket dir short.
    sock = Path(tempfile.mkdtemp(prefix="vpg", dir="/tmp"))
    # Postgres on macOS refuses to start without a valid locale in the environment.
    env = {**os.environ, "LC_ALL": "C", "LANG": "C"}
    subprocess.run(
        [pg_bin / "initdb", "-D", data, "-U", "postgres", "-A", "trust", "--no-sync", "-E", "UTF8", "--locale=C"],
        check=True,
        capture_output=True,
        env=env,
    )
    subprocess.run(
        [
            pg_bin / "pg_ctl",
            "-D",
            data,
            "-w",
            "-l",
            tmp / "log",
            "-o",
            f"-k {sock} -c listen_addresses='' -c fsync=off",
            "start",
        ],
        check=True,
        capture_output=True,
        env=env,
    )
    try:
        yield f"postgresql://postgres@/postgres?host={sock}"
    finally:
        subprocess.run([pg_bin / "pg_ctl", "-D", data, "-m", "immediate", "stop"], capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)
        shutil.rmtree(sock, ignore_errors=True)


@pytest.fixture(scope="session")
def db_url(server_url: str) -> str:
    name = f"verity_test_{uuid.uuid4().hex[:8]}"
    with psycopg.connect(server_url, autocommit=True) as admin:
        admin.execute(f'create database "{name}"')
    url = (
        server_url.replace("/postgres?", f"/{name}?")
        if "/postgres?" in server_url
        else f"{server_url.rsplit('/', 1)[0]}/{name}"
    )
    with psycopg.connect(url, autocommit=True) as conn:
        has_auth = conn.execute("select 1 from pg_namespace where nspname = 'auth'").fetchone()
        if not has_auth:
            conn.execute(STUB.read_text())
        for migration in MIGRATIONS:
            conn.execute(migration.read_text())
    return url


@pytest.fixture()
def conn(db_url: str) -> Iterator[psycopg.Connection]:
    """A connection whose work is rolled back after each test."""
    with psycopg.connect(db_url, row_factory=dict_row) as c:
        c.execute("begin")
        yield c
        c.rollback()


class Actor:
    """Runs statements as `authenticated` with given JWT claims, like PostgREST does."""

    def __init__(self, conn: psycopg.Connection, claims: dict):
        self.conn = conn
        self.claims = claims

    @contextmanager
    def _as(self):
        self.conn.execute("savepoint actor")
        self.conn.execute("set local role authenticated")
        self.conn.execute("select set_config('request.jwt.claims', %s, true)", (json.dumps(self.claims),))
        try:
            yield
        except Exception:
            self.conn.execute("rollback to savepoint actor")
            raise
        finally:
            self.conn.execute("reset role")
            self.conn.execute("select set_config('request.jwt.claims', '', true)")

    def all(self, sql: str, params: tuple | dict | None = None) -> list[dict]:
        with self._as():
            return self.conn.execute(sql, params).fetchall()

    def one(self, sql: str, params: tuple | dict | None = None):
        with self._as():
            row = self.conn.execute(sql, params).fetchone()
            return None if row is None else next(iter(row.values()))

    def run(self, sql: str, params: tuple | dict | None = None) -> None:
        with self._as():
            self.conn.execute(sql, params)


@pytest.fixture()
def world(conn: psycopg.Connection):
    """Two tenants (kantor_notaris, firma) with users in each role, seeded as the migration owner."""
    from factories import World

    return World(conn, Actor)
