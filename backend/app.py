"""
DiagramAI :: FastAPI backend (complete)
=======================================
POST /api/generate   { "prompt": "..." }
  -> route (Groq) -> spec (Groq) -> validate -> render -> solve
  -> { kind, spec, image_b64, mermaid_code, solution, meta }

All renderers wired: circuits, flowcharts, block diagrams, physics.
"""
from __future__ import annotations
import base64
import os
import sys
import time

# ensure backend dir is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

load_dotenv()

from core.brain import route_prompt, build_spec
from core.schemas import DiagramKind, CircuitSpec, GraphSpec, PhysicsSpec
from core import solver as solver_mod
from core import practice_problems as practice_mod
from core.db import init_db, get_db, User, HistoryItem, GenerationLog
from core.auth import oauth, google_configured, is_edu_email, current_user_optional, current_user_required, admin_required
from renderers.circuit import render_circuit
from renderers.graphviz_render import render_graphviz
from renderers.physics import render_physics
from renderers.mermaid_render import render_mermaid

app = FastAPI(title="DiagramAI", version="0.1.0")

# Session middleware MUST be added before any route that calls request.session.
# Signed cookies — secret comes from env in prod. https_only=False keeps local
# dev working over http; Render fronts everything with TLS so the cookie still
# only travels over https in production.
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET", "dev-secret-change-me-in-prod"),
    same_site="lax",
    https_only=False,
    max_age=60 * 60 * 24 * 30,   # 30 days
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Create tables on startup. SQLite default; override with DATABASE_URL.
init_db()


class GenerateRequest(BaseModel):
    prompt: str


class RerenderRequest(BaseModel):
    kind: str          # 'circuit' | 'flowchart' | 'block' | 'sequence' | 'state' | 'physics'
    spec: dict         # the full spec dict (matches CircuitSpec / GraphSpec / PhysicsSpec shape)


class GenerateResponse(BaseModel):
    ok: bool
    kind: str
    title: str
    spec: dict
    image_b64: str
    mermaid_code: str
    solution: dict
    meta: dict


@app.get("/api/health")
def health():
    return {"status": "ok", "groq_key_present": bool(os.environ.get("GROQ_API_KEY"))}


@app.get("/api/practice")
def practice(difficulty: str = None, topic: str = None):
    """Get a random practice problem.
    Optional query params: ?difficulty=easy|medium|hard &topic=RC%20Filter
    """
    p = practice_mod.random_problem(difficulty=difficulty, topic=topic)
    return {
        "id": p["id"],
        "topic": p["topic"],
        "difficulty": p["difficulty"],
        "prompt": p["prompt"],
        "challenge": p["challenge"],
        "learning_objective": p["learning_objective"],
        "hint": p["hint"],
    }


@app.get("/api/practice/topics")
def practice_topics():
    return {"topics": practice_mod.all_topics()}


# ═══════════════════════════════════════════════════════════════
#  AUTHENTICATION (Google OAuth + signed-cookie session)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/auth/config")
def auth_config():
    """Tell the frontend whether Google OAuth is wired up.
    Lets the UI hide the login button when running locally without creds."""
    return {"google": google_configured()}


@app.get("/api/auth/google", name="google_login")
async def google_login(request: Request):
    """Kicks off the OAuth dance — redirects to Google's consent screen."""
    if not google_configured():
        return RedirectResponse(url="/?auth_error=not_configured")
    redirect_uri = str(request.url_for("google_callback"))
    return await oauth.google.authorize_redirect(request, redirect_uri)


