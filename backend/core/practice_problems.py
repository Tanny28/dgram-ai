"""
DiagramAI :: Practice Problem Library
=====================================
Curated engineering problems — each one is a (prompt, challenge_text, topic, difficulty)
tuple. The student gets the diagram + math, then the answer is hidden behind a reveal.

We focus on circuits because we have a real solver — the student can verify their work
against an analytically-computed answer.
"""
from __future__ import annotations
import random
from typing import Optional


# Each entry: prompt -> diagram, challenge -> what the student is solving for,
# learning_objective -> what concept this problem reinforces.
PROBLEMS = [
    # ── RC FILTERS ──
    {
        "id": "rc-001",
        "topic": "RC Filter",
        "difficulty": "easy",
        "prompt": "RC low-pass filter with 1kOhm and 100nF",
        "challenge": "Calculate the cutoff frequency (fc) of this RC low-pass filter. At what frequency does the output signal drop to 70.7% of the input amplitude?",
        "learning_objective": "First-order RC filter cutoff: fc = 1 / (2πRC)",
        "hint": "Use fc = 1 / (2πRC). Convert units carefully — k = 10³, n = 10⁻⁹.",
    },
    {
        "id": "rc-002",
        "topic": "RC Filter",
        "difficulty": "easy",
        "prompt": "RC low-pass filter with 10kOhm and 47nF",
        "challenge": "Find the cutoff frequency. Then determine the time constant τ. How long until the capacitor charges to ~63% of the source voltage?",
        "learning_objective": "Time constant τ = RC and its relationship to step response",
        "hint": "τ = RC. After one time constant, the capacitor reaches 1 - 1/e ≈ 63.2% of final voltage.",
    },
    {
        "id": "rc-003",
        "topic": "RC Filter",
        "difficulty": "medium",
        "prompt": "RC low-pass filter with 4.7kOhm and 220nF",
        "challenge": "An audio signal contains components at 100 Hz, 1 kHz, and 10 kHz. Which components pass through this filter relatively unattenuated, and which are heavily attenuated?",
        "learning_objective": "Frequency selectivity of low-pass filters and the -3dB point",
        "hint": "Signals well below fc pass through. Signals well above fc are attenuated. Compute fc first.",
    },

    # ── VOLTAGE DIVIDERS ──
    {
        "id": "vd-001",
        "topic": "Voltage Divider",
        "difficulty": "easy",
        "prompt": "voltage divider 12V across 1kOhm and 2kOhm",
        "challenge": "Find the output voltage at the midpoint (across R2). Then calculate the current flowing through both resistors and the total power dissipated.",
        "learning_objective": "Voltage divider equation: V_out = V_in × R2 / (R1 + R2)",
        "hint": "V_out = V_in × R2 / (R1 + R2). I = V_in / (R1 + R2). P = I² × (R1 + R2).",
    },
    {
        "id": "vd-002",
        "topic": "Voltage Divider",
        "difficulty": "medium",
        "prompt": "voltage divider 9V across 4.7kOhm and 10kOhm",
        "challenge": "Calculate V_out across the 10kΩ resistor. Then design challenge: what value of R2 would you need to get exactly 5V output (keeping R1 = 4.7kΩ)?",
        "learning_objective": "Inverse design problem — solving for component values to meet a spec",
        "hint": "For V_out = 5V from 9V source: 5 = 9 × R2 / (4700 + R2). Solve for R2.",
    },

    # ── RLC CIRCUITS ──
    {
        "id": "rlc-001",
        "topic": "RLC Circuit",
        "difficulty": "medium",
        "prompt": "series RLC circuit, 10mH 100nF 50Ohm",
        "challenge": "Find the resonant frequency f0 of this series RLC circuit. At resonance, what does the circuit look like to the source — purely resistive, capacitive, or inductive?",
        "learning_objective": "Resonance: f0 = 1 / (2π√LC). At resonance, XL = XC, leaving only R.",
        "hint": "f0 = 1 / (2π × √(L × C)). At resonance, the impedance is purely real and equals R.",
    },
    {
        "id": "rlc-002",
        "topic": "RLC Circuit",
        "difficulty": "hard",
        "prompt": "series RLC circuit, 47mH 220nF 100Ohm",
        "challenge": "Find the resonant frequency f0 AND the quality factor Q. Is this a high-Q or low-Q circuit? What does that tell you about the bandwidth around resonance?",
        "learning_objective": "Q factor and bandwidth: Q = (1/R)√(L/C), BW = f0/Q",
        "hint": "Q = (1/R) × √(L/C). High Q (>10) means narrow bandwidth, sharp resonance. Low Q means broad resonance.",
    },

    # ── BASIC SERIES ──
    {
        "id": "ser-001",
        "topic": "Series Circuit",
        "difficulty": "easy",
        "prompt": "series circuit with 5V battery and two resistors 100Ohm and 200Ohm",
        "challenge": "Find the current through the circuit. Then find the voltage drop across each resistor. Verify that the drops sum to the source voltage (Kirchhoff's voltage law).",
        "learning_objective": "Ohm's law in series circuits; KVL verification",
        "hint": "I = V_source / R_total. V_R1 = I × R1. V_R2 = I × R2. V_R1 + V_R2 should = V_source.",
    },

    # ── PHYSICS (free-body) ──
    {
        "id": "phy-001",
        "topic": "Physics",
        "difficulty": "easy",
        "prompt": "free body diagram of a block on an incline",
        "challenge": "Identify all forces acting on the block. For a 5 kg block on a 30° incline (frictionless), what is the component of gravity pulling the block down the slope?",
        "learning_objective": "Decomposing weight into components parallel and perpendicular to an incline",
        "hint": "Force down the slope = mg·sin(θ). Force into the slope = mg·cos(θ).",
    },
    {
        "id": "phy-002",
        "topic": "Physics",
        "difficulty": "medium",
        "prompt": "free body diagram showing forces on a hanging mass",
        "challenge": "If the mass hangs in equilibrium from a single rope, what must the tension in the rope equal? What if it's suspended by two ropes at 45° to vertical?",
        "learning_objective": "Static equilibrium: net force = 0 in all directions",
        "hint": "Single rope: T = mg. Two symmetric ropes at angle θ from vertical: 2T·cos(θ) = mg, so T = mg/(2cos θ).",
    },

    # ── ALGORITHMS (flowcharts) ──
    {
        "id": "alg-001",
        "topic": "Algorithm",
        "difficulty": "medium",
        "prompt": "flowchart for binary search algorithm",
        "challenge": "Trace the algorithm: searching for 23 in [1, 5, 8, 12, 17, 23, 28, 34, 41]. How many comparisons does it take? What is the worst-case time complexity?",
        "learning_objective": "Binary search behavior and O(log n) complexity",
        "hint": "Each iteration halves the search space. Worst case is O(log₂ n). For n=9, that's ~4 iterations max.",
    },
    {
        "id": "alg-002",
        "topic": "Algorithm",
        "difficulty": "easy",
        "prompt": "flowchart to check if a number is prime",
        "challenge": "What is the time complexity of the naive prime-checking algorithm? Can you improve it by only checking divisors up to √n instead of n/2?",
        "learning_objective": "Algorithmic optimization and complexity analysis",
        "hint": "Naive: O(n). Optimised: O(√n). If n = a×b and a ≤ b, then a ≤ √n — so checking divisors above √n is wasted work.",
    },

    # ── SYSTEM ARCHITECTURE ──
    {
        "id": "sys-001",
        "topic": "System Design",
        "difficulty": "medium",
        "prompt": "system architecture: client, API gateway, auth service, orders service, database",
        "challenge": "Where would you add a cache to reduce database load? Where would rate limiting belong? If the auth service goes down, which other components fail and why?",
        "learning_objective": "Distributed system thinking — failure modes, caching, single points of failure",
        "hint": "Cache: between gateway and orders. Rate limit: at the gateway. Auth down: every authenticated request fails — gateway should fail-closed.",
    },

    # ── STATE MACHINES ──
    {
        "id": "fsm-001",
        "topic": "State Machine",
        "difficulty": "easy",
        "prompt": "state diagram for a traffic light",
        "challenge": "What's the trigger for each state transition? In a real intersection, what additional states exist (yellow before red, blinking modes)? Is this a Mealy or Moore machine?",
        "learning_objective": "Finite state machines: states, transitions, and triggers; Moore vs Mealy",
        "hint": "Moore: output depends only on current state. Mealy: output depends on state + input. A traffic light is typically modeled as Moore.",
    },
]


def random_problem(difficulty: Optional[str] = None, topic: Optional[str] = None) -> dict:
    """Pick a random problem, optionally filtered by difficulty and/or topic."""
    pool = PROBLEMS
    if difficulty:
        pool = [p for p in pool if p["difficulty"] == difficulty]
    if topic:
        pool = [p for p in pool if p["topic"].lower() == topic.lower()]
    if not pool:
        pool = PROBLEMS  # fall back to full pool if filter is too narrow
    return random.choice(pool)


def all_topics() -> list[str]:
    return sorted(set(p["topic"] for p in PROBLEMS))
