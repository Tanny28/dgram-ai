"""
DiagramAI :: Offline Fallback
=============================
A tiny rule-based router + canned specs. Used only when Groq is unavailable
(no key / no network). Keeps the live demo alive on bad conference wifi.
This is deliberately simple keyword matching -- it is a safety net, not the brain.
"""
from __future__ import annotations

import re

from core.schemas import (
    DiagramRoute, DiagramKind,
    CircuitSpec, CircuitComponent, CircuitConnection, CircuitComponentType as CT,
    GraphSpec, GraphNode, GraphEdge,
    PhysicsSpec, Vector2D,
)

_KEYWORDS = {
    DiagramKind.CIRCUIT:   ["circuit", "resistor", "capacitor", "voltage", "rc", "rl", "diode", "led", "amplifier", "filter"],
    DiagramKind.FLOWCHART: ["flowchart", "flow chart", "process", "if", "decision", "algorithm", "loop"],
    DiagramKind.PHYSICS:   ["force", "free body", "free-body", "incline", "gravity", "tension", "friction"],
    DiagramKind.SEQUENCE:  ["sequence", "interaction", "request", "response", "api call"],
    DiagramKind.STATE:     ["state machine", "state diagram", "fsm", "transition"],
    DiagramKind.BLOCK:     ["block", "architecture", "system diagram", "pipeline"],
}


def route(prompt: str) -> DiagramRoute:
    p = prompt.lower()

    def matches(word: str) -> bool:
        # word-boundary match so 'rc' doesn't fire inside 'search'
        return re.search(rf"\b{re.escape(word)}\b", p) is not None

    for kind, words in _KEYWORDS.items():
        hit = next((w for w in words if matches(w)), None)
        if hit:
            return DiagramRoute(kind=kind, reasoning=f"[offline] matched '{hit}' for {kind.value}")
    return DiagramRoute(kind=DiagramKind.CIRCUIT, reasoning="[offline] default to circuit")


def spec(prompt: str, kind: DiagramKind):
    p = (prompt or "").lower()
    if kind == DiagramKind.CIRCUIT:
        # pick a coherent canned circuit based on the prompt so even the
        # offline demo shows the RIGHT circuit, not always an RC filter
        if "divider" in p or ("series" in p and "1k" in p):
            return CircuitSpec(
                title="Voltage Divider (offline demo)",
                components=[
                    CircuitComponent(id="V1", type=CT.SOURCE_V, label="12V"),
                    CircuitComponent(id="R1", type=CT.RESISTOR, label="1kOhm"),
                    CircuitComponent(id="R2", type=CT.RESISTOR, label="2kOhm"),
                ],
                connections=[
                    CircuitConnection(source="V1", target="R1"),
                    CircuitConnection(source="R1", target="R2"),
                    CircuitConnection(source="R2", target="V1"),
                ],
                topology="series",
            )
        if "rlc" in p or "resonan" in p or ("inductor" in p and "capacitor" in p):
            return CircuitSpec(
                title="Series RLC Circuit (offline demo)",
                components=[
                    CircuitComponent(id="V1", type=CT.SOURCE_SIN, label="Vin"),
                    CircuitComponent(id="R1", type=CT.RESISTOR, label="50Ohm"),
                    CircuitComponent(id="L1", type=CT.INDUCTOR, label="10mH"),
                    CircuitComponent(id="C1", type=CT.CAPACITOR, label="100nF"),
                ],
                connections=[
                    CircuitConnection(source="V1", target="R1"),
                    CircuitConnection(source="R1", target="L1"),
                    CircuitConnection(source="L1", target="C1"),
                    CircuitConnection(source="C1", target="V1"),
                ],
                topology="series",
            )
        if "three" in p or "330" in p or ("series" in p and "resist" in p):
            return CircuitSpec(
                title="Series Resistors (offline demo)",
                components=[
                    CircuitComponent(id="V1", type=CT.SOURCE_V, label="9V"),
                    CircuitComponent(id="R1", type=CT.RESISTOR, label="100Ohm"),
                    CircuitComponent(id="R2", type=CT.RESISTOR, label="220Ohm"),
                    CircuitComponent(id="R3", type=CT.RESISTOR, label="330Ohm"),
                ],
                connections=[
                    CircuitConnection(source="V1", target="R1"),
                    CircuitConnection(source="R1", target="R2"),
                    CircuitConnection(source="R2", target="R3"),
                    CircuitConnection(source="R3", target="V1"),
                ],
                topology="series",
            )
        # default: RC low-pass
        return CircuitSpec(
            title="RC Low-Pass Filter (offline demo)",
            components=[
                CircuitComponent(id="V1", type=CT.SOURCE_SIN, label="Vin"),
                CircuitComponent(id="R1", type=CT.RESISTOR, label="1kOhm"),
                CircuitComponent(id="C1", type=CT.CAPACITOR, label="100nF"),
            ],
            connections=[
                CircuitConnection(source="V1", target="R1"),
                CircuitConnection(source="R1", target="C1"),
                CircuitConnection(source="C1", target="V1"),
            ],
            topology="series",
        )
    if kind == DiagramKind.PHYSICS:
        return PhysicsSpec(
            title="Block on a Surface (offline demo)",
            body_label="m",
            forces=[
                Vector2D(label="Weight (mg)", dx=0, dy=-1, color="red"),
                Vector2D(label="Normal (N)", dx=0, dy=1, color="blue"),
                Vector2D(label="Applied (F)", dx=1, dy=0, color="green"),
                Vector2D(label="Friction (f)", dx=-0.6, dy=0, color="orange"),
            ],
        )
    # graph-shaped kinds share GraphSpec
    return GraphSpec(
        title=f"{kind.value.title()} (offline demo)",
        direction="TD",
        nodes=[
            GraphNode(id="A", label="Start", shape="stadium"),
            GraphNode(id="B", label="Process", shape="box"),
            GraphNode(id="C", label="Decision?", shape="diamond"),
            GraphNode(id="D", label="End", shape="stadium"),
        ],
        edges=[
            GraphEdge(source="A", target="B", label=""),
            GraphEdge(source="B", target="C", label=""),
            GraphEdge(source="C", target="D", label="Yes"),
            GraphEdge(source="C", target="B", label="No"),
        ],
    )
