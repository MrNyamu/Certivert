# Certivert — Claude Code Foundation Prompt
## Phase 1: Clarity Smart Contracts + Node.js API + IPFS Integration

---

## Project Overview

You are building **Certivert**, a blockchain-based academic certificate verification
system for Kenyan universities. The system prevents fraudulent academic credentials
by anchoring certificate records immutably on the Stacks blockchain (Bitcoin Layer 2).

This prompt covers **Phase 1** — the backend foundation:
1. Clarity smart contracts (deployed to Clarinet devnet)
2. Node.js / Express REST API
3. IPFS integration and SHA-256 hashing

There is **no database**. The Clarity smart contract is the sole source of truth for
all certificate state. IPFS stores the encrypted PDF documents. The Node.js API is a
stateless orchestration layer only.

---

## Architecture Reference

```
Presentation layer   React.js (built in Phase 2 — not this prompt)
Auth layer           Hiro / Leather wallet via @stacks/connect (Phase 2)
─────────────────────────────────────────────────────────────────────
Application layer    Node.js + Express  ←  THIS PROMPT
                     REST API bridge, SHA-256 hashing, PDF handling
─────────────────────────────────────────────────────────────────────
Storage layer
  ├── IPFS           Encrypted cert PDFs, pinned, content-addressed  ←  THIS PROMPT
  └── Clarity        cert hash + CID + revocation flag + roles       ←  THIS PROMPT
        └── Stacks chain → PoX → Bitcoin settlement layer
```

---

## Monorepo Structure to Scaffold

```
certivert/
├── contracts/                        # Clarity smart contracts
│   ├── role-registry.clar
│   └── certificate-store.clar
├── tests/                            # Clarinet unit tests
│   ├── role-registry_test.ts
│   └── certificate-store_test.ts
├── Clarinet.toml                     # Clarinet project config
├── settings/
│   └── Devnet.toml                   # Devnet wallet config
│
├── api/                              # Node.js / Express backend
│   ├── src/
│   │   ├── index.js                  # Express app entry point
│   │   ├── config.js                 # Env vars and constants
│   │   ├── routes/
│   │   │   ├── issue.js              # POST /api/issue
│   │   │   ├── verify.js             # GET  /api/verify/:certId
│   │   │   └── revoke.js             # POST /api/revoke
│   │   ├── services/
│   │   │   ├── ipfs.js               # IPFS upload / fetch / pin
│   │   │   ├── hash.js               # SHA-256 cert hashing
│   │   │   ├── stacks.js             # Stacks node RPC calls
│   │   │   └── contract.js           # Clarity contract read/write
│   │   └── middleware/
│   │       ├── upload.js             # Multer PDF upload handler
│   │       └── errorHandler.js       # Global error handler
│   ├── package.json
│   └── .env.example
│
└── README.md
```

---

## Part 1 — Clarity Smart Contracts

### 1A. `contracts/role-registry.clar`

**Purpose:** Manage which wallet addresses hold which roles in the system.
Roles: `university`, `student`, `employer`, `knqa`.
Only the contract deployer (admin) can assign or revoke roles.

**Required data structures:**
```clarity
;; Map: principal -> role string
(define-map roles principal (string-ascii 20))

;; Admin is the contract deployer
(define-data-var admin principal tx-sender)
```

**Required public functions:**
- `(assign-role (user principal) (role (string-ascii 20)))` — admin only, errors with
  `u401` if caller is not admin
- `(revoke-role (user principal))` — admin only
- `(get-role (user principal))` — read-only, returns `(optional (string-ascii 20))`
- `(has-role (user principal) (role (string-ascii 20)))` — read-only, returns bool
- `(is-university (user principal))` — read-only convenience function
- `(is-knqa (user principal))` — read-only convenience function

**Error constants:**
```clarity
(define-constant ERR-NOT-ADMIN (err u401))
(define-constant ERR-ROLE-NOT-FOUND (err u404))
(define-constant ERR-INVALID-ROLE (err u400))
```

**Valid roles:** `"university"`, `"student"`, `"employer"`, `"knqa"` — validate on
assign, return `ERR-INVALID-ROLE` for anything else.

---

### 1B. `contracts/certificate-store.clar`

**Purpose:** Core certificate lifecycle — propose issuance (multi-sig), finalise
issuance once threshold met, verify, and revoke. This contract imports from
`role-registry` to enforce role-based access control.

