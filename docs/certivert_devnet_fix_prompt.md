# Certivert — Devnet Fix & Migration from Simnet

## Your Mission

You are debugging and fixing a broken Clarinet devnet setup for the Certivert project
on an Apple Silicon Mac (arm64). The developer has spent 7+ hours fighting this and
needs a working devnet so the Node.js API can broadcast real transactions.

Do NOT ask for permission before running diagnostic commands. Investigate first,
explain what you find, then fix it.

---

## System Context

- **Machine:** Apple Silicon (arm64) — M-series Mac
- **OS:** macOS
- **Docker Desktop:** v29.2.1 — host networking is ENABLED
- **Node.js:** v22.14.0
- **Clarinet:** installed via Homebrew (version unknown — check first)
- **Project path:** `~/Documents/Developer/Github/certivert/certivert`
- **Branch:** `mr/startup-fixes`

---

## The Problem

`clarinet devnet start` fails with this error immediately after startup:

```
terminating devnet network: logs and chainstate available at location
/Users/wesleynyamu/.../certivert/.cache/stacks-devnet-XXXXXXXXXX/
error: unable to retrieve network: Docker responded with status code 404:
network <hash> not found
```

### What has already been tried (do NOT repeat these):
- Deleting `.cache` directory — cache regenerates, problem persists
- `docker network prune -f` — no stale networks, problem persists
- `docker volume rm` — volumes cleared, problem persists
- Adding `epoch_3_0 = 132` to `Devnet.toml` — helps with snapshot but not the 404
- `clarinet devnet start --from-genesis` — same 404 error
- Enabling Docker host networking — done, did not fix it
- Multiple reinstalls of containers — same result every time

### Secondary problem (when devnet partially starts):
When devnet does start (rare), the stacks-api throws:
```
DB does not contain a parent block at height 37
```
This is because the stacks-node loads from a cached snapshot (height 37+) but
Postgres is empty (height 0) — they are out of sync.

### Third problem:
The deployer address changes every run:
```
- expected-sender: ST3BVB6Z3PZ9GJDWSPKY4NJGH8PR0XJM846AMWAC9  (saved)
+ expected-sender: ST32MF4T90BPJSQBE0P9AT726QJ2K9VJ5R9E9KX6G  (recomputed)
```
This happens because Clarinet's newer versions derive addresses from a mnemonic,
not from the `secret_key` in `Devnet.toml`. No mnemonic is set, so it generates
a new random one each run.

---

## Current File State

### `settings/Devnet.toml`
```toml
# Devnet Configuration
[network]
name = "devnet"
deployment_fee_rate = 10

[accounts.deployer]
secret_key = "753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3d7ac5"
balance = 100_000_000_000_000
sbtc_balance = 1_000_000_000

[accounts.wallet_1]
secret_key = "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61efef9f6c27"
balance = 100_000_000_000_000
sbtc_balance = 1_000_000_000

[accounts.wallet_2]
secret_key = "530d9f61984c888536871c6573073bdfc0058896dc1adfe9a6a10dfacadc209155"
balance = 100_000_000_000_000
sbtc_balance = 1_000_000_000

[accounts.wallet_3]
secret_key = "d655b2523bcd65e34889725c73064feb17ceb796831c0e111ba1a552b0f31b3901"
balance = 100_000_000_000_000
sbtc_balance = 1_000_000_000

[accounts.faucet]
secret_key = "f9d7206a47f14d2870c163ebab4bf3e70d18f5d14ce1031f3902fbbc894fe4c701"
balance = 100_000_000_000_000
sbtc_balance = 1_000_000_000

[devnet]
disable_stacks_explorer = false
disable_stacks_api = false
epoch_3_0 = 132
```

### `Clarinet.toml`
```toml
[project]
name = "certivert"
description = ""
authors = []
telemetry = true
cache_dir = "./.cache"

[contracts.role-registry]
path = "contracts/role-registry.clar"
epoch = "latest"

[contracts.certificate-store]
path = "contracts/certificate-store.clar"
epoch = "latest"
depends_on = ["role-registry"]

[repl.analysis]
passes = ["check_checker"]
check_checker = { trusted_sender = false, trusted_caller = false, callee_filter = false }
```

