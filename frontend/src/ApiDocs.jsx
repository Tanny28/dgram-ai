import { useState, useEffect, useRef } from 'react'

const BASE_URL = 'https://dgram-ai.onrender.com'

const SECTIONS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'quickstart',   label: 'Quickstart' },
  { id: 'auth',         label: 'Authentication' },
  { id: 'generate',     label: 'POST /api/generate',         kind: 'endpoint', method: 'POST' },
  { id: 'rerender',     label: 'POST /api/rerender',         kind: 'endpoint', method: 'POST' },
  { id: 'health',       label: 'GET /api/health',            kind: 'endpoint', method: 'GET' },
  { id: 'practice',     label: 'GET /api/practice',          kind: 'endpoint', method: 'GET' },
  { id: 'topics',       label: 'GET /api/practice/topics',   kind: 'endpoint', method: 'GET' },
  { id: 'schemas',      label: 'Schemas' },
  { id: 'errors',       label: 'Errors' },
  { id: 'self-hosting', label: 'Self-hosting' },
]

// ── helpers ──

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true }
  catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy') } catch {}
    document.body.removeChild(ta)
    return true
  }
}

function highlightJson(value) {
  const json = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"\\]+)":/g, '<span class="key">"$1"</span>:')
    .replace(/: "([^"\\]*)"/g, ': <span class="str">"$1"</span>')
    .replace(/: (true|false|null)/g, ': <span class="kw">$1</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="num">$1</span>')
}

// ── reusable code-block with tab switcher + copy button ──

