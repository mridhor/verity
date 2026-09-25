import logging
from typing import Annotated

from fastapi import Depends, FastAPI
from verity_core.redact import RedactingFilter
from verity_schema.principal import Principal

from verity_engine.deps import require_tenant

logging.getLogger().addFilter(RedactingFilter())

app = FastAPI(title="Verity engine", version="0.0.0", docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/whoami")
def whoami(principal: Annotated[Principal, Depends(require_tenant)]) -> Principal:
    """Echoes the principal the engine derived from the verified token (used by integration tests)."""
    return principal