### `api/.env` (current — still pointing at simnet)
```
STACKS_NETWORK=simnet
API_PORT=3001
IPFS_API_URL=http://127.0.0.1:5001
ENCRYPTION_KEY=<redacted>
CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
CONTRACT_NAME_ROLES=role-registry
CONTRACT_NAME_CERTS=certificate-store
DEPLOYER_PRIVATE_KEY=753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3d7ac5
```

---

## Investigation Steps — Run These First

Before fixing anything, run these diagnostics and report findings:

```bash
# 1. Check Clarinet version
clarinet --version

# 2. Check Docker networking mode
docker info | grep -E "Network|Bridge|Host"

# 3. Check if Docker can create networks at all
docker network create test-certivert-net
docker network rm test-certivert-net

# 4. Check current state of all certivert containers and networks
docker ps -a --filter "name=certivert"
docker network ls --filter "name=certivert"
docker volume ls --filter "name=certivert"

# 5. Check the full Clarinet devnet start error with verbose output
cd ~/Documents/Developer/Github/certivert/certivert
clarinet devnet start --from-genesis 2>&1 | head -30
```

---

## Fix Priority Order

Fix these in order — do not skip ahead:

### Fix 1 — Resolve the Docker 404 network error (BLOCKER)

The root cause is Clarinet tries to reference a Docker network by ID before it
exists. Investigate whether this is:

(a) A Clarinet version bug — check if upgrading/downgrading fixes it:
```bash
clarinet --version
# If above 2.3.0, try:
brew uninstall clarinet
brew install clarinet@2.3.0
# or install specific binary from GitHub releases for arm64
```

(b) A Docker Desktop configuration issue on Apple Silicon — check:
```bash
# Confirm host networking is enabled
docker run --rm --network host alpine ping -c1 localhost
```

(c) A permissions issue with Docker socket:
```bash
ls -la /var/run/docker.sock
groups $USER | grep docker
```

If the Clarinet version is newer than 2.3.0, download and test with the last
known-stable arm64 binary:
```bash
curl -L https://github.com/hirosystems/clarinet/releases/download/v2.3.0/clarinet-macos-arm64.tar.gz \
  -o /tmp/clarinet-stable.tar.gz
tar -xzf /tmp/clarinet-stable.tar.gz -C /tmp/
/tmp/clarinet --version
# If it works, replace the current binary:
sudo mv /tmp/clarinet $(which clarinet)
```

### Fix 2 — Stabilise the deployer address

Once devnet starts, add the correct mnemonics to `Devnet.toml` so the deployer
address never changes between runs.

The correct approach is:
1. Let Clarinet generate and save a deployment plan once (type Y to overwrite)
2. Read the generated mnemonic from the cache:
   ```bash
   cat .cache/stacks-devnet-*/settings/Devnet.toml | grep -A2 "deployer"
   ```
3. Copy that mnemonic into `settings/Devnet.toml` under `[accounts.deployer]`
4. Regenerate the plan: `clarinet deployments generate --devnet`
5. Confirm the address is now stable across multiple generate runs

### Fix 3 — Disable snapshot to prevent Postgres mismatch

Add these settings to `[devnet]` in `Devnet.toml`:
```toml
[devnet]
disable_stacks_explorer = false
disable_stacks_api = false
epoch_3_0 = 132
```

Then always start with:
```bash
clarinet devnet start --from-genesis
```

This ensures stacks-node and Postgres always start from block 0 together,
preventing the "DB does not contain parent block" error.

### Fix 4 — Deploy contracts to devnet

Once devnet is stable and all 7 containers are green:
```bash
clarinet deployments apply --devnet
```

Type `n` to keep the saved plan, `Y` to continue.

Verify deployment succeeded:
```bash
curl -s http://localhost:3999/v2/contracts/interface/<DEPLOYER_ADDRESS>/role-registry | python3 -m json.tool | head -10
curl -s http://localhost:3999/v2/contracts/interface/<DEPLOYER_ADDRESS>/certificate-store | python3 -m json.tool | head -10
```

