from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MYSQL_ROOT_PASSWORD: str
    MYSQL_DATABASE: str
    MYSQL_USER: str
    MYSQL_PASSWORD: str
    DATABASE_URL: str
    REDIS_URL: str
    OLLAMA_URL: str = "http://biblio_ia-ollama-1:11434"
    OLLAMA_MODEL: str = "qwen2.5:0.5b"
    OLLAMA_AUTO_PULL: bool = True
    JWT_SECRET: str
    ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30
    PROJECT_NAME: str = "Biblio-IA"
    VERSION: str = "1.0.0"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

settings = Settings()