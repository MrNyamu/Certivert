# Certivert API - Simnet Integration

This document explains how to use the Certivert API with simnet mode for local development without requiring a running Stacks devnet or Docker containers.

## What is Simnet Mode?

Simnet mode allows the API to use the same in-process simnet that your tests use, providing:

- **No external dependencies**: No need for Docker, Stacks node, or PostgreSQL
- **Instant feedback**: Contract calls execute immediately without waiting for blocks
- **Test consistency**: Same environment as your automated tests
- **Easy debugging**: Full visibility into contract state and execution

## Quick Setup

1. **Copy the environment configuration:**
   ```bash
   cp .env.simnet .env
   ```

2. **Install dependencies (if not already done):**
   ```bash
   npm install
   ```

3. **Start the API in simnet mode:**
   ```bash
   npm run dev
   ```

The API will automatically:
- Initialize the simnet instance with your contracts
- Set up roles (university, knqa, student)  
- Configure authorized signers
- Start serving on http://localhost:4000

## API Endpoints (Simnet Mode)

### Issue Certificate
```bash
POST http://localhost:4000/api/issue
Content-Type: multipart/form-data

# Form fields:
# - studentName: "John Doe"
# - admissionNo: "ADM001" 
# - programme: "Computer Science"
# - year: 2023
# - grade: "First Class"
# - pdf: [PDF file]
```

### Verify Certificate
```bash
GET http://localhost:4000/api/verify/{certId}
```

### Revoke Certificate
```bash
POST http://localhost:4000/api/revoke
Content-Type: application/json

{
  "certId": "certificate_id_here",
  "callerRole": "university"  // or "knqa"
}
```

## Example Test Flow

Here's how to test the complete certificate lifecycle:

### 1. Issue a Certificate
```bash
curl -X POST http://localhost:4000/api/issue \
  -F "studentName=John Doe" \
  -F "admissionNo=ADM001" \
  -F "programme=Computer Science" \
  -F "year=2023" \
  -F "grade=First Class" \
  -F "pdf=@sample-cert.pdf"
```

**Expected Response:**
```json
{
  "certId": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "ipfsCid": "QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o",
  "proposeTxId": "simnet_propose_a1b2c3d4_1640995200000",
  "approveTxId": "simnet_approve_a1b2c3d4_1640995201000",
  "status": "issued",
  "message": "Certificate issued successfully"
}
```

### 2. Verify the Certificate
```bash
curl http://localhost:4000/api/verify/a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Expected Response:**
```json
{
  "status": "VALID",
  "certificate": {
    "studentName": "John Doe",
    "admissionNo": "ADM001",
    "programme": "Computer Science",
    "year": 2023,
    "grade": "First Class",
    "ipfsCid": "QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o",
    "certHash": "def123...",
    "issuedBy": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
    "issuedAt": 8,
    "revoked": false,
    "revokedBy": null,
    "revokedAt": null
  },
  "hashVerified": true,
  "message": "Certificate is valid and authentic"
}
```

### 3. Revoke the Certificate
```bash
curl -X POST http://localhost:4000/api/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "certId": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    "callerRole": "university"
  }'
```

**Expected Response:**
```json
{
  "certId": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "txId": "simnet_revoke_a1b2c3d4_1640995202000",
  "status": "revoked", 
  "revokedBy": "university",
  "message": "Certificate revoked successfully"
}
```

### 4. Verify Revoked Certificate
```bash
curl http://localhost:4000/api/verify/a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Expected Response:**
```json
{
  "status": "REVOKED",
  "certificate": {
    "studentName": "John Doe",
    "admissionNo": "ADM001",
    "programme": "Computer Science", 
    "year": 2023,
    "grade": "First Class",
    "revoked": true,
    "revokedBy": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
    "revokedAt": 9
  },
  "message": "Certificate has been revoked"
}
```

## Key Differences from Network Mode

### Transaction IDs
In simnet mode, transaction IDs are generated as:
- `simnet_propose_{certId}_{timestamp}`
- `simnet_approve_{certId}_{timestamp}` 
- `simnet_revoke_{certId}_{timestamp}`

### No Blockchain Delays
- Contract calls execute immediately
- No need to wait for block confirmation
- Perfect for rapid testing and development

### Roles and Authentication
The simnet is pre-configured with:
- `university` role: Can propose certificates
- `knqa` role: Can revoke certificates  
- `signer2`: Authorized to approve certificates
- `student` role: Cannot perform admin actions

### Mock Addresses
Simnet uses deterministic test addresses instead of real Stacks addresses.

## Debugging

### Enable Debug Logging
Set environment variable for detailed logging:
```bash
DEBUG=certivert:* npm run dev
```

### Access Simnet Instance
For advanced debugging, you can access the simnet instance:
```javascript
import { getSimnet, getAccounts } from './src/services/simnet.js';

const simnet = getSimnet();
const accounts = getAccounts();
console.log('Available accounts:', Array.from(accounts.keys()));
```

### Common Issues

**"Simnet initialization failed"**: Ensure you're running from the correct directory (the project root should contain `Clarinet.toml`)

**"Contract not found"**: Make sure your contracts are deployed by running `npm test` first

**"IPFS errors"**: IPFS is still required for file storage. Ensure IPFS node is running or mock the IPFS service for testing.

## Switching Back to Network Mode

To switch back to devnet/testnet mode:

1. Update `.env`:
   ```bash
   STACKS_NETWORK=devnet
   STACKS_API_URL=http://localhost:3999
   ```

2. Ensure your devnet is running:
   ```bash
   clarinet devnet start
   ```

3. Restart the API:
   ```bash
   npm run dev
   ```

The API will automatically use the network-based contract service instead of simnet.