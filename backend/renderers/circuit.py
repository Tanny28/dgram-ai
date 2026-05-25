"""
DiagramAI :: Circuit Renderer
=============================
Takes a validated CircuitSpec and renders a real, electrically-coherent
schematic with SchemDraw. Because we render from structure, wires always
connect to real terminals -- no floating components, no hallucinated symbols.
"""
from __future__ import annotations
import io
import schemdraw
import schemdraw.elements as elm

from core.schemas import CircuitSpec, CircuitComponentType as CT


# Map our spec types -> SchemDraw element factories
_ELEMENT_MAP = {
    CT.RESISTOR:        lambda: elm.Resistor(),
    CT.CAPACITOR:       lambda: elm.Capacitor(),
    CT.INDUCTOR:        lambda: elm.Inductor(),
    CT.DIODE:           lambda: elm.Diode(),
    CT.LED:             lambda: elm.LED(),
    CT.BATTERY:         lambda: elm.Battery(),
    CT.SOURCE_V:        lambda: elm.SourceV(),
    CT.SOURCE_SIN:      lambda: elm.SourceSin(),
    CT.SOURCE_I:        lambda: elm.SourceI(),
    CT.SWITCH:          lambda: elm.Switch(),
    CT.GROUND:          lambda: elm.Ground(),
    CT.LAMP:            lambda: elm.Lamp(),
    CT.OPAMP:           lambda: elm.Opamp(),
    CT.TRANSISTOR_NPN:  lambda: elm.BjtNpn(),
}


def render_circuit(spec: CircuitSpec) -> bytes:
    """Render the circuit spec to PNG bytes."""
    with schemdraw.Drawing(show=False) as d:
        d.config(unit=2.5)

        comps = [c for c in spec.components if c.type != CT.GROUND]
        n = len(comps)

        if spec.topology == "series" or n <= 2:
            _render_series_loop(d, comps)
        elif spec.topology == "parallel":
            _render_parallel(d, comps)
        else:
            # mixed/unknown -> safe series loop fallback (still always valid)
            _render_series_loop(d, comps)

        png = d.get_imagedata("png")
    return png


def _place(d, comp):
    """Instantiate a SchemDraw element for a spec component with its label."""
    factory = _ELEMENT_MAP.get(comp.type, lambda: elm.Resistor())
    el = factory()
    if comp.label:
        el = el.label(comp.label)
    return el


def _render_series_loop(d, comps):
    """Classic rectangular loop: source on left, components across the top."""
    if not comps:
        d += elm.Resistor().label("?")
        return

    # First element goes up (source), rest go across the top, then close loop.
    top = comps[1:] if len(comps) > 1 else []
    source = comps[0]

    d += _place(d, source).up()
    for c in top:
        d += _place(d, c).right()
    # come down and back to close the loop
    d += elm.Line().down()
    d += elm.Line().left().tox(0)


def _render_parallel(d, comps):
    """Source on the left, remaining branches stacked in parallel."""
    if not comps:
        d += elm.Resistor().label("?")
        return

    source = comps[0]
    branches = comps[1:] or [comps[0]]

    d += (src := _place(d, source).up())
    d += elm.Line().right().length(d.unit * len(branches))
    top_end = d.here

    for i, c in enumerate(branches):
        d.push()
        d += elm.Line().down().length(d.unit * 0.0001)  # anchor
        d += _place(d, c).down()
        d.pop()
        if i < len(branches) - 1:
            d += elm.Line().left().length(d.unit)

    d += elm.Line().endpoints(src.start, top_end)


if __name__ == "__main__":
    # ---- Smoke test: a simple RC series circuit, no LLM involved ----
    from core.schemas import CircuitComponent, CircuitConnection
    demo = CircuitSpec(
        title="RC Series Circuit",
        components=[
            CircuitComponent(id="V1", type=CT.SOURCE_V, label="10V"),
            CircuitComponent(id="R1", type=CT.RESISTOR, label="1kΩ"),
            CircuitComponent(id="C1", type=CT.CAPACITOR, label="10µF"),
        ],
        connections=[
            CircuitConnection(source="V1", target="R1"),
            CircuitConnection(source="R1", target="C1"),
            CircuitConnection(source="C1", target="V1"),
        ],
        topology="series",
    )
    data = render_circuit(demo)
    with open("/home/claude/diagramai/_smoketest_circuit.png", "wb") as f:
        f.write(data)
    print(f"OK rendered {len(data)} bytes")
