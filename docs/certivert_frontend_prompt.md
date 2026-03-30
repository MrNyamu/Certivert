# Certivert — Phase 2 Frontend Design Prompt
## React Frontend with Wallet Authentication + Role Dashboards

---

## Design Brief — Read This First

### Who this is for

Certivert serves four distinct users in the Kenyan education ecosystem:

1. **University Registrar** — institutional, formal, process-driven. Issues and manages
   certificates on behalf of the university. Uses a desktop browser at work.
   Needs confidence that the system reflects institutional authority.

2. **Employer / HR Manager** — pragmatic, time-pressured. Verifying a candidate's
   credentials before making a hiring decision. Needs the result fast, clearly,
   and without ambiguity. One wrong hire costs the company.

3. **Student / Graduate** — earned something significant. Views and shares their
   certificate. Mobile-first (smartphone is their primary internet device in Kenya).
   Deserves to feel pride, not confusion.

4. **KNQA Official** — regulatory authority. Audits the system, manages trusted
   issuers, revokes fraudulent certificates. Needs an oversight panel that feels
   authoritative and complete.

### What the design must communicate

- **Institutional authority** — this is not a startup app. It is infrastructure.
- **Cryptographic trust** — the blockchain provenance is a feature, worn proudly.
- **Absolute clarity on verification status** — VALID / REVOKED / NOT FOUND must
  be unmistakable. An employer must not misread a status at a glance.
- **Kenyan context** — grounded in its geography without being flag-waving.

### Aesthetic direction — Warm Institutional Light

**Tone:** Precise. Confident. Human without being casual. Inspired by Anthropic's
design language — warm off-white surfaces, restrained colour, editorial serif
typography, generous negative space, and a single accent colour that appears only
where it must. Think how a respected Kenyan institution — the Central Bank,
Strathmore University, the Kenya Revenue Authority — would present itself digitally
if designed today with taste. Not a crypto dApp. Not a government portal. Not a
SaaS dashboard. Its own register.

**Core philosophy borrowed from Anthropic:**
- Light-first, warm-toned palette — cream and linen, not white or grey
- Near-monochromatic base — the accent (coral) appears sparingly, only where
  it encodes meaning (active state, role badge, wordmark italic)
- Verification status colours are the ONLY chromatic moments — green, red,
  amber earn their prominence because nothing else competes
- Subtle grain texture on the connect screen — present but subconscious
- Typography does the heavy lifting; decoration is earned, not decorative

**Color palette (CSS variables):**
```css
/* Base surfaces — warm, not cold */
--cream:          #F5F0E8;   /* primary background — warm off-white */
--cream-soft:     #EDE8DF;   /* hover surfaces, subtle differentiation */
--cream-border:   #D8D1C4;   /* borders, dividers, form underlines */
--linen:          #FAF7F2;   /* elevated surfaces — sidebar, topbar, cards */

/* Text hierarchy */
--ink:            #1A1A18;   /* primary text, headings, primary buttons */
--ink-soft:       #2E2E2A;   /* secondary headings, hover states */
--muted:          #7A7468;   /* labels, secondary text, nav items */
--faint:          #B8B2A8;   /* placeholders, hints, tertiary info */

/* Accent — coral, used sparingly */
--coral:          #C85C3C;   /* wordmark italic, active nav border, role badges */
--coral-soft:     #F2E4DC;   /* role badge background, PDF drop hover */

/* Verification status — the only chromatic moments */
--verified:       #1A6B47;   /* VALID text, active borders, live indicator */
--verified-bg:    #EBF5EE;   /* VALID stamp background (light) */
--verified-deep:  #0E3D29;   /* VALID heading text on --verified-bg */
--revoked:        #8B1A1A;   /* REVOKED text */
--revoked-bg:     #F5EBEB;   /* REVOKED stamp background */
--amber:          #8B6914;   /* TAMPERED / warning text */
--amber-bg:       #F5F0E0;   /* TAMPERED stamp background */
```

