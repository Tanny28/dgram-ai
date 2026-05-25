"""
DiagramAI :: Mermaid Renderer
=============================
Converts a GraphSpec into Mermaid syntax. The frontend renders the Mermaid
code using the mermaid.js library — we just produce the text definition.
For the API we return the mermaid string; the frontend handles the rendering.
"""
from __future__ import annotations
from core.schemas import GraphSpec, DiagramKind


_SHAPE_MAP = {
    "box":     ('["', '"]'),
    "round":   ('("', '")'),
    "diamond": ('{"', '"}'),
    "circle":  ('(("', '"))'),
    "stadium": ('(["', '"])'),
}


def render_mermaid(spec: GraphSpec, kind: DiagramKind = DiagramKind.FLOWCHART) -> str:
    """Return a mermaid diagram definition string."""

    if kind == DiagramKind.SEQUENCE:
        return _sequence(spec)
    if kind == DiagramKind.STATE:
        return _state(spec)

    # flowchart / block
    direction = spec.direction if spec.direction in ("TD", "LR", "BT", "RL") else "TD"
    lines = [f"graph {direction}"]

    for n in spec.nodes:
        l, r = _SHAPE_MAP.get(n.shape, _SHAPE_MAP["box"])
        safe = n.label.replace('"', "'")
        lines.append(f'    {n.id}{l}{safe}{r}')

    for e in spec.edges:
        if e.label:
            safe = e.label.replace('"', "'")
            lines.append(f'    {e.source} -->|"{safe}"| {e.target}')
        else:
            lines.append(f'    {e.source} --> {e.target}')

    return "\n".join(lines)


def _sequence(spec: GraphSpec) -> str:
    lines = ["sequenceDiagram"]
    for n in spec.nodes:
        lines.append(f"    participant {n.id} as {n.label}")
    for e in spec.edges:
        label = e.label or " "
        lines.append(f"    {e.source}->>+{e.target}: {label}")
    return "\n".join(lines)


def _state(spec: GraphSpec) -> str:
    lines = ["stateDiagram-v2"]
    for n in spec.nodes:
        lines.append(f"    {n.id} : {n.label}")
    for e in spec.edges:
        label = f" : {e.label}" if e.label else ""
        lines.append(f"    {e.source} --> {e.target}{label}")
    return "\n".join(lines)


if __name__ == "__main__":
    from core.schemas import GraphNode, GraphEdge
    demo = GraphSpec(
        title="Binary Search Flowchart",
        direction="TD",
        nodes=[
            GraphNode(id="S", label="Start", shape="stadium"),
            GraphNode(id="I", label="Set low=0, high=n-1", shape="box"),
            GraphNode(id="C", label="low <= high?", shape="diamond"),
            GraphNode(id="M", label="mid = (low+high)/2", shape="box"),
            GraphNode(id="F", label="arr[mid] == target?", shape="diamond"),
            GraphNode(id="R", label="Return mid", shape="stadium"),
            GraphNode(id="L", label="target < arr[mid]?", shape="diamond"),
            GraphNode(id="H", label="high = mid - 1", shape="box"),
            GraphNode(id="LO", label="low = mid + 1", shape="box"),
            GraphNode(id="NF", label="Not Found", shape="stadium"),
        ],
        edges=[
            GraphEdge(source="S", target="I", label=""),
            GraphEdge(source="I", target="C", label=""),
            GraphEdge(source="C", target="M", label="Yes"),
            GraphEdge(source="C", target="NF", label="No"),
            GraphEdge(source="M", target="F", label=""),
            GraphEdge(source="F", target="R", label="Yes"),
            GraphEdge(source="F", target="L", label="No"),
            GraphEdge(source="L", target="H", label="Yes"),
            GraphEdge(source="L", target="LO", label="No"),
            GraphEdge(source="H", target="C", label=""),
            GraphEdge(source="LO", target="C", label=""),
        ],
    )
    print(render_mermaid(demo))
