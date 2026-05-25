"""
DiagramAI :: Structured Specification Schemas
==============================================
The core idea: an engineering diagram is NOT a picture. It is a structured
specification (components + connections). The LLM's only job is to fill these
schemas. A deterministic renderer turns the schema into a guaranteed-correct
diagram. This eliminates hallucinated, electrically-nonsense output.

NOTE on Groq strict mode: Groq's structured-output is stricter than OpenAI's.
Every property MUST appear in the 'required' list or Groq returns a 400.
Pydantic's model_json_schema() lists all fields as required by default when
they have no default value, so we keep fields non-optional and use sentinels.
"""
from __future__ import annotations
from enum import Enum
from typing import List
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Top-level routing: which family of diagram are we building?
# ---------------------------------------------------------------------------
class DiagramKind(str, Enum):
    CIRCUIT = "circuit"          # -> SchemDraw
    FLOWCHART = "flowchart"      # -> Mermaid
    BLOCK = "block"              # -> Graphviz
    SEQUENCE = "sequence"        # -> Mermaid
    STATE = "state"             # -> Mermaid / SchemDraw
    PHYSICS = "physics"          # -> Matplotlib


# ---------------------------------------------------------------------------
# CIRCUIT spec  (the showpiece)
# ---------------------------------------------------------------------------
class CircuitComponentType(str, Enum):
    RESISTOR = "resistor"
    CAPACITOR = "capacitor"
    INDUCTOR = "inductor"
    DIODE = "diode"
    LED = "led"
    BATTERY = "battery"
    SOURCE_V = "source_v"        # generic voltage source
    SOURCE_SIN = "source_sin"    # AC source
    SOURCE_I = "source_i"        # current source
    SWITCH = "switch"
    GROUND = "ground"
    OPAMP = "opamp"
    TRANSISTOR_NPN = "transistor_npn"
    LAMP = "lamp"


class CircuitComponent(BaseModel):
    id: str = Field(description="Unique node id, e.g. 'R1', 'C1', 'V1'.")
    type: CircuitComponentType
    label: str = Field(description="Display label e.g. '10kΩ', '5V'. Empty string if none.")


class CircuitConnection(BaseModel):
    """A directed edge in the netlist: from one component to the next."""
    source: str = Field(description="id of the component the wire leaves from")
    target: str = Field(description="id of the component the wire enters")


class CircuitSpec(BaseModel):
    title: str
    components: List[CircuitComponent]
    connections: List[CircuitConnection]
    # series | parallel | mixed — guides the layout engine
    topology: str = Field(description="One of: 'series', 'parallel', 'mixed'.")


# ---------------------------------------------------------------------------
# FLOWCHART / BLOCK / SEQUENCE / STATE  (graph-shaped)
# ---------------------------------------------------------------------------
class GraphNode(BaseModel):
    id: str
    label: str
    shape: str = Field(description="'box','round','diamond','circle','stadium'")


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str = Field(description="Edge label, empty string if none.")


class GraphSpec(BaseModel):
    title: str
    direction: str = Field(description="'TD' top-down or 'LR' left-right")
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# ---------------------------------------------------------------------------
# PHYSICS  (free-body, forces, mechanics)
# ---------------------------------------------------------------------------
class Vector2D(BaseModel):
    label: str
    dx: float
    dy: float
    color: str = Field(description="matplotlib color name, e.g. 'red'")


class PhysicsSpec(BaseModel):
    title: str
    body_label: str = Field(description="Label for the central body/object.")
    forces: List[Vector2D]


# ---------------------------------------------------------------------------
# The envelope the LLM fills first (cheap classification call)
# ---------------------------------------------------------------------------
class DiagramRoute(BaseModel):
    kind: DiagramKind
    reasoning: str = Field(description="One sentence: why this kind fits the prompt.")