**Tailwind config — extend with these tokens:**
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        cream:         '#F5F0E8',
        'cream-soft':  '#EDE8DF',
        'cream-border':'#D8D1C4',
        linen:         '#FAF7F2',
        ink:           '#1A1A18',
        'ink-soft':    '#2E2E2A',
        muted:         '#7A7468',
        faint:         '#B8B2A8',
        coral:         '#C85C3C',
        'coral-soft':  '#F2E4DC',
        verified:      '#1A6B47',
        'verified-bg': '#EBF5EE',
        'verified-deep':'#0E3D29',
        revoked:       '#8B1A1A',
        'revoked-bg':  '#F5EBEB',
        amber:         '#8B6914',
        'amber-bg':    '#F5F0E0',
      },
      fontFamily: {
        serif: ['"Libre Baskerville"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '3px',   /* sharp, institutional — not rounded SaaS */
      },
    },
  },
}
```

**Typography:**
- Display / headings: `"Libre Baskerville"` — institutional weight, closer to
  official documents than editorial magazines. The italic cut used only in the
  wordmark ("Certi*vert*") as the sole typographic flourish.
- Body / UI: `"DM Sans"` — clean, readable, friendly without being casual.
  Weight 300 for descriptive copy, 400 for body, 500 for labels and buttons.
- Monospace (cert IDs, hashes, block heights): `"JetBrains Mono"` — precise,
  signals technical provenance without being jargon-heavy.

**Google Fonts import (add to `index.css`):**
```css
@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500&display=swap');
```

**Motion:** Restrained. Purposeful. The verification result is the ONE moment
of animation — the stamp panel fades in and the status glyph scales from 0.8
to 1.0 over 250ms (ease-out). No bounce, no spin. Everything else: 150ms
ease transitions on colour and border only. No transform animations on hover.

**Border radius:** `3px` everywhere — sharp enough to feel institutional,
slightly softer than pure 0. Never `rounded-lg` or pill shapes except for the
role badge (which uses `2px` with uppercase small text).

**The unforgettable thing:** The verification status stamp. The entire result
panel takes on the status colour as its background — warm green, deep red, or
muted amber — so the outcome is unmistakable at a glance before a word is read.
The Baskerville serif heading ("Verified valid" / "Certificate revoked") gives
the result the weight of an official document stamp. The rest of the UI remains
calm cream throughout — these status moments are the only colour in the room.

---

## Tech Stack

```
Framework:     React 18 + Vite
Styling:       Tailwind CSS (configured with custom tokens above)
Routing:       React Router v6
Blockchain:    @stacks/connect, @stacks/transactions, @stacks/network
HTTP client:   Axios (calls to Node.js API on port 4000)
QR code gen:   qrcode (npm)
QR scanning:   html5-qrcode
Fonts:         Google Fonts (Libre Baskerville, DM Sans, JetBrains Mono)
Icons:         lucide-react
```

---

## Monorepo Context — Existing Repository

This frontend is being added to an **existing monorepo**. Do not create a new
repository. The current root of the Certivert project looks like this:

```
certivert/                         ← repository root (already exists)
├── Clarinet.toml                  ← already exists
├── README.md                      ← already exists
├── api/                           ← already exists (Phase 1 complete)
├── contracts/                     ← already exists (Clarity smart contracts)
├── deployments/                   ← already exists (Clarinet deployment plans)
├── settings/                      ← already exists (Devnet/Testnet/Mainnet toml)
├── tests/                         ← already exists (Vitest contract tests)
├── node_modules/                  ← root-level (Clarinet SDK + Vitest)
├── package.json                   ← root-level (test runner scripts)
├── package-lock.json              ← already exists
├── tsconfig.json                  ← already exists
└── vitest.config.ts               ← already exists
```

The `frontend/` directory does not exist yet. It must be scaffolded as a
**sibling to `api/`** inside this same repository. Do not move, rename, or
modify any existing files. Work only inside the new `frontend/` directory
and the root `package.json` scripts block.

---

## Monorepo Setup — Run These Commands First

From the **repository root** (`certivert/`), run these commands in order:

```bash
# 1. Scaffold the Vite + React app into frontend/
npm create vite@latest frontend -- --template react

# 2. Install frontend dependencies
cd frontend
npm install

# 3. Install Tailwind and its peer dependencies
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4. Install app dependencies
npm install react-router-dom axios @stacks/connect @stacks/transactions @stacks/network qrcode html5-qrcode lucide-react

