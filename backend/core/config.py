from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MYSQL_ROOT_PASSWORD: str
    MYSQL_DATABASE: str
    MYSQL_USER: str
    MYSQL_PASSWORD: str
    DATABASE_URL: str
    REDIS_URL: str
    OLLAMA_URL: str
    JWT_SECRET: str
    ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30
    PROJECT_NAME: str = "Biblio-IA"
    VERSION: str = "1.0.0"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

settings = Settings()