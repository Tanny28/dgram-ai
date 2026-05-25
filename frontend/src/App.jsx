import { useState, useEffect, useRef } from 'react'

const EXAMPLES = [
  'RC low-pass filter with 1kOhm and 100nF',
  'voltage divider 12V across 1kOhm and 2kOhm',
  'series RLC circuit, 10mH 100nF 50Ohm',
  'flowchart for binary search algorithm',
  'free body diagram of a block on an incline',
  'system architecture: client, API gateway, auth, orders, database',
]

const FEATURES = [
  {
    icon: '⬡',
    title: 'Deterministic Rendering',
    desc: 'Every diagram is rendered from a verified Pydantic spec, not hallucinated pixels. If the spec is correct, the diagram is correct — guaranteed.',
    tag: 'core',
  },
  {
    icon: '∫',
    title: 'Circuit Math Solver',
    desc: 'Cutoff frequencies, impedances, voltage drops — all solved analytically with step-by-step working shown alongside the schematic.',
    tag: 'circuits',
  },
  {
    icon: '⇄',
    title: 'Smart LLM Routing',
    desc: 'Groq strict JSON mode classifies your prompt into the right diagram type before building the spec. No ambiguity, no wrong renderers.',
    tag: 'ai',
  },
  {
    icon: '◈',
    title: '6 Diagram Types',
    desc: 'Circuits (SchemDraw), flowcharts + sequences + states (Mermaid), block diagrams (Graphviz), and physics free-body diagrams (Matplotlib).',
    tag: 'renderers',
  },
  {
    icon: '⌇',
    title: 'Offline Fallback',
    desc: 'No Groq key? No problem. A curated offline spec library covers the most common engineering diagram patterns out of the box.',
    tag: 'resilience',
  },
  {
    icon: '{}',
    title: 'Structured Spec Output',
    desc: 'Every response includes the full Pydantic spec as JSON — machine-readable, testable, and auditable. The spec is the source of truth.',
    tag: 'api',
  },
]

const DIAGRAM_TYPES = [
  { name: 'Electrical Circuits', hint: 'RC filters · voltage dividers · RLC circuits', color: '#fafb63', icon: '〜' },
  { name: 'Flowcharts', hint: 'Algorithms · decision trees · processes', color: '#6bfff7', icon: '⬡' },
  { name: 'Block Diagrams', hint: 'System architecture · data flow · components', color: '#fafb63', icon: '⊞' },
  { name: 'Physics', hint: 'Free-body · force vectors · incline problems', color: '#6bfff7', icon: '→' },
  { name: 'Sequence Diagrams', hint: 'API calls · message flows · protocols', color: '#fafb63', icon: '⇄' },
  { name: 'State Machines', hint: 'FSMs · transitions · lifecycle diagrams', color: '#6bfff7', icon: '◎' },
]

const STEPS = [
  {
    num: '01',
    title: 'Describe',
    body: 'Type your diagram in plain English. "RC low-pass filter with 1kΩ and 100nF" is enough to get a correct schematic and solved math.',
  },
  {
    num: '02',
    title: 'Route + Spec',
    body: 'Groq classifies the prompt and builds a validated Pydantic schema — the spec is the contract. No ambiguous pixels, just verified structure.',
  },
  {
    num: '03',
    title: 'Render + Solve',
    body: 'Deterministic libraries render the exact diagram from the spec. For circuits, the engineering math is solved analytically with full working.',
  },
]

// ── sub-components ──

function SpecView({ spec }) {
  const json = JSON.stringify(spec, null, 2)
  const html = json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/"([^"]+)":/g, '<span class="key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="str">"$1"</span>')
  return <pre className="spec-pre" dangerouslySetInnerHTML={{ __html: html }} />
}

// Global mermaid load promise — prevents duplicate <script> injection on rapid calls
let mermaidReady = null
function loadMermaid() {
  if (mermaidReady) return mermaidReady
  mermaidReady = new Promise((resolve, reject) => {
    if (window.mermaid) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
    s.onload = () => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',          // light theme → always visible on white canvas
        fontFamily: 'JetBrains Mono, monospace',
      })
      resolve()
    }
    s.onerror = reject
    document.head.appendChild(s)
  })
  return mermaidReady
}