# 5. Return to root and install concurrently for unified dev command
cd ..
npm install --save-dev concurrently
```

Then update the **root `package.json`** scripts block. Do not touch any other
field in the root `package.json` — it already contains the Vitest test runner
config for the Clarity contracts:

```json
{
  "scripts": {
    "test":         "vitest run",
    "test:watch":   "vitest",
    "dev:api":      "cd api && node src/index.js",
    "dev:frontend": "cd frontend && npm run dev",
    "dev":          "concurrently \"npm run dev:api\" \"npm run dev:frontend\"",
    "check":        "clarinet check"
  }
}
```

The `node_modules/` at the root belongs to the Clarinet SDK and Vitest setup —
do not hoist frontend or API dependencies into it. Each workspace manages its
own `node_modules/` independently:
- `frontend/node_modules/` — React, Vite, Tailwind, Stacks.js
- `api/node_modules/` — Express, kubo-rpc-client, @stacks/transactions
- root `node_modules/` — @hirosystems/clarinet-sdk, vitest (test runner only)

---

## Full Monorepo Structure After Setup

```
certivert/                         ← repository root
├── Clarinet.toml
├── README.md
├── package.json                   ← updated with dev scripts
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
│
├── contracts/                     ← Clarity smart contracts (unchanged)
│   ├── role-registry.clar
│   └── certificate-store.clar
│
├── tests/                         ← Contract unit tests (unchanged)
│   ├── role-registry.test.ts
│   └── certificate-store.test.ts
│
├── deployments/                   ← Clarinet deployments (unchanged)
├── settings/                      ← Devnet/Testnet/Mainnet config (unchanged)
│
├── api/                           ← Node.js API (Phase 1 — unchanged)
│   ├── src/
│   │   ├── index.js
│   │   ├── config.js
│   │   ├── routes/
│   │   ├── services/
│   │   └── middleware/
│   ├── package.json
│   └── .env
│
└── frontend/                      ← NEW — Vite + React (Phase 2)
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx                # Router + auth guard
    │   ├── index.css              # Global styles, CSS variables, font imports
    │   ├── hooks/
    │   │   ├── useWallet.js       # Stacks wallet connection state
    │   │   └── useRole.js         # On-chain role resolution
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── AppShell.jsx   # Sidebar + topbar shell
    │   │   │   ├── Sidebar.jsx    # Role-specific nav
    │   │   │   └── Topbar.jsx     # Wallet status, BTC block pill
    │   │   ├── auth/
    │   │   │   └── ConnectWallet.jsx
    │   │   └── ui/
    │   │       ├── StatusStamp.jsx   # VALID / REVOKED / NOT_FOUND display
    │   │       ├── CertCard.jsx      # Certificate metadata card
    │   │       ├── QRDisplay.jsx     # QR code + copy link
    │   │       ├── QRScanner.jsx     # Camera QR scanner
    │   │       └── HashDisplay.jsx   # Truncated cert ID with copy
    │   ├── pages/
    │   │   ├── university/
    │   │   │   ├── IssueCertificate.jsx
    │   │   │   └── PendingApprovals.jsx
    │   │   ├── verify/
    │   │   │   └── VerifyCertificate.jsx
    │   │   ├── student/
    │   │   │   └── MyCertificates.jsx
    │   │   └── knqa/
    │   │       ├── AuditRegistry.jsx
    │   │       └── ManageIssuers.jsx
    │   └── lib/
    │       ├── api.js             # Axios instance + typed API calls
    │       └── wallet.js          # Stacks connect helpers
    ├── public/
    │   └── certivert-seal.svg     # Geometric seal SVG
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js         # Custom design tokens (see below)
    ├── postcss.config.js
    ├── package.json               # Frontend deps only
    └── .env                       # Frontend env vars (gitignored)
