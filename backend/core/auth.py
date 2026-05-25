"""
DiagramAI :: Authentication
===========================
Google OAuth via authlib + signed-cookie sessions via Starlette SessionMiddleware.

Flow:
  1. User clicks "Sign in with Google" -> frontend sends them to /api/auth/google
  2. Backend redirects to Google consent screen
  3. Google redirects back to /api/auth/google/callback?code=...
  4. Backend exchanges code -> id_token, upserts user, sets session['user_id'], redirects to /
  5. Subsequent requests carry the signed session cookie; current_user_optional() reads it.
"""
from __future__ import annotations
import os

from authlib.integrations.starlette_client import OAuth
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from core.db import User, get_db


# Recognise typical academic email patterns so EDU users can be auto-upgraded to Pro
_EDU_PATTERNS = (".edu", ".edu.", ".ac.")


def is_edu_email(email: str) -> bool:
    if not email:
        return False
    e = email.lower()
    return any(p in e for p in _EDU_PATTERNS)


# Lazy-init OAuth so app boots even without Google creds (offline/dev).
oauth = OAuth()
oauth.register(
    name="google",
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def google_configured() -> bool:
    """True iff both client id and secret are set. Lets the frontend hide the login button."""
    return bool(os.environ.get("GOOGLE_CLIENT_ID")) and bool(os.environ.get("GOOGLE_CLIENT_SECRET"))


# ── FastAPI dependencies ──

def current_user_optional(request: Request, db: Session = Depends(get_db)) -> User | None:
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def current_user_required(user: User | None = Depends(current_user_optional)) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="not authenticated")
    return user
