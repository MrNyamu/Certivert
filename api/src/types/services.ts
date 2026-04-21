/**
 * Service layer interfaces and types
 */

import { 
  CertificateData, 
  ContractCertificate, 
  VerificationResult, 
  PendingIssuanceRequest,
  PendingRevocationRequest,
  UserRoleString,
  UserRoleType 
} from './certificate.js';
import { TransactionResult } from './blockchain.js';

// Contract Service Interface
export interface ContractService {
  // Certificate issuance
  proposeCertificate(
    certId: string, 
    certData: CertificateData, 
    ipfsCid: string, 
    signerKey: string
  ): Promise<string>;
  
  approveCertificate(
    certId: string, 
    signer2Key: string
  ): Promise<string>;
  
  // Certificate revocation
  revokeCertificate(
    certId: string, 
    callerKey: string
  ): Promise<string>;
  
  // Certificate verification and queries
  verifyCertificate(certId: string): Promise<VerificationResult>;
  
  getPendingTx(certId: string): Promise<PendingIssuanceRequest | null>;
  
  // Utility functions
  getKeyByRole(role: UserRoleString): string;
}

// IPFS Service Interface
export interface IPFSService {
  // File operations
  uploadToIPFS(buffer: Buffer): Promise<{ cid: string }>;
  
  fetchFromIPFS(cid: string): Promise<Buffer>;
  
  pinCID(cid: string): Promise<void>;
  
  // Connection management
  checkConnection(): Promise<boolean>;
  
  closeClient(): void;
}

// Hash Service Interface
export interface HashService {
  // Certificate hashing
  computeCertHash(certData: CertificateData): string;
  
  // File hashing
  computeFileHash(buffer: Buffer): string;
  
  // Hash validation
  isValidHash(hash: string): boolean;
}

// Blockchain Service Interface
export interface BlockchainService {
  // Health checks
  checkBlockchainHealth(): Promise<{
    connected: boolean;
    info: any;
    error: string | null;
  }>;
  
  checkContractDeployment(): Promise<{
    deployed: boolean;
    contracts: any;
    error: string | null;
  }>;
  
  checkContractReadAccess(): Promise<{
    accessible: boolean;
    tests: any;
    error: string | null;
  }>;
  
  // Overall status
  getBlockchainStatus(): Promise<{
    status: string;
    details: any;
  }>;
}

// Configuration Service Interface
export interface ConfigService {
  // Environment configuration
  readonly STACKS_NETWORK: string;
  readonly STACKS_API_URL: string;
  readonly CONTRACT_ADDRESS: string;
  readonly CONTRACT_NAME_ROLES: string;
  readonly CONTRACT_NAME_CERTS: string;
  readonly IPFS_API_URL: string;
  readonly API_PORT: number;
  readonly ENCRYPTION_KEY: string;
  readonly DEPLOYER_PRIVATE_KEY: string;
  readonly SIGNER_2_PRIVATE_KEY: string;
  readonly UNIVERSITY_ADDRESS: string;
  readonly KNQA_ADDRESS: string;
  readonly STUDENT_ADDRESS: string;
}

// Extended Contract Service with governance functions
export interface GovernanceContractService extends ContractService {
  // Role management
  setUserRole(user: string, role: UserRoleType): Promise<TransactionResult>;
  
  getUserRole(user: string): Promise<UserRoleType>;
  
  // Governance-specific certificate operations
  requestIssueCertificate(
    certId: string,
    studentPrincipal: string,
    studentName: string,
    programme: string,
    year: number,
    grade: string,
    ipfsCid: string,
    certHash: string
  ): Promise<TransactionResult>;
  
  approveIssueCertificate(certId: string): Promise<TransactionResult>;
  
  requestRevokeCertificate(
    certId: string, 
    reason: string
  ): Promise<TransactionResult>;
  
  approveRevokeCertificate(certId: string): Promise<TransactionResult>;
  
  // Query functions
  getPendingIssuance(certId: string): Promise<PendingIssuanceRequest | null>;
  
  getPendingRevocation(certId: string): Promise<PendingRevocationRequest | null>;
  
  getCertificateStatus(certId: string): Promise<number>;
  
  isCertificateValid(certId: string): Promise<boolean>;
}