```

---

## Tailwind Config — `frontend/tailwind.config.js`

Replace the scaffolded default entirely with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream:            '#F5F0E8',
        'cream-soft':     '#EDE8DF',
        'cream-border':   '#D8D1C4',
        linen:            '#FAF7F2',
        ink:              '#1A1A18',
        'ink-soft':       '#2E2E2A',
        muted:            '#7A7468',
        faint:            '#B8B2A8',
        coral:            '#C85C3C',
        'coral-soft':     '#F2E4DC',
        verified:         '#1A6B47',
        'verified-bg':    '#EBF5EE',
        'verified-deep':  '#0E3D29',
        revoked:          '#8B1A1A',
        'revoked-bg':     '#F5EBEB',
        amber:            '#8B6914',
        'amber-bg':       '#F5F0E0',
      },
      fontFamily: {
        serif: ['"Libre Baskerville"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '3px',
        sm:      '2px',
        md:      '3px',
        lg:      '4px',
      },
      borderWidth: {
        DEFAULT: '0.5px',
      },
    },
  },
  plugins: [],
}
```

---

## Global CSS — `frontend/src/index.css`

Replace the Vite scaffolded `index.css` entirely:

```css
@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --cream:          #F5F0E8;
  --cream-soft:     #EDE8DF;
  --cream-border:   #D8D1C4;
  --linen:          #FAF7F2;
  --ink:            #1A1A18;
  --ink-soft:       #2E2E2A;
  --muted:          #7A7468;
  --faint:          #B8B2A8;
  --coral:          #C85C3C;
  --coral-soft:     #F2E4DC;
  --verified:       #1A6B47;
  --verified-bg:    #EBF5EE;
  --verified-deep:  #0E3D29;
  --revoked:        #8B1A1A;
  --revoked-bg:     #F5EBEB;
  --amber:          #8B6914;
  --amber-bg:       #F5F0E0;
}

* {
  box-sizing: border-box;
}

body {
  background-color: var(--cream);
  color: var(--ink);
  font-family: 'DM Sans', sans-serif;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar — subtle, matches the warm palette */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--cream); }
::-webkit-scrollbar-thumb { background: var(--cream-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--muted); }
```

---

## Frontend Environment Variables — `frontend/.env`

Create this file (gitignored — add `frontend/.env` to `.gitignore`):

```
VITE_API_URL=http://localhost:4000
VITE_STACKS_NETWORK=simnet
VITE_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
VITE_CONTRACT_NAME_ROLES=role-registry
VITE_CONTRACT_NAME_CERTS=certificate-store
VITE_STACKS_API_URL=http://localhost:20443
```

Also create `frontend/.env.example` (committed) with the same keys but
placeholder values. Add `frontend/.env` to the root `.gitignore`.

---

## Component Specifications

### `ConnectWallet.jsx` — Landing screen

This is the first thing every user sees. It must establish authority immediately.

**Layout:** Full viewport. Warm linen background (`--linen`). Subtle grain
texture overlay (SVG feTurbulence noise at 4% opacity — adds tactile warmth
without visual noise). Centered content column, max-width 440px.

**Top eyebrow:** `"CERTIVERT · KENYA"` in `"JetBrains Mono"`, 10px,
`--coral`, uppercase, letter-spacing 0.16em. Signals provenance immediately.

**Wordmark:** `"Libre Baskerville"` regular, 42px, `--ink`. The word "vert"
rendered in italic — `Certi<em>vert</em>` — as the sole typographic gesture.
No underline, no decoration. The italic carries it.

**Tagline:** 14px `"DM Sans"` weight 300, `--muted`, max-width 300px,
line-height 1.6. `"Blockchain-anchored certificate verification for Kenya's
universities and employers"`. Below the wordmark, generous spacing.

**Seal SVG:** Concentric circles — outermost in `--cream-border`, inner ring
in `--verified` at 60% opacity, center fill `--verified-bg`. Bitcoin ₿ mark
at center in `--verified`, monospace. "STACKS" and "BITCOIN" in `"JetBrains
Mono"` 4.5px around the rings in `--faint`. Horizontal tick marks at 9 and 3
o'clock. The seal reads as institutional, not crypto.

**Connect button:** Full width, `--ink` background, `--cream` text.
`"DM Sans"` 500 weight, 14px, border-radius 3px. Label: `"Connect Hiro wallet"`.
Small square icon (Hiro wallet symbol) left of label. On hover: `--ink-soft`.
This is intentionally NOT green — green is reserved for VALID status only.

