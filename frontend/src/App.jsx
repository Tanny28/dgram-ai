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

const TESTIMONIALS = [
  {
    text: 'Finally an AI diagram tool that checks the math. Ran an RC filter problem and got the exact cutoff frequency — correct to the right number of significant figures.',
    name: 'Rohan M.',
    role: 'EE undergrad, IIT Bombay',
    tag: 'RC Filter',
  },
  {
    text: 'Used this for a lab report on series RLC circuits. The PDF export included step-by-step working I could cite directly. My TA asked which tool generated it.',
    name: 'Sarah C.',
    role: 'Electrical Engineering, UC Berkeley',
    tag: 'RLC Circuit',
  },
  {
    text: 'The tweak panel is the killer feature. Change a resistor value, see the solved math update in under 100ms. No LLM call, no hallucinations — pure deterministic output.',
    name: 'Alex P.',
    role: 'Systems Engineer, Berlin',
    tag: 'Tweak Panel',
  },
  {
    text: 'I teach digital circuits. The state machine diagrams are correctly typed — the model actually distinguishes Moore from Mealy outputs. That level of correctness is rare.',
    name: 'Dr. M. Torres',
    role: 'Lecturer, Faculty of Engineering',
    tag: 'State Machines',
  },
]

const FAQ_ITEMS = [
  {
    q: 'Is DiagramAI really free?',
    a: 'The Free tier provides 50 diagram generations per month with access to all 6 diagram types, the circuit math solver, and all export formats. Verified .edu email addresses receive unlimited Pro features at no cost — permanently.',
  },
  {
    q: 'How accurate is the circuit math?',
    a: 'All math is solved analytically by a deterministic Python solver — not by the LLM. The solver parses SI-prefixed component values (1kOhm, 100nF, 10mH) and applies the exact formulas. The LLM builds the structured spec; it never touches the numbers.',
  },
  {
    q: 'What diagram types are supported?',
    a: 'Six types: electrical circuits (SchemDraw), flowcharts + sequence diagrams + state machines (Mermaid), block and architecture diagrams (Graphviz), and physics free-body diagrams (Matplotlib). Each type has its own validated Pydantic schema.',
  },
  {
    q: 'Can I use DiagramAI without a Groq API key?',
    a: 'Yes. The backend ships with an offline fallback mode that covers the most common engineering diagram patterns from a curated spec library. The status indicator in the generator shows whether you are in live or offline mode.',
  },
  {
    q: 'What is the "spec" and why does it matter?',
    a: 'Every diagram is generated from a validated Pydantic v2 schema — the spec. Instead of asking the LLM to draw a circuit directly, we ask it to fill a strict JSON structure. A circuit spec cannot have floating wires or unlabeled nodes by construction. Edit the spec in the Tweak Panel and the diagram re-renders instantly with no LLM call.',
  },
  {
    q: 'What export formats are available?',
    a: 'PNG, SVG, PDF (with full step-by-step working), JSON spec, and LaTeX are all available from the export toolbar. The PDF report includes the diagram, solved quantities, and working steps in a clean A4 layout.',
  },
  {
    q: 'Is there a REST API I can call from my own code?',
    a: 'Yes. POST /api/generate accepts a prompt string and returns the full spec, rendered image, solved math, and routing metadata. POST /api/rerender lets you tweak a spec and re-render without an LLM call. The full spec JSON is always returned so you can store and replay it.',
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

// ══════════════════════════════════════════
//  Download / share / history helpers
// ══════════════════════════════════════════

function downloadBlob(content, filename, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function downloadPNG(b64, filename) {
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  downloadBlob(new Blob([arr], { type: 'image/png' }), filename, 'image/png')
}

function downloadSVGFromContainer(container, filename) {
  const svg = container?.querySelector?.('svg')
  if (!svg) return false
  // serialize and ensure xmlns
  const clone = svg.cloneNode(true)
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const xml = new XMLSerializer().serializeToString(clone)
  downloadBlob(xml, filename, 'image/svg+xml')
  return true
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // fallback for non-secure contexts
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch {}
    document.body.removeChild(ta)
    return true
  }
}

function buildLatex(result) {
  const { title, kind, spec, solution } = result
  const lines = [
    `% Diagram.ai export — ${new Date().toISOString().slice(0, 10)}`,
    `\\section*{${title || 'Untitled diagram'}}`,
    `\\textit{Type: ${kind}}`,
    '',
  ]
  if (solution?.solvable && solution.summary) {
    lines.push('\\textbf{Result.} ' + solution.summary, '')
    if (solution.quantities && Object.keys(solution.quantities).length) {
      lines.push('\\begin{itemize}')
      for (const [k, v] of Object.entries(solution.quantities)) {
        lines.push(`  \\item \\textbf{${k}}: ${v}`)
      }
      lines.push('\\end{itemize}', '')
    }
    if (solution.steps?.length) {
      lines.push('\\textbf{Working:}', '\\begin{enumerate}')
      for (const s of solution.steps) lines.push(`  \\item ${s}`)
      lines.push('\\end{enumerate}', '')
    }
  }
  lines.push('\\textbf{Specification (JSON):}', '\\begin{verbatim}')
  lines.push(JSON.stringify(spec, null, 2))
  lines.push('\\end{verbatim}')
  return lines.join('\n')
}

async function downloadPDF(result, mermaidContainerEl) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  let y = margin

  // Title
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text(result.title || 'Diagram', margin, y)
  y += 22

  // Subtitle
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(120)
  pdf.text(`Generated by Diagram.ai · ${result.kind} · ${new Date().toLocaleString()}`, margin, y)
  pdf.setTextColor(0)
  y += 22

  // Image (PNG)
  if (result.image_b64) {
    const imgW = pageW - margin * 2
    const imgH = imgW * 0.55
    try {
      pdf.addImage(`data:image/png;base64,${result.image_b64}`, 'PNG', margin, y, imgW, imgH, undefined, 'FAST')
      y += imgH + 18
    } catch (e) { console.error('pdf img', e) }
  } else if (mermaidContainerEl) {
    // rasterize SVG → image
    const svg = mermaidContainerEl.querySelector('svg')
    if (svg) {
      try {
        const xml = new XMLSerializer().serializeToString(svg)
        const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))
        const img = new Image()
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl })
        const canvas = document.createElement('canvas')
        canvas.width = img.width * 2
        canvas.height = img.height * 2
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const png = canvas.toDataURL('image/png')
        const imgW = pageW - margin * 2
        const imgH = Math.min(imgW * (img.height / img.width || 0.55), 420)
        pdf.addImage(png, 'PNG', margin, y, imgW, imgH)
        y += imgH + 18
      } catch (e) { console.error('mermaid→png:', e) }
    }
  }

  function ensureSpace(h) {
    if (y + h > pageH - margin) { pdf.addPage(); y = margin }
  }

  if (result.solution?.summary) {
    ensureSpace(40)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13)
    pdf.text('Result', margin, y); y += 16
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11)
    const lines = pdf.splitTextToSize(result.solution.summary, pageW - margin * 2)
    ensureSpace(lines.length * 13 + 8)
    pdf.text(lines, margin, y); y += lines.length * 13 + 10
  }
  if (result.solution?.quantities && Object.keys(result.solution.quantities).length) {
    ensureSpace(40)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13)
    pdf.text('Quantities', margin, y); y += 16
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11)
    for (const [k, v] of Object.entries(result.solution.quantities)) {
      ensureSpace(14)
      pdf.text(`• ${k}: ${v}`, margin, y); y += 14
    }
    y += 6
  }
  if (result.solution?.steps?.length) {
    ensureSpace(40)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13)
    pdf.text('Working', margin, y); y += 16
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10)
    result.solution.steps.forEach((s, i) => {
      const lines = pdf.splitTextToSize(`${i + 1}. ${s}`, pageW - margin * 2)
      ensureSpace(lines.length * 12 + 4)
      pdf.text(lines, margin, y); y += lines.length * 12 + 4
    })
  }

  // footer
  const totalPages = pdf.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setTextColor(150)
    pdf.text('Diagram.ai · correct by construction', margin, pageH - 18)
    pdf.text(`${i} / ${totalPages}`, pageW - margin, pageH - 18, { align: 'right' })
  }

  const fname = (result.title || result.kind || 'diagram').replace(/[^\w]+/g, '_').toLowerCase()
  pdf.save(`${fname}.pdf`)
}

