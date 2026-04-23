# Certivert Certificate View Implementation - Session Notes

## Current Status: IN PROGRESS
**Date**: April 22, 2026  
**Time Remaining**: 2 hours until presentation  

## Problem Statement
User needed to change the "View Certificates" functionality from showing pending revocations to showing pending certificates, and implement wallet-based contract calls to retrieve certificate data.

## What Was Completed ✅

### 1. Updated Dashboard Text and Functionality
- **University Dashboard** (`/src/components/dashboards/UniversityDashboard.tsx`)
  - Changed "View Certificates" button text to show it uses wallet
  - Updated function from `loadPendingCertificates()` to `handleViewCertificates()`
  - Now fetches real pending certificate data via contract calls

- **KNQA Dashboard** (`/src/components/dashboards/KNQADashboard.tsx`)
  - Changed "View Certificates" button functionality
  - Updated tab text from "Certificate revocations awaiting KNQA approval" to "Certificates awaiting KNQA approval"
  - Implemented same wallet-based certificate fetching

### 2. Wallet Service Implementation
- **File**: `/src/services/wallet.ts`
- **Added Function**: `getPendingCertificateData(certId: string)`
  - Makes read-only contract calls to `get-pending-issuance` function
  - Uses Stacks API endpoint: `http://localhost:3999/v2/contracts/call-read/`
  - Contract: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM/certificate-governance-v3`
  - Parses Clarity response format: `(ok (some (tuple ...)))`

### 3. Removed Failed API Approaches
- **File**: `/src/services/api.ts`
- **Removed**: `getPendingIssuance()` and `getPendingIssuances()` functions
- These were causing 400/500 errors with backend API

## Current Issue 🚨
**Error**: `ReferenceError: Buffer is not defined`
- **Location**: `wallet.ts:529`
- **Cause**: Browser environment doesn't have Node.js `Buffer` 
- **Last Fix**: Changed argument format from hex encoding to plain string

## Contract Function Details
- **Function**: `get-pending-issuance`
- **Type**: Read-only function (not a public transaction function)
- **Parameter**: `cert-id` (string-ascii)
- **Returns**: 
```clarity
(ok (some (tuple 
  (admission-no "122323") 
  (cert-hash "V2VzbGV5IE4tMTIy") 
  (grade "Pass") 
  (ipfs-cid "bafkreicjf3nrgyil5damm6atniwebfev63yheb33torilzajbckzpymoaq") 
  (programme "BBIT") 
  (requested-at u66) 
  (student-name "Wesley N") 
  (university-principal ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50) 
  (year u2026)
)))
```

## Known Working Certificate IDs
```javascript
const knownCertIds = [
  'V2VzbGV5IE4tMTIy',   // Wesley N-122 (confirmed working)
  'V2VzbGV5IERvZSBCSU',  // Wesley Doe BIT
  'QUJDREVGQklU',       // Additional test IDs
  'MTIzNDU2Nzg5MA'
];
```

## What Needs to Be Done Next 🔄

### 1. Fix Contract Call Arguments (HIGH PRIORITY)
The Stacks API read-only calls need proper argument formatting. Try these approaches:

**Option A**: Clarity Value Format
```javascript
arguments: [
  {
    type: "string-ascii",
    value: certId
  }
]
```

**Option B**: Hex Encoding (browser-safe)
```javascript
// Use browser-compatible string to hex conversion
const stringToHex = (str) => {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16);
  }
  return '0x' + hex;
};

arguments: [stringToHex(certId)]
```

**Option C**: Test Direct String (current attempt)
```javascript
arguments: [certId]  // Current implementation
```

### 2. Test Contract Call Manually
Use curl to test the exact format:
```bash
curl -X POST "http://localhost:3999/v2/contracts/call-read/ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM/certificate-governance-v3/get-pending-issuance" \
-H "Content-Type: application/json" \
-d '{"sender": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "arguments": ["V2VzbGV5IE4tMTIy"]}'
```

### 3. Update Certificate Display
Once data fetching works, ensure the UI properly displays the fetched certificate data in the pending certificates section.

## Environment Info
- **Devnet**: Running on http://localhost:3999
- **API**: Running on http://localhost:3002  
- **Frontend**: Running on npm run dev
- **Contract Address**: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM`
- **Contract Name**: `certificate-governance-v3`

## Files Modified
1. `/src/services/wallet.ts` - Added `getPendingCertificateData()`
2. `/src/services/api.ts` - Removed failing API functions
3. `/src/components/dashboards/UniversityDashboard.tsx` - Updated `handleViewCertificates()`
4. `/src/components/dashboards/KNQADashboard.tsx` - Updated `handleViewCertificates()`

## Previous Errors Encountered
1. ❌ "NoSuchPublicFunction" - Fixed by switching from wallet transactions to read-only calls
2. ❌ "400 Bad Request" - Due to incorrect argument formatting
3. ❌ "Buffer is not defined" - Fixed by removing Node.js Buffer usage
4. 🔄 **Current**: Need correct argument format for Stacks API

## Next Session Actions
1. **IMMEDIATE**: Fix the contract call argument formatting
2. **TEST**: Verify certificate data is fetched and displayed
3. **POLISH**: Ensure UI shows proper loading states and error handling
4. **PRESENTATION**: Prepare demo of certificate viewing functionality

## Backup Plan (if contract calls fail)
- Revert to backend API approach and fix the 500 errors
- Or implement a simple mock data display for the presentation
- Focus on demonstrating the wallet integration and UI flow