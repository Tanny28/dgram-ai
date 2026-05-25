"""
DiagramAI :: Physics Renderer (Matplotlib)
==========================================
Renders PhysicsSpec (free-body / force diagrams) using Matplotlib.
Draws a central body with labeled force vectors.
"""
from __future__ import annotations
import io
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from core.schemas import PhysicsSpec


def render_physics(spec: PhysicsSpec) -> bytes:
    """Render a PhysicsSpec to PNG bytes."""
    fig, ax = plt.subplots(1, 1, figsize=(6, 5))
    ax.set_xlim(-2, 2)
    ax.set_ylim(-2, 2)
    ax.set_aspect("equal")
    ax.set_title(spec.title, fontsize=14, fontweight="bold", pad=12)
    ax.axis("off")

    # draw the body as a filled square at center
    body_size = 0.45
    body = patches.FancyBboxPatch(
        (-body_size, -body_size), body_size * 2, body_size * 2,
        boxstyle="round,pad=0.05",
        facecolor="#e8edf2", edgecolor="#3d4f5f", linewidth=2,
    )
    ax.add_patch(body)
    ax.text(0, 0, spec.body_label, ha="center", va="center",
            fontsize=16, fontweight="bold", color="#2d3748")

    # draw force vectors
    for f in spec.forces:
        scale = 1.1
        dx, dy = f.dx * scale, f.dy * scale
        # arrow starts from the edge of the body, not center
        sx = body_size * (1 if dx > 0 else (-1 if dx < 0 else 0))
        sy = body_size * (1 if dy > 0 else (-1 if dy < 0 else 0))
        ax.annotate(
            "", xy=(sx + dx, sy + dy), xytext=(sx, sy),
            arrowprops=dict(
                arrowstyle="-|>", color=f.color, lw=2.5,
                mutation_scale=18,
            ),
        )
        # label at the tip of the arrow
        lx = sx + dx * 1.15
        ly = sy + dy * 1.15
        ax.text(lx, ly, f.label, ha="center", va="center",
                fontsize=10, color=f.color, fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.15", facecolor="white",
                          edgecolor=f.color, alpha=0.85, linewidth=0.8))

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


if __name__ == "__main__":
    from core.schemas import Vector2D
    demo = PhysicsSpec(
        title="Block on Inclined Plane",
        body_label="m",
        forces=[
            Vector2D(label="Weight (mg)", dx=0, dy=-1, color="#e53e3e"),
            Vector2D(label="Normal (N)", dx=-0.5, dy=0.87, color="#3182ce"),
            Vector2D(label="Friction (f)", dx=-0.87, dy=-0.5, color="#dd6b20"),
        ],
    )
    data = render_physics(demo)
    open("/tmp/test_physics.png", "wb").write(data)
    print(f"rendered {len(data)} bytes")
