/**
 * Central Type Definitions
 * Comprehensive type definitions for the Certivert application
 */

// ===============================
// DOMAIN TYPES
// ===============================

export interface ICertificateId {
  readonly value: string;
  isValid(): boolean;
  toString(): string;
}

export interface ICertificateStatus {
  readonly value: number;
  toString(): string;
  isPending(): boolean;
  isActive(): boolean;
  isRevoked(): boolean;
  canTransitionTo(newStatus: number): boolean;
}

export interface IWalletAddress {
  readonly value: string;
  isValid(): boolean;
  getNetwork(): 'mainnet' | 'testnet';
  toString(): string;
}

export interface IUserRole {
  readonly value: number;
  toString(): string;
  toStringValue(): string;
  getPermissions(): string[];
  canIssue(): boolean;
  canApprove(): boolean;
  canRevoke(): boolean;
}

export interface IStudentInfo {
  readonly studentName: string;
  readonly admissionNo: string;
  readonly programme: string;
  readonly year: number;
  readonly grade: string;
  isValid(): boolean;
  getDisplayString(): string;
}

// ===============================
// ENTITY INTERFACES
// ===============================

export interface ICertificate {
  readonly id: ICertificateId;
  readonly studentInfo: IStudentInfo;
  readonly programme: string;
  readonly year: number;
  readonly grade: string;
  readonly issuerAddress: string;
  readonly dateIssued: Date;
  readonly status: ICertificateStatus;
  readonly ipfsCid?: string;
  readonly additionalData?: Record<string, any>;

  isActive(): boolean;
  canBeRevoked(): boolean;
  validate(): ValidationResult;
  toJSON(): CertificateJSON;
}

export interface IUser {
  readonly address: IWalletAddress;
  readonly role: IUserRole;
  readonly name?: string;
  readonly email?: string;
  readonly institution?: string;
  readonly publicKey?: string;
  readonly isConnected: boolean;
  readonly lastLoginAt?: Date;

  isStudent(): boolean;
  isUniversity(): boolean;
  isKNQA(): boolean;
  isActive(): boolean;
  canIssueCertificates(): boolean;
  canApproveCertificates(): boolean;
  canRevokeCertificates(): boolean;
  hasPermission(permission: string): boolean;
  getDisplayName(): string;
  toJSON(): UserJSON;
}

// ===============================
// DATA TRANSFER OBJECTS
// ===============================

export interface CertificateJSON {
  id: string;
  studentName: string;
  admissionNo: string;
  programme: string;
  year: number;
  grade: string;
  issuerAddress: string;
  dateIssued: string;
  status: number;
  ipfsCid?: string;
  additionalData?: Record<string, any>;
}

export interface UserJSON {
  address: string;
  role: number;
  name?: string;
  email?: string;
  institution?: string;
  publicKey?: string;
  isConnected: boolean;
  lastLoginAt?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// ===============================
// API TYPES
// ===============================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp?: string;
}

export interface VerificationResult {
  success: boolean;
  isValid: boolean;
  certificateId: string;
  certificate?: CertificateJSON;
  status?: string;
  message?: string;
  verificationDetails?: {
    hashVerified: boolean;
    blockchainVerified: boolean;
    ipfsVerified: boolean;
    timestamp: string;
  };
  businessChecks?: {
    isActive: boolean;
    canBeRevoked: boolean;
    isExpired: boolean;
    issueYear: number;
    gradeValid: boolean;
    allPassed: boolean;
  };
  securityChecks?: {
    hashVerified: boolean;
    blockchainVerified: boolean;
    ipfsVerified: boolean;
    tamperedWith: boolean;
    securityScore: number;
    allPassed: boolean;
  };
  complianceStatus?: {
    formatCompliant: boolean;
    dataIntegrity: boolean;
    institutionalStandards: boolean;
    regulatoryCompliant: boolean;
    overallCompliant: boolean;
  };
  timestamp: string;
}

export interface IssuanceResult {
  success: boolean;
  certificateId?: string;
  certificate?: ICertificate;
  transactionDetails?: {
    proposeTxId: string;
    approveTxId: string;
    ipfsCid: string;
  };
  message?: string;
  error?: string;
  code?: string;
}

export interface RevocationResult {
  success: boolean;
  certificateId: string;
  transactionId?: string;
  revocationTimestamp?: string;
  revokerAddress?: string;
  reason?: string;
  auditInfo?: AuditInfo;
  message?: string;
  error?: string;
  code?: string;
}

export interface AuditInfo {
  action: string;
  certificateId: string;
  studentName: string;
  programme: string;
  originalIssuer: string;
  revokerAddress: string;
  reason: string;
  additionalNotes: string;
  timestamp: string;
  previousStatus: string;
  newStatus: string;
}

// ===============================
// AUTHENTICATION TYPES
// ===============================