**Certificate record structure:**
```clarity
(define-map certificates
  (string-ascii 64)          ;; cert-id (SHA-256 hex of cert data)
  {
    student-name:   (string-ascii 100),
    admission-no:   (string-ascii 30),
    programme:      (string-ascii 100),
    year:           uint,
    grade:          (string-ascii 20),
    ipfs-cid:       (string-ascii 100),
    cert-hash:      (string-ascii 64),
    issued-by:      principal,
    issued-at:      uint,           ;; block height
    revoked:        bool,
    revoked-by:     (optional principal),
    revoked-at:     (optional uint)
  }
)
```

**Pending multi-sig transaction structure (2-of-2 for prototype simplicity):**
```clarity
(define-map pending-txs
  (string-ascii 64)          ;; cert-id
  {
    proposer:       principal,
    signer-2:       (optional principal),
    cert-data:      { ... same fields as above minus revocation fields ... },
    signatures:     uint,          ;; count: 1 after propose, 2 after approve
    proposed-at:    uint
  }
)

;; Track authorised second signers (set by admin)
(define-map authorised-signers principal bool)
```

**Required public functions:**

`(propose-certificate (cert-id (string-ascii 64)) (student-name ...) (admission-no ...)
  (programme ...) (year uint) (grade ...) (ipfs-cid ...) (cert-hash ...))`
- Caller must have role `"university"` (check via contract-call to role-registry)
- cert-id must not already exist in certificates map
- cert-id must not already be pending
- Creates entry in `pending-txs` with `signatures: u1`
- Errors: `ERR-NOT-AUTHORISED (u401)`, `ERR-ALREADY-EXISTS (u409)`,
  `ERR-ALREADY-PENDING (u409)`

`(approve-certificate (cert-id (string-ascii 64)))`
- Caller must be in `authorised-signers` map
- Caller must not be the original proposer (prevents self-approval)
- pending-tx must exist with `signatures: u1`
- Increments signatures to `u2`, threshold met → moves record from
  `pending-txs` into `certificates` map with `revoked: false`
- Deletes entry from `pending-txs`
- Errors: `ERR-NOT-AUTHORISED`, `ERR-NOT-FOUND (u404)`,
  `ERR-ALREADY-SIGNED (u409)`, `ERR-SELF-APPROVAL (u403)`

`(revoke-certificate (cert-id (string-ascii 64)))`
- Caller must have role `"university"` OR `"knqa"`
- Certificate must exist and not already be revoked
- Sets `revoked: true`, `revoked-by: (some tx-sender)`, `revoked-at: (some block-height)`
- Errors: `ERR-NOT-AUTHORISED`, `ERR-NOT-FOUND`, `ERR-ALREADY-REVOKED (u409)`

`(add-authorised-signer (signer principal))` — admin only
`(remove-authorised-signer (signer principal))` — admin only

**Required read-only functions:**

`(get-certificate (cert-id (string-ascii 64)))` — returns full certificate record or none

`(verify-certificate (cert-id (string-ascii 64)))` — returns:
```clarity
{
  status: (string-ascii 20),   ;; "VALID" | "REVOKED" | "NOT_FOUND"
  certificate: (optional { ... })
}
```

`(get-pending-tx (cert-id (string-ascii 64)))` — returns pending tx or none

`(is-authorised-signer (signer principal))` — returns bool

---

### 1C. Clarinet Tests (`tests/`)

Write Clarinet/Vitest unit tests for both contracts covering:

**role-registry tests:**
- Admin can assign a valid role
- Non-admin cannot assign a role (expect ERR-NOT-ADMIN)
- Invalid role string rejected (expect ERR-INVALID-ROLE)
- `get-role` returns correct role after assignment
- `has-role` returns true/false correctly
- Admin can revoke a role

**certificate-store tests:**
- University wallet can propose a certificate
- Non-university wallet cannot propose (expect ERR-NOT-AUTHORISED)
- Duplicate cert-id proposal rejected (expect ERR-ALREADY-PENDING)
- Authorised signer can approve, moves to certificates map
- Proposer cannot self-approve (expect ERR-SELF-APPROVAL)
- `verify-certificate` returns VALID for issued cert
- University can revoke, `verify-certificate` returns REVOKED
- KNQA can revoke
- Non-authorised wallet cannot revoke (expect ERR-NOT-AUTHORISED)
- Double-revoke rejected (expect ERR-ALREADY-REVOKED)

---

## Part 2 — Node.js / Express API