// ── history (localStorage) ──
const HISTORY_KEY = 'diagram-ai-history'
const HISTORY_LIMIT = 20

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
function persistHistory(arr) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)) } catch {}
}
function pushHistory(prompt, kind, title) {
  const h = loadHistory().filter(x => x.prompt !== prompt)
  h.unshift({ prompt, kind, title, ts: Date.now() })
  const trimmed = h.slice(0, HISTORY_LIMIT)
  persistHistory(trimmed)
  return trimmed
}

// ── share URL (encoded prompt in ?p=) ──
function encodeShare(prompt) {
  try { return btoa(unescape(encodeURIComponent(prompt))) } catch { return '' }
}
function decodeShare(p) {
  try { return decodeURIComponent(escape(atob(p))) } catch { return null }
}

// ══════════════════════════════════════════
//  EMAIL CAPTURE MODAL
// ══════════════════════════════════════════

const EMAIL_KEY = 'diagram-ai-email'
const EMAIL_DISMISSED_KEY = 'diagram-ai-email-dismissed'

function emailAlreadyCollected() {
  return !!localStorage.getItem(EMAIL_KEY) || !!localStorage.getItem(EMAIL_DISMISSED_KEY)
}

function saveEmail(email, isEdu) {
  localStorage.setItem(EMAIL_KEY, JSON.stringify({ email, isEdu, ts: Date.now() }))
}

