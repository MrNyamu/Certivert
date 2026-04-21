# Certivert Frontend Architecture

## **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Admin     │ │   Student   │ │   Public    │          │
│  │ Dashboard   │ │ Dashboard   │ │  Verifier   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Wallet    │ │ Certificate │ │    State    │          │
│  │  Services   │ │  Services   │ │ Management  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   User      │ │ Certificate │ │    File     │          │
│  │  Entities   │ │  Entities   │ │  Entities   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                INFRASTRUCTURE LAYER                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Stacks    │ │     API     │ │    IPFS     │          │
│  │  Connect    │ │   Client    │ │   Client    │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## **User Roles & Access**

### **1. KNQA & University (Admin Users)**
- **Authentication**: Required (Stacks wallet)
- **Capabilities**:
  - Issue certificates (initiate/approve)
  - Revoke certificates (initiate/approve)
  - View pending requests from other party
  - Upload documents and set student details
  - View issued/revoked certificate lists

### **2. Student & Employer (Public Users)**
- **Authentication**: Not required
- **Capabilities**:
  - Enter certificate ID to view details
  - Download decrypted PDF document
  - View certificate metadata
  - Verify authenticity status

## **State Management Strategy**

### **Global States**
```typescript
interface AppState {
  // Auth state
  wallet: {
    isConnected: boolean;
    address: string | null;
    role: UserRole;
    loading: boolean;
    error: string | null;
  };
  
  // Certificate states
  certificates: {
    issued: AsyncState<Certificate[]>;
    pending: AsyncState<PendingRequest[]>;
    revoked: AsyncState<Certificate[]>;
  };
  
  // UI states
  ui: {
    currentView: ViewType;
    notifications: Notification[];
  };
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}
```

## **Component Architecture**

### **Presentation Layer Components**

#### **1. Layout Components**
- `<AppLayout />` - Main layout wrapper
- `<Navbar />` - Navigation with wallet connection
- `<Sidebar />` - Role-based navigation menu
- `<Footer />` - App footer

#### **2. Dashboard Components**
- `<AdminDashboard />` - For KNQA/University
- `<PublicDashboard />` - For Student/Employer
- `<DashboardStats />` - Statistics cards
- `<RecentActivity />` - Activity feed

#### **3. Certificate Components**
- `<CertificateForm />` - Issue new certificate
- `<CertificateCard />` - Display certificate summary
- `<CertificateViewer />` - Full certificate details + PDF
- `<CertificateList />` - List with filters/search
- `<PendingRequests />` - Approve/reject requests

#### **4. UI Components**
- `<LoadingSpinner />` - Loading states
- `<ErrorBoundary />` - Error handling
- `<Modal />` - Modal dialogs
- `<Toast />` - Notifications
- `<Button />` - Themed buttons
- `<Input />` - Form inputs

### **Application Layer Services**

#### **1. Wallet Service**
```typescript
interface WalletService {
  connect(): Promise<void>;
  disconnect(): void;
  getAddress(): string | null;
  getRole(): Promise<UserRole>;
  isConnected(): boolean;
}
```

#### **2. Certificate Service**
```typescript
interface CertificateService {
  issue(data: CertificateData, pdf: File): Promise<Certificate>;
  verify(certId: string): Promise<VerificationResult>;
  revoke(certId: string, reason: string): Promise<void>;
  list(filters?: CertificateFilters): Promise<Certificate[]>;
  getPending(): Promise<PendingRequest[]>;
  approve(certId: string): Promise<void>;
}
```

#### **3. File Service**
```typescript
interface FileService {
  download(cid: string): Promise<Blob>;
  getInfo(cid: string): Promise<FileInfo>;
  viewPDF(cid: string): Promise<string>; // Returns blob URL
}
```

### **Domain Layer Entities**

#### **Certificate Entity**
```typescript
interface Certificate {
  id: string;
  studentName: string;
  admissionNo: string;
  programme: string;
  year: number;
  grade: string;
  ipfsCid: string;
  status: CertificateStatus;
  issuedAt?: Date;
  revokedAt?: Date;
  university: string;
  
  // Computed properties
  isValid(): boolean;
  canRevoke(userRole: UserRole): boolean;
  getStatusDisplay(): string;
}
```

#### **User Entity**
```typescript
interface User {
  address: string;
  role: UserRole;
  
  // Role capabilities
  canIssue(): boolean;
  canRevoke(): boolean;
  canApprove(): boolean;
}
```

### **Infrastructure Layer**

#### **API Client**
```typescript
class CertivertAPI {
  private baseUrl: string;
  
  async issue(data: FormData): Promise<CertificateResponse>;
  async verify(certId: string): Promise<VerificationResponse>;
  async revoke(data: RevokeRequest): Promise<void>;
  async getRole(address: string): Promise<RoleResponse>;
  async downloadFile(cid: string): Promise<Blob>;
}
```

## **Routing Structure**

```typescript
const routes = [
  {
    path: '/',
    element: <LandingPage />,
    public: true
  },
  {
    path: '/verify',
    element: <PublicVerification />,
    public: true
  },
  {
    path: '/verify/:certId',
    element: <CertificateViewer />,
    public: true
  },
  {
    path: '/dashboard',
    element: <DashboardRouter />,
    requiresAuth: true,
    children: [
      {
        path: 'admin',
        element: <AdminDashboard />,
        roles: ['university', 'knqa']
      },
      {
        path: 'issue',
        element: <IssueCertificate />,
        roles: ['university']
      },
      {
        path: 'pending',
        element: <PendingRequests />,
        roles: ['university', 'knqa']
      }
    ]
  }
];
```

## **Technology Stack**

### **Core Framework**
- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for routing

### **State Management**
- **Zustand** for simple, type-safe state management
- **TanStack Query** for server state management

### **Styling**
- **Tailwind CSS** for utility-first styling
- **Headless UI** for accessible components
- **Heroicons** for iconography

### **Wallet Integration**
- **@stacks/connect** for wallet connection
- **@stacks/auth** for authentication

### **Development Tools**
- **ESLint + Prettier** for code quality
- **TypeScript strict mode**
- **Vitest** for testing

## **File Structure**

```
src/
├── components/           # Presentation Layer
│   ├── layout/
│   ├── dashboard/
│   ├── certificate/
│   └── ui/
├── services/            # Application Layer
│   ├── wallet.service.ts
│   ├── certificate.service.ts
│   └── file.service.ts
├── entities/            # Domain Layer
│   ├── certificate.entity.ts
│   ├── user.entity.ts
│   └── types.ts
├── infrastructure/      # Infrastructure Layer
│   ├── api/
│   ├── wallet/
│   └── storage/
├── stores/             # State Management
│   ├── wallet.store.ts
│   ├── certificate.store.ts
│   └── ui.store.ts
├── hooks/              # Custom Hooks
├── utils/              # Utilities
└── pages/              # Page Components
```

## **Key Features Implementation**

### **1. Two-Step Approval Process**
- University initiates → KNQA approves (or vice versa)
- Real-time pending requests view
- Notification system for approvals needed

### **2. Document Viewing System**
- Certificate ID input → API verification → PDF display
- Embedded PDF viewer with download option
- Responsive design for mobile viewing

### **3. Role-Based UI**
- Dynamic navigation based on wallet role
- Feature flags for role-specific actions
- Graceful fallbacks for unauthorized actions

### **4. State Management**
- Loading states for all async operations
- Error boundaries with retry mechanisms
- Optimistic updates where appropriate
- Cache invalidation strategies

This architecture ensures scalability, maintainability, and a excellent user experience across all user roles!