# Certivert Frontend Implementation Context

## Overview
This document provides complete context for continuing work on the Certivert certificate management system frontend. The system handles Stacks blockchain wallet authentication with role-based access control for academic certificate management.

## Current State: WORKING ✅

### Successfully Implemented Features
1. **Stacks Wallet Integration** - Proper authentication using @stacks/connect
2. **Role-Based Authentication** - Student/University/KNQA roles from blockchain
3. **Session Management** - Real-time validation and disconnect functionality
4. **Redux State Management** - Complete auth and certificate state management
5. **University Dashboard** - Full certificate issuance and revocation interface
6. **Public Verification** - Certificate verification without authentication
7. **Routing System** - Proper role-based dashboard routing

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Redux Toolkit + RTK Query
- **Blockchain**: Stacks Connect + @stacks/connect v8.2.6
- **Styling**: Tailwind CSS + Heroicons
- **Routing**: React Router v6

### Key Components Structure
```
frontend/src/
├── components/
│   ├── auth/
│   │   ├── ConnectWallet.js - Wallet connection interface
│   │   └── SessionValidator.tsx - Real-time session monitoring
│   ├── dashboards/
│   │   ├── PublicVerification.tsx - Public cert verification (✅ Complete)
│   │   ├── UniversityDashboard.tsx - University interface (✅ Complete)
│   │   └── [NEEDED] KNQADashboard.tsx - KNQA admin interface
│   └── certificate/
│       └── CertificateViewer.js - Certificate display component
├── services/
│   ├── wallet.ts - Wallet service with proper Stacks Connect integration
│   └── api.ts - Backend API service
├── store/
│   ├── slices/
│   │   ├── authSlice.ts - Authentication state management
│   │   └── certificateSlice.ts - Certificate operations
│   └── index.ts - Store configuration
└── types/index.ts - TypeScript definitions
```

## Authentication Flow (WORKING)

### Current Role Mapping
- **Student (u1)**: View own certificates
- **University (u2)**: Issue and revoke certificates (pending KNQA approval)
- **KNQA (u3)**: Approve/deny all university requests + audit system

### Test Wallet Addresses
```
University: ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50
Student: ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB  
KNQA: ST2Y2SFNVZBT8SSZ00XXKH930MCN0RFREB2GQG7CJ
```

### Session Management Features
- ✅ Real-time wallet connection validation (30-second intervals)
- ✅ Window focus validation
- ✅ Manual disconnect functionality
- ✅ Automatic session clearing when wallet disconnects
- ✅ Clear all data functionality for debugging

## Current Implementation Status

### ✅ COMPLETED: University Dashboard
**Location**: `frontend/src/components/dashboards/UniversityDashboard.tsx`

**Features**:
- Certificate issuance form with validation
- Certificate revocation interface
- Recent activity tracking
- Error handling and loading states
- Disconnect wallet functionality

**Key Functions**:
```typescript
// Issue Certificate
dispatch(issueCertificate({
  studentName, admissionNo, programme, year, grade,
  callerRole: 'university', walletAddress
}))

// Revoke Certificate  
dispatch(revokeCertificate({
  certId, callerRole: 'university', walletAddress
}))
```

### 🟡 NEXT TASK: KNQA Dashboard Implementation

**Location**: `frontend/src/components/dashboards/KNQADashboard.tsx` (TO BE CREATED)

**Requirements**:
1. **Shared Functionality with University**:
   - Certificate issuance (same UI/logic)
   - Certificate revocation (same UI/logic)
   - Recent activity view
   - Certificate verification

2. **KNQA-Specific Features**:
   - **Approval Queue**: View all pending university requests
   - **Approve/Deny Actions**: Approve or deny university certificate requests
   - **System Audit**: View all system activities across universities
   - **Bulk Operations**: Handle multiple approvals at once
   - **Advanced Filters**: Filter by university, date range, certificate type

3. **Implementation Strategy**:
   ```typescript
   // Shared components to extract:
   - CertificateIssueForm (reusable)
   - CertificateRevokeForm (reusable) 
   - RecentActivityList (reusable)
   - CertificateStatusBadge (reusable)
   
   // KNQA-specific components to create:
   - ApprovalQueue
   - BulkActionToolbar
   - SystemAuditView
   - UniversityFilter
   ```

### Code Examples for KNQA Implementation

**KNQA Dashboard Structure**:
```typescript
const KNQADashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'approve' | 'issue' | 'revoke' | 'audit'>('approve');
  
  // Shared with University (reuse components)
  const renderIssueTab = () => <UniversityIssueForm role="knqa" />;
  const renderRevokeTab = () => <UniversityRevokeForm role="knqa" />;
  
  // KNQA-specific
  const renderApprovalTab = () => <ApprovalQueue />;
  const renderAuditTab = () => <SystemAuditView />;
  
  return (
    <div className="space-y-6">
      <KNQAHeader />
      <TabNavigation />
      {renderActiveTab()}
    </div>
  );
};
```

## Recent Bug Fixes Applied