**Below button:** 11px `"DM Sans"` weight 300, `--faint`, line-height 1.7:
`"Requires Hiro or Leather wallet · No account or password"`

**Unregistered wallet state:** Amber inline banner below the button —
`--amber-bg` background, `--amber` left border 2px, `--amber` text:
`"Your wallet is not registered. Contact your institution administrator."`

---

### `AppShell.jsx` — Authenticated layout

**Sidebar** (left, 210px, `--linen` background, `--cream-border` right border):
- Certivert wordmark at top in `"Libre Baskerville"` 17px — `Certi<em>vert</em>`
  with italic on "vert" in `--coral`. Below it, role badge.
- Role badge — inline, 2px border-radius, uppercase 10px `"DM Sans"` 500,
  letter-spacing 0.06em. Colours:
  - University → `--coral-soft` bg, `--coral` text
  - Student → `#EBF5EE` bg, `--verified-deep` text
  - Employer → `#EDE8F5` bg, `#4A3F7A` text
  - KNQA → `--amber-bg` bg, `--amber` text
- Nav items: 13px `"DM Sans"` 400, `--muted` default. Active state:
  `--coral` left border (2px), `--cream-soft` background, `--ink` text,
  weight 500. Hover: `--cream-soft` bg, `--ink-soft` text. No icons —
  text only, with a 5px `--cream-border` dash as a subtle list marker.
- Bottom: wallet address truncated in `"JetBrains Mono"` 9px, `--faint`.
  No disconnect button in nav — keep the sidebar clean.

**Topbar** (top, 50px, `--linen` background, `--cream-border` bottom border):
- Page title left — `"Libre Baskerville"` 15px regular, `--ink`.
- Right: Bitcoin block height pill — `--cream` background, `--cream-border`
  border, border-radius 2px, padding 4px 10px. Label `"BTC"` in `"JetBrains
  Mono"` 10px `--faint`, value in `"JetBrains Mono"` 10px `--ink` weight 500,
  then a 5px live dot in `--verified` pulsing at 2.5s. Updates every 30s
  via Stacks API `/v2/info`. This signals the system is live without
  requiring the user to understand what it means.

---

### `StatusStamp.jsx` — The signature component

This is the most important component in the entire application.
Build it with ceremony.

**Props:** `status: "VALID" | "REVOKED" | "NOT_FOUND" | "TAMPERED" | "LOADING"`
`certificate?: object` (cert metadata, present when status is VALID or REVOKED)

**VALID state:**
- Full-width panel, `--verified-bg` background, 2px `--verified` left border
- Status glyph SVG (36px): concentric circles + check mark in `--verified`.
  Animates from `scale(0.8) opacity(0)` to `scale(1) opacity(1)` over 250ms
  ease-out on mount. No bounce — controlled, official.
- Heading: `"Verified valid"` in `"Libre Baskerville"` bold, `--verified-deep`,
  sentence case (not all-caps). 20px. The Baskerville serif gives this the
  weight of a rubber stamp on an official document.
- Subtext: `"Authentic and unrevoked. Hash confirmed against on-chain record."`
  in `"DM Sans"` 300, 11px, `--muted`, max-width 220px.
- Divider: 0.5px `--cream-border`
- Metadata grid (2 columns): student name, year, programme, grade.
  Label in 9px uppercase `--faint`, value in 12px `--ink` weight 500.

**REVOKED state:**
- `--revoked-bg` background, 2px `--revoked` left border
- Glyph: circle with X in `--revoked` (not filled — outline only)
- Heading: `"Certificate revoked"` in `"Libre Baskerville"` bold, `--revoked`
- Subtext: `"Permanently invalidated and anchored to Bitcoin. Cannot be undone."`
- Metadata: revoked-by address (monospace, truncated), BTC block height

**NOT_FOUND state:**
- `--cream-soft` background, 2px `--cream-border` left border
- Glyph: dashed circle outline in `--cream-border` (absence of a seal)
- Heading: `"Not found"` in `"Libre Baskerville"` bold, `--muted`
- Subtext: `"No certificate record exists on the blockchain for this identifier."`