Both should return JSON with contract functions listed.

### Fix 5 — Update the API .env for devnet

Once contracts are deployed, update `api/.env`:
```
STACKS_NETWORK=devnet
STACKS_API_URL=http://localhost:3999
API_PORT=3001
IPFS_API_URL=http://127.0.0.1:5001
ENCRYPTION_KEY=<keep existing value>
CONTRACT_ADDRESS=<address from step 2 — stable deployer address>
CONTRACT_NAME_ROLES=role-registry
CONTRACT_NAME_CERTS=certificate-store
DEPLOYER_PRIVATE_KEY=753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3d7ac5
SIGNER_2_PRIVATE_KEY=7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61efef9f6c27
UNIVERSITY_ADDRESS=<wallet_1 address from devnet>
KNQA_ADDRESS=<wallet_2 address from devnet>
STUDENT_ADDRESS=<wallet_3 address from devnet>
```

### Fix 6 — Remove simnet.js and update contractFactory.js

The API currently has a simnet mode that used the Clarinet SDK in-process.
Now that devnet is working, this should be removed and replaced with standard
`@stacks/transactions` HTTP broadcasting.

Check the current state of:
- `api/src/services/simnet.js` — delete this file
- `api/src/services/contractFactory.js` — remove simnet branch, always use devnet
- `api/src/services/contract.js` — ensure it uses `STACKS_API_URL` from env

### Fix 7 — Assign roles on devnet and run E2E test

After the API starts cleanly against devnet, assign roles using the deployer wallet:

The role assignment needs to happen via the API or a script since clarinet console
uses simnet. Create a one-time setup script `api/scripts/setup-roles.js`:

```js
// Assigns university, knqa, student roles to devnet wallets
// Run once after fresh devnet start: node scripts/setup-roles.js
```

Then run the full E2E test:
```bash
# Issue a certificate
curl -X POST http://localhost:3001/api/issue \
  -F "studentName=John Doe" \
  -F "admissionNo=ADM001" \
  -F "programme=Bachelor of Business in Information Technology" \
  -F "year=2024" \
  -F "grade=First Class Honours" \
  -F "pdf=@./tests/sample.pdf"

# Verify it
curl http://localhost:3001/api/verify/<certId>

# Revoke it
curl -X POST http://localhost:3001/api/revoke \
  -H "Content-Type: application/json" \
  -d '{"certId": "<certId>", "callerRole": "knqa"}'

# Verify revoked
curl http://localhost:3001/api/verify/<certId>
```

---

## Success Criteria

You are done when ALL of the following are true:

- [ ] `clarinet devnet start --from-genesis` starts without the Docker 404 error
- [ ] All 7 containers show green: bitcoin-node, stacks-node, stacks-api,
      postgres, stacks-signer, stacks-explorer, bitcoin-explorer
- [ ] `docker logs stacks-api.certivert.devnet` shows NO "DB does not contain
      parent block" errors
- [ ] `clarinet deployments apply --devnet` completes without `RecvError`
- [ ] Both contract interfaces return JSON from the Stacks API
- [ ] The deployer address is the same across two consecutive
      `clarinet deployments generate --devnet` runs
- [ ] `POST /api/issue` returns `status: "issued"` with a real txId
- [ ] `GET /api/verify/:certId` returns `status: "VALID"`
- [ ] `POST /api/revoke` returns `status: "revoked"`
- [ ] `GET /api/verify/:certId` after revocation returns `status: "REVOKED"`

---

## Important Constraints

- Do NOT use simnet for any part of the API anymore — devnet only
- Do NOT modify the Clarity contracts — they are correct and pass clarinet check
- Do NOT add a database — all state lives on-chain
- The ENCRYPTION_KEY in .env must be preserved — do not regenerate it
- Private keys only come from .env — never hardcode them in source files
- If you discover the Clarinet version is the root cause, document exactly which
  version works and which doesn't so this can be avoided in future