function CodeTabs({ tabs, onCopy }) {
  const [active, setActive] = useState(tabs[0].label)
  const current = tabs.find(t => t.label === active) || tabs[0]

  return (
    <div className="cb-wrap">
      <div className="cb-tabs">
        <div className="cb-tab-row">
          {tabs.map(t => (
            <button
              key={t.label}
              className={`cb-tab ${active === t.label ? 'cb-tab--on' : ''}`}
              onClick={() => setActive(t.label)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          className="cb-copy"
          onClick={() => { copyText(current.code); onCopy?.() }}
          type="button"
        >
          copy
        </button>
      </div>
      <pre className="cb-pre"><code>{current.code}</code></pre>
    </div>
  )
}

function JsonBlock({ data, onCopy }) {
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return (
    <div className="cb-wrap">
      <div className="cb-tabs">
        <div className="cb-tab-row">
          <span className="cb-tab cb-tab--on">JSON response</span>
        </div>
        <button
          className="cb-copy"
          onClick={() => { copyText(str); onCopy?.() }}
          type="button"
        >
          copy
        </button>
      </div>
      <pre className="cb-pre" dangerouslySetInnerHTML={{ __html: highlightJson(str) }} />
    </div>
  )
}

// ── examples builder: produces curl/python/js tab data for an endpoint ──

function buildExamples({ method, path, body }) {
  const url = `${BASE_URL}${path}`
  const bodyStr = body ? JSON.stringify(body, null, 2) : null

  const curl = method === 'GET'
    ? `curl ${url}`
    : `curl -X ${method} ${url} \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}'`

  const python = method === 'GET'
    ? `import requests\n\nr = requests.get("${url}")\ndata = r.json()\nprint(data)`
    : `import requests\n\nr = requests.post(\n  "${url}",\n  json=${bodyStr.replace(/\n/g, '\n  ')},\n)\ndata = r.json()\nprint(data["spec"])`

  const js = method === 'GET'
    ? `const res = await fetch("${url}")\nconst data = await res.json()\nconsole.log(data)`
    : `const res = await fetch("${url}", {\n  method: "${method}",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(${bodyStr.replace(/\n/g, '\n  ')}),\n})\nconst data = await res.json()\nconsole.log(data.spec)`

  return [
    { label: 'curl',       code: curl },
    { label: 'Python',     code: python },
    { label: 'JavaScript', code: js },
  ]
}

// ── canned example response payloads (matches actual backend output) ──

const GENERATE_RESPONSE = {
  ok: true,
  kind: 'circuit',
  title: 'RC Low-Pass Filter',
  spec: {
    components: [
      { id: 'V1',  type: 'source_v',  label: '5V',     nodes: ['n0', 'gnd'] },
      { id: 'R1',  type: 'resistor',  label: '1kOhm',  nodes: ['n0', 'n1'] },
      { id: 'C1',  type: 'capacitor', label: '100nF',  nodes: ['n1', 'gnd'] },
      { id: 'GND', type: 'ground',    label: '',       nodes: ['gnd'] },
    ],
    connections: [],
    topology: 'series',
    title: 'RC Low-Pass Filter',
  },
  image_b64: 'iVBORw0KGgoAAAANSUhEUgAA...(truncated)',
  mermaid_code: '',
  solution: {
    solvable: true,
    summary: 'RC low-pass filter cutoff = 1.591 kHz, time constant = 100.0 us',
    steps: [
      'Identify R = 1.0 kOhm, C = 100.0 nF',
      'Time constant tau = R * C = 1000 * 1.0e-07 = 1.0e-04 s',
      'Cutoff frequency fc = 1 / (2 * pi * R * C)',
      'fc = 1 / (2 * pi * 1.0e-04) = 1591.55 Hz',
    ],
    quantities: {
      'Resistance': '1.0 kOhm',
      'Capacitance': '100.0 nF',
      'Time constant': '100.0 us',
      'Cutoff frequency': '1.591 kHz',
    },
  },
  meta: {
    routing_reason: 'detected RC filter pattern with R + C values',
    elapsed_ms: 87,
    offline: false,
  },
}

const RERENDER_RESPONSE = {
  ok: true,
  kind: 'circuit',
  title: 'RC Low-Pass Filter',
  spec: '...same shape as generate, with edited values...',
  image_b64: 'iVBORw0...',
  mermaid_code: '',
  solution: {
    solvable: true,
    summary: 'RC low-pass filter cutoff = 318.3 Hz, time constant = 500.0 us',
    quantities: { 'Cutoff frequency': '318.3 Hz' },
    steps: ['...'],
  },
  meta: { routing_reason: 'rerender (no LLM)', elapsed_ms: 42, offline: false },
}

const HEALTH_RESPONSE = { status: 'ok', groq_key_present: true }

const PRACTICE_RESPONSE = {
  id: 'rc-001',
  topic: 'RC Filter',
  difficulty: 'easy',
  prompt: 'RC low-pass filter with 1kOhm and 100nF',
  challenge: 'Calculate the cutoff frequency (fc) of this RC low-pass filter...',
  learning_objective: 'First-order RC filter cutoff: fc = 1 / (2*pi*R*C)',
  hint: 'Use fc = 1 / (2*pi*R*C). Convert units carefully.',
}

const TOPICS_RESPONSE = {
  topics: ['Algorithm', 'Physics', 'RC Filter', 'RLC Circuit', 'Series Circuit', 'State Machine', 'System Design', 'Voltage Divider'],
}

// ── field table component ──

function FieldTable({ fields }) {
  return (
    <div className="field-table">
      <div className="ft-head">
        <div>Field</div>
        <div>Type</div>
        <div>Description</div>
      </div>
      {fields.map(f => (
        <div className="ft-row" key={f.name}>
          <div className="ft-name">
            <code>{f.name}</code>
            {f.required && <span className="ft-req">required</span>}
          </div>
          <div className="ft-type">{f.type}</div>
          <div className="ft-desc">{f.desc}</div>
        </div>
      ))}
    </div>
  )
}

// ── top nav ──

function DocsNav() {
  return (
    <nav className="docs-nav">
      <div className="docs-nav-inner">
        <a href="/" className="docs-nav-logo">
          <img src="/logo.png" alt="Diagram.ai" />
        </a>
        <span className="docs-nav-crumb">/ API documentation</span>
        <div className="docs-nav-spacer" />
        <a href="https://github.com/Tanny28/dgram-ai" target="_blank" rel="noreferrer" className="docs-nav-link">GitHub</a>
        <a href="/" className="docs-nav-cta">Back to app</a>
      </div>
    </nav>
  )
}

// ── sidebar ──

function Sidebar({ active }) {
  return (
    <aside className="docs-sidebar">
      <div className="ds-section">
        <div className="ds-label">Contents</div>
        <ul className="ds-list">
          {SECTIONS.map(s => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`ds-link ${active === s.id ? 'ds-link--on' : ''} ${s.kind === 'endpoint' ? 'ds-link--endpoint' : ''}`}
              >
                {s.kind === 'endpoint' && (
                  <span className={`ds-method ds-method--${s.method.toLowerCase()}`}>{s.method}</span>
                )}
                <span className="ds-text">{s.label.replace(/^(POST|GET) /, '')}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="ds-section ds-callout">
        <div className="ds-callout-title">Self-hosted?</div>
        <div className="ds-callout-body">
          All endpoints are open and unauthenticated when you run DiagramAI on your own infrastructure. Just point at <code>localhost:8000</code> instead.
        </div>
      </div>
    </aside>
  )
}

// ── endpoint card ──

function EndpointCard({ id, method, path, title, desc, body, response, fields, flashCopy }) {
  const examples = buildExamples({ method, path, body })
  return (
    <section className="endpoint" id={id}>
      <div className="ep-head">
        <span className={`method-badge method-badge--${method.toLowerCase()}`}>{method}</span>
        <code className="ep-path">{path}</code>
      </div>
      <h2 className="ep-title">{title}</h2>
      <p className="ep-desc">{desc}</p>

      {fields && fields.length > 0 && (
        <>
          <h4 className="ep-sub">Request body</h4>
          <FieldTable fields={fields} />
        </>
      )}

      <h4 className="ep-sub">Example request</h4>
      <CodeTabs tabs={examples} onCopy={() => flashCopy('Example copied')} />

      <h4 className="ep-sub">Example response</h4>
      <JsonBlock data={response} onCopy={() => flashCopy('Response JSON copied')} />
    </section>
  )
}

// ══════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════

export default function ApiDocs() {
  const [active, setActive] = useState('overview')
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  function flashCopy(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }

  // scrollspy
  useEffect(() => {
    const observed = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean)
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) setActive(e.target.id)
        })
      },
      { rootMargin: '-25% 0% -65% 0%', threshold: [0, 0.5, 1] }
    )
    observed.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="docs">
      <DocsNav />

      {toast && <div className="toast">{toast}</div>}

      <div className="docs-shell">
        <Sidebar active={active} />

        <main className="docs-content">

          {/* HERO */}
          <header className="docs-hero">
            <div className="dh-eyebrow">API Reference · v0.1.0</div>
            <h1 className="dh-title">Build with <span className="grad-text">Diagram.ai</span>.</h1>
            <p className="dh-sub">
              A REST API that turns plain-English prompts into verified Pydantic specs, deterministically rendered diagrams, and analytically solved engineering math.
            </p>
            <div className="dh-chips">
              <div className="dh-chip">
                <span className="dh-chip-label">Base URL</span>
                <code>{BASE_URL}</code>
              </div>
              <div className="dh-chip">
                <span className="dh-chip-label">Content-Type</span>
                <code>application/json</code>
              </div>
              <div className="dh-chip">
                <span className="dh-chip-label">Auth</span>
                <code>none (self-hosted)</code>
              </div>
            </div>
          </header>

          {/* OVERVIEW */}
          <section className="ds-block" id="overview">
            <h2 className="ds-h2">Overview</h2>
            <p className="ds-p">
              The DiagramAI API exposes a deterministic pipeline that converts engineering prompts into structured specifications, renders them with real engineering libraries (SchemDraw, Mermaid, Graphviz, Matplotlib), and solves any underlying math analytically — not via LLM.
            </p>
            <p className="ds-p">
              The key insight: the LLM never draws anything. It only fills a strict Pydantic schema with constrained decoding. A Python renderer turns that schema into a diagram. The diagram is correct because the spec is correct-by-construction.
            </p>
            <div className="ds-note">
              <strong>Why this matters for integrators:</strong> every response includes the full validated spec as JSON. You can store it, replay it deterministically, mutate fields and re-render without another LLM call, or build your own renderer on top of the same schema.
            </div>
          </section>

          {/* QUICKSTART */}
          <section className="ds-block" id="quickstart">
            <h2 className="ds-h2">Quickstart</h2>
            <p className="ds-p">Generate your first diagram in three lines of code:</p>
            <CodeTabs
              tabs={buildExamples({
                method: 'POST',
                path: '/api/generate',
                body: { prompt: 'RC low-pass filter with 1kOhm and 100nF' },
              })}
              onCopy={() => flashCopy('Quickstart copied')}
            />
            <p className="ds-p">
              The response includes a base64-encoded PNG of the schematic, the full structured spec, and the analytically solved cutoff frequency with step-by-step working.
            </p>
          </section>

          {/* AUTH */}
          <section className="ds-block" id="auth">
            <h2 className="ds-h2">Authentication</h2>
            <p className="ds-p">
              The self-hosted instance and the public demo at <code>{BASE_URL}</code> currently require <strong>no authentication</strong> — all endpoints accept anonymous requests. Rate limits are applied per IP.
            </p>
            <div className="ds-note">
              <strong>Coming soon:</strong> API keys for the hosted Pro tier, with higher rate limits, request history, and team workspaces. <a href="/#pricing">See pricing →</a>
            </div>
          </section>

          {/* ENDPOINTS */}

          <EndpointCard
            id="generate"
            method="POST"
            path="/api/generate"
            title="Generate a diagram from a prompt"
            desc="The primary endpoint. Routes the prompt to the correct diagram type, fills the validated spec, renders the diagram, and solves the engineering math in a single call."
            body={{ prompt: 'RC low-pass filter with 1kOhm and 100nF' }}
            response={GENERATE_RESPONSE}
            fields={[
              { name: 'prompt', type: 'string', required: true, desc: 'Natural-language description of the diagram. Be specific about component values and topology for best results.' },
            ]}
            flashCopy={flashCopy}
          />

          <EndpointCard
            id="rerender"
            method="POST"
            path="/api/rerender"
            title="Re-render from a modified spec (no LLM call)"
            desc="Take a previously generated spec, mutate any field (component values, topology, labels), and get a freshly rendered diagram plus re-solved math in under 100ms. No LLM is invoked — pure deterministic transformation."
            body={{ kind: 'circuit', spec: { components: ['...'], topology: 'series' } }}
            response={RERENDER_RESPONSE}
            fields={[
              { name: 'kind', type: 'string', required: true, desc: "One of: 'circuit', 'flowchart', 'block', 'sequence', 'state', 'physics'. Determines which Pydantic schema validates the spec." },
              { name: 'spec', type: 'object', required: true, desc: 'A full spec object matching the schema for the given kind. Easiest path: take the spec from a previous /api/generate response and edit it.' },
            ]}
            flashCopy={flashCopy}
          />

          <EndpointCard
            id="health"
            method="GET"
            path="/api/health"
            title="Service health check"
            desc="Returns the status of the service and whether a Groq API key is configured. If groq_key_present is false, the service runs in offline fallback mode with a curated spec library."
            response={HEALTH_RESPONSE}
            flashCopy={flashCopy}
          />

          <EndpointCard
            id="practice"
            method="GET"
            path="/api/practice"
            title="Get a random engineering practice problem"
            desc="Returns a curated practice problem with prompt, challenge text, learning objective, and hint. Optional query params filter the pool."
            response={PRACTICE_RESPONSE}
            fields={[
              { name: 'difficulty', type: 'query string', desc: "Optional. One of: 'easy', 'medium', 'hard'." },
              { name: 'topic', type: 'query string', desc: 'Optional. Filter by topic name (case-insensitive). Use /api/practice/topics to see the full list.' },
            ]}
            flashCopy={flashCopy}
          />

          <EndpointCard
            id="topics"
            method="GET"
            path="/api/practice/topics"
            title="List all available practice topics"
            desc="Returns the sorted list of topic names available in the practice problem library, suitable for building a topic filter UI."
            response={TOPICS_RESPONSE}
            flashCopy={flashCopy}
          />

          {/* SCHEMAS */}
          <section className="ds-block" id="schemas">
            <h2 className="ds-h2">Schemas</h2>
            <p className="ds-p">
              Every spec is a strict Pydantic v2 model. The full source of truth lives in <code>backend/core/schemas.py</code>. The three top-level schemas:
            </p>

            <h3 className="ds-h3">CircuitSpec</h3>
            <p className="ds-p">
              Used for electrical circuits. The math solver consumes this directly to compute cutoff frequencies, time constants, voltage drops, and resonance.
            </p>
            <FieldTable fields={[
              { name: 'components', type: 'Component[]', desc: "Array of Component objects with id, type ('resistor' | 'capacitor' | 'inductor' | 'source_v' | 'source_sin' | 'battery' | 'ground'), label (e.g. '1kOhm'), and nodes (array of node ids)." },
              { name: 'connections', type: 'Connection[]', desc: 'Optional explicit wires beyond what is implied by shared nodes.' },
              { name: 'topology', type: 'string', desc: "One of: 'series', 'parallel', 'mixed', 'voltage_divider'." },
              { name: 'title', type: 'string', desc: 'Human-readable title for the diagram.' },
            ]} />

            <h3 className="ds-h3">GraphSpec</h3>
            <p className="ds-p">
              Used for flowcharts, sequence diagrams, state machines, and block diagrams. Generic graph structure rendered via Mermaid or Graphviz depending on kind.
            </p>
            <FieldTable fields={[
              { name: 'nodes', type: 'Node[]', desc: "Array with id, label, and shape ('rect' | 'diamond' | 'circle' | 'rounded' | 'parallelogram')." },
              { name: 'edges', type: 'Edge[]', desc: "Array with source, target, label, and optional style ('solid' | 'dashed' | 'thick')." },
              { name: 'direction', type: 'string', desc: "Layout direction: 'LR' (left-right) or 'TB' (top-bottom)." },
              { name: 'title', type: 'string', desc: 'Human-readable title.' },
            ]} />

            <h3 className="ds-h3">PhysicsSpec</h3>
            <p className="ds-p">
              Used for free-body diagrams and force vector visualizations.
            </p>
            <FieldTable fields={[
              { name: 'body', type: 'object', desc: "The central body. Includes shape ('block' | 'circle'), position, and optional rotation (used for incline problems)." },
              { name: 'forces', type: 'Force[]', desc: "Array of force vectors with label (e.g. 'mg', 'N', 'T'), magnitude, angle (degrees from +x), and optional color." },
              { name: 'surface', type: 'object', desc: "Optional surface beneath the body. Useful for incline diagrams — includes angle and length." },
              { name: 'title', type: 'string', desc: 'Human-readable title.' },
            ]} />
          </section>

          {/* ERRORS */}
          <section className="ds-block" id="errors">
            <h2 className="ds-h2">Errors</h2>
            <p className="ds-p">
              All endpoints return JSON with an <code>ok</code> boolean. On success, <code>ok: true</code>. On a recoverable error (bad spec, unsupported kind), the response still has <code>200 OK</code> with <code>ok: false</code> and a human-readable summary in <code>solution.summary</code>.
            </p>
            <div className="ds-note">
              <strong>Why not 4xx status codes?</strong> The frontend always wants the same response shape so it can render an error banner consistently. Hard 4xx/5xx is reserved for malformed JSON, missing required fields, and infrastructure failure.
            </div>
            <h4 className="ep-sub">Common error patterns</h4>
            <FieldTable fields={[
              { name: 'spec validation failed', type: 'ok: false', desc: "The /api/rerender endpoint received a spec that doesn't match the Pydantic schema for the given kind. Check field names and types against the Schemas section above." },
              { name: 'unknown kind', type: 'ok: false', desc: 'The kind value passed to /api/rerender is not one of the six supported types.' },
              { name: 'Render error', type: 'ok: true (with error in solution.summary)', desc: 'The spec was valid but the renderer (SchemDraw, Mermaid, Graphviz, Matplotlib) threw. Usually means an unsupported topology or a malformed label.' },
            ]} />
          </section>

          {/* SELF HOSTING */}
          <section className="ds-block" id="self-hosting">
            <h2 className="ds-h2">Self-hosting</h2>
            <p className="ds-p">
              The full stack is open source on GitHub. The repo ships with a Dockerfile and a Render blueprint — one-click deploy with your own Groq key.
            </p>
            <CodeTabs
              tabs={[
                {
                  label: 'Quick run',
                  code: `git clone https://github.com/Tanny28/dgram-ai.git\ncd dgram-ai\n\n# backend\ncd backend && pip install -r requirements.txt\necho "GROQ_API_KEY=your_key_here" > .env\npython app.py\n\n# in another terminal — frontend\ncd frontend && npm install && npm run dev`,
                },
                {
                  label: 'Docker',
                  code: `docker build -t dgram-ai .\ndocker run -p 8000:8000 -e GROQ_API_KEY=your_key dgram-ai`,
                },
              ]}
              onCopy={() => flashCopy('Self-host snippet copied')}
            />
            <p className="ds-p" style={{ marginTop: 16 }}>
              No Groq key? The backend automatically falls back to a curated offline spec library covering the most common engineering diagram patterns. Useful for demos, CI, and air-gapped environments. The <code>/api/health</code> endpoint reports <code>groq_key_present: false</code> when running this way.
            </p>
          </section>

          <footer className="docs-footer">
            <div className="df-left">
              <img src="/logo.png" alt="Diagram.ai" />
              <span>v0.1.0 · built by Tanmay Shinde</span>
            </div>
            <div className="df-right">
              <a href="/">App</a>
              <a href="/#pricing">Pricing</a>
              <a href="https://github.com/Tanny28/dgram-ai" target="_blank" rel="noreferrer">GitHub</a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
