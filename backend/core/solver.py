"""
DiagramAI :: Circuit Solver
===========================
The differentiator. Because we hold the circuit as a STRUCTURED SPEC (a
netlist), we can do real engineering math on it -- not just draw it. A
diffusion model has pixels; we have the actual component values.

Scope decision (defensible in interview): we solve the COMMON NAMED circuits
that ~80% of 2nd-year students actually ask for, each with a clean closed-form
solution and full step-by-step working. The architecture is extensible -- new
circuit types register a solver function -- but we ship the named ones rock
solid rather than arbitrary nodal analysis unreliably.

Every value is parsed from the spec labels (e.g. '10kOhm' -> 10000.0).
"""
from __future__ import annotations
import re
import math
from dataclasses import dataclass, field
from typing import Optional

from core.schemas import CircuitSpec, CircuitComponentType as CT


# ---------------------------------------------------------------------------
# Unit parsing: '10kOhm' -> 10000.0, '100nF' -> 1e-7, '5V' -> 5.0
# ---------------------------------------------------------------------------
_SI = {
    'p': 1e-12, 'n': 1e-9, 'u': 1e-6, 'µ': 1e-6, 'm': 1e-3,
    'k': 1e3, 'K': 1e3, 'M': 1e6, 'meg': 1e6, 'G': 1e9,
}


def parse_value(label: str) -> Optional[float]:
    """Extract a numeric SI value from a component label. Returns None if none."""
    if not label:
        return None
    # strip common unit words so the prefix detector sees the multiplier letter
    cleaned = label.strip()
    # match: number, optional SI prefix, optional unit letters
    m = re.match(r'^\s*([0-9]*\.?[0-9]+)\s*([pnuµmkKMG]|meg)?', cleaned)
    if not m:
        return None
    val = float(m.group(1))
    prefix = m.group(2)
    if prefix:
        val *= _SI[prefix]
    return val


@dataclass
class Solution:
    """A solved circuit: the headline result plus the working steps."""
    summary: str
    steps: list[str] = field(default_factory=list)
    quantities: dict[str, str] = field(default_factory=dict)
    solvable: bool = True


def _fmt_hz(hz: float) -> str:
    if hz >= 1e6:
        return f"{hz/1e6:.3g} MHz"
    if hz >= 1e3:
        return f"{hz/1e3:.3g} kHz"
    return f"{hz:.3g} Hz"


def _by_type(spec: CircuitSpec, t: CT):
    return [c for c in spec.components if c.type == t]


# ---------------------------------------------------------------------------
# Individual solvers
# ---------------------------------------------------------------------------
def _solve_rc(spec: CircuitSpec) -> Optional[Solution]:
    rs = _by_type(spec, CT.RESISTOR)
    cs = _by_type(spec, CT.CAPACITOR)
    if not (rs and cs):
        return None
    R = parse_value(rs[0].label)
    C = parse_value(cs[0].label)
    if not (R and C):
        return Solution(
            summary="RC filter detected, but R or C value missing — add values to solve.",
            solvable=False,
        )
    fc = 1.0 / (2 * math.pi * R * C)
    tau = R * C
    return Solution(
        summary=f"RC filter cutoff frequency f꜀ = {_fmt_hz(fc)}",
        steps=[
            "Identify topology: a resistor and capacitor form a first-order RC filter.",
            "Cutoff (corner) frequency formula: f꜀ = 1 / (2·π·R·C).",
            f"Substitute R = {R:g} Ω and C = {C:g} F.",
            f"f꜀ = 1 / (2π · {R:g} · {C:g}) = {_fmt_hz(fc)}.",
            f"Time constant τ = R·C = {tau:.3g} s.",
        ],
        quantities={
            "Cutoff frequency f꜀": _fmt_hz(fc),
            "Time constant τ": f"{tau:.3g} s",
            "R": f"{R:g} Ω",
            "C": f"{C:g} F",
        },
    )


def _solve_rl(spec: CircuitSpec) -> Optional[Solution]:
    rs = _by_type(spec, CT.RESISTOR)
    ls = _by_type(spec, CT.INDUCTOR)
    if not (rs and ls):
        return None
    R = parse_value(rs[0].label)
    L = parse_value(ls[0].label)
    if not (R and L):
        return Solution(summary="RL filter detected, but R or L value missing.", solvable=False)
    fc = R / (2 * math.pi * L)
    tau = L / R
    return Solution(
        summary=f"RL filter cutoff frequency f꜀ = {_fmt_hz(fc)}",
        steps=[
            "Identify topology: a resistor and inductor form a first-order RL filter.",
            "Cutoff frequency formula: f꜀ = R / (2·π·L).",
            f"Substitute R = {R:g} Ω and L = {L:g} H.",
            f"f꜀ = {R:g} / (2π · {L:g}) = {_fmt_hz(fc)}.",
            f"Time constant τ = L/R = {tau:.3g} s.",
        ],
        quantities={"Cutoff frequency f꜀": _fmt_hz(fc), "Time constant τ": f"{tau:.3g} s"},
    )


