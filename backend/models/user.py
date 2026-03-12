import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum

class UserRole(str, Enum):
    ADHERENT = "adherent"
    BIBLIOTHECAIRE = "bibliothecaire"

class User(SQLModel, table=True):
    __tablename__ = "users"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: UserRole = Field(default=UserRole.ADHERENT)
    est_bloque: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)