# Certivert API - Postman Collection

This directory contains a comprehensive Postman collection for testing the Certivert blockchain certificate verification API.

## Files

- **`Certivert_API.postman_collection.json`** - Complete API collection with all endpoints
- **`Certivert_Local.postman_environment.json`** - Environment variables for local development
- **`POSTMAN_README.md`** - This documentation file

## Quick Setup

### 1. Import into Postman

1. Open Postman
2. Click "Import" button
3. Drag and drop both JSON files or use "Upload Files"
4. Select "Certivert Local" environment from the dropdown

### 2. Start the API Server

```bash
# Start in simnet mode (default)
cd api
npm start
```

The API will start on `http://localhost:3001` in simnet mode.

### 3. Test the Collection

Run the requests in this order for a complete test:

1. **Health Check** - Verify API is running
2. **Issue Certificate** - Create a new certificate (saves certId automatically)
3. **Verify Certificate** - Check the issued certificate status
4. **Revoke Certificate** - Revoke the certificate  
5. **Verify Certificate** - Confirm revocation status

## Collection Structure

### Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check and API status | No |
| POST | `/api/issue` | Issue new certificate | No* |
| GET | `/api/verify/:certId` | Verify certificate status | No |
| POST | `/api/revoke` | Revoke certificate | Yes** |

*In production, this would require authentication
**Role-based: university, knqa roles can revoke

### Environment Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `baseUrl` | API base URL | `http://localhost:3001` |
| `certId` | Certificate ID for testing | Auto-set after issuing |
| `network` | Network mode | `simnet` |
| `universityRole` | University role identifier | `university` |
| `knqaRole` | KNQA role identifier | `knqa` |

## Certificate Lifecycle Testing

### 1. Issue Certificate

**Request:** `POST /api/issue`
- **Body Type:** `form-data`
- **Required Fields:**
  - `studentName`: Full name
  - `admissionNo`: Admission number
  - `programme`: Programme of study  
  - `year`: Graduation year
  - `grade`: Grade/classification
  - `pdf`: PDF file upload

**Response:** Certificate ID, IPFS CID, transaction IDs

**Auto-Test:** Saves `certId` to environment variables

### 2. Verify Certificate

**Request:** `GET /api/verify/{{certId}}`
- Uses the `certId` from environment

**Possible Responses:**
- `VALID`: Certificate is authentic and not revoked
- `REVOKED`: Certificate has been revoked
- `NOT_FOUND`: Certificate doesn't exist
- `TAMPERED`: Certificate data has been modified

### 3. Revoke Certificate

**Request:** `POST /api/revoke`
- **Body:**
  ```json
  {
    "certId": "{{certId}}",
    "callerRole": "university"
  }
  ```

**Valid Roles:**
- `university`: Can revoke certificates they issued
- `knqa`: Can revoke any certificate (regulatory authority)

## Test Scripts

Each request includes automated test scripts that:

- Verify response status codes
- Check required response fields
- Validate data formats (e.g., certificate ID format)
- Set environment variables automatically

### Example Test Results

✅ **Issue Certificate Tests:**
- Status code is 200 or 201
- Response has required fields (certId, ipfsCid, etc.)
- Certificate ID is valid 64-character hex hash
- Certificate ID saved to environment

✅ **Verify Certificate Tests:**
- Status code is 200
- Response has valid status field
- Certificate object contains expected fields

✅ **Revoke Certificate Tests:**
- Status code is 200
- Response confirms revocation
- Transaction ID follows expected format

## Response Examples

### Issue Certificate - Success
```json
{
  "certId": "d1b67b6697bc4c125097bcc1644a5eb046a6f4bbd5261d87a32b12717b453e87",
  "ipfsCid": "bafkreidlyrazlckq7mf5pk3o5mtusj7ubnszbc23ap72tgw6v2ipcp2mue",
  "proposeTxId": "simnet_propose_d1b67b6697bc4c125097bcc1644a5eb046a6f4bbd5261d87a32b12717b453e87_1774110225398",
  "approveTxId": "simnet_approve_d1b67b6697bc4c125097bcc1644a5eb046a6f4bbd5261d87a32b12717b453e87_1774110225400",
  "status": "issued",
  "message": "Certificate issued successfully"
}
```

### Verify Certificate - Valid
```json
{
  "status": "VALID",
  "certificate": {
    "studentName": "Alice Johnson",
    "admissionNo": "ADM003",
    "programme": "Computer Science",
    "year": 2023,
    "grade": "First Class",
    "issuedBy": "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
    "issuedAt": 8,
    "revoked": false
  },
  "hashVerified": true,
  "message": "Certificate is valid and authentic"
}
```

### Revoke Certificate - Success
```json
{
  "certId": "d1b67b6697bc4c125097bcc1644a5eb046a6f4bbd5261d87a32b12717b453e87",
  "txId": "simnet_revoke_d1b67b6697bc4c125097bcc1644a5eb046a6f4bbd5261d87a32b12717b453e87_1774110261757",
  "status": "revoked",
  "revokedBy": "university",
  "message": "Certificate revoked successfully"
}
```

## Network Modes

### Simnet Mode (Development)
- **Environment:** `STACKS_NETWORK=simnet`
- **URL:** `http://localhost:3001`
- **Features:** Instant transactions, in-process blockchain simulation
- **Use Case:** Local development and testing

### Devnet Mode (Integration)
- **Environment:** `STACKS_NETWORK=devnet`  
- **URL:** `http://localhost:4000` (typically)
- **Features:** Real Stacks devnet, block confirmations required
- **Use Case:** Integration testing with real blockchain

### Testnet Mode (Staging)
- **Environment:** `STACKS_NETWORK=testnet`
- **URL:** Production API URL
- **Features:** Stacks testnet, real transactions with test tokens
- **Use Case:** Pre-production testing

## Troubleshooting

### Common Issues

**"Connection refused"**
- Ensure API server is running: `npm start`
- Check port in `baseUrl` matches server port

**"Certificate not found"**
- Issue a certificate first using the "Issue Certificate" request
- Ensure `certId` environment variable is set

**"PDF file required"**
- Attach a PDF file in the "Issue Certificate" request
- Use any PDF file for testing purposes

**"Unauthorized role"**
- Use valid roles: `university` or `knqa` for revocation
- Check request body JSON format

### Debug Mode

Enable detailed API logging:
```bash
DEBUG=certivert:* npm start
```

### Health Check

Always start testing with the Health Check endpoint:
- Verifies API connectivity
- Shows current network mode
- Confirms IPFS connection status

## Sample Test Flow

1. **Health Check** → Verify API is running
2. **Issue Certificate** → `certId` saved automatically  
3. **Verify Certificate** → Should return "VALID" status
4. **Revoke Certificate** → Use university role
5. **Verify Certificate** → Should return "REVOKED" status

This complete workflow tests all major API functionality and demonstrates the certificate lifecycle from issuance to revocation.