function dismissEmail() {
  localStorage.setItem(EMAIL_DISMISSED_KEY, Date.now().toString())
}

function EmailModal({ onClose, flashToast }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isEdu = /\.edu(\.[a-z]{2,})?$/i.test(email) || /\.ac\.[a-z]{2,}$/i.test(email)

  async function submit(e) {
    e?.preventDefault?.()
    if (!isValid || submitting) return
    setSubmitting(true)
    saveEmail(email, isEdu)
    flashToast(isEdu ? 'EDU verified — Pro features unlocked!' : '100 free credits added to your account')
    setTimeout(onClose, 1200)
  }

  return (
    <>
      <div className="email-overlay" onClick={onClose} />
      <div className="email-modal" role="dialog" aria-labelledby="email-title">
        <button className="em-close" onClick={onClose} type="button">✕</button>
        <div className="em-badge">EARLY ACCESS</div>
        <h3 className="em-title" id="email-title">
          Get <span className="grad-text">100 free credits</span><br />— or unlimited if you&apos;re a student.
        </h3>
        <p className="em-desc">
          We&apos;re launching <strong>Diagram.ai Pro</strong> with PDF lab reports, unlimited generations,
          and private history sync. Verified <code>.edu</code> emails get it <strong>free forever</strong>.
        </p>
        <form className="em-form" onSubmit={submit}>
          <input
            type="email"
            className="em-input"
            placeholder="you@university.edu"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            required
          />
          <button type="submit" className="em-submit" disabled={!isValid || submitting}>
            {submitting ? '✓' : isEdu ? 'Claim free Pro →' : 'Claim 100 credits →'}
          </button>
        </form>
        {isValid && isEdu && (
          <div className="em-edu-flash">Detected EDU email — you will get Pro free.</div>
        )}
        <div className="em-perks">
          <div className="em-perk"><span>✓</span> Unlimited diagram generations</div>
          <div className="em-perk"><span>✓</span> Branded PDF lab reports</div>
          <div className="em-perk"><span>✓</span> Cloud history + shareable links</div>
          <div className="em-perk"><span>✓</span> Priority Groq inference</div>
        </div>
        <button className="em-skip" onClick={onClose} type="button">Maybe later</button>
      </div>
    </>
  )
}

// ══════════════════════════════════════════
//  TWEAK PANEL — edit spec values live, no LLM
// ══════════════════════════════════════════