**TAMPERED state:**
- `--amber-bg` background, 2px `--amber` left border
- Glyph: triangle warning outline in `--amber`
- Heading: `"Document tampered"` in `"Libre Baskerville"` bold, `--amber`
- Subtext: `"Hash mismatch detected. The file does not match the on-chain record."`

**LOADING state:**
- `--cream-soft` background, no border
- A thin 1px horizontal line in `--cream-border` sweeps from top to bottom
  of the panel over 1.2s, looping. CSS animation only — `transform: translateY`
  from `-100%` to `100%` on a `::after` pseudo-element with `overflow: hidden`.
- Text: `"Querying blockchain…"` in `"JetBrains Mono"` 12px, `--faint`

---

### `IssueCertificate.jsx` — University dashboard

**Left panel (form, 55% width):**

Section heading: `"Certificate details"` in `"Libre Baskerville"` 22px regular,
`--ink`. Below it: `"All fields are hashed and anchored immutably on the Stacks
blockchain"` in `"DM Sans"` 300, 12px, `--muted`.

Form fields — bottom-border-only input style (no box border):
- `field-label`: 10px uppercase `"DM Sans"` 500, `--muted`, letter-spacing 0.1em
- `field-input`: transparent background, `--cream-border` bottom border (1px),
  `--ink` text, 13px `"DM Sans"` 400. On focus: border colour transitions to
  `--coral`. No box shadow, no outline box.
- Fields: student full name, admission number, programme, year, grade
- Grid: 2 columns for name+admission, programme+year. Grade full width.

PDF drag-and-drop zone:
- 1px dashed `--cream-border` border, border-radius 3px, padding 18px
- Label: `"Drop certificate PDF here, or click to browse"` in 12px `--muted`
- Hint: `"PDF · max 10 MB · encrypted with AES-256 before upload"` 10px `--faint`
- On hover/drag-over: border-color → `--coral`, background → `--coral-soft`
- On file selected: show filename in `"JetBrains Mono"` 11px `--ink` + file size

Submit button: `"Issue and anchor certificate"` — `--ink` background,
`--cream` text, full width, border-radius 3px, 11px padding. NOT green.
Green is reserved for VALID status only. The button earns its authority
from the contrast of ink on cream.

Progress steps (appear on submit, replace button area):
```
✓  Certificate hash computed (SHA-256)          ← done: --verified text
✓  Encrypted PDF uploaded to IPFS               ← done: --verified text
→  Proposing transaction to Stacks blockchain   ← active: --coral, weight 500
○  Second signature pending                     ← pending: --faint
○  Anchored to Bitcoin via PoX                  ← pending: --faint
```
Step markers: `✓` in `--verified`, `→` in `--coral`, `○` in `--faint`.
Each step reveals sequentially with a 100ms opacity fade, no slide.

**Right panel (recent issuances, 45% width):**
`"DM Sans"` 11px uppercase label `"RECENT ISSUANCES"` in `--faint`.
List of last 5 certificates — cert ID in `"JetBrains Mono"` 10px `--faint`,
student name in 13px `--ink`, programme in 12px `--muted`. Status dot:
5px circle, `--verified` or `--revoked`. Rows separated by `--cream-border`
0.5px lines. Click → navigate to verify page pre-filled with that cert ID.

---

### `VerifyCertificate.jsx` — Employer + Student shared

**Two input methods, tabbed:**

Tab 1 — `"Enter certificate ID"`:
- Large monospace input field, placeholder:
  `"Paste the 64-character certificate identifier"`
- `"Verify"` button below

Tab 2 — `"Scan QR code"`:
- Camera scanner component (html5-qrcode) with rounded corners,
  a scanning reticle overlay (thin green corner brackets, CSS only)
- On successful scan: auto-submits, camera closes

**Below inputs:** The `StatusStamp` component renders with full ceremony
after the API call resolves.

**If VALID:** Show the `QRDisplay` component beneath the stamp —
`"Share this verification link"` with the QR code and a copy-link button.

---

### `MyCertificates.jsx` — Student portal

A grid of certificate cards (2 columns on desktop, 1 on mobile).

