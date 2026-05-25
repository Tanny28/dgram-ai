# DiagramAI

**Engineering diagrams that are correct by construction.**

DiagramAI does not generate pixels. It generates a verified structured specification (components + connections), renders it deterministically using real engineering libraries, and solves the underlying math. No hallucinated wires. No floating components. Just the right answer.

---

## What makes this different

| Feature | Stable Diffusion / DALL-E | Mermaid / draw.io | DiagramAI |
|---|---|---|---|
| Input | prompt | code syntax | plain English |
| Output | pixels (often wrong) | diagram (manual) | verified diagram + math |
| Circuits | nonsense symbols | not supported | electrically correct |
| Physics | blurry arrows | not supported | proper free-body diagrams |
| Solves math | no | no | yes, with step-by-step working |

---

## Quick start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Graphviz system package (`brew install graphviz` on mac, `apt install graphviz` on linux)
- A free Groq API key from https://console.groq.com (optional — runs offline without it)

### Setup

```bash
# clone
git clone https://github.com/Tanny28/dgram-ai.git
cd dgram-ai

# backend
cd backend
cp .env.example .env          # paste your GROQ_API_KEY in .env
pip install -r requirements.txt
cd ..

# frontend
cd frontend
npm install
cd ..
```

### Run

Open two terminals:

**Terminal 1 — backend:**
```bash
cd backend
python app.py
```
Backend runs at http://localhost:8000. Swagger docs at http://localhost:8000/docs.

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs at http://localhost:5173. Open it in your browser.

---

## Architecture

```
Student types prompt
       |
       v
  [FastAPI backend]
       |
       v
  Stage A: Groq LLM classifier (strict JSON)
  "What kind of diagram is this?"
  -> DiagramRoute { kind, reasoning }
       |
       v
  Stage B: Groq LLM spec filler (strict JSON)
  "Fill the structured schema"
  -> CircuitSpec / GraphSpec / PhysicsSpec
       |
       v
  Validator / Critic
  No floating nodes, closed loops, valid labels
       |
       v
  Router -> correct renderer
  |-- SchemDraw     -> circuits, signals
  |-- Mermaid       -> flowcharts, UML, sequence, state
  |-- Graphviz      -> block diagrams, architecture
  |-- Matplotlib    -> physics, free-body diagrams
       |
       v
  Rendered SVG/PNG (guaranteed correct)
  + Solved math with step-by-step working (circuits)
       |
       v
  [React frontend]
```

### Key insight

The LLM never draws anything. It fills a Pydantic schema with constrained decoding (Groq strict mode = 100% schema adherence). A deterministic renderer turns that schema into a diagram. The diagram is correct because the schema is correct-by-construction.

---

## Supported diagram types

| Type | Renderer | Solver | Example prompt |
|---|---|---|---|
| Circuit | SchemDraw | RC, RL, RLC, divider, series | "RC low-pass filter with 1kOhm and 100nF" |
| Flowchart | Mermaid | -- | "flowchart for binary search algorithm" |
| Block diagram | Graphviz | -- | "system architecture: client, gateway, services, database" |
| Sequence diagram | Mermaid | -- | "sequence diagram: user login via API" |
| State machine | Mermaid | -- | "state diagram for a traffic light" |
| Physics | Matplotlib | -- | "free body diagram of a block on an incline" |

---

## API

### `GET /api/health`
Returns `{ status, groq_key_present }`.

### `POST /api/generate`
**Body:** `{ "prompt": "RC low-pass filter with 1kOhm and 100nF" }`

**Response:**
```json
{
  "ok": true,
  "kind": "circuit",
  "title": "RC Low-Pass Filter",
  "spec": { "components": [...], "connections": [...], "topology": "series" },
  "image_b64": "iVBOR...",
  "mermaid_code": "",
  "solution": {
    "solvable": true,
    "summary": "RC filter cutoff frequency = 1.59 kHz",
    "steps": ["step 1...", "step 2..."],
    "quantities": { "Cutoff frequency": "1.59 kHz", "Time constant": "0.0001 s" }
  },
  "meta": { "elapsed_ms": 87, "offline": false }
}
```

---

## Project structure