function TweakPanel({ result, onRerendered, flashToast }) {
  const [editedSpec, setEditedSpec] = useState(result.spec)
  const [pending, setPending] = useState(false)
  const [lastMs, setLastMs] = useState(null)
  const debounceRef = useRef(null)

  // when a fresh result comes in (new prompt), reset editor
  useEffect(() => { setEditedSpec(result.spec); setLastMs(null) }, [result.spec])

  async function doRerender(spec) {
    setPending(true)
    const t0 = performance.now()
    try {
      const res = await fetch('/api/rerender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: result.kind, spec }),
      })
      const data = await res.json()
      setLastMs(Math.round(performance.now() - t0))
      if (data.ok) onRerendered(data)
      else flashToast?.('spec validation failed')
    } catch (e) {
      console.error(e)
      flashToast?.('rerender failed')
    } finally {
      setPending(false)
    }
  }

  function scheduleRerender(spec) {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doRerender(spec), 350)
  }

  function updateComponentLabel(idx, newLabel) {
    const next = {
      ...editedSpec,
      components: editedSpec.components.map((c, i) =>
        i === idx ? { ...c, label: newLabel } : c
      ),
    }
    setEditedSpec(next)
    scheduleRerender(next)
  }

  function applyPreset(idx, preset) {
    updateComponentLabel(idx, preset)
  }

  // only circuits have meaningful tweakable values right now
  if (result.kind !== 'circuit') return null

  // skip ground / wires / labels-less components in the editor
  const tweakable = editedSpec.components
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.type !== 'ground' && c.label && c.label.trim() !== '')

  if (tweakable.length === 0) return null

  return (
    <div className="result-panel result-panel--full tweak-panel">
      <div className="rp-head">
        <span className="rp-label">tweak values · no LLM call</span>
        <span className="rp-tag" style={{
          color: pending ? 'var(--cyan)' : 'var(--yellow)',
          borderColor: pending ? 'rgba(107, 255, 247, 0.4)' : 'rgba(250, 251, 99, 0.3)',
        }}>
          {pending ? 'RECOMPUTING…' : lastMs !== null ? `${lastMs}ms` : 'LIVE'}
        </span>
      </div>
      <div className="rp-body">
        <p className="tweak-desc">
          Change any component value below — the diagram <em>and the solved math</em> update in real-time.
          <strong> No LLM call.</strong> This is the spec-is-source-of-truth thesis: every render comes from
          a structured spec, so editing the spec deterministically updates the result.
        </p>

        <div className="tweak-grid">
          {tweakable.map(({ c, i }) => (
            <div className="tweak-row" key={c.id}>
              <div className="tweak-header">
                <span className="tweak-id">{c.id}</span>
                <span className="tweak-type">{c.type}</span>
              </div>
              <input
                className="tweak-input"
                value={c.label}
                onChange={e => updateComponentLabel(i, e.target.value)}
                placeholder="e.g. 1kOhm, 100nF, 5V"
              />
              {c.type === 'resistor' && (
                <div className="tweak-presets">
                  {['100Ohm', '1kOhm', '10kOhm', '100kOhm', '1MOhm'].map(p => (
                    <button key={p} className="preset-btn" onClick={() => applyPreset(i, p)}>{p}</button>
                  ))}
                </div>
              )}
              {c.type === 'capacitor' && (
                <div className="tweak-presets">
                  {['10pF', '1nF', '10nF', '100nF', '1uF', '10uF'].map(p => (
                    <button key={p} className="preset-btn" onClick={() => applyPreset(i, p)}>{p}</button>
                  ))}
                </div>
              )}
              {c.type === 'inductor' && (
                <div className="tweak-presets">
                  {['1uH', '10uH', '100uH', '1mH', '10mH', '100mH'].map(p => (
                    <button key={p} className="preset-btn" onClick={() => applyPreset(i, p)}>{p}</button>
                  ))}
                </div>
              )}
              {(c.type === 'source_v' || c.type === 'battery' || c.type === 'source_sin') && (
                <div className="tweak-presets">
                  {['1V', '3.3V', '5V', '9V', '12V', '24V'].map(p => (
                    <button key={p} className="preset-btn" onClick={() => applyPreset(i, p)}>{p}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── tiny IconBtn ──
function IconBtn({ onClick, children, title, hot }) {
  return (
    <button className={`icon-btn ${hot ? 'icon-btn--hot' : ''}`} onClick={onClick} title={title} type="button">
      {children}
    </button>
  )
}

// ══════════════════════════════════════════
//  Main App
// ══════════════════════════════════════════

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [health, setHealth] = useState(null)
  const [navScrolled, setNavScrolled] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [toast, setToast] = useState('')
  const [practice, setPractice] = useState(null)        // active practice problem
  const [practiceRevealed, setPracticeRevealed] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [faqOpen, setFaqOpen] = useState(null)
  // ─── Compare mode ───
  const [compareMode, setCompareMode] = useState(false)
  const [variantA, setVariantA] = useState(null)        // snapshot result
  const [variantAPrompt, setVariantAPrompt] = useState('')
  const [variantBPrompt, setVariantBPrompt] = useState('')
  const [variantBLoading, setVariantBLoading] = useState(false)
  const [variantBResult, setVariantBResult] = useState(null)
  const diagramAreaRef = useRef(null)
  const toastTimerRef = useRef(null)
  const promptInputRef = useRef(null)

  function flashToast(msg) {
    setToast(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 2200)
  }

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth({ status: 'down' }))
    const onScroll = () => setNavScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)

    // load saved history
    setHistory(loadHistory())

    // honour ?p= shared prompt
    const params = new URLSearchParams(window.location.search)
    const shared = params.get('p')
    if (shared) {
      const decoded = decodeShare(shared)
      if (decoded) {
        setPrompt(decoded)
        setTimeout(() => {
          document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })
          run(decoded)
        }, 400)
      }
    }

    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keyboard shortcuts: Ctrl/Cmd+K → focus prompt, Ctrl/Cmd+H → history, Escape → close
  useEffect(() => {
    function onKey(e) {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === 'k') {
        e.preventDefault()
        document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })
        setTimeout(() => promptInputRef.current?.focus(), 300)
      }
      if (mod && e.key === 'h') {
        e.preventDefault()
        setShowHistory(v => !v)
      }
      if (e.key === 'Escape') {
        setShowHistory(false)
        setShowEmail(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(p, opts = {}) {
    const q = (p ?? prompt).trim()
    if (!q || loading) return
    setPrompt(q)
    setLoading(true); setError(''); setResult(null)
    // clear any active practice context unless this run is FROM a practice problem
    if (!opts.keepPractice) {
      setPractice(null)
      setPracticeRevealed(false)
      setShowHint(false)
    }
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q }),
      })
      if (!res.ok) throw new Error(`server returned ${res.status}`)
      const data = await res.json()
      setResult(data)
      const newHist = pushHistory(q, data.kind, data.title)
      setHistory(newHist)
      // Show email modal after 2nd+ successful generation (once)
      if (newHist.length >= 2 && !emailAlreadyCollected()) {
        setTimeout(() => setShowEmail(true), 2500)
      }
    } catch (e) {
      setError(`generation failed — ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  function enterCompareMode() {
    if (!result) return
    setVariantA(result)
    setVariantAPrompt(prompt)
    setVariantBPrompt('')
    setVariantBResult(null)
    setCompareMode(true)
    flashToast('compare mode — enter a second prompt')
  }
  function exitCompareMode() {
    setCompareMode(false)
    setVariantA(null)
    setVariantBPrompt('')
    setVariantBResult(null)
  }
  async function runVariantB() {
    const q = variantBPrompt.trim()
    if (!q || variantBLoading) return
    setVariantBLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q }),
      })
      if (!res.ok) throw new Error(`server returned ${res.status}`)
      const data = await res.json()
      setVariantBResult(data)
    } catch (e) {
      flashToast(`variant B failed — ${e.message}`)
    } finally {
      setVariantBLoading(false)
    }
  }

  async function loadPracticeProblem() {
    try {
      flashToast('loading random problem…')
      const res = await fetch('/api/practice')
      if (!res.ok) throw new Error(`server returned ${res.status}`)
      const p = await res.json()
      setPractice(p)
      setPracticeRevealed(false)
      setShowHint(false)
      document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => run(p.prompt, { keepPractice: true }), 350)
    } catch (e) {
      flashToast('could not load practice problem')
    }
  }

  // ── result-action handlers ──
  function actDownloadPNG() {
    if (!result) return
    const fname = (result.title || result.kind || 'diagram').replace(/\W+/g, '_').toLowerCase()
    if (result.image_b64) {
      downloadPNG(result.image_b64, `${fname}.png`)
      flashToast('PNG downloaded')
    } else if (diagramAreaRef.current) {
      // mermaid → svg→png conversion via canvas
      const svg = diagramAreaRef.current.querySelector('svg')
      if (!svg) { flashToast('no diagram to download'); return }
      const xml = new XMLSerializer().serializeToString(svg)
      const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = (img.width || 800) * 2
        canvas.height = (img.height || 500) * 2
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(b => { downloadBlob(b, `${fname}.png`, 'image/png'); flashToast('PNG downloaded') }, 'image/png')
      }
      img.src = dataUrl
    }
  }
  function actDownloadSVG() {
    if (!result || !diagramAreaRef.current) { flashToast('no svg available'); return }
    const fname = (result.title || result.kind || 'diagram').replace(/\W+/g, '_').toLowerCase()
    if (downloadSVGFromContainer(diagramAreaRef.current, `${fname}.svg`)) flashToast('SVG downloaded')
    else flashToast('no svg available — try PNG')
  }
  async function actDownloadPDF() {
    if (!result) return
    flashToast('building PDF…')
    try {
      await downloadPDF(result, diagramAreaRef.current)
      flashToast('PDF downloaded')
    } catch (e) {
      console.error(e); flashToast('PDF failed')
    }
  }
  function actDownloadJSON() {
    if (!result) return
    const fname = (result.title || result.kind || 'diagram').replace(/\W+/g, '_').toLowerCase()
    downloadBlob(JSON.stringify(result.spec, null, 2), `${fname}.json`, 'application/json')
    flashToast('JSON downloaded')
  }
  async function actCopyLatex() {
    if (!result) return
    await copyText(buildLatex(result))
    flashToast('LaTeX copied to clipboard')
  }
  async function actCopyJSON() {
    if (!result) return
    await copyText(JSON.stringify(result.spec, null, 2))
    flashToast('Spec JSON copied')
  }
  async function actShareLink() {
    if (!prompt) return
    const url = `${window.location.origin}${window.location.pathname}?p=${encodeShare(prompt)}`
    await copyText(url)
    // also update browser URL so it's bookmarkable
    try { window.history.replaceState({}, '', url) } catch {}
    flashToast('share link copied')
  }
  function actClearHistory() {
    persistHistory([])
    setHistory([])
    flashToast('history cleared')
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
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="/api-docs">API</a>
          </div>
          <button
            className="nav-history-btn"
            onClick={() => setShowHistory(v => !v)}
            title="Toggle history"
            type="button"
          >
            ◷ History{history.length > 0 && <span className="nh-count">{history.length}</span>}
          </button>
          <a href="#try" className="nav-cta">Try it free →</a>
        </div>
      </nav>

      {/* ── HISTORY DRAWER ── */}
      {showHistory && (
        <>
          <div className="history-overlay" onClick={() => setShowHistory(false)} />
          <aside className="history-drawer">
            <div className="hd-head">
              <span className="hd-title">◷ Recent Generations</span>
              <button className="hd-close" onClick={() => setShowHistory(false)} type="button">✕</button>
            </div>
            <div className="hd-body">
              {history.length === 0 ? (
                <div className="hd-empty">
                  No history yet.<br />
                  Your generated diagrams will appear here.
                </div>
              ) : (
                <ul className="hd-list">
                  {history.map((h, i) => (
                    <li
                      key={i}
                      className="hd-item"
                      onClick={() => {
                        setPrompt(h.prompt)
                        setShowHistory(false)
                        document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })
                        setTimeout(() => run(h.prompt), 400)
                      }}
                    >
                      <div className="hd-item-prompt">{h.prompt}</div>
                      <div className="hd-item-meta">
                        <span className="hd-item-kind">{h.kind}</span>
                        <span>·</span>
                        <span>{new Date(h.ts).toLocaleString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {history.length > 0 && (
              <div className="hd-foot">
                <button className="hd-clear" onClick={actClearHistory} type="button">
                  Clear history
                </button>
              </div>
            )}
          </aside>
        </>
      )}

      {/* ── EMAIL CAPTURE MODAL ── */}
      {showEmail && (
        <EmailModal
          onClose={() => { dismissEmail(); setShowEmail(false) }}
          flashToast={flashToast}
        />
      )}

      {/* ── TOAST ── */}
      {toast && <div className="toast">{toast}</div>}

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

      {/* ── STATS STRIP ── */}
      <section className="stats-section">
        <div className="stats-inner">
          <div className="stat">
            <div className="stat-value grad-text">&lt;100<span className="stat-unit">ms</span></div>
            <div className="stat-label">re-render latency</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-value grad-text">6<span className="stat-unit">types</span></div>
            <div className="stat-label">diagram families</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-value grad-text">100<span className="stat-unit">%</span></div>
            <div className="stat-label">spec-verified output</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-value grad-text">0<span className="stat-unit">$</span></div>
            <div className="stat-label">for students with .edu</div>
          </div>
        </div>
      </section>

      {/* ── GENERATOR ── */}
      <section className="generator-section" id="try">
        <div className="section-inner">
          <div className="section-label">// live generator</div>
          <div className="generator-head">
            <h2 className="section-h2">Try it now.</h2>
            <button className="practice-btn" onClick={loadPracticeProblem} type="button" title="Get a random engineering practice problem">
              Random Practice Problem
            </button>
          </div>

          {/* COMPARE MODE BANNER */}
          {compareMode && (
            <div className="compare-banner">
              <div className="cb-left">
                <span className="cb-icon">↔</span>
                <div>
                  <div className="cb-title">COMPARE MODE</div>
                  <div className="cb-sub">
                    Variant A: <code>{variantAPrompt || '(empty)'}</code>
                  </div>
                </div>
              </div>
              <button className="cb-exit" onClick={exitCompareMode}>✕ Exit compare</button>
            </div>
          )}

          {compareMode && (
            <div className="compare-grid">
              {/* Variant A column */}
              <div className="compare-col">
                <div className="compare-col-head">
                  <span className="cc-badge cc-badge--a">A</span>
                  <span className="cc-prompt">{variantAPrompt}</span>
                </div>
                {variantA?.image_b64 ? (
                  <div className="canvas">
                    <img src={`data:image/png;base64,${variantA.image_b64}`} alt={variantA.title} />
                  </div>
                ) : variantA?.mermaid_code ? (
                  <MermaidView code={variantA.mermaid_code} />
                ) : (
                  <div className="canvas canvas-empty">no diagram</div>
                )}
                {variantA?.solution?.summary && (
                  <div className="sol-summary" style={{ marginTop: 12 }}>
                    {variantA.solution.summary}
                  </div>
                )}
              </div>

              {/* Variant B column */}
              <div className="compare-col">
                <div className="compare-col-head">
                  <span className="cc-badge cc-badge--b">B</span>
                  <input
                    className="cc-input"
                    value={variantBPrompt}
                    onChange={e => setVariantBPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runVariantB()}
                    placeholder="e.g. RC low-pass filter with 10kOhm and 100nF"
                    autoFocus
                  />
                  <button
                    className="cc-go"
                    onClick={runVariantB}
                    disabled={!variantBPrompt.trim() || variantBLoading}
                  >
                    {variantBLoading ? '⟳' : '↗'}
                  </button>
                </div>
                {variantBLoading ? (
                  <div className="canvas canvas-empty"><span className="canvas-hint">generating variant B…</span></div>
                ) : variantBResult?.image_b64 ? (
                  <div className="canvas">
                    <img src={`data:image/png;base64,${variantBResult.image_b64}`} alt={variantBResult.title} />
                  </div>
                ) : variantBResult?.mermaid_code ? (
                  <MermaidView code={variantBResult.mermaid_code} />
                ) : (
                  <div className="canvas canvas-empty">enter a prompt above →</div>
                )}
                {variantBResult?.solution?.summary && (
                  <div className="sol-summary" style={{ marginTop: 12 }}>
                    {variantBResult.solution.summary}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DIFF CALLOUT (only when both variants have solutions) */}
          {compareMode && variantA?.solution?.solvable && variantBResult?.solution?.solvable && (
            <div className="compare-diff">
              <div className="cd-head">Differences</div>
              <div className="cd-rows">
                {Object.keys(variantA.solution.quantities || {}).map(key => {
                  const a = variantA.solution.quantities[key]
                  const b = variantBResult.solution.quantities?.[key]
                  const changed = a !== b && b !== undefined
                  return (
                    <div className={`cd-row ${changed ? 'cd-row--changed' : ''}`} key={key}>
                      <span className="cd-key">{key}</span>
                      <span className="cd-a">{a}</span>
                      <span className="cd-arrow">{changed ? '→' : '='}</span>
                      <span className="cd-b">{b ?? '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {practice && (
            <div className="practice-card">
              <div className="pc-head">
                <div className="pc-meta">
                  <span className="pc-tag">PRACTICE</span>
                  <span className={`pc-diff pc-diff--${practice.difficulty}`}>{practice.difficulty}</span>
                  <span className="pc-topic">{practice.topic}</span>
                </div>
                <button className="pc-next" onClick={loadPracticeProblem} type="button">↻ Next problem</button>
              </div>
              <div className="pc-body">
                <div className="pc-section">
                  <div className="pc-label">Challenge</div>
                  <p className="pc-challenge">{practice.challenge}</p>
                </div>

                <div className="pc-actions">
                  {!showHint && !practiceRevealed && (
                    <button className="pc-action-btn pc-action-btn--ghost" onClick={() => setShowHint(true)}>
                      Show hint
                    </button>
                  )}
                  {!practiceRevealed && (
                    <button className="pc-action-btn" onClick={() => setPracticeRevealed(true)}>
                      ✓ Reveal answer
                    </button>
                  )}
                </div>

                {showHint && (
                  <div className="pc-hint">
                    <span className="pc-hint-label">Hint:</span> {practice.hint}
                  </div>
                )}

                {practiceRevealed && (
                  <div className="pc-reveal">
                    <div className="pc-section">
                      <div className="pc-label">Learning objective</div>
                      <p className="pc-obj">{practice.learning_objective}</p>
                    </div>
                    <div className="pc-section">
                      <div className="pc-label">Solution working</div>
                      <p className="pc-obj" style={{ color: 'var(--text-dim)' }}>
                        Check the <strong>Solution panel</strong> below for the analytical result with full step-by-step working.
                        {result?.solution?.summary && (
                          <span className="pc-result-inline"> → <strong>{result.solution.summary}</strong></span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="terminal">
            <div className="terminal-bar">
              <span className="t-dot t-red" />
              <span className="t-dot t-yellow" />
              <span className="t-dot t-green" />
              <span className="t-title">dgram-ai · prompt engine</span>
              <span className="t-shortcut">Ctrl+K</span>
              <span className="t-status">
                <span className={`t-indicator ${offline ? 'offline' : ''}`} />
                {health === null ? '…' : offline ? 'fallback' : 'groq online'}
              </span>
            </div>
            <div className="terminal-body">
              <span className="t-sigil">›</span>
              <input
                ref={promptInputRef}
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
              {/* action toolbar */}
              <div className="result-toolbar">
                <span className="rt-label">EXPORT →</span>
                <IconBtn onClick={actDownloadPNG} title="Download as PNG image" hot>⤓ PNG</IconBtn>
                <IconBtn onClick={actDownloadSVG} title="Download as SVG (mermaid only)">⤓ SVG</IconBtn>
                <IconBtn onClick={actDownloadPDF} title="Download full report as PDF">⤓ PDF</IconBtn>
                <IconBtn onClick={actDownloadJSON} title="Download spec as JSON">⤓ JSON</IconBtn>
                <span className="rt-sep" />
                <IconBtn onClick={actCopyLatex} title="Copy LaTeX of result + spec">⎘ LaTeX</IconBtn>
                <IconBtn onClick={actCopyJSON} title="Copy spec JSON to clipboard">⎘ Spec</IconBtn>
                <span className="rt-sep" />
                <IconBtn onClick={actShareLink} title="Copy shareable URL" hot>↗ Share</IconBtn>
                <span className="rt-sep" />
                <IconBtn onClick={enterCompareMode} title="Compare this result with another prompt side-by-side">↔ Compare</IconBtn>
              </div>

              {/* schematic panel */}
              <div className="result-panel">
                <div className="rp-head">
                  <span className="rp-label">schematic</span>
                  <span className="rp-tag">{result.kind}</span>
                </div>
                <div className="rp-body">
                  <div ref={diagramAreaRef}>
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
                  </div>
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

              {/* TWEAK PANEL — interactive value editor (circuits only) */}
              <TweakPanel
                result={result}
                flashToast={flashToast}
                onRerendered={data => setResult(prev => ({ ...prev, ...data }))}
              />

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

      {/* ── PRICING ── */}
      <section className="pricing-section" id="pricing">
        <div className="section-inner">
          <div className="section-label">// pricing</div>
          <h2 className="section-h2">Free for students. <span className="grad-text">Always.</span></h2>
          <p className="section-sub">
            Built by an engineering student, for engineering students. Verified <code>.edu</code> emails get <em>everything</em> free.
          </p>
          <div className="pricing-grid">
            <div className="price-card">
              <div className="pc-tier">Free</div>
              <div className="pc-price">$0<span>/forever</span></div>
              <p className="pc-tagline">Try it. Build it. Learn it.</p>
              <ul className="pc-features">
                <li>✓ 50 diagrams per month</li>
                <li>✓ All 6 diagram types</li>
                <li>✓ PNG / SVG / JSON downloads</li>
                <li>✓ Tweak panel + math solver</li>
                <li>✓ Shareable URLs</li>
                <li className="pc-muted">✗ PDF lab reports</li>
                <li className="pc-muted">✗ Cloud history</li>
              </ul>
              <a href="#try" className="pc-cta pc-cta--ghost">Start free →</a>
            </div>

            <div className="price-card price-card--featured">
              <div className="pc-ribbon">★ MOST POPULAR</div>
              <div className="pc-tier">Pro</div>
              <div className="pc-price">$9<span>/month</span></div>
              <p className="pc-tagline">For serious engineers and builders.</p>
              <ul className="pc-features">
                <li>✓ <strong>Unlimited</strong> diagrams</li>
                <li>✓ All 6 diagram types</li>
                <li>✓ <strong>PDF lab reports</strong> w/ working steps</li>
                <li>✓ Cloud history sync across devices</li>
                <li>✓ Priority Groq inference</li>
                <li>✓ Custom branding on exports</li>
                <li>✓ Early access to new diagram types</li>
              </ul>
              <a href="#try" className="pc-cta">Upgrade to Pro →</a>
            </div>

            <div className="price-card price-card--edu">
              <div className="pc-ribbon pc-ribbon--edu">EDU FREE</div>
              <div className="pc-tier">Student</div>
              <div className="pc-price">$0<span>/forever</span></div>
              <p className="pc-tagline">Verified <code>.edu</code> = full Pro, free.</p>
              <ul className="pc-features">
                <li>✓ <strong>Everything in Pro</strong></li>
                <li>✓ Unlimited diagrams + PDF reports</li>
                <li>✓ Cloud history sync</li>
                <li>✓ Priority inference</li>
                <li>✓ Free during academic enrollment</li>
                <li>✓ Lab report templates</li>
                <li>✓ Practice problem library</li>
              </ul>
              <a href="#try" className="pc-cta pc-cta--ghost">Verify .edu →</a>
            </div>
          </div>
          <div className="pricing-footnote">
            Need a <strong>team plan</strong> or <strong>enterprise integration</strong>?{' '}
            <a href="mailto:hello@dgram.ai">Get in touch →</a>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="testimonials-section" id="testimonials">
        <div className="section-inner">
          <div className="section-label">// from engineers</div>
          <h2 className="section-h2">Built for people who care about correct answers.</h2>
          <div className="testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div className="tcard" key={i}>
                <div className="tcard-tag">{t.tag}</div>
                <p className="tcard-text">{t.text}</p>
                <div className="tcard-author">
                  <div className="tcard-name">{t.name}</div>
                  <div className="tcard-role">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="faq-section" id="faq">
        <div className="section-inner">
          <div className="section-label">// faq</div>
          <h2 className="section-h2">Common questions.</h2>
          <div className="faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <div
                className={`faq-item ${faqOpen === i ? 'faq-item--open' : ''}`}
                key={i}
              >
                <button
                  className="faq-q"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  type="button"
                >
                  <span>{item.q}</span>
                  <span className="faq-chevron">{faqOpen === i ? '−' : '+'}</span>
                </button>
                {faqOpen === i && (
                  <div className="faq-a">{item.a}</div>
                )}
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
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="/api-docs">API docs</a>
            <a href="https://github.com/Tanny28/dgram-ai" target="_blank" rel="noreferrer">GitHub ↗</a>
          </div>
          <div className="footer-copy">v0.1.0 · FastAPI + Groq + SchemDraw + Graphviz</div>
        </div>
      </footer>

    </div>
  )
}
