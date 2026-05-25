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

# Mermaid reserves these tokens — using them as node IDs breaks the parser
# (`end` closes a subgraph block, `start`/`default`/etc. have grammar meaning).
# LLMs love to name nodes "start" and "end", so we prefix any reserved id.
_MERMAID_RESERVED = {
    "end", "start", "default", "subgraph", "direction",
    "class", "classDef", "style", "click", "linkStyle",
    "graph", "flowchart", "state", "stateDiagram",
}


def _safe_id(node_id: str) -> str:
    """Prefix reserved mermaid keywords with `n_` to avoid parser collisions."""
    if node_id.lower() in _MERMAID_RESERVED:
        return f"n_{node_id}"
    return node_id


def render_mermaid(spec: GraphSpec, kind: DiagramKind = DiagramKind.FLOWCHART) -> str:
    """Return a mermaid diagram definition string."""

    if kind == DiagramKind.SEQUENCE:
        return _sequence(spec)
    if kind == DiagramKind.STATE:
        return _state(spec)

    # flowchart / block
    direction = spec.direction if spec.direction in ("TD", "LR", "BT", "RL") else "TD"
    lines = [f"flowchart {direction}"]

    for n in spec.nodes:
        l, r = _SHAPE_MAP.get(n.shape, _SHAPE_MAP["box"])
        # strip chars that break mermaid's parser inside node labels
        safe = n.label.replace('"', "'").replace('(', '[').replace(')', ']')
        lines.append(f'    {_safe_id(n.id)}{l}{safe}{r}')

    for e in spec.edges:
        src, tgt = _safe_id(e.source), _safe_id(e.target)
        if e.label:
            # quote-free pipe labels — avoid parser issues with special chars
            safe = e.label.replace('"', "'").replace('|', '/').replace('[', '(').replace(']', ')')
            lines.append(f'    {src} -->|{safe}| {tgt}')
        else:
            lines.append(f'    {src} --> {tgt}')

    return "\n".join(lines)


def _sequence(spec: GraphSpec) -> str:
    lines = ["sequenceDiagram"]
    for n in spec.nodes:
        # sanitize participant labels — strip chars that break the parser
        safe_label = n.label.replace('"', "'").replace(':', '-').replace('\n', ' ')
        lines.append(f"    participant {_safe_id(n.id)} as {safe_label}")
    for e in spec.edges:
        label = (e.label or "").replace('"', "'").replace(':', '-').strip() or "call"
        # Use plain ->> (no activation +) — activation boxes require matching
        # deactivation lines that the LLM/offline spec never emits, causing
        # mermaid v10/v11 to throw a parse error.
        lines.append(f"    {_safe_id(e.source)}->>{_safe_id(e.target)}: {label}")
    return "\n".join(lines)


def _state(spec: GraphSpec) -> str:
    lines = ["stateDiagram-v2"]
    for n in spec.nodes:
        # strip chars that break stateDiagram-v2 parser (:, ?, [, {)
        safe = n.label.replace(':', '-').replace('?', '').replace('[', '(').replace(']', ')').replace('{', '(').replace('}', ')')
        lines.append(f"    {_safe_id(n.id)}: {safe}")
    for e in spec.edges:
        src, tgt = _safe_id(e.source), _safe_id(e.target)
        if e.label:
            safe_label = e.label.replace(':', '-').replace('?', '').strip()
            lines.append(f"    {src} --> {tgt}: {safe_label}")
        else:
            lines.append(f"    {src} --> {tgt}")
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
