"""JWT verification for the AI engine and workers (PLAN.md §4, JWT check 3; rule 5).

Identity comes only from a Supabase access token signed with the project's asymmetric key
(ES256/RS256), verified against the JWKS. Request headers are never consulted for identity.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import httpx
import jwt
from jwt import PyJWK
from pydantic import ValidationError
from verity_schema.principal import Principal

ALLOWED_ALGORITHMS = ("ES256", "RS256")


class AuthError(Exception):
    """Raised for any token that must not be trusted. Message is safe to log (no token)."""


@dataclass
class JwksCache:
    """Caches the JWKS; refetches on an unknown `kid` (key rotation), at most once per `min_refresh_s`."""

    url: str
    ttl_s: float = 600.0
    min_refresh_s: float = 10.0
    client: httpx.Client = field(default_factory=lambda: httpx.Client(timeout=5.0))
    _keys: dict[str, PyJWK] = field(default_factory=dict)
    _fetched_at: float = 0.0

    def _fetch(self) -> None:
        response = self.client.get(self.url)
        response.raise_for_status()
        keys: dict[str, PyJWK] = {}
        for jwk in response.json().get("keys", []):
            if jwk.get("kid") and jwk.get("alg") in ALLOWED_ALGORITHMS:
                keys[jwk["kid"]] = PyJWK(jwk)
        self._keys, self._fetched_at = keys, time.monotonic()

    def get(self, kid: str) -> PyJWK:
        now = time.monotonic()
        if not self._keys or now - self._fetched_at > self.ttl_s:
            self._fetch()
        if kid not in self._keys and now - self._fetched_at > self.min_refresh_s:
            self._fetch()
        try:
            return self._keys[kid]
        except KeyError:
            raise AuthError("unknown signing key") from None


@dataclass
class TokenVerifier:
    jwks: JwksCache
    issuer: str
    audience: str = "authenticated"
    leeway_s: int = 30

    def verify(self, token: str) -> Principal:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError:
            raise AuthError("malformed token") from None
        alg, kid = header.get("alg"), header.get("kid")
        # Symmetric (HS256) and `none` tokens are rejected outright.
        if alg not in ALLOWED_ALGORITHMS or not kid:
            raise AuthError("unsupported token algorithm")
        key = self.jwks.get(kid)
        try:
            claims = jwt.decode(
                token,
                key=key.key,
                algorithms=[alg],
                audience=self.audience,
                issuer=self.issuer,
                leeway=self.leeway_s,
                options={"require": ["exp", "iat", "sub", "iss", "aud"]},
            )
        except jwt.PyJWTError as exc:
            raise AuthError(f"invalid token: {type(exc).__name__}") from None
        try:
            return Principal(
                user_id=claims["sub"],
                tenant_id=claims.get("tenant_id"),
                app_role=claims.get("app_role"),
                aal=claims.get("aal", "aal1"),
            )
        except ValidationError:
            raise AuthError("unexpected claim values") from None


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("missing bearer token")
    return authorization[7:].strip()