```
dgram-ai/
  backend/
    app.py                  # FastAPI server
    requirements.txt
    .env.example
    core/
      schemas.py            # Pydantic specs (CircuitSpec, GraphSpec, PhysicsSpec)
      brain.py              # Groq LLM pipeline (route + spec fill)
      solver.py             # Circuit math solver (RC, RLC, divider, series)
      offline_fallback.py   # Canned specs for demo without network
    renderers/
      circuit.py            # SchemDraw renderer
      mermaid_render.py     # Mermaid syntax generator
      graphviz_render.py    # Graphviz PNG renderer
      physics.py            # Matplotlib free-body renderer
  frontend/
    index.html
    vite.config.js
    package.json
    src/
      main.jsx
      App.jsx
      styles.css
```

---

## Tech stack

- **Groq** — fastest LLM inference, strict structured JSON output (constrained decoding)
- **SchemDraw 0.22** — electrical schematics from code
- **Mermaid** — flowcharts, UML, sequence, state diagrams
- **Graphviz** — block and architecture diagrams
- **Matplotlib** — physics force/vector diagrams
- **FastAPI** — async Python backend with auto Swagger docs
- **React 18 + Vite** — frontend
- **Pydantic v2** — schema validation

---

## Offline mode

If `GROQ_API_KEY` is not set or the network is down, DiagramAI falls back to a keyword-based router and canned specs. The demo never dies on bad wifi. The UI shows an amber dot and "offline / fallback engine" when running in this mode.

---

## Authentication (Google OAuth) — optional

DiagramAI supports Google sign-in so users can sync their history across devices. When signed-in users generate a diagram, the entry is stored in the backend SQLite DB instead of the browser's `localStorage`. When the OAuth credentials are not configured, the UI auto-hides the sign-in button and history falls back to local storage transparently — nothing breaks.

### Setting up Google OAuth

1. Go to https://console.cloud.google.com/apis/credentials
2. Create a new OAuth 2.0 Client ID (type: **Web application**)
3. Add an authorized redirect URI: `https://your-domain/api/auth/google/callback` (and `http://localhost:8000/api/auth/google/callback` for local dev)
4. Copy the client ID and secret into `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   SESSION_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
   ```
5. Restart the backend. The "Sign in" button appears in the nav.

History endpoints (`GET/POST/DELETE /api/history`) require a valid session cookie. The frontend handles this automatically.

---

## Deployment (Render)

The repo ships with a `Dockerfile` and `render.yaml` so a deploy is one click:

1. Push the repo to GitHub (already at https://github.com/Tanny28/dgram-ai).
2. Sign in at https://render.com and click **New → Blueprint**.
3. Connect this repo. Render reads `render.yaml`, picks Docker runtime, provisions a 1 GB persistent disk at `/data` (for the SQLite database), and prompts for env vars:
   - `GROQ_API_KEY` — your Groq key
   - `SESSION_SECRET` — auto-generated by Render
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — leave blank to disable OAuth, or paste from Google Cloud Console
4. Click **Create**. Build takes ~4 minutes (Graphviz install + npm install + Vite build + Docker layer assembly).
5. Render gives you a `https://dgram-ai.onrender.com` URL. If you set Google OAuth, go back to Google Cloud Console and add the redirect URI: `https://your-render-url/api/auth/google/callback`.

The free Render tier sleeps after 15 minutes of inactivity — the first request after a sleep takes ~30 seconds to cold-start. Paid plans avoid this. The persistent disk survives sleeps and restarts.

### Custom domain

Once you have a domain, point an `A` record to Render's IP (shown in the service settings) and update:

- `frontend/index.html` — `og:url`, `og:image`, `twitter:url`, `twitter:image`, `canonical`
- `frontend/public/sitemap.xml` — every `<loc>` URL
- `frontend/public/robots.txt` — `Sitemap:` line

### Analytics

The site is analytics-free by default. To enable privacy-friendly traffic stats:

1. Sign up at https://plausible.io (or self-host).
2. Register your domain.
3. Uncomment the `<script defer data-domain="..."` line in `frontend/index.html`.

No cookies, no consent banner needed.

---

## SEO checklist

- [x] Title + meta description
- [x] OpenGraph + Twitter card tags
- [x] OG preview image (`/og-image.svg` — 1200×630)
- [x] `robots.txt` allowing crawl, disallowing `/api/`
- [x] `sitemap.xml` with all anchor sections
- [x] JSON-LD `SoftwareApplication` schema
- [x] Canonical URL
- [x] Mobile responsive (tested at 768px and 420px)

---

Built by Tanmay Shinde.