@app.get("/api/auth/google/callback", name="google_callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """Google redirects here with ?code=... We exchange for an id_token,
    upsert the user, set session['user_id'], and redirect to /."""
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        print(f"[auth] google callback exchange failed: {e}")
        return RedirectResponse(url="/?auth_error=exchange_failed")

    userinfo = token.get("userinfo") or {}
    sub = userinfo.get("sub")
    email = userinfo.get("email")
    name = userinfo.get("name")
    picture = userinfo.get("picture")

    if not sub or not email:
        return RedirectResponse(url="/?auth_error=missing_userinfo")

    user = db.query(User).filter(User.google_sub == sub).first()
    if user is None:
        user = User(google_sub=sub, email=email, name=name, picture=picture)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Refresh display fields in case the user updated their Google profile
        dirty = False
        if user.name != name:    user.name = name;       dirty = True
        if user.picture != picture: user.picture = picture; dirty = True
        if dirty: db.commit()

    request.session["user_id"] = user.id
    return RedirectResponse(url="/?auth=ok")


@app.post("/api/auth/logout")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@app.get("/api/me")
def me(user: User | None = Depends(current_user_optional)):
    """Returns the current user, or {user: null} when not signed in.
    Frontend calls this on every page load to determine auth state."""
    if user is None:
        return {"user": None}
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "picture": user.picture,
            "edu": is_edu_email(user.email),
        }
    }


# ═══════════════════════════════════════════════════════════════
#  CLOUD HISTORY (per-user, max 50 items)
# ═══════════════════════════════════════════════════════════════

class HistoryAddRequest(BaseModel):
    prompt: str
    kind: str | None = None
    title: str | None = None


@app.get("/api/history")
def get_history(
    user: User = Depends(current_user_required),
    db: Session = Depends(get_db),
):
    items = (
        db.query(HistoryItem)
        .filter(HistoryItem.user_id == user.id)
        .order_by(HistoryItem.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "items": [
            {
                "id": i.id,
                "prompt": i.prompt,
                "kind": i.kind,
                "title": i.title,
                "ts": int(i.created_at.timestamp() * 1000),
            }
            for i in items
        ]
    }


@app.post("/api/history")
def add_history(
    item: HistoryAddRequest,
    user: User = Depends(current_user_required),
    db: Session = Depends(get_db),
):
    # de-dup: if the user already has this exact prompt, remove the old entry first
    db.query(HistoryItem).filter(
        HistoryItem.user_id == user.id,
        HistoryItem.prompt == item.prompt,
    ).delete(synchronize_session=False)

    new_item = HistoryItem(
        user_id=user.id,
        prompt=item.prompt,
        kind=item.kind,
        title=item.title,
    )
    db.add(new_item)
    db.commit()

    # Enforce 50-item cap per user — drop oldest excess
    excess = (
        db.query(HistoryItem)
        .filter(HistoryItem.user_id == user.id)
        .order_by(HistoryItem.created_at.desc())
        .offset(50)
        .all()
    )
    for e in excess:
        db.delete(e)
    if excess:
        db.commit()

    return {"ok": True}


@app.delete("/api/history")
def clear_history(
    user: User = Depends(current_user_required),
    db: Session = Depends(get_db),
):
    db.query(HistoryItem).filter(HistoryItem.user_id == user.id).delete()
    db.commit()
    return {"ok": True}


class HistoryBulkRequest(BaseModel):
    items: list[HistoryAddRequest]


@app.post("/api/history/bulk")
def add_history_bulk(
    req: HistoryBulkRequest,
    user: User = Depends(current_user_required),
    db: Session = Depends(get_db),
):
    """One-shot migration endpoint: frontend posts its entire localStorage
    history the first time the user signs in, so they don't lose past work."""
    seen_prompts = set()
    for item in req.items:
        if item.prompt in seen_prompts:
            continue
        seen_prompts.add(item.prompt)

        db.query(HistoryItem).filter(
            HistoryItem.user_id == user.id,
            HistoryItem.prompt == item.prompt,
        ).delete(synchronize_session=False)

        db.add(HistoryItem(
            user_id=user.id, prompt=item.prompt, kind=item.kind, title=item.title,
        ))
    db.commit()

    # Cap at 50
    excess = (
        db.query(HistoryItem)
        .filter(HistoryItem.user_id == user.id)
        .order_by(HistoryItem.created_at.desc())
        .offset(50)
        .all()
    )
    for e in excess:
        db.delete(e)
    if excess:
        db.commit()
    return {"ok": True, "imported": len(seen_prompts)}


def _render_and_solve(kind: DiagramKind, spec) -> dict:
    """Shared pipeline: take a validated spec, render it, run the solver.
    Returns dict with image_b64, mermaid_code, solution_payload.
    Used by both /api/generate (after LLM) and /api/rerender (no LLM)."""
    image_b64 = ""
    mermaid_code = ""
    solution_payload = {"solvable": False, "summary": "", "steps": [], "quantities": {}}

    try:
        if kind == DiagramKind.CIRCUIT and isinstance(spec, CircuitSpec):
            png = render_circuit(spec)
            image_b64 = base64.b64encode(png).decode("ascii")
            sol = solver_mod.solve(spec)
            if sol is not None:
                solution_payload = {
                    "solvable": sol.solvable,
                    "summary": sol.summary,
                    "steps": sol.steps,
                    "quantities": sol.quantities,
                }

        elif kind == DiagramKind.PHYSICS and isinstance(spec, PhysicsSpec):
            png = render_physics(spec)
            image_b64 = base64.b64encode(png).decode("ascii")

        elif kind == DiagramKind.BLOCK and isinstance(spec, GraphSpec):
            png = render_graphviz(spec)
            image_b64 = base64.b64encode(png).decode("ascii")

        elif kind in (DiagramKind.FLOWCHART, DiagramKind.SEQUENCE,
                      DiagramKind.STATE) and isinstance(spec, GraphSpec):
            mermaid_code = render_mermaid(spec, kind)

    except Exception as e:
        print(f"[api] render error for {kind}: {e}")
        solution_payload["summary"] = f"Render error: {e}"

    return {
        "image_b64": image_b64,
        "mermaid_code": mermaid_code,
        "solution": solution_payload,
    }


@app.post("/api/generate", response_model=GenerateResponse)
def generate(
    req: GenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    t0 = time.time()

    route = route_prompt(req.prompt)
    spec = build_spec(req.prompt, route)
    out = _render_and_solve(route.kind, spec)

    elapsed_ms = int((time.time() - t0) * 1000)
    is_offline = not bool(os.environ.get("GROQ_API_KEY"))

    # Log every generation for the admin dashboard (user_id nullable for anon)
    try:
        user_id = request.session.get("user_id")
        db.add(GenerationLog(
            user_id=user_id,
            prompt=req.prompt,
            kind=route.kind.value,
            title=getattr(spec, "title", ""),
            latency_ms=elapsed_ms,
            offline=is_offline,
        ))
        db.commit()
    except Exception as e:
        print(f"[api] failed to write generation log: {e}")

    return GenerateResponse(
        ok=True,
        kind=route.kind.value,
        title=getattr(spec, "title", ""),
        spec=spec.model_dump(),
        image_b64=out["image_b64"],
        mermaid_code=out["mermaid_code"],
        solution=out["solution"],
        meta={
            "routing_reason": route.reasoning,
            "elapsed_ms": elapsed_ms,
            "offline": is_offline,
        },
    )


@app.post("/api/rerender", response_model=GenerateResponse)
def rerender(req: RerenderRequest):
    """Re-render and re-solve from a modified spec — no LLM call.
    Lets the frontend tweak component values (1kOhm -> 5kOhm) and get
    a fresh diagram + solved math in <100ms."""
    t0 = time.time()

    # parse kind enum
    try:
        kind = DiagramKind(req.kind)
    except ValueError:
        return GenerateResponse(
            ok=False, kind=req.kind, title="", spec=req.spec,
            image_b64="", mermaid_code="",
            solution={"solvable": False, "summary": f"unknown kind: {req.kind}", "steps": [], "quantities": {}},
            meta={"elapsed_ms": 0, "offline": True, "routing_reason": "rerender"},
        )

    # validate spec against the right schema
    try:
        if kind == DiagramKind.CIRCUIT:
            spec = CircuitSpec(**req.spec)
        elif kind == DiagramKind.PHYSICS:
            spec = PhysicsSpec(**req.spec)
        else:
            spec = GraphSpec(**req.spec)
    except Exception as e:
        return GenerateResponse(
            ok=False, kind=req.kind, title="", spec=req.spec,
            image_b64="", mermaid_code="",
            solution={"solvable": False, "summary": f"spec validation failed: {e}", "steps": [], "quantities": {}},
            meta={"elapsed_ms": 0, "offline": True, "routing_reason": "rerender"},
        )

    out = _render_and_solve(kind, spec)

    return GenerateResponse(
        ok=True,
        kind=kind.value,
        title=getattr(spec, "title", ""),
        spec=spec.model_dump(),
        image_b64=out["image_b64"],
        mermaid_code=out["mermaid_code"],
        solution=out["solution"],
        meta={
            "routing_reason": "rerender (no LLM)",
            "elapsed_ms": int((time.time() - t0) * 1000),
            "offline": not bool(os.environ.get("GROQ_API_KEY")),
        },
    )


# ═══════════════════════════════════════════════════════════════
#  ADMIN ROUTES  (ADMIN_EMAIL env var guards every endpoint)
# ═══════════════════════════════════════════════════════════════

from sqlalchemy import func, desc
from datetime import datetime, timedelta


@app.get("/api/admin/stats")
def admin_stats(
    _admin: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """High-level numbers for the dashboard header cards."""
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_gens  = db.query(func.count(GenerationLog.id)).scalar() or 0

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_gens  = db.query(func.count(GenerationLog.id)).filter(
        GenerationLog.created_at >= today_start
    ).scalar() or 0

    live_gens = db.query(func.count(GenerationLog.id)).filter(
        GenerationLog.offline == False  # noqa: E712
    ).scalar() or 0

    avg_latency = db.query(func.avg(GenerationLog.latency_ms)).filter(
        GenerationLog.offline == False  # noqa: E712
    ).scalar()

    # kind breakdown
    kind_rows = db.query(
        GenerationLog.kind,
        func.count(GenerationLog.id).label("cnt")
    ).group_by(GenerationLog.kind).all()

    return {
        "total_users":  total_users,
        "total_gens":   total_gens,
        "today_gens":   today_gens,
        "live_gens":    live_gens,
        "offline_gens": total_gens - live_gens,
        "avg_latency_ms": round(avg_latency) if avg_latency else None,
        "by_kind": {row.kind or "unknown": row.cnt for row in kind_rows},
    }


@app.get("/api/admin/users")
def admin_users(
    offset: int = 0,
    limit: int = 50,
    _admin: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """All registered users with their generation counts."""
    users = db.query(User).order_by(desc(User.created_at)).offset(offset).limit(limit).all()
    total = db.query(func.count(User.id)).scalar() or 0

    rows = []
    for u in users:
        gen_count = db.query(func.count(GenerationLog.id)).filter(
            GenerationLog.user_id == u.id
        ).scalar() or 0
        last_gen = db.query(func.max(GenerationLog.created_at)).filter(
            GenerationLog.user_id == u.id
        ).scalar()
        rows.append({
            "id":         u.id,
            "email":      u.email,
            "name":       u.name or "",
            "picture":    u.picture or "",
            "edu":        is_edu_email(u.email),
            "gen_count":  gen_count,
            "joined_at":  int(u.created_at.timestamp() * 1000),
            "last_gen_at": int(last_gen.timestamp() * 1000) if last_gen else None,
        })

    return {"total": total, "users": rows}


@app.get("/api/admin/logs")
def admin_logs(
    offset: int = 0,
    limit: int = 100,
    _admin: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Recent generation logs across all users (signed-in and anonymous)."""
    logs = (
        db.query(GenerationLog)
        .order_by(desc(GenerationLog.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = db.query(func.count(GenerationLog.id)).scalar() or 0

    rows = []
    for lg in logs:
        rows.append({
            "id":         lg.id,
            "prompt":     lg.prompt,
            "kind":       lg.kind or "",
            "title":      lg.title or "",
            "latency_ms": lg.latency_ms,
            "offline":    lg.offline,
            "user_id":    lg.user_id,
            "user_email": lg.user.email if lg.user else None,
            "created_at": int(lg.created_at.timestamp() * 1000),
        })

    return {"total": total, "logs": rows}


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    _admin: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Remove a user account and all their history. Logs are kept (user_id set to NULL)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="user not found")
    db.delete(user)
    db.commit()
    return {"ok": True}


from fastapi.responses import FileResponse

# Serve the built React frontend
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
