from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from verity_core.auth import AuthError, JwksCache, TokenVerifier, bearer_token
from verity_schema.principal import Principal

from verity_engine.settings import get_settings


@lru_cache
def get_verifier() -> TokenVerifier:
    s = get_settings()
    return TokenVerifier(jwks=JwksCache(url=s.jwks_url), issuer=s.issuer, audience=s.jwt_audience)


def get_principal(
    verifier: Annotated[TokenVerifier, Depends(get_verifier)],
    authorization: Annotated[str | None, Header()] = None,
) -> Principal:
    """JWT check 3 (PLAN.md §4). Only the Authorization header is read; x-tenant-id and similar are ignored."""
    try:
        return verifier.verify(bearer_token(authorization))
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


def require_tenant(principal: Annotated[Principal, Depends(get_principal)]) -> Principal:
    if principal.tenant_id is None or principal.app_role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="no active tenant membership")
    if principal.app_role in {"notaris", "partner", "super_admin"} and principal.aal != "aal2":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="mfa required")
    return principal
