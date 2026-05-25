"""
DiagramAI :: Graphviz Renderer
==============================
Converts a GraphSpec into a PNG via the graphviz library.
Used for block diagrams and architecture diagrams where spatial layout matters.
"""
from __future__ import annotations
import graphviz as gv
from core.schemas import GraphSpec


_SHAPE_MAP = {
    "box":     "box",
    "round":   "ellipse",
    "diamond": "diamond",
    "circle":  "circle",
    "stadium": "rect",
}


def render_graphviz(spec: GraphSpec) -> bytes:
    """Render a GraphSpec to PNG bytes using Graphviz."""
    rankdir = spec.direction if spec.direction in ("TD", "LR", "BT", "RL") else "TB"
    # graphviz uses TB not TD
    if rankdir == "TD":
        rankdir = "TB"

    dot = gv.Digraph(format="png")
    dot.attr(rankdir=rankdir, bgcolor="white", fontname="Helvetica",
             margin="0.3", pad="0.2", dpi="150")
    dot.attr("node", style="filled", fillcolor="#f0f4f8", color="#4a5568",
             fontname="Helvetica", fontsize="12", shape="box",
             penwidth="1.2")
    dot.attr("edge", fontname="Helvetica", fontsize="10", color="#718096",
             penwidth="1.0")

    for n in spec.nodes:
        shape = _SHAPE_MAP.get(n.shape, "box")
        dot.node(n.id, n.label, shape=shape)

    for e in spec.edges:
        if e.label:
            dot.edge(e.source, e.target, label=f" {e.label} ")
        else:
            dot.edge(e.source, e.target)

    return dot.pipe()


if __name__ == "__main__":
    from core.schemas import GraphNode, GraphEdge
    demo = GraphSpec(
        title="Microservices Architecture",
        direction="LR",
        nodes=[
            GraphNode(id="C", label="Client", shape="stadium"),
            GraphNode(id="GW", label="API Gateway", shape="box"),
            GraphNode(id="A", label="Auth Service", shape="box"),
            GraphNode(id="O", label="Order Service", shape="box"),
            GraphNode(id="DB", label="Database", shape="circle"),
        ],
        edges=[
            GraphEdge(source="C", target="GW", label="HTTPS"),
            GraphEdge(source="GW", target="A", label="verify"),
            GraphEdge(source="GW", target="O", label="route"),
            GraphEdge(source="O", target="DB", label="query"),
        ],
    )
    data = render_graphviz(demo)
    open("/tmp/test_graphviz.png", "wb").write(data)
    print(f"rendered {len(data)} bytes")