function MermaidView({ code }) {
  const ref = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [renderError, setRenderError] = useState('')

  useEffect(() => {
    if (!code || !ref.current) return
    let cancelled = false
    setLoaded(false)
    setRenderError('')

    loadMermaid().then(async () => {
      if (cancelled) return
      try {
        const id = 'mermaid-' + Date.now()
        const { svg } = await window.mermaid.render(id, code)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setLoaded(true)
        }
      } catch (e) {
        console.error('mermaid render:', e)
        if (!cancelled) setRenderError(code)
      }
    }).catch(e => {
      console.error('mermaid load failed:', e)
      if (!cancelled) setRenderError(code)
    })

    return () => { cancelled = true }
  }, [code])

  if (renderError) {
    return (
      <div className="canvas canvas-empty" style={{ minHeight: 200, flexDirection: 'column', gap: 8 }}>
        <span style={{ color: 'var(--yellow)', marginBottom: 8 }}>⚠ mermaid render failed</span>
        <pre style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', textAlign: 'left', maxWidth: '100%' }}>{renderError}</pre>
      </div>
    )
  }

  return (
    <div className="canvas mermaid-canvas">
      <div ref={ref} style={{ width: '100%', textAlign: 'center' }}>
        {!loaded && <span className="canvas-hint">rendering diagram…</span>}
      </div>
    </div>
  )
}

