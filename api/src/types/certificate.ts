/**
 * Certificate-related types and interfaces
 */

// Certificate Status Constants (from Clarity contract)
export const CertificateStatus = {
  PENDING_ISSUE: 100,
  ACTIVE: 200,
  PENDING_REVOKE: 300,
  REVOKED: 400
} as const;

export type CertificateStatusType = typeof CertificateStatus[keyof typeof CertificateStatus];

// Core certificate data structure (for API requests)
export interface CertificateData {
  studentName: string;
  admissionNo: string;
  programme: string;
  year: number;
  grade: string;
  certHash?: string; // Optional for compatibility
}

// Extended certificate data with computed fields
export interface CertificateRequest extends CertificateData {
  certHash: string;
  ipfsCid: string;
  studentPrincipal: string;
}

// Full certificate as stored in blockchain
export interface ContractCertificate {
  studentPrincipal: string;
  universityPrincipal: string;
  studentName: string;
  programme: string;
  year: number;
  grade: string;
  ipfsCid: string;
  certHash: string;
  status: CertificateStatusType;
  issuedAt?: number;
  revokedAt?: number;
  revocationReason?: string;
}

// Pending certificate issuance request
export interface PendingIssuanceRequest {
  universityPrincipal: string;
  studentPrincipal: string;
  studentName: string;
  programme: string;
  year: number;
  grade: string;
  ipfsCid: string;
  certHash: string;
  requestedAt: number;
}

// Pending certificate revocation request
export interface PendingRevocationRequest {
  initiator: string;
  initiatorRole: UserRoleType;
  reason: string;
  requestedAt: number;
}

// Certificate verification result
export interface VerificationResult {
  status: 'VALID' | 'REVOKED' | 'NOT_FOUND' | 'TAMPERED';
  certificate?: ContractCertificate;
  hashVerified?: boolean;
  message?: string;
  warning?: string;
}

// API request/response types
export interface IssueCertificateRequest {
  studentName: string;
  admissionNo: string;
  programme: string;
  year: number;
  grade: string;
  // file: Express.Multer.File (handled by multer middleware)
}

export interface IssueCertificateResponse {
  certId: string;
  ipfsCid: string;
  proposeTxId: string;
  approveTxId: string;
  status: 'issued';
  message: string;
}

export interface RevokeCertificateRequest {
  certId: string;
  reason: string;
}

export interface RevokeCertificateResponse {
  certId: string;
  txId: string;
  status: 'revoked';
  message: string;
}

// User role types (from Clarity contract)
export const UserRole = {
  NONE: 0,
  ADMIN: 1,        // Updated from STUDENT
  UNIVERSITY: 2,
  KNQA: 3
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export type UserRoleString = 'none' | 'admin' | 'university' | 'knqa';

// Role mapping utilities
export const roleToString = (role: UserRoleType): UserRoleString => {
  switch (role) {
    case UserRole.ADMIN: return 'admin';           // Updated from STUDENT
    case UserRole.UNIVERSITY: return 'university';
    case UserRole.KNQA: return 'knqa';
    default: return 'none';
  }
};

export const stringToRole = (roleStr: UserRoleString): UserRoleType => {
  switch (roleStr) {
    case 'admin': return UserRole.ADMIN;           // Updated from 'student'
    case 'university': return UserRole.UNIVERSITY;
    case 'knqa': return UserRole.KNQA;
    default: return UserRole.NONE;
  }
};