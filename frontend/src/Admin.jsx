import { useState, useEffect } from 'react'

// ── helpers ──────────────────────────────────────────────────
function fmtDate(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function fmtRelative(ms) {
  if (!ms) return '—'
  const diff = Date.now() - ms
  if (diff < 60_000)  return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}
function truncate(str, n = 60) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}
const KIND_COLOR = {
  circuit:   '#fafb63',
  flowchart: '#6bfff7',
  block:     '#aaff45',
  sequence:  '#a78bfa',
  state:     '#fb923c',
  physics:   '#f472b6',
}

// ── stat card ────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: '#0d2028',
      border: `1px solid ${accent || '#1a3040'}`,
      padding: '20px 24px',
      flex: '1 1 160px',
      minWidth: 140,
    }}>
      <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 28, fontWeight: 700, color: accent || '#daedf4' }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 12, color: '#5a8090', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#3a6070', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── kind badge ───────────────────────────────────────────────
function KindBadge({ kind }) {
  const color = KIND_COLOR[kind] || '#5a8090'
  return (
    <span style={{
      fontFamily: 'JetBrains Mono,monospace',
      fontSize: 10,
      color,
      border: `1px solid ${color}44`,
      padding: '2px 6px',
      background: `${color}11`,
      whiteSpace: 'nowrap',
    }}>
      {kind || '?'}
    </span>
  )
}

