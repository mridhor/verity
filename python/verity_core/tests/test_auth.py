import json
import time
import uuid

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from verity_core.auth import AuthError, JwksCache, TokenVerifier, bearer_token

ISS = "https://auth.verity.test/auth/v1"


@pytest.fixture()
def keypair():
    private = ec.generate_private_key(ec.SECP256R1())
    jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key()))
    jwk.update({"kid": "k1", "alg": "ES256", "use": "sig"})
    return private, jwk


@pytest.fixture()
def verifier(keypair):
    _, jwk = keypair
    transport = httpx.MockTransport(lambda req: httpx.Response(200, json={"keys": [jwk]}))
    cache = JwksCache(
        url="https://auth.verity.test/auth/v1/.well-known/jwks.json", client=httpx.Client(transport=transport)
    )
    return TokenVerifier(jwks=cache, issuer=ISS)


def make_token(private, **overrides):
    now = int(time.time())
    claims = {
        "sub": str(uuid.uuid4()),
        "iss": ISS,
        "aud": "authenticated",
        "iat": now,
        "exp": now + 3600,
        "role": "authenticated",
        "aal": "aal2",
        "tenant_id": str(uuid.uuid4()),
        "app_role": "notaris",
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, private, algorithm="ES256", headers={"kid": "k1"})


def test_valid_token_yields_principal_from_claims(verifier, keypair):
    private, _ = keypair
    p = verifier.verify(make_token(private))
    assert p.app_role == "notaris" and p.aal == "aal2" and p.tenant_id is not None


def test_missing_tenant_claims_are_allowed_but_empty(verifier, keypair):
    p = verifier.verify(make_token(keypair[0], tenant_id=None, app_role=None))
    assert p.tenant_id is None and p.app_role is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"exp": int(time.time()) - 3600},
        {"iss": "https://evil.example/auth/v1"},
        {"aud": "anon"},
        {"app_role": "god"},
    ],
)
def test_invalid_claims_rejected(verifier, keypair, overrides):
    with pytest.raises(AuthError):
        verifier.verify(make_token(keypair[0], **overrides))


def test_foreign_signing_key_rejected(verifier):
    other = ec.generate_private_key(ec.SECP256R1())
    with pytest.raises(AuthError):
        verifier.verify(make_token(other))


def test_hs256_token_rejected_even_with_known_kid(verifier):
    token = jwt.encode(
        {"sub": str(uuid.uuid4())}, "shared-secret-that-is-long-enough-000", algorithm="HS256", headers={"kid": "k1"}
    )
    with pytest.raises(AuthError, match="algorithm"):
        verifier.verify(token)


def test_bearer_parsing():
    assert bearer_token("Bearer abc") == "abc"
    with pytest.raises(AuthError):
        bearer_token(None)
    with pytest.raises(AuthError):
        bearer_token("Basic abc")
