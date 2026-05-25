"""
DiagramAI :: The Brain
======================
Two-stage LLM pipeline, both stages using Groq strict structured outputs:

  Stage A (route):   prompt -> DiagramRoute   (which renderer family?)
  Stage B (fill):    prompt -> <KindSpec>     (fill the exact schema)

Strict mode = constrained decoding = the model is *physically incapable* of
emitting JSON that violates the schema. That is the reliability guarantee we
sell in the interview: the spec is correct-by-construction.

If GROQ_API_KEY is missing or the network is down, we fall back to a small
library of canned specs so the live demo NEVER dies on bad conference wifi.
"""
from __future__ import annotations
import os
import json
from typing import Type, TypeVar

from pydantic import BaseModel

from core.schemas import (
    DiagramRoute, DiagramKind,
    CircuitSpec, GraphSpec, PhysicsSpec,
)
from core import offline_fallback

T = TypeVar("T", bound=BaseModel)

DEFAULT_MODEL = os.environ.get("DIAGRAMAI_MODEL", "llama-3.3-70b-versatile")

_SPEC_FOR_KIND = {
    DiagramKind.CIRCUIT:   CircuitSpec,
    DiagramKind.FLOWCHART: GraphSpec,
    DiagramKind.BLOCK:     GraphSpec,
    DiagramKind.SEQUENCE:  GraphSpec,
    DiagramKind.STATE:     GraphSpec,
    DiagramKind.PHYSICS:   PhysicsSpec,
}


def _strict_schema(model: Type[BaseModel]) -> dict:
    """Produce a Groq-strict JSON schema: additionalProperties:false everywhere
    and every property in 'required'. Pydantic gets us most of the way; we
    walk the schema to enforce the rest."""
    schema = model.model_json_schema()

    def _harden(node: dict):
        if not isinstance(node, dict):
            return
        if node.get("type") == "object" or "properties" in node:
            node["additionalProperties"] = False
            props = node.get("properties", {})
            node["required"] = list(props.keys())
            for v in props.values():
                _harden(v)
        for key in ("items", "$defs", "definitions"):
            sub = node.get(key)
            if isinstance(sub, dict):
                # $defs maps name -> schema
                if key in ("$defs", "definitions"):
                    for d in sub.values():
                        _harden(d)
                else:
                    _harden(sub)
        for v in node.get("anyOf", []):
            _harden(v)

    _harden(schema)
    return schema


def _get_client():
    """Lazy import so the module loads even without groq installed (offline)."""
    try:
        from groq import Groq
    except ImportError:
        return None
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return None
    return Groq(api_key=key)


def _call_structured(client, model_cls: Type[T], system: str, user: str) -> T:
    """One Groq call constrained to model_cls. Raises on failure (caller handles)."""
    schema = _strict_schema(model_cls)
    resp = client.chat.completions.create(
        model=DEFAULT_MODEL,
        temperature=0,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": model_cls.__name__,
                "strict": True,
                "schema": schema,
            },
        },
    )
    raw = resp.choices[0].message.content
    return model_cls.model_validate_json(raw)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def route_prompt(prompt: str) -> DiagramRoute:
    client = _get_client()
    if client is None:
        return offline_fallback.route(prompt)
    try:
        return _call_structured(
            client, DiagramRoute,
            system=(
                "You are a routing engine for an engineering-diagram generator. "
                "Classify the user's request into exactly one diagram kind. "
                "circuit=electrical schematics; flowchart=process/decision flows; "
                "block=system block/architecture diagrams; sequence=interaction "
                "over time; state=state machines; physics=free-body/force diagrams."
            ),
            user=prompt,
        )
    except Exception as e:
        print(f"[brain] route fell back to offline: {e}")
        return offline_fallback.route(prompt)


def build_spec(prompt: str, route: DiagramRoute) -> BaseModel:
    spec_cls = _SPEC_FOR_KIND[route.kind]
    client = _get_client()
    if client is None:
        return offline_fallback.spec(prompt, route.kind)
    try:
        return _call_structured(
            client, spec_cls,
            system=_SPEC_SYSTEM_PROMPTS[route.kind],
            user=prompt,
        )
    except Exception as e:
        print(f"[brain] spec fell back to offline: {e}")
        return offline_fallback.spec(prompt, route.kind)


_SPEC_SYSTEM_PROMPTS = {
    DiagramKind.CIRCUIT: (
        "You convert an electrical-engineering request into a CircuitSpec. "
        "Give every component a unique id (R1, C1, V1...). List connections as "
        "a closed loop so current can flow. Use realistic labels with units. "
        "Choose topology 'series', 'parallel', or 'mixed'."
    ),
    DiagramKind.FLOWCHART: (
        "Convert the request into a GraphSpec describing a flowchart. Use shape "
        "'diamond' for decisions, 'box' for processes, 'stadium' for start/end. "
        "direction is usually 'TD'. Label decision edges 'Yes'/'No'."
    ),
    DiagramKind.BLOCK: (
        "Convert the request into a GraphSpec of system blocks. Use 'box' shapes "
        "and 'LR' direction unless the request implies otherwise."
    ),
    DiagramKind.SEQUENCE: (
        "Convert the request into a GraphSpec where nodes are participants and "
        "edges are time-ordered messages with labels."
    ),
    DiagramKind.STATE: (
        "Convert the request into a GraphSpec of states ('round' shapes) and "
        "labelled transitions."
    ),
    DiagramKind.PHYSICS: (
        "Convert the request into a PhysicsSpec: one central body and the force "
        "vectors acting on it. Use dx/dy in [-1,1], and clear color names."
    ),
}


if __name__ == "__main__":
    # Offline smoke test (no key needed)
    os.environ.pop("GROQ_API_KEY", None)
    r = route_prompt("draw an RC low-pass filter")
    print("route:", r.kind, "-", r.reasoning)
    s = build_spec("draw an RC low-pass filter", r)
    print("spec title:", s.title)