### 1. Serialization Issues Fixed
```typescript
// Changed Date objects to ISO strings in types/index.ts
lastLoginAt?: string; // was Date

// Updated Redux store config to ignore serialization paths
serializableCheck: {
  ignoredActionsPaths: ['meta.arg', 'payload.timestamp', 'payload.user.lastLoginAt'],
  ignoredPaths: ['auth.user.lastLoginAt', 'auth.lastActivity']
}
```

### 2. StacksProvider Conflicts Resolved
```typescript
// Disabled conflicting imports in multiple files:
// - infrastructure/wallet/WalletService.ts
// - application/services/AuthService.js  
// - hooks/useWallet.js

// Only active wallet service: src/services/wallet.ts
```

### 3. Role-Based Routing Fixed
```typescript
// App.tsx - DashboardRouter now properly routes by role
switch (user.role) {
  case 'university': navigate('/dashboard/university', { replace: true }); break;
  case 'knqa': navigate('/dashboard/knqa', { replace: true }); break;  // ← Fixed
  case 'student': navigate('/dashboard/student', { replace: true }); break;
  default: navigate('/verify', { replace: true }); break;
}
```

### 4. Session Clearing Functionality
```typescript
// Added comprehensive session clearing
walletService.clearAllSessions(); // Clears Stacks + storage + IndexedDB
dispatch(clearAllSessions()); // Redux thunk
dispatch(resetAuthState()); // Manual state reset
```

## Backend API Integration (WORKING)

### Role Endpoint
```
GET /api/role/:walletAddress
Response: { role: 'university|student|knqa', roleValue: 1|2|3 }
```

### Certificate Operations
```typescript
// Issue Certificate
POST /api/issue
Body: { studentName, admissionNo, programme, year, grade, callerRole, walletAddress }

// Revoke Certificate  
POST /api/revoke
Body: { certId, callerRole, walletAddress }

// Verify Certificate
POST /api/verify  
Body: { certId }
```

## Environment Configuration

### Contract Configuration (api/.env)
```bash
CONTRACT_NAME_ROLES=certificate-governance  # ← Fixed from role-registry
CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.certificate-governance
STACKS_NETWORK=devnet
```

### Frontend Configuration
```bash
VITE_STACKS_NETWORK=devnet
VITE_API_URL=http://localhost:3002
```

## Current Development Workflow

### Start Servers
```bash
# Backend (Terminal 1)
cd api && npm run start  # Port 3002

# Frontend (Terminal 2) 
cd frontend && npm run dev  # Port 5176
```

### Testing Authentication
1. Visit `http://localhost:5176/`
2. Click "Connect Wallet" 
3. Use test wallet addresses above
4. Should route to appropriate dashboard based on role

### Clear Sessions for Clean Testing
- Use "Clear Data" button on verification page
- Or test in incognito mode
- Manually disconnect in Xverse settings if needed

## Next Steps (Priority Order)

### 1. IMMEDIATE: Implement KNQA Dashboard
**Goal**: Create KNQA admin interface with shared University components

**Tasks**:
- [ ] Create `KNQADashboard.tsx` component
- [ ] Extract shared components from UniversityDashboard
- [ ] Implement ApprovalQueue for pending university requests
- [ ] Add KNQA-specific permissions and actions
- [ ] Test role separation between University and KNQA

**Acceptance Criteria**:
- KNQA users see approval queue as default tab
- KNQA can perform all University actions (issue/revoke)
- KNQA has additional approve/deny functionality
- Shared components work for both roles

### 2. Component Extraction for Reusability
```typescript
// Extract these from UniversityDashboard:
- components/forms/CertificateIssueForm.tsx
- components/forms/CertificateRevokeForm.tsx  
- components/lists/RecentActivityList.tsx
- components/ui/CertificateStatusBadge.tsx

// Create role-aware shared components:
<CertificateIssueForm role={user.role} />
<CertificateRevokeForm role={user.role} />
```

### 3. KNQA-Specific Backend Integration
**May need backend endpoints for**:
- GET `/api/pending-approvals` - University requests awaiting approval
- POST `/api/approve` - Approve university request
- POST `/api/deny` - Deny university request  
- GET `/api/audit-log` - System-wide activity log

## Known Issues & Notes

### Working Solutions
- ✅ Authentication flow works correctly with proper role routing
- ✅ Session validation prevents stale authentication
- ✅ University dashboard fully functional
- ✅ Manual session clearing available for testing

### Important Notes
- **Role routing is now fixed** - KNQA wallets route to `/dashboard/knqa`
- **Clear Data button available** on verification page for clean testing
- **Xverse wallet disconnection** may require manual clearing in wallet settings
- **Incognito mode recommended** for clean testing sessions

## Development Environment

### Current Status
- ✅ Frontend dev server running on port 5176
- ✅ Backend API server running on port 3002
- ✅ All authentication flows working
- ✅ Redux DevTools enabled for debugging

### File Structure Ready for KNQA Implementation
The codebase is well-structured for implementing KNQA dashboard by:
1. Reusing existing University dashboard components
2. Adding role-based conditional rendering
3. Implementing KNQA-specific approval workflow

This context should be sufficient to continue KNQA dashboard implementation in the next session.