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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from core.brain import route_prompt, build_spec
from core.schemas import DiagramKind, CircuitSpec, GraphSpec, PhysicsSpec
from core import solver as solver_mod
from core import practice_problems as practice_mod
from renderers.circuit import render_circuit
from renderers.graphviz_render import render_graphviz
from renderers.physics import render_physics
from renderers.mermaid_render import render_mermaid

app = FastAPI(title="DiagramAI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
def generate(req: GenerateRequest):
    t0 = time.time()

    route = route_prompt(req.prompt)
    spec = build_spec(req.prompt, route)
    out = _render_and_solve(route.kind, spec)

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
            "elapsed_ms": int((time.time() - t0) * 1000),
            "offline": not bool(os.environ.get("GROQ_API_KEY")),
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
