# Certificate System - Testing Guide

## Issues Fixed

### ✅ 1. Network Configuration Problem
**Problem**: `network: undefined` in logs, failed mempool checks
**Fix**: Added `getNetworkUrl()` helper function that properly resolves network URLs for devnet/testnet/mainnet

### ✅ 2. Transaction Error Handling  
**Problem**: Process continued even when blockchain transactions failed with `NotEnoughFunds`
**Fix**: Added proper error checking in `proposeCertificate()`, `approveCertificate()`, and `revokeCertificate()` functions - process now stops on transaction failures

### ✅ 3. Role-Based Authentication
**Problem**: No authentication checks before certificate operations
**Fix**: 
- Created `middleware/auth.ts` with role-based authentication
- Added `authenticateUser` and `requireUniversityRole` middlewares
- Only universities can issue certificates
- Both universities and KNQA can revoke certificates

### ✅ 4. Funding Validation
**Problem**: No pre-transaction funding checks
**Fix**: Added `validateAccountFunds()` function that checks account balance before broadcasting (currently logs warnings for devnet/testnet)

## Testing the Fixes

### 1. Test Wallet Authentication

#### Issue Certificate (Should Require University Role)
```bash
# ❌ Should fail without wallet address
curl -X POST http://localhost:3005/api/issue \
  -F "studentName=John Doe" \
  -F "admissionNo=ADM001" \
  -F "programme=Computer Science" \
  -F "year=2025" \
  -F "grade=First Class" \
  -F "pdf=@certificate.pdf"

# Expected: 401 Unauthorized - "Wallet address required"

# ✅ Should succeed with university wallet (if role assigned in contract)
curl -X POST http://localhost:3005/api/issue \
  -F "walletAddress=ST1UNIVERSITY_ADDRESS_HERE" \
  -F "studentName=John Doe" \
  -F "admissionNo=ADM001" \
  -F "programme=Computer Science" \
  -F "year=2025" \
  -F "grade=First Class" \
  -F "pdf=@certificate.pdf"

# Expected: Process starts but may fail on transaction funding

# ❌ Should fail with student wallet  
curl -X POST http://localhost:3005/api/issue \
  -F "walletAddress=ST1STUDENT_ADDRESS_HERE" \
  -F "studentName=John Doe" \
  -F "admissionNo=ADM001" \
  -F "programme=Computer Science" \
  -F "year=2025" \
  -F "grade=First Class" \
  -F "pdf=@certificate.pdf"

# Expected: 403 Forbidden - "Access denied. Required roles: university. Your role: student."
```

#### Revoke Certificate (Should Require University or KNQA Role)
```bash
# ✅ Should work with university wallet
curl -X POST http://localhost:3005/api/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "ST1UNIVERSITY_ADDRESS_HERE",
    "certId": "some-cert-hash", 
    "reason": "Academic fraud"
  }'

# ✅ Should work with knqa wallet  
curl -X POST http://localhost:3005/api/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "ST1KNQA_ADDRESS_HERE",
    "certId": "some-cert-hash", 
    "reason": "Regulatory violation"
  }'

# ❌ Should fail with student wallet
curl -X POST http://localhost:3005/api/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "ST1STUDENT_ADDRESS_HERE",
    "certId": "some-cert-hash", 
    "reason": "Test"
  }'

# Expected: 403 Forbidden - "Access denied. Required roles: university, knqa. Your role: student."
```

### 2. Test Transaction Error Handling

With proper authentication headers, attempt certificate issuance. You should now see:

**Before (Old Behavior):**
- Process continued despite transaction failures
- Certificate marked as "issued" even with failed transactions
- IPFS pinning occurred regardless of blockchain failures

**After (New Behavior):**
- Process stops immediately when blockchain transactions fail
- Clear error messages about transaction rejection
- No IPFS operations if blockchain transactions fail
- HTTP 500 error response with detailed error information

### 3. Test Network Configuration

Check the logs during certificate issuance:

**Before:**
```
About to broadcast transaction with network: undefined
Network details: { coreApiUrl: undefined, ... }
Failed to check mempool: Failed to parse URL from undefined/extended/v1/tx/mempool
```

**After:**
```
About to broadcast transaction with network: http://localhost:3999
Network details: { coreApiUrl: "http://localhost:3999", networkType: "devnet", configUrl: "http://localhost:3999" }
```

### 4. Test Funding Checks

The system now performs funding validation before transaction broadcast:

**For Devnet/Testnet:**
- Logs: "Skipping balance check for devnet/testnet environment"

**For Mainnet:**  
- Logs: "Balance check not implemented for mainnet - ensure accounts are funded"

## Expected Flow

### Successful Certificate Issuance (with proper auth & funding):
1. ✅ Authentication check passes
2. ✅ File upload succeeds  
3. ✅ IPFS upload succeeds
4. ✅ Funding validation passes (or skipped for devnet)
5. ✅ Propose transaction succeeds
6. ✅ Approve transaction succeeds
7. ✅ IPFS pinning succeeds
8. ✅ Success response returned

### Failed Certificate Issuance (authentication):
1. ❌ Authentication check fails
2. 🛑 Process stops immediately
3. 📝 401/403 error response

### Failed Certificate Issuance (funding):
1. ✅ Authentication check passes
2. ✅ File upload succeeds
3. ✅ IPFS upload succeeds  
4. ❌ Blockchain transaction fails (NotEnoughFunds)
5. 🛑 Process stops immediately
6. 📝 500 error with transaction details
7. 🚫 No IPFS pinning occurs

## Next Steps

1. **Deploy Role Registry**: Ensure role-registry contract is deployed and accessible
2. **Assign Roles**: Use contract calls to assign roles to test wallet addresses:
   ```clarity
   (contract-call? .role-registry set-user-role 'ST1UNIVERSITY... u2)
   (contract-call? .role-registry set-user-role 'ST1KNQA... u3)
   ```
3. **Fund Accounts**: Add STX tokens to your devnet accounts to test successful transactions
4. **Frontend Integration**: Implement Stacks Connect wallet integration
5. **Transaction Signing**: Add frontend transaction signing for contract calls
6. **Monitoring**: Add metrics for transaction success/failure rates