// ── main component ────────────────────────────────────────────
export default function Admin() {
  const [me, setMe]         = useState(null)        // current signed-in user
  const [auth, setAuth]     = useState('loading')   // 'loading' | 'ok' | '401' | '403'
  const [stats, setStats]   = useState(null)
  const [users, setUsers]   = useState([])
  const [logs, setLogs]     = useState([])
  const [tab, setTab]       = useState('overview')  // 'overview' | 'users' | 'logs'
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast]   = useState('')

  function flashToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  useEffect(() => {
    // 1. confirm signed in
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.user) { setAuth('401'); return }
        setMe(d.user)
        // 2. try admin stats — will 403 if not admin
        return fetch('/api/admin/stats', { credentials: 'include' })
      })
      .then(r => {
        if (!r) return
        if (r.status === 403) { setAuth('403'); return }
        if (r.status === 401) { setAuth('401'); return }
        return r.json()
      })
      .then(d => {
        if (!d) return
        setStats(d)
        setAuth('ok')
      })
      .catch(() => setAuth('error'))
  }, [])

  useEffect(() => {
    if (auth !== 'ok') return
    if (tab === 'users' && users.length === 0) {
      fetch('/api/admin/users?limit=100', { credentials: 'include' })
        .then(r => r.json()).then(d => setUsers(d.users || []))
    }
    if (tab === 'logs' && logs.length === 0) {
      fetch('/api/admin/logs?limit=200', { credentials: 'include' })
        .then(r => r.json()).then(d => setLogs(d.logs || []))
    }
  }, [tab, auth])

  async function deleteUser(id, email) {
    if (!window.confirm(`Delete account for ${email}?\nThis removes their history. Generation logs are kept.`)) return
    setDeleting(id)
    try {
      const r = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' })
      if (r.ok) {
        setUsers(u => u.filter(x => x.id !== id))
        flashToast(`Deleted ${email}`)
      } else {
        flashToast('Delete failed')
      }
    } finally {
      setDeleting(null)
    }
  }

  // ── gate screens ─────────────────────────────────────────
  if (auth === 'loading') {
    return (
      <div style={gateWrap}>
        <div style={{ color: '#5a8090', fontFamily: 'JetBrains Mono,monospace' }}>loading…</div>
      </div>
    )
  }
  if (auth === '401') {
    return (
      <div style={gateWrap}>
        <div style={gateBox}>
          <div style={{ color: '#fafb63', fontSize: 32, marginBottom: 12 }}>⚠</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Not signed in</div>
          <div style={{ color: '#5a8090', marginBottom: 20 }}>Sign in with your admin Google account to access this panel.</div>
          <a href="/api/auth/google" style={ctaBtn}>Sign in with Google</a>
        </div>
      </div>
    )
  }
  if (auth === '403') {
    return (
      <div style={gateWrap}>
        <div style={gateBox}>
          <div style={{ color: '#fb923c', fontSize: 32, marginBottom: 12 }}>⛔</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Access denied</div>
          <div style={{ color: '#5a8090', marginBottom: 8 }}>
            Signed in as <strong style={{ color: '#daedf4' }}>{me?.email}</strong>
          </div>
          <div style={{ color: '#5a8090', fontSize: 13 }}>
            This account is not the configured admin. Set <code style={{ color: '#6bfff7' }}>ADMIN_EMAIL</code> in your backend <code>.env</code>.
          </div>
        </div>
      </div>
    )
  }

  // ── dashboard ─────────────────────────────────────────────
  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#daedf4', fontFamily: "'Barlow',sans-serif" }}>

      {/* toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#aaff45', color: '#000', padding: '10px 20px',
          fontFamily: 'JetBrains Mono,monospace', fontSize: 13, zIndex: 9999,
        }}>
          {toast}
        </div>
      )}

      {/* nav */}
      <div style={{
        borderBottom: '1px solid #1a3040',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#060f12',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <img src="/logo.png" alt="diagram.ai" style={{ height: 36 }} />
          </a>
          <span style={{ color: '#1a3040', fontSize: 20 }}>|</span>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: '#aaff45', letterSpacing: 2 }}>
            ADMIN
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {me?.picture && <img src={me.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} referrerPolicy="no-referrer" />}
          <span style={{ fontSize: 13, color: '#5a8090' }}>{me?.email}</span>
          <a href="/" style={{ fontSize: 12, color: '#5a8090', textDecoration: 'none', marginLeft: 8 }}>← Back to app</a>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* page title */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, margin: 0 }}>
            Admin Dashboard
          </h1>
          <div style={{ color: '#5a8090', fontSize: 13, marginTop: 4 }}>
            All times UTC · Data from SQLite · Refreshed on page load
          </div>
        </div>

        {/* stat cards */}
        {stats && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
            <StatCard label="Total users"      value={stats.total_users}   accent="#aaff45" />
            <StatCard label="Total generations" value={stats.total_gens}   accent="#6bfff7" />
            <StatCard label="Today"             value={stats.today_gens}   accent="#fafb63" />
            <StatCard label="Live (Groq)"       value={stats.live_gens}    accent="#aaff45"
              sub={`${stats.offline_gens} offline`} />
            <StatCard label="Avg latency"
              value={stats.avg_latency_ms ? `${stats.avg_latency_ms}ms` : '—'}
              accent="#6bfff7" sub="live requests only" />
          </div>
        )}

        {/* kind breakdown */}
        {stats?.by_kind && Object.keys(stats.by_kind).length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: '#5a8090', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Diagram type breakdown
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(stats.by_kind)
                .sort((a, b) => b[1] - a[1])
                .map(([kind, cnt]) => (
                  <div key={kind} style={{
                    background: '#0d2028',
                    border: `1px solid ${KIND_COLOR[kind] || '#1a3040'}44`,
                    padding: '8px 16px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <KindBadge kind={kind} />
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 16, color: KIND_COLOR[kind] || '#daedf4' }}>
                      {cnt}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid #1a3040' }}>
          {['overview', 'users', 'logs'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? '#0d2028' : 'transparent',
                border: 'none',
                borderBottom: tab === t ? '2px solid #aaff45' : '2px solid transparent',
                color: tab === t ? '#aaff45' : '#5a8090',
                padding: '10px 20px',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono,monospace',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && stats && (
          <div style={{ color: '#5a8090', fontSize: 14 }}>
            <p>Switch to the <strong style={{ color: '#daedf4' }}>Users</strong> tab to see all registered accounts.</p>
            <p style={{ marginTop: 8 }}>Switch to the <strong style={{ color: '#daedf4' }}>Logs</strong> tab to see every generation request (including anonymous).</p>
            <p style={{ marginTop: 16, fontSize: 12, color: '#253a44' }}>
              Note: on Render free tier, SQLite data is lost on container restart. Upgrade to a persistent disk or use Neon/Supabase for permanent storage.
            </p>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a3040' }}>
                  {['User', 'Email', 'Joined', 'Last gen', 'Generations', 'EDU', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#5a8090', fontWeight: 400, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, color: '#5a8090', textAlign: 'center' }}>No users yet</td></tr>
                )}
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #0d2028' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {u.picture
                          ? <img src={u.picture} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} referrerPolicy="no-referrer" />
                          : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1a3040', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                              {(u.name || u.email || '?')[0].toUpperCase()}
                            </div>
                        }
                        <span style={{ color: '#daedf4' }}>{u.name || '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#5a8090', fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{u.email}</td>
                    <td style={{ padding: '10px 12px', color: '#5a8090', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(u.joined_at)}</td>
                    <td style={{ padding: '10px 12px', color: '#5a8090', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtRelative(u.last_gen_at)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono,monospace', color: '#6bfff7' }}>{u.gen_count}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {u.edu && <span style={{ fontSize: 10, color: '#aaff45', border: '1px solid #aaff4544', padding: '2px 6px' }}>EDU</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        onClick={() => deleteUser(u.id, u.email)}
                        disabled={deleting === u.id}
                        style={{
                          background: 'transparent',
                          border: '1px solid #3a1a1a',
                          color: '#7a3030',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontFamily: 'JetBrains Mono,monospace',
                        }}
                      >
                        {deleting === u.id ? '…' : 'delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── LOGS TAB ── */}
        {tab === 'logs' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a3040' }}>
                  {['Time', 'Prompt', 'Kind', 'User', 'Latency', 'Mode'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#5a8090', fontWeight: 400, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, color: '#5a8090', textAlign: 'center' }}>No generations logged yet</td></tr>
                )}
                {logs.map(lg => (
                  <tr key={lg.id} style={{ borderBottom: '1px solid #0a1a1f' }}>
                    <td style={{ padding: '8px 12px', color: '#5a8090', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtRelative(lg.created_at)}</td>
                    <td style={{ padding: '8px 12px', color: '#daedf4', maxWidth: 340 }} title={lg.prompt}>{truncate(lg.prompt)}</td>
                    <td style={{ padding: '8px 12px' }}><KindBadge kind={lg.kind} /></td>
                    <td style={{ padding: '8px 12px', color: '#5a8090', fontSize: 11 }}>
                      {lg.user_email
                        ? <span style={{ color: '#6bfff7' }}>{truncate(lg.user_email, 30)}</span>
                        : <span style={{ color: '#253a44' }}>anon</span>
                      }
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#fafb63' }}>
                      {lg.latency_ms != null ? `${lg.latency_ms}ms` : '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        fontSize: 10,
                        color: lg.offline ? '#fb923c' : '#aaff45',
                        border: `1px solid ${lg.offline ? '#fb923c44' : '#aaff4544'}`,
                        padding: '2px 6px',
                      }}>
                        {lg.offline ? 'offline' : 'live'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

// ── shared styles ─────────────────────────────────────────────
const gateWrap = {
  background: '#000',
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Barlow',sans-serif",
  color: '#daedf4',
}
const gateBox = {
  background: '#0d2028',
  border: '1px solid #1a3040',
  padding: '48px 40px',
  maxWidth: 400,
  textAlign: 'center',
}
const ctaBtn = {
  display: 'inline-block',
  background: '#aaff45',
  color: '#000',
  textDecoration: 'none',
  padding: '10px 24px',
  fontWeight: 700,
  fontSize: 14,
}