def _solve_rlc(spec: CircuitSpec) -> Optional[Solution]:
    rs = _by_type(spec, CT.RESISTOR)
    ls = _by_type(spec, CT.INDUCTOR)
    cs = _by_type(spec, CT.CAPACITOR)
    if not (ls and cs):
        return None
    L = parse_value(ls[0].label)
    C = parse_value(cs[0].label)
    if not (L and C):
        return Solution(summary="RLC circuit detected, but L or C value missing.", solvable=False)
    f0 = 1.0 / (2 * math.pi * math.sqrt(L * C))
    steps = [
        "Identify topology: inductor + capacitor form a resonant RLC circuit.",
        "Resonant frequency formula: f₀ = 1 / (2·π·√(L·C)).",
        f"Substitute L = {L:g} H and C = {C:g} F.",
        f"f₀ = 1 / (2π·√({L:g}·{C:g})) = {_fmt_hz(f0)}.",
    ]
    q = {"Resonant frequency f₀": _fmt_hz(f0)}
    if rs:
        R = parse_value(rs[0].label)
        if R:
            Qf = (1.0 / R) * math.sqrt(L / C)
            steps.append(f"Quality factor Q = (1/R)·√(L/C) = {Qf:.3g}.")
            q["Quality factor Q"] = f"{Qf:.3g}"
    return Solution(summary=f"RLC resonant frequency f₀ = {_fmt_hz(f0)}", steps=steps, quantities=q)


def _solve_divider(spec: CircuitSpec) -> Optional[Solution]:
    rs = _by_type(spec, CT.RESISTOR)
    vs = _by_type(spec, CT.SOURCE_V) + _by_type(spec, CT.BATTERY)
    # A divider is exactly two resistors. 3+ resistors is a series/ladder
    # network -> let the series solver handle it (unless title said 'divider').
    if len(rs) != 2:
        return None
    R1 = parse_value(rs[0].label)
    R2 = parse_value(rs[1].label)
    if not (R1 and R2):
        return Solution(summary="Voltage divider detected, but resistor values missing.", solvable=False)
    steps = [
        "Identify topology: two resistors in series form a voltage divider.",
        "Output across R2: Vout = Vin · R2 / (R1 + R2).",
        f"Substitute R1 = {R1:g} Ω and R2 = {R2:g} Ω.",
    ]
    q = {"R1": f"{R1:g} Ω", "R2": f"{R2:g} Ω", "Ratio R2/(R1+R2)": f"{R2/(R1+R2):.3g}"}
    Vin = parse_value(vs[0].label) if vs else None
    if Vin:
        Vout = Vin * R2 / (R1 + R2)
        steps.append(f"Vout = {Vin:g} · {R2:g}/({R1:g}+{R2:g}) = {Vout:.3g} V.")
        q["Vout"] = f"{Vout:.3g} V"
        summary = f"Voltage divider output Vout = {Vout:.3g} V"
    else:
        summary = f"Voltage divider ratio = {R2/(R1+R2):.3g} (add Vin to get Vout)"
    return Solution(summary=summary, steps=steps, quantities=q)


def _solve_series_resistors(spec: CircuitSpec) -> Optional[Solution]:
    rs = _by_type(spec, CT.RESISTOR)
    if len(rs) < 2:
        return None
    vals = [parse_value(r.label) for r in rs]
    if any(v is None for v in vals):
        return Solution(summary="Series resistors detected, but a value is missing.", solvable=False)
    total = sum(vals)
    return Solution(
        summary=f"Total series resistance R = {total:g} Ω",
        steps=[
            "Resistors in series add directly: R_total = R1 + R2 + …",
            f"R_total = {' + '.join(f'{v:g}' for v in vals)} = {total:g} Ω.",
        ],
        quantities={"Total resistance": f"{total:g} Ω"},
    )


# ---------------------------------------------------------------------------
# Public entry: try solvers in priority order
# ---------------------------------------------------------------------------
def solve(spec: CircuitSpec) -> Optional[Solution]:
    """Return the best Solution for this spec, or None if nothing applies."""
    title = (spec.title or "").lower()

    # Title hints let us disambiguate (e.g. an RC titled 'low-pass' is still RC)
    ordered = [_solve_rlc, _solve_rc, _solve_rl, _solve_divider, _solve_series_resistors]

    # If the title screams a specific kind, front-run that solver.
    if "divider" in title:
        ordered = [_solve_divider] + ordered
    elif "rlc" in title or "resonan" in title:
        ordered = [_solve_rlc] + ordered
    elif "series" in title and "resist" in title:
        ordered = [_solve_series_resistors] + ordered

    for fn in ordered:
        try:
            sol = fn(spec)
        except Exception:
            sol = None
        if sol is not None:
            return sol
    return None


if __name__ == "__main__":
    from core.schemas import CircuitComponent, CircuitConnection
    rc = CircuitSpec(
        title="RC Low-Pass Filter",
        components=[
            CircuitComponent(id="V1", type=CT.SOURCE_SIN, label="Vin"),
            CircuitComponent(id="R1", type=CT.RESISTOR, label="1kOhm"),
            CircuitComponent(id="C1", type=CT.CAPACITOR, label="100nF"),
        ],
        connections=[],
        topology="series",
    )
    s = solve(rc)
    print("SUMMARY:", s.summary)
    for i, step in enumerate(s.steps, 1):
        print(f"  {i}. {step}")
    print("QUANTITIES:", s.quantities)