Each `CertCard`:
- Background: `--linen`. Border: 0.5px `--cream-border`. Border-radius: 3px.
- Left accent: 3px `--verified` left border on the card itself (not inside).
  This signals the card represents a valid, anchored credential.
- Programme name: `"Libre Baskerville"` 17px regular, `--ink`, padding-left 12px
- Issuing university: 11px `"DM Sans"` 300, `--muted`, padding-left 12px
- Fact row (year, grade, admission): 9px uppercase `--faint` labels,
  12px `--ink` weight 500 values, gap 20px, padding-left 12px
- Divider: 0.5px `--cream-border`
- Cert ID row: `"JetBrains Mono"` 10px `--faint` + IPFS CID truncated
- Action buttons: `"View & Download"` in `--ink` bg / `--cream` text (primary),
  `"Share QR code"` in `--cream` bg / `--ink` text / `--cream-border` border.
  Border-radius 2px, 11px font.
- On card hover: border-color → `--cream-border` to `--verified` transition
  150ms ease.

Empty state: centered SVG of a document outline (simple, no fill) in
`--cream-border`. Below it: `"No certificates registered to this wallet yet"`
in `"Libre Baskerville"` italic 16px `--muted`.

---

### `AuditRegistry.jsx` — KNQA dashboard

**Top stats row (3 metric cards):**
- Background: `--linen`. Border: 0.5px `--cream-border`. Border-radius 3px.
  Padding 14px 16px.
- Label: 10px uppercase `"DM Sans"` 500, `--faint`, letter-spacing 0.1em
- Value: `"Libre Baskerville"` 28px regular, `--ink`. Active count in
  `--verified-deep`. Revoked count in `--revoked`.

**Search bar:** `--linen` background input, `--cream-border` bottom border
only (no box). Placeholder: `"Search by cert ID, student, or institution…"`
in `"DM Sans"` 13px `--faint`. Below the stats row, above the table.

**Certificate table:**
- Header row: `--cream-soft` background, `--cream-border` border, border-radius
  3px 3px 0 0. 9px uppercase `"DM Sans"` 500 `--muted`, letter-spacing 0.1em.
  Padding 8px 12px.
- Body rows: `--linen` background, `--cream-border` borders (no top border,
  stacked). Padding 11px 12px. On hover: `--cream-soft` background 0.1s.
  Last row: border-radius 0 0 3px 3px.
- Cert ID column: `"JetBrains Mono"` 10px `--muted`
- Status pills: 2px border-radius, 10px `"DM Sans"` 500, letter-spacing 0.04em
  - Valid → `--verified-bg` bg, `--verified-deep` text
  - Revoked → `--revoked-bg` bg, `--revoked` text
- Action column: `"Revoke"` in `--coral`, 11px `"DM Sans"` 500, no bg, no
  border. On hover: underline. Disabled (already revoked): `--faint`, no cursor.

**Revocation confirmation modal:**
- Overlay: `rgba(26, 26, 24, 0.5)` — warm ink, not cold black
- Modal: `--linen` background, `--cream-border` border, border-radius 3px,
  padding 28px, max-width 400px
- Heading: `"Confirm revocation"` in `"Libre Baskerville"` 18px, `--ink`
- Body: `"This action is permanent and cannot be undone. The revocation will
  be anchored to the Bitcoin blockchain via Proof of Transfer."` in `"DM Sans"`
  13px 300, `--muted`
- Cert ID shown: `"JetBrains Mono"` 11px `--ink` in a `--cream-soft` inset box
- Buttons: `"Cancel"` (cream/border) + `"Confirm revocation"` (`--revoked` bg,
  `--cream` text). Both border-radius 3px.

---

### `HashDisplay.jsx` — Reusable cert ID display

```
a3f9d2e1···4f2a  [copy]
```

- Font: `"JetBrains Mono"` 10px, `--faint`
- Shows first 8 + last 4 chars with `···` ellipsis (not `...`)
- Copy label: 10px `"DM Sans"` `--faint`, no border, no bg. On click:
  copies full hash to clipboard, label briefly reads `"copied"` in
  `--verified` for 1.5s, then reverts
- On hover: full hash appears as a native browser `title` tooltip

---

## Authentication Flow