export interface AuthenticationResult {
  success: boolean;
  user?: SerializedUser;
  address?: string;
  publicKey?: string;
  timestamp?: string;
  error?: string;
  code?: string;
}

export interface SerializedUser {
  address: string;
  role: string;
  roleValue: number;
  name?: string;
  email?: string;
  institution?: string;
  displayName: string;
  isConnected: boolean;
  lastLoginAt?: string;
  permissions: string[];
  isStudent: boolean;
  isUniversity: boolean;
  isKNQA: boolean;
  isActive: boolean;
}

export interface DashboardConfig {
  address: string;
  role: string;
  displayName: string;
  permissions: string[];
  dashboardType: 'student' | 'university' | 'knqa' | 'public';
  features: string[];
  defaultRoute: string;
}

export interface ConnectionStatus {
  api: 'connected' | 'disconnected' | 'error';
  blockchain: 'connected' | 'disconnected' | 'error';
  ipfs: 'connected' | 'disconnected' | 'error';
}

export interface BlockchainStatus {
  network: 'mainnet' | 'testnet';
  blockHeight: number;
  burnBlockHeight: number;
  version?: string;
  isFullySynced: boolean;
  peerVersion?: number;
  lastUpdated: string;
}

// ===============================
// REDUX STORE TYPES
// ===============================

export interface AuthState {
  isConnected: boolean;
  user: SerializedUser | null;
  walletAddress: string | null;
  publicKey: string | null;
  userRole: string | null;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  lastActivity: string | null;
  sessionValid: boolean;
}

export interface CertificateState {
  certificates: CertificateJSON[];
  currentCertificate: CertificateJSON | null;
  verificationResults: Record<string, VerificationResult>;
  recentIssuances: any[];
  systemStats: SystemStats | null;
  loadingStates: {
    verifying: boolean;
    issuing: boolean;
    revoking: boolean;
    loading: boolean;
  };
  error: string | null;
  lastUpdated: string | null;
}

export interface NotificationState {
  notifications: Notification[];
  settings: NotificationSettings;
  systemAlerts: SystemAlert[];
  connectionStatus: ConnectionStatus;
  isSubscribed: boolean;
  subscriptionError: string | null;
}

export interface UIState {
  sidebarOpen: boolean;
  currentPage: string;
  navigationHistory: string[];
  modals: Record<string, boolean>;
  loadingStates: Record<string, boolean>;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  compactView: boolean;
  animationsEnabled: boolean;
  qrScanner: QRScannerState;
  forms: Record<string, FormState>;
  toastQueue: Toast[];
  search: SearchState;
  layout: LayoutState;
}

// ===============================
// COMPONENT PROP TYPES
// ===============================

