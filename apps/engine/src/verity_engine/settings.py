from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Engine configuration. There is deliberately no Supabase secret/service key setting (rule 4)."""

    model_config = SettingsConfigDict(env_prefix="VERITY_", env_file=".env", extra="ignore")

    supabase_url: str = "http://127.0.0.1:54321"
    jwt_audience: str = "authenticated"

    @property
    def issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.issuer}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
