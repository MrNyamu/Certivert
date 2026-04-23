# 🏛️ Governance Role Manager - Usage Guide

This document explains how to use the new Governance Role Manager that calls the `set-user-role` function directly in the certificate governance contract.

## Overview

The Governance Role Manager provides a frontend interface to set user roles using the governance contract's `set-user-role` function. This bypasses the separate role-registry contract and works directly with the governance contract's internal role mapping.

## Architecture

```mermaid
graph TD
    A[Frontend Component] --> B[Backend API /api/role/assign]
    B --> C[Contract Service setUserRole()]
    C --> D[Governance Contract set-user-role()]
    D --> E[Role stored as uint in governance contract]
```

## Role Mapping

The governance contract uses uint values to represent roles:

| Role String | Uint Value | Contract Constant | Permissions |
|-------------|------------|-------------------|-------------|
| `none` | `u0` | `ROLE-NONE` | No special permissions |
| `student` | `u1` | `ROLE-STUDENT` | View certificates, verify |
| `university` | `u2` | `ROLE-UNIVERSITY` | Issue, revoke certificates |
| `knqa` | `u3` | `ROLE-KNQA` | All permissions + role management |

## Frontend Component

### Location
`frontend/src/components/admin/GovernanceRoleManager.tsx`

### Usage
```jsx
import GovernanceRoleManager from './components/admin/GovernanceRoleManager';

function AdminPage() {
  return (
    <div>
      <GovernanceRoleManager />
    </div>
  );
}
```

### Features
- ✅ Real-time role assignment
- ✅ Address validation
- ✅ Transaction tracking
- ✅ Assignment history
- ✅ Role descriptions
- ✅ Current user role display

## Backend API

### Endpoint
```
POST /api/role/assign
```

### Request Body
```json
{
  "adminAddress": "ST1ADMIN_ADDRESS_HERE",
  "targetAddress": "ST1TARGET_ADDRESS_HERE", 
  "role": "university"
}
```

### Response
```json
{
  "success": true,
  "transactionId": "0xabc123...",
  "targetAddress": "ST1TARGET_ADDRESS_HERE",
  "role": "university",
  "status": "Transaction broadcasted successfully",
  "message": "Role 'university' assigned to ST1TARGET...6X"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "message": "Only KNQA role or contract deployer can assign roles"
}
```

## Contract Functions Used

### Backend Contract Call
```typescript
// In contract.ts
await setUserRole(targetAddress, role, adminPrivateKey);
```

This translates to:
```clarity
;; In certificate-governance-v3.clar
(contract-call? 
  .certificate-governance-v3 
  set-user-role 
  'ST1TARGET_ADDRESS_HERE 
  u2) ;; u2 = university role
```

### Role Verification
```typescript
// Check current role
const role = await getUserRole(userAddress);
```

This calls:
```clarity
;; In certificate-governance-v3.clar
(contract-call? 
  .certificate-governance-v3 
  get-role 
  'ST1USER_ADDRESS_HERE)
```

## Testing the Implementation

### Step 1: Start the Backend
```bash
cd api/
npm run dev
```

### Step 2: Deploy Contracts
```bash
# Deploy to devnet
clarinet deployments apply --devnet
```

### Step 3: Test API Directly

**Assign University Role:**
```bash
curl -X POST http://localhost:4000/api/role/assign \
  -H "Content-Type: application/json" \
  -d '{
    "adminAddress": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    "targetAddress": "ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50",
    "role": "university"
  }'
```

**Check Role Assignment:**
```bash
curl http://localhost:4000/api/role/ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50
```

Expected Response:
```json
{
  "success": true,
  "address": "ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50",
  "role": "university",
  "permissions": [
    "issue_certificates",
    "revoke_certificates",
    "view_issued_certificates",
    "verify_certificates",
    "download_certificates",
    "upload_files"
  ],
  "timestamp": "2026-04-21T18:30:00.000Z",
  "network": "devnet"
}
```

### Step 4: Test Frontend Component

1. **Connect Wallet** with deployer address
2. **Navigate to Role Manager** page
3. **Enter target address** (e.g., `ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50`)
4. **Select role** (e.g., "University")
5. **Click "Assign Role"**
6. **Wait for transaction confirmation** (~1-2 minutes)
7. **Verify role assignment** in the history

## Security Considerations

### Admin Authorization
- Only the contract deployer can assign roles (enforced in contract)
- Backend validates admin permissions before creating transaction
- Frontend shows current user role for transparency

### Address Validation
- Both frontend and backend validate Stacks address format
- Regex pattern: `/^S[TP][0-9A-Z]{38,39}$/`

### Private Key Management
- Backend uses deployer's private key from environment variables
- In production, consider using multi-signature wallets
- Never expose private keys in frontend code

## Troubleshooting

### Common Issues

**❌ "Contract not found"**
```bash
# Solution: Deploy contracts first
clarinet deployments apply --devnet
```

**❌ "Transaction failed: NotAuthorized"**
```bash
# Solution: Verify admin address is the contract deployer
curl http://localhost:4000/api/role/ADMIN_ADDRESS_HERE
```

**❌ "Invalid address format"**
```bash
# Solution: Ensure address starts with ST/SP and is 39-41 characters
# Valid: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
# Invalid: S1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
```

**❌ "Role assignment not reflected"**
```bash
# Solution: Wait for blockchain confirmation (1-2 minutes)
# Check transaction status:
curl http://localhost:3999/extended/v1/tx/TRANSACTION_ID_HERE
```

### Debug Commands

```bash
# Check if contracts are deployed
curl http://localhost:3999/v2/contracts/interface/ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM/certificate-governance-v3

# Check specific role
curl http://localhost:4000/api/role/check/YOUR_ADDRESS

# View recent transactions
curl http://localhost:3999/extended/v1/tx/mempool?limit=10
```

## Integration Example

Here's how to integrate the Governance Role Manager into your existing application:

```tsx
// App.tsx or admin route
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import GovernanceRoleManager from './components/admin/GovernanceRoleManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/governance-roles" element={<GovernanceRoleManager />} />
        {/* Other routes */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

## Next Steps

1. **Add Role History**: Track role assignment history in the contract
2. **Batch Operations**: Allow multiple role assignments in one transaction
3. **Role Revocation**: Add functionality to revoke/remove roles
4. **Audit Logging**: Enhanced logging for role changes
5. **Multi-Signature**: Require multiple approvals for role changes

## Summary

The Governance Role Manager provides a complete solution for managing user roles in the Certivert system:

- ✅ **Frontend Component**: User-friendly interface for role assignment
- ✅ **Backend API**: Secure endpoint for contract interactions
- ✅ **Contract Integration**: Direct calls to governance contract
- ✅ **Role Validation**: Comprehensive validation and error handling
- ✅ **Transaction Tracking**: Real-time status updates
- ✅ **Security**: Admin-only access with proper validation

You can now assign roles through the UI, which will call the backend API, which will execute the `set-user-role` function in the governance contract!