export interface CertificateCardProps {
  certificate: CertificateJSON;
  onVerify?: (certificateId: string) => void;
  onDownload?: (ipfsCid: string, filename?: string) => void;
  onRevoke?: (certificateId: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export interface VerificationResultProps {
  result: VerificationResult;
  onClose?: () => void;
  onRetry?: (certificateId: string) => void;
}

export interface IssuanceFormProps {
  onSubmit: (data: IssuanceFormData) => void;
  onCancel?: () => void;
  loading?: boolean;
  error?: string;
  initialData?: Partial<IssuanceFormData>;
}

export interface RevocationDialogProps {
  certificateId: string;
  certificate?: CertificateJSON;
  onConfirm: (reason: string, notes?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

// ===============================
// FORM TYPES
// ===============================

export interface IssuanceFormData {
  studentName: string;
  admissionNo: string;
  programme: string;
  year: number;
  grade: string;
  dateIssued?: string;
  additionalData?: Record<string, any>;
  file: File;
}

export interface FormState {
  step?: number;
  maxSteps?: number;
  data: Record<string, any>;
  errors: Record<string, string>;
  isValid: boolean;
}

export interface QRScannerState {
  isActive: boolean;
  hasPermission: boolean | null;
  error: string | null;
}

export interface SearchState {
  isOpen: boolean;
  query: string;
  recentQueries: string[];
  suggestions: string[];
}

export interface LayoutState {
  density: 'compact' | 'normal' | 'comfortable';
  cardSize: 'small' | 'medium' | 'large';
  listView: boolean;
}

// ===============================
// NOTIFICATION TYPES
// ===============================

export interface Notification {
  id: number | string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  priority: 1 | 2 | 3 | 4;
  autoDismiss: boolean;
  persistent: boolean;
  timeout?: number;
  timestamp: string;
  read?: boolean;
  data?: Record<string, any>;
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  showBrowserNotifications: boolean;
  maxVisible: number;
  defaultTimeout: number;
}

export interface SystemAlert {
  id: number | string;
  type: 'maintenance' | 'security' | 'feature' | 'warning';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  expiresAt?: string;
}

export interface Toast {
  id: number | string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  timestamp: string;
}

// ===============================
// SYSTEM TYPES
// ===============================

export interface SystemStats {
  totalCertificates: number;
  activeCertificates: number;
  revokedCertificates: number;
  pendingCertificates: number;
  totalUniversities: number;
  recentActivity: ActivityItem[];
  blockchainHeight: number;
  systemHealth: 'healthy' | 'warning' | 'error';
  lastUpdated: string;
  trends?: {
    issuanceRate: number;
    revocationRate: number;
    growthTrend: 'growing' | 'stable' | 'declining';
  };
  healthScore?: number;
}

export interface ActivityItem {
  id: string;
  type: 'issue' | 'verify' | 'revoke' | 'approve';
  description: string;
  timestamp: string;
  actor?: string;
  certificateId?: string;
}

// ===============================
// UTILITY TYPES
// ===============================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export type UserRoleType = 'none' | 'student' | 'university' | 'knqa';

export type CertificateStatusType = 'pending_issue' | 'active' | 'pending_revoke' | 'revoked';

export type RevocationReason = 
  | 'fraud'
  | 'error_in_issuance' 
  | 'student_request'
  | 'academic_misconduct'
  | 'duplicate_issuance'
  | 'institutional_policy'
  | 'other';

export type ThemeMode = 'light' | 'dark' | 'auto';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// ===============================
// HTTP CLIENT TYPES
// ===============================

export interface HttpClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  maxRetryDelay: number;
}

export interface RequestMetadata {
  startTime: number;
  correlationId?: string;
}

export interface EnhancedError extends Error {
  isNetworkError: boolean;
  isServerError: boolean;
  isClientError: boolean;
  correlationId?: string;
  duration: number;
  userMessage: string;
  response?: {
    status: number;
    data: any;
  };
  config?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    metadata?: RequestMetadata;
  };
}

// ===============================
// ENVIRONMENT TYPES
// ===============================

export interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_STACKS_API_URL: string;
  readonly VITE_STACKS_NETWORK: 'mainnet' | 'testnet';
  readonly MODE: 'development' | 'production' | 'test';
}

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// ===============================
// EVENT TYPES
// ===============================

export interface AuthEvent {
  type: 'login' | 'logout' | 'restore' | 'profile_updated';
  user?: SerializedUser;
  timestamp?: string;
}

export interface ConnectionEvent {
  type: 'success' | 'error';
  user?: SerializedUser;
  address?: string;
  publicKey?: string;
  error?: string;
  timestamp?: string;
}

export interface NotificationEvent {
  type: 'add' | 'remove' | 'clear' | 'update';
  notification?: Notification;
  notifications?: Notification[];
}

// ===============================
// SEARCH AND FILTER TYPES
// ===============================

export interface SearchParams {
  query?: string;
  studentName?: string;
  admissionNo?: string;
  programme?: string;
  year?: number;
  issuer?: string;
  status?: CertificateStatusType;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  certificates: CertificateJSON[];
  total: number;
  hasMore: boolean;
  query: SearchParams;
}

export interface FilterOptions {
  programmes: string[];
  years: number[];
  grades: string[];
  statuses: CertificateStatusType[];
  issuers: string[];
}

// ===============================
// ASYNC THUNK TYPES
// ===============================

export interface ThunkConfig {
  state: {
    auth: AuthState;
    certificates: CertificateState;
    notifications: NotificationState;
    ui: UIState;
  };
  dispatch: any;
  extra?: any;
  rejectValue: string;
}

// ===============================
// FILE UPLOAD TYPES
// ===============================

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileValidation {
  isValid: boolean;
  errors: string[];
  file?: {
    name: string;
    size: number;
    type: string;
    sizeFormatted: string;
  };
}

export interface UploadResult {
  success: boolean;
  filename?: string;
  size?: number;
  error?: string;
}

// ===============================
// EXPORT DEFAULT INTERFACE
// ===============================

export interface CertivertTypes {
  // Domain
  ICertificateId: ICertificateId;
  ICertificateStatus: ICertificateStatus;
  IWalletAddress: IWalletAddress;
  IUserRole: IUserRole;
  IStudentInfo: IStudentInfo;
  ICertificate: ICertificate;
  IUser: IUser;
  
  // Data
  CertificateJSON: CertificateJSON;
  UserJSON: UserJSON;
  ValidationResult: ValidationResult;
  
  // API
  ApiResponse: ApiResponse;
  VerificationResult: VerificationResult;
  IssuanceResult: IssuanceResult;
  RevocationResult: RevocationResult;
  
  // Auth
  AuthenticationResult: AuthenticationResult;
  SerializedUser: SerializedUser;
  DashboardConfig: DashboardConfig;
  
  // State
  AuthState: AuthState;
  CertificateState: CertificateState;
  NotificationState: NotificationState;
  UIState: UIState;
}