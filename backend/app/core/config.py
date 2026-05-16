from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_STORAGE_BUCKET: str = "invoices"

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    ANTHROPIC_API_KEY: str = ""
    HF_API_TOKEN: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    ENVIRONMENT: str = "development"

    @property
    def CLAUDE_API_KEY(self) -> str:
        return self.ANTHROPIC_API_KEY

    class Config:
        env_file = ".env"


settings = Settings()