### Tech stack
- Node.js 20+
- Express 4
- `multer` for PDF file uploads (memory storage, 10MB limit, PDF only)
- `@stacks/transactions` and `@stacks/network` for Stacks contract calls
- `kubo-rpc-client` (formerly `ipfs-http-client`) for IPFS
- `crypto` (built-in Node) for SHA-256 hashing
- `dotenv` for environment config
- `cors`, `helmet`, `express-rate-limit` for basic security

### `api/src/config.js`

Load and export all environment variables with defaults:
```js
STACKS_NETWORK=devnet          // or testnet
STACKS_API_URL=http://localhost:3999
CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
CONTRACT_NAME_ROLES=role-registry
CONTRACT_NAME_CERTS=certificate-store
IPFS_API_URL=http://127.0.0.1:5001
API_PORT=4000
DEPLOYER_PRIVATE_KEY=           // devnet deployer key from Clarinet.toml
SIGNER_2_PRIVATE_KEY=           // second signer key from Clarinet.toml
```

### `api/src/services/hash.js`

```js
// computeCertHash(certData) -> hex string (SHA-256)
// Input: { studentName, admissionNo, programme, year, grade }
// Canonicalise: sort keys, JSON.stringify, SHA-256
// Returns: 64-char hex string — this is the cert-id
```

### `api/src/services/ipfs.js`

```js
// uploadToIPFS(fileBuffer) -> { cid: string }
// Encrypts buffer with AES-256-CBC (key from env ENCRYPTION_KEY)
// Uploads encrypted buffer to local IPFS node
// Pins the CID
// Returns CID string

// fetchFromIPFS(cid) -> Buffer
// Fetches encrypted buffer from IPFS by CID
// Decrypts and returns plaintext buffer

// pinCID(cid) -> void
// Pins a CID on the local node (call after cert is finalised on-chain)
```

Use Node.js `crypto` for AES-256-CBC. Derive IV per file (random 16 bytes),
prepend IV to the stored buffer so it can be recovered on fetch.

### `api/src/services/contract.js`

```js
// proposeCertificate(certId, certData, ipfsCid, signerKey) -> txId
// Calls propose-certificate on certificate-store contract
// Uses makeContractCall from @stacks/transactions
// Broadcasts to Stacks devnet node
// Returns transaction ID

// approveCertificate(certId, signer2Key) -> txId
// Calls approve-certificate — completes the 2-of-2 threshold
// Returns transaction ID

// revokeCertificate(certId, callerKey) -> txId
// Calls revoke-certificate
// Returns transaction ID

// verifyCertificate(certId) -> { status, certificate }
// Read-only call to verify-certificate
// Uses callReadOnlyFunction from @stacks/transactions
// Returns parsed result object

// getPendingTx(certId) -> pendingTx | null
// Read-only call to get-pending-tx
```

### `api/src/routes/issue.js` — `POST /api/issue`

**Request:** `multipart/form-data`
```
fields: studentName, admissionNo, programme, year, grade
file:   pdf (required, max 10MB)
```

**Flow (matches sequence diagram exactly):**
1. Validate all fields present
2. Compute `certId = SHA-256(canonicalised cert data)`
3. Upload encrypted PDF to IPFS → get `cid`
4. Call `proposeCertificate(certId, certData, cid, deployerKey)` → `txId1`
5. Call `approveCertificate(certId, signer2Key)` → `txId2`
   *(In production this is a separate action by Signer 2. For the prototype,
   auto-approve using the second devnet wallet key to complete the flow in one
   API call. Add a comment explaining this prototype shortcut.)*
6. Pin the CID on IPFS
7. Return `{ certId, ipfsCid: cid, proposeTxId: txId1, approveTxId: txId2, status: "issued" }`

**Error responses:** 400 for missing fields, 409 for duplicate certId, 500 for
contract/IPFS failures. Always return `{ error: string }` shape.

### `api/src/routes/verify.js` — `GET /api/verify/:certId`

**Flow (matches sequence diagram):**
1. Call `verifyCertificate(certId)` on contract → get `{ status, certificate }`
2. If status is `NOT_FOUND` → return 404 `{ status: "NOT_FOUND" }`
3. If status is `REVOKED` → return 200 `{ status: "REVOKED", certificate }`
4. Fetch encrypted PDF from IPFS using `certificate.ipfsCid`
5. Decrypt PDF buffer
6. Recompute SHA-256 hash of decrypted buffer
7. Compare recomputed hash against `certificate.certHash`
8. If hashes match → `{ status: "VALID", certificate, hashVerified: true }`
9. If hashes mismatch → `{ status: "TAMPERED", certificate, hashVerified: false }`

