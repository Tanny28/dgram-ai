"""
DiagramAI :: Database (SQLAlchemy + SQLite)
===========================================
Three tables:
  - users           (id, google_sub, email, name, picture, created_at)
  - history_items   (id, user_id FK, prompt, kind, title, created_at)
  - generation_logs (id, user_id FK nullable, prompt, kind, title,
                     latency_ms, offline, created_at)

generation_logs powers the admin dashboard — every /api/generate call
is recorded regardless of whether the user is signed in.

Production path on Render: SQLite file on a mounted persistent disk at
/data/diagramai.db (configured via DATABASE_URL env var).
Local dev defaults to ./diagramai.db in the backend working directory.
"""
from __future__ import annotations
import os
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, relationship


DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./diagramai.db")

# SQLite needs check_same_thread=False for FastAPI's threadpool
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True)
    google_sub  = Column(String, unique=True, index=True, nullable=False)
    email       = Column(String, unique=True, nullable=False)
    name        = Column(String, nullable=True)
    picture     = Column(String, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)

    history = relationship(
        "HistoryItem",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    logs = relationship(
        "GenerationLog",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class HistoryItem(Base):
    __tablename__ = "history_items"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    prompt      = Column(String, nullable=False)
    kind        = Column(String, nullable=True)
    title       = Column(String, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="history")


class GenerationLog(Base):
    __tablename__ = "generation_logs"

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    prompt     = Column(String, nullable=False)
    kind       = Column(String, nullable=True)
    title      = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    offline    = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="logs")


def init_db() -> None:
    """Create tables if they don't exist. Safe to call on every startup."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency that yields a database session and ensures it's closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
