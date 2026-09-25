import json
import time
import uuid

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from verity_core.auth import JwksCache, TokenVerifier
from verity_engine.deps import get_verifier
from verity_engine.main import app

ISS = "http://auth.test/auth/v1"


@pytest.fixture()
def signer():
    private = ec.generate_private_key(ec.SECP256R1())
    jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key())) | {"kid": "k1", "alg": "ES256"}
    cache = JwksCache(
        url="http://auth.test/jwks",
        client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"keys": [jwk]}))),
    )
    app.dependency_overrides[get_verifier] = lambda: TokenVerifier(jwks=cache, issuer=ISS)
    yield lambda **c: jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "iss": ISS,
            "aud": "authenticated",
            "iat": int(time.time()),
            "exp": int(time.time()) + 600,
            "aal": "aal2",
            "tenant_id": str(uuid.uuid4()),
            "app_role": "staf_admin",
        }
        | c,
        private,
        algorithm="ES256",
        headers={"kid": "k1"},
    )
    app.dependency_overrides.clear()


client = TestClient(app)


def test_healthz():
    assert client.get("/healthz").json() == {"status": "ok"}


def test_whoami_uses_token_claims_not_headers(signer):
    tenant = str(uuid.uuid4())
    r = client.get(
        "/v1/whoami",
        headers={
            "Authorization": f"Bearer {signer(tenant_id=tenant)}",
            "x-tenant-id": str(uuid.uuid4()),
            "x-user-id": str(uuid.uuid4()),
            "x-role": "notaris",
        },
    )
    assert r.status_code == 200
    assert r.json()["tenant_id"] == tenant and r.json()["app_role"] == "staf_admin"


def test_missing_token_is_401(signer):
    assert client.get("/v1/whoami", headers={"x-tenant-id": str(uuid.uuid4())}).status_code == 401


def test_privileged_role_without_mfa_is_403(signer):
    r = client.get("/v1/whoami", headers={"Authorization": f"Bearer {signer(app_role='notaris', aal='aal1')}"})
    assert r.status_code == 403


def test_no_membership_is_403(signer):
    r = client.get("/v1/whoami", headers={"Authorization": f"Bearer {signer(tenant_id=None, app_role=None)}"})
    assert r.status_code == 403


def test_settings_have_no_service_key():
    from verity_engine.settings import Settings

    assert not any("service" in f or "secret" in f for f in Settings.model_fields)