```jsx
// hooks/useWallet.js
// On connect:
// 1. @stacks/connect showConnect() triggers wallet popup
// 2. On success: store { address, publicKey } in React state + sessionStorage
// 3. Call API GET /api/role/:address → returns role from on-chain registry
// 4. Store role in state
// 5. React Router redirects to role-specific dashboard

// On page reload:
// 1. Check sessionStorage for existing session
// 2. Re-verify role from API (don't trust cached role alone)
// 3. Restore session or redirect to connect screen

// Route guard:
// <PrivateRoute role="university"> wraps university pages
// Redirects to /connect if no wallet, or /unauthorized if wrong role
```

---

## Environment Variables

```
VITE_API_URL=http://localhost:4000
VITE_STACKS_NETWORK=devnet
VITE_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
VITE_CONTRACT_NAME_ROLES=role-registry
VITE_CONTRACT_NAME_CERTS=certificate-store
VITE_STACKS_API_URL=http://localhost:3999
```

---

## Responsive Behaviour

The proposal specifies smartphones as the predominant internet access device
in Kenya. Design mobile-first:

- `ConnectWallet` → full viewport, works identically on mobile
- `VerifyCertificate` → primary mobile use case — the QR scanner especially
  must work cleanly on phone cameras
- `AppShell` → sidebar collapses to bottom tab bar on mobile (4 tabs max)
- `StatusStamp` → full-width on mobile, same ceremony
- `IssueCertificate` → single column on mobile, form first
- `AuditRegistry` → table scrolls horizontally on mobile, stat cards stack

---

## Accessibility Requirements

- All status states must be communicated via text, not color alone
  (VALID/REVOKED text labels always present alongside color)
- Form inputs: proper `<label>` elements, not placeholder-as-label
- QR scanner: keyboard-accessible fallback (cert ID input is always available)
- Focus rings: visible, `--coral` colored (matches the active accent, not green)
- Verification result: `aria-live="polite"` region so screen readers
  announce status changes

---

## What NOT to Build in This Phase

- No backend changes (API is complete from Phase 1)
- No actual Stacks testnet deployment (still simnet locally)
- No PDF viewer in-browser (download only)
- No email notifications
- No multi-language support (English only for prototype)

---

## Build Order

**Before writing any component code**, complete the monorepo setup:

```bash
# From repository root
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom axios @stacks/connect @stacks/transactions @stacks/network qrcode html5-qrcode lucide-react
cd ..
npm install --save-dev concurrently
```

Then update the root `package.json` scripts as described above, replace
`frontend/tailwind.config.js` and `frontend/src/index.css` with the versions
above, and create `frontend/.env` and `frontend/.env.example`.

Verify the scaffold works before touching any component:
```bash
npm run dev:frontend   # should open http://localhost:5173
npm run dev:api        # should start API on http://localhost:4000
npm run dev            # both together via concurrently
```

**Component build sequence:**

1. `ConnectWallet.jsx` + `useWallet.js` — get wallet auth working end to end.
   Confirm the linen surface, grain texture, and wordmark render correctly.
   Test with a Hiro wallet on simnet before proceeding.
2. `AppShell.jsx` + `Sidebar.jsx` + `Topbar.jsx` — authenticated shell with
   coral active nav and BTC block pill. Test all four role states.
3. `StatusStamp.jsx` — build all five states completely (VALID, REVOKED,
   NOT_FOUND, TAMPERED, LOADING). This is the design centrepiece. Confirm
   the stamp animation and Baskerville serif rendering before moving on.
4. `VerifyCertificate.jsx` — wires `StatusStamp` to `GET /api/verify/:certId`.
   Test the full verify flow against the running simnet API.
5. `IssueCertificate.jsx` — form, PDF drop zone, sequential progress steps.
   Wire to `POST /api/issue`.
6. `MyCertificates.jsx` — cert card grid. Wire to `GET /api/verify/:certId`
   for each cert returned from the on-chain registry.
7. `AuditRegistry.jsx` — stats, table, revocation modal. Wire to
   `POST /api/revoke`.
8. Mobile responsive pass — bottom tab bar on mobile, QR scanner full viewport.
9. Polish pass — loading states, empty states, error states, focus rings,
   aria-live regions, scrollbar styling.
