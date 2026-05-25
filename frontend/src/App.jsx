import { useState, useEffect, useRef } from 'react'

const EXAMPLES = [
  'RC low-pass filter with 1kOhm and 100nF',
  'voltage divider, 12V across 1kOhm and 2kOhm',
  'series RLC circuit, 10mH 100nF 50Ohm',
  'flowchart for binary search algorithm',
  'free body diagram of a block on an incline',
  'system architecture: client, API gateway, auth, orders, database',
]

function SpecView({ spec }) {
  const json = JSON.stringify(spec, null, 2)
  const html = json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/"([^"]+)":/g, '<span class="key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="str">"$1"</span>')
  return <pre className="spec-pre" dangerouslySetInnerHTML={{ __html: html }} />
}

function MermaidView({ code }) {
  const ref = useRef(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!code || !ref.current) return
    let cancelled = false

    async function render() {
      // load mermaid from CDN if not already loaded
      if (!window.mermaid) {
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
        s.onload = () => {
          window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'Archivo, sans-serif' })
          if (!cancelled) doRender()
        }
        document.head.appendChild(s)
      } else {
        doRender()
      }

      async function doRender() {
        try {
          const id = 'mermaid-' + Date.now()
          const { svg } = await window.mermaid.render(id, code)
          if (!cancelled && ref.current) {
            ref.current.innerHTML = svg
            setLoaded(true)
          }
        } catch (e) {
          console.error('mermaid render:', e)
          if (ref.current) ref.current.textContent = code
        }
      }
    }
    render()
    return () => { cancelled = true }
  }, [code])

  return (
    <div className="canvas" style={{ background: '#fff', minHeight: 200 }}>
      <div ref={ref} style={{ width: '100%', textAlign: 'center' }}>
        {!loaded && <span style={{ color: '#888', fontFamily: 'var(--mono)', fontSize: 12 }}>rendering diagram...</span>}
      </div>
    </div>
  )
}

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth({ status: 'down' }))
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
      setError(`generation failed -- ${e.message}. is the backend running on :8000?`)
    } finally {
      setLoading(false)
    }
  }

  const offline = health && !health.groq_key_present
  const sol = result?.solution
  const hasMermaid = result?.mermaid_code
  const hasImage = result?.image_b64
  const hasSolution = sol?.summary && sol?.solvable

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="mark">diagram<b>AI</b></span>
          <span className="ver">v0.1.0</span>
        </div>
        <div className="status">
          <span className={`dot ${offline ? 'offline' : ''}`} />
          {health ? (offline ? 'offline / fallback engine' : 'groq engine online') : 'connecting...'}
        </div>
      </div>

      <div className="hero">
        <h1>Engineering diagrams that are <span className="accent">correct by construction.</span></h1>
        <p>
          DiagramAI doesn't generate pixels -- it generates a verified structured specification,
          renders it deterministically, then <span style={{ color: 'var(--text)' }}>solves the underlying
          engineering math</span>. No hallucinated wires. No floating components. Just the right answer.
        </p>
      </div>

      <div className="console">
        <div className="console-head">prompt -- describe a diagram in plain english</div>
        <div className="console-body">
          <span className="prompt-sigil">&rsaquo;</span>
          <input
            value={prompt}
            placeholder="e.g. RC low-pass filter with 1kOhm and 100nF"
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
            autoFocus
          />
          <button onClick={() => run()} disabled={loading}>
            {loading ? 'SOLVING...' : 'GENERATE'}
          </button>
        </div>
      </div>

      <div className="chips">
        {EXAMPLES.map(ex => (
          <div className="chip" key={ex} onClick={() => { setPrompt(ex); run(ex) }}>{ex}</div>
        ))}
      </div>

      {loading && <div className="loadbar" />}
      {error && <div className="error-line">{error}</div>}

      {result && (
        <div className="results">
          <div className="panel">
            <div className="panel-head">
              <span className="label">schematic</span>
              <span className="tag">{result.kind}</span>
            </div>
            <div className="panel-body">
              {hasImage ? (
                <div className="canvas">
                  <img src={`data:image/png;base64,${result.image_b64}`} alt={result.title} />
                </div>
              ) : hasMermaid ? (
                <MermaidView code={result.mermaid_code} />
              ) : (
                <div className="canvas empty">
                  <span>no renderer matched -- try a different prompt</span>
                </div>
              )}
              <div className="metaline">
                <span><b>title</b> {result.title || '--'}</span>
                <span><b>route</b> {result.meta.routing_reason}</span>
                <span><b>{result.meta.elapsed_ms}ms</b></span>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="label">solution</span>
              {hasSolution && <span className="tag">solved</span>}
            </div>
            <div className="panel-body">
              {hasSolution ? (
                <>
                  <div className="readout-summary">{sol.summary}</div>
                  {sol.quantities && Object.keys(sol.quantities).length > 0 && (
                    <div className="quantities">
                      {Object.entries(sol.quantities).map(([k, v]) => (
                        <div className="quantity" key={k}>
                          <div className="k">{k}</div>
                          <div className="v">{v}</div>
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
                <div className="canvas empty" style={{ minHeight: 120 }}>
                  <span>{result.kind === 'circuit' ? 'add component values to solve' : `${result.kind} diagrams -- visual output only`}</span>
                </div>
              )}
            </div>
          </div>

          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <div className="panel-head">
              <span className="label">structured spec -- the source of truth</span>
              <span className="tag">json</span>
            </div>
            <div className="panel-body">
              <SpecView spec={result.spec} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