### `api/src/routes/revoke.js` — `POST /api/revoke`

**Request body:** `{ certId: string, callerRole: "university" | "knqa" }`

**Note:** In Phase 2 the caller's wallet signature will authenticate this. For Phase 1
prototype, accept `callerRole` in the body and use the corresponding devnet private key
from config. Add a `// TODO: replace with wallet signature verification in Phase 2`
comment.

**Flow:**
1. Validate `certId` and `callerRole`
2. Check certificate exists and is not already revoked (call `verifyCertificate`)
3. Call `revokeCertificate(certId, callerKey)` → `txId`
4. Return `{ certId, txId, status: "revoked" }`

### `api/src/middleware/upload.js`

Multer config:
- Storage: `memoryStorage()` (no disk writes)
- File filter: accept `application/pdf` only, reject others with 400
- Limits: `fileSize: 10 * 1024 * 1024` (10MB)

### `api/src/middleware/errorHandler.js`

Global Express error handler. Logs error, returns:
```json
{ "error": "message", "code": "ERROR_CODE" }
```
Never expose stack traces in responses.

### `api/src/index.js`

- Apply `helmet()`, `cors({ origin: 'http://localhost:5173' })`, rate limiter
  (100 req/15min per IP)
- Mount routes under `/api`
- Apply global error handler last
- Log startup: network, contract addresses, IPFS URL, port

---

## Part 3 — Environment and README

### `.env.example`
```
STACKS_NETWORK=devnet
STACKS_API_URL=http://localhost:3999
CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
CONTRACT_NAME_ROLES=role-registry
CONTRACT_NAME_CERTS=certificate-store
IPFS_API_URL=http://127.0.0.1:5001
API_PORT=4000
DEPLOYER_PRIVATE_KEY=753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3d7ac5
SIGNER_2_PRIVATE_KEY=7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61efef9f6c27
ENCRYPTION_KEY=a-32-byte-hex-string-here-replace-me
```

The deployer and signer keys above are Clarinet's standard devnet wallet keys
(safe to include in example — devnet only, no real funds).

### `README.md`

Include:
1. Prerequisites (Clarinet CLI, Node 20+, IPFS Desktop or Kubo)
2. Setup steps: `clarinet integrate`, install npm deps, copy `.env`
3. How to run: `clarinet devnet start` then `node src/index.js`
4. How to test contracts: `clarinet test`
5. API endpoint reference (method, path, request shape, response shape) for all 3 routes
6. How to assign roles using `clarinet console` before testing

---

## Constraints and Code Quality Rules

- **No MongoDB or any database.** All state lives on-chain or in IPFS.
- **No TypeScript** for the API — plain ES modules (`.js`) with JSDoc comments.
- **Clarity contracts** must pass `clarinet check` with zero warnings.
- All Clarity functions must have inline comments explaining each step.
- API services must be pure functions where possible — no global mutable state.
- All `async` functions must have `try/catch` with meaningful error messages.
- Private keys must only come from environment variables — never hardcoded
  (except the `.env.example` which uses public devnet keys).
- Use `console.log` for info, `console.error` for errors — no logging library needed
  for Phase 1.
- The API must start cleanly on a fresh `clarinet devnet` with no manual setup
  beyond copying `.env` and running npm install.

---

## Verification Checklist (Claude Code must satisfy all of these)

- [ ] `clarinet check` passes on both contracts
- [ ] `clarinet test` passes all unit tests (green)
- [ ] `POST /api/issue` with a PDF returns `certId` and `status: "issued"`
- [ ] `GET /api/verify/:certId` returns `status: "VALID"` for that certId
- [ ] `POST /api/revoke` with that certId returns `status: "revoked"`
- [ ] `GET /api/verify/:certId` after revocation returns `status: "REVOKED"`
- [ ] A tampered certId (non-existent) returns `status: "NOT_FOUND"`
- [ ] IPFS upload and fetch round-trip works (encrypt → pin → fetch → decrypt)
- [ ] SHA-256 hash is deterministic for the same cert data

---

## What NOT to Build in This Phase

- No React frontend (Phase 2)
- No wallet connection UI (Phase 2)
- No QR code generation (Phase 2)
- No role dashboards (Phase 2)
- No deployment to Stacks testnet (Phase 3 — devnet only for now)
- No Nginx / PM2 / domain hosting (Phase 3)

Start with the Clarity contracts and Clarinet setup, then the API services
(`hash.js`, `ipfs.js`, `contract.js`), then the routes, then the tests.