// ── main app ──

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [health, setHealth] = useState(null)
  const [navScrolled, setNavScrolled] = useState(false)

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth({ status: 'down' }))
    const onScroll = () => setNavScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function run(p) {
    const q = (p ?? prompt).trim()
    if (!q || loading) return
    setPrompt(q)
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q }),
      })
      if (!res.ok) throw new Error(`server returned ${res.status}`)
      setResult(await res.json())
    } catch (e) {
      setError(`generation failed — ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  function tryExample(ex) {
    setPrompt(ex)
    document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })
    setTimeout(() => run(ex), 500)
  }

  const offline = health && !health.groq_key_present
  const sol = result?.solution
  const hasMermaid = result?.mermaid_code
  const hasImage = result?.image_b64
  const hasSolution = sol?.summary && sol?.solvable

  return (
    <div className="site">

      {/* ── NAV ── */}
      <nav className={`nav ${navScrolled ? 'nav--scrolled' : ''}`}>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <img src="/logo.svg" alt="Diagram.ai" className="nav-logo-img" />
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#types">Diagrams</a>
          </div>
          <a href="#try" className="nav-cta">Try it free →</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-grid-bg" />
        <div className="hero-glow" />
        <div className="hero-inner">
          <div className="hero-badge">
            <span className="badge-dot" />
            {health === null ? 'connecting…' : offline ? 'offline fallback mode' : 'Groq engine · online'}
          </div>

          <h1 className="hero-h1">
            Turn plain English<br />
            into <span className="grad-text">engineering diagrams.</span>
          </h1>

          <p className="hero-sub">
            DiagramAI doesn&apos;t generate pixels — it generates a <em>verified structured specification</em>,
            renders it deterministically, and solves the engineering math.
            No hallucinated wires. No floating components.{' '}
            <strong>Just the right answer.</strong>
          </p>

          <div className="hero-actions">
            <a href="#try" className="btn-primary">Generate a diagram →</a>
            <a href="#how" className="btn-ghost">See how it works</a>
          </div>

          <div className="hero-chips">
            {EXAMPLES.slice(0, 3).map(ex => (
              <span key={ex} className="hero-chip" onClick={() => tryExample(ex)}>
                {ex}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── GENERATOR ── */}
      <section className="generator-section" id="try">
        <div className="section-inner">
          <div className="section-label">// live generator</div>
          <h2 className="section-h2">Try it now.</h2>

          <div className="terminal">
            <div className="terminal-bar">
              <span className="t-dot t-red" />
              <span className="t-dot t-yellow" />
              <span className="t-dot t-green" />
              <span className="t-title">dgram-ai · prompt engine</span>
              <span className="t-status">
                <span className={`t-indicator ${offline ? 'offline' : ''}`} />
                {health === null ? '…' : offline ? 'fallback' : 'groq online'}
              </span>
            </div>
            <div className="terminal-body">
              <span className="t-sigil">›</span>
              <input
                value={prompt}
                placeholder="e.g. RC low-pass filter with 1kΩ and 100nF"
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && run()}
                autoFocus
              />
              <button onClick={() => run()} disabled={loading}>
                {loading ? '⟳ SOLVING' : 'GENERATE ↗'}
              </button>
            </div>
          </div>

          <div className="example-chips">
            {EXAMPLES.map(ex => (
              <div className="ex-chip" key={ex} onClick={() => { setPrompt(ex); run(ex) }}>
                {ex}
              </div>
            ))}
          </div>

          {loading && (
            <div className="loadbar">
              <div className="loadbar-fill" />
            </div>
          )}
          {error && <div className="error-banner">{error}</div>}

          {result && (
            <div className="results-grid">
              {/* schematic panel */}
              <div className="result-panel">
                <div className="rp-head">
                  <span className="rp-label">schematic</span>
                  <span className="rp-tag">{result.kind}</span>
                </div>
                <div className="rp-body">
                  {hasImage ? (
                    <div className="canvas">
                      <img src={`data:image/png;base64,${result.image_b64}`} alt={result.title} />
                    </div>
                  ) : hasMermaid ? (
                    <MermaidView code={result.mermaid_code} />
                  ) : (
                    <div className="canvas canvas-empty">
                      no renderer matched — try a different prompt
                    </div>
                  )}
                  <div className="rp-meta">
                    <span><b>title</b> {result.title || '—'}</span>
                    <span><b>route</b> {result.meta.routing_reason}</span>
                    <span className="rp-time">{result.meta.elapsed_ms}ms</span>
                  </div>
                </div>
              </div>

              {/* solution panel */}
              <div className="result-panel">
                <div className="rp-head">
                  <span className="rp-label">solution</span>
                  {hasSolution && <span className="rp-tag rp-tag--solved">solved ✓</span>}
                </div>
                <div className="rp-body">
                  {hasSolution ? (
                    <>
                      <div className="sol-summary">{sol.summary}</div>
                      {sol.quantities && Object.keys(sol.quantities).length > 0 && (
                        <div className="quantities">
                          {Object.entries(sol.quantities).map(([k, v]) => (
                            <div className="quantity" key={k}>
                              <div className="q-key">{k}</div>
                              <div className="q-val">{v}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {sol.steps?.length > 0 && (
                        <ol className="steps">
                          {sol.steps.map((s, i) => <li key={i}>{s}</li>)}
                        </ol>
                      )}
                    </>
                  ) : (
                    <div className="canvas canvas-empty" style={{ minHeight: 120, color: 'var(--text-dim)' }}>
                      {result.kind === 'circuit'
                        ? 'add component values to solve'
                        : `${result.kind} — visual output only`}
                    </div>
                  )}
                </div>
              </div>

              {/* spec panel */}
              <div className="result-panel result-panel--full">
                <div className="rp-head">
                  <span className="rp-label">structured spec // source of truth</span>
                  <span className="rp-tag">json</span>
                </div>
                <div className="rp-body">
                  <SpecView spec={result.spec} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="features-section" id="features">
        <div className="section-inner">
          <div className="section-label">// capabilities</div>
          <h2 className="section-h2">Built different.</h2>
          <p className="section-sub">
            Most AI diagram tools generate images.
            DiagramAI generates <em>correct specifications</em>.
          </p>
          <div className="features-grid">
            {FEATURES.map(f => (
              <div className="feature-card" key={f.title}>
                <div className="fc-icon">{f.icon}</div>
                <div className="fc-tag">{f.tag}</div>
                <h3 className="fc-title">{f.title}</h3>
                <p className="fc-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="how-section" id="how">
        <div className="section-inner">
          <div className="section-label">// process</div>
          <h2 className="section-h2">How it works.</h2>
          <div className="steps-row">
            {STEPS.map((s, i) => (
              <div className="step-card" key={s.num}>
                <div className="step-num">{s.num}</div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-body">{s.body}</p>
                {i < STEPS.length - 1 && <div className="step-arrow">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIAGRAM TYPES ── */}
      <section className="types-section" id="types">
        <div className="section-inner">
          <div className="section-label">// supported diagrams</div>
          <h2 className="section-h2">Six types. One API.</h2>
          <div className="types-grid">
            {DIAGRAM_TYPES.map(t => (
              <div
                className="type-card"
                key={t.name}
                style={{ '--tc-accent': t.color }}
                onClick={() => tryExample(
                  t.name === 'Electrical Circuits' ? EXAMPLES[0]
                  : t.name === 'Flowcharts' ? EXAMPLES[3]
                  : t.name === 'Physics' ? EXAMPLES[4]
                  : t.name === 'Block Diagrams' ? EXAMPLES[5]
                  : EXAMPLES[0]
                )}
              >
                <div className="tc-icon" style={{ color: t.color }}>{t.icon}</div>
                <h3 className="tc-name">{t.name}</h3>
                <p className="tc-hint">{t.hint}</p>
                <div className="tc-try">try it →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INSIGHT BANNER ── */}
      <section className="insight-section">
        <div className="section-inner">
          <div className="insight-card">
            <div className="insight-quote">
              &ldquo;We don&apos;t generate images.<br />
              We generate <span className="grad-text">verified specifications</span><br />
              and render them deterministically.&rdquo;
            </div>
            <div className="insight-sub">
              The diagram is correct because the spec is correct-by-construction.
            </div>
            <a href="#try" className="btn-primary">Generate your first diagram →</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-logo">
            <img src="/logo.svg" alt="Diagram.ai" className="footer-logo-img" />
          </div>
          <div className="footer-links">
            <a href="#try">Generator</a>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="https://github.com/Tanny28/dgram-ai" target="_blank" rel="noreferrer">GitHub ↗</a>
          </div>
          <div className="footer-copy">v0.1.0 · FastAPI + Groq + SchemDraw + Graphviz</div>
        </div>
      </footer>

    </div>
  )
}
