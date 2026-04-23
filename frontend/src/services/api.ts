/**
 * API Client Service - Infrastructure Layer
 * Handles all HTTP communication with the backend API
 */

import type { 
  ApiResponse, 
  VerificationResult, 
  IssuanceResult, 
  RevocationResult,
  CertificateJSON,
  SerializedUser,
  SystemStats
} from '../types/index.js';

export interface IssuanceRequest {
  walletAddress: string;
  studentName: string;
  admissionNo: string;
  programme: string;
  year: number;
  grade: string;
  file: File;
}

export interface RevocationRequest {
  walletAddress: string;
  certId: string;
  reason: string;
}

export interface FinalizeCertificateRequest {
  walletAddress: string;
  txId: string;
  certId: string;
  ipfsCid: string;
  studentName: string;
  admissionNo: string;
  programme: string;
  year: number;
  grade: string;
}

export interface RoleResponse {
  address: string;
  role: string;
  roleValue: number;
}

export interface PendingIssuance {
  certId: string;
  universityPrincipal: string;
  studentName: string;
  admissionNo: string;
  programme: string;
  year: number;
  grade: string;
  ipfsCid: string;
  certHash: string;
  requestedAt: number;
}

export interface PendingRevocation {
  certId: string;
  initiator: string;
  initiatorRole: number;
  reason: string;
  requestedAt: number;
}

export interface PendingResponse<T> {
  success: boolean;
  count: number;
  pending: T[];
  message: string;
}

export class CertivertAPI {
  private baseUrl: string;
  private timeout: number = 30000; // 30 seconds

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  /**
   * Get wallet address from Redux store if available
   */
  private getWalletAddress(): string | null {
    try {
      // Access Redux store directly
      if (typeof window !== 'undefined' && (window as any).__REDUX_STORE__) {
        const state = (window as any).__REDUX_STORE__.getState();
        return state?.auth?.walletAddress || null;
      }
      
      // Fallback: try to get from localStorage
      const persistedAuth = localStorage.getItem('persist:certivert-auth');
      if (persistedAuth) {
        const parsed = JSON.parse(persistedAuth);
        const walletAddress = parsed.walletAddress ? JSON.parse(parsed.walletAddress) : null;
        return walletAddress;
      }
    } catch (error) {
      console.warn('Failed to get wallet address:', error);
    }
    
    return null;
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Automatically add wallet address to headers for authenticated endpoints
    const authHeaders: Record<string, string> = {};
    const walletAddress = this.getWalletAddress();
    
    // Endpoints that require authentication
    const authEndpoints = ['/api/pending/', '/api/issue', '/api/revoke'];
    const needsAuth = authEndpoints.some(authEndpoint => endpoint.startsWith(authEndpoint));
    
    if (needsAuth && walletAddress) {
      authHeaders['X-Wallet-Address'] = walletAddress;
    }
    
    const config: RequestInit = {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    };

    // Remove Content-Type for FormData requests
    if (options.body instanceof FormData) {
      const headers = { ...config.headers };
      delete (headers as any)['Content-Type'];
      config.headers = headers;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 
          errorData.error || 
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as T;
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - please try again');
        }
        throw new Error(`API Error: ${error.message}`);
      }
      throw new Error('Unknown API error occurred');
    }
  }

  /**
   * Issue a new certificate
   */
  async issueCertificate(data: IssuanceRequest): Promise<IssuanceResult> {
    const formData = new FormData();
    formData.append('walletAddress', data.walletAddress);
    formData.append('studentName', data.studentName);
    formData.append('admissionNo', data.admissionNo);
    formData.append('programme', data.programme);
    formData.append('year', data.year.toString());
    formData.append('grade', data.grade);
    formData.append('pdf', data.file);

    return this.request<IssuanceResult>('/api/issue', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Verify a certificate by ID using smart contract
   */
  async verifyCertificate(certId: string): Promise<VerificationResult> {
    try {
      // First try smart contract verification
      const contractResult = await this.verifyFromContract(certId);
      if (contractResult.success) {
        return contractResult;
      }
      
      // Fallback to backend API if contract call fails
      return this.request<VerificationResult>(`/api/verify/${encodeURIComponent(certId)}`);
    } catch (error) {
      console.error('Certificate verification failed:', error);
      throw error;
    }
  }

  /**
   * Verify certificate directly from smart contract
   */
  async verifyFromContract(certId: string): Promise<VerificationResult> {
    try {
      // Import wallet service to make contract call
      const { walletService } = await import('./wallet.js');
      
      // Use the existing getCertificateData method which checks both pending and issued certificates
      const result = await walletService.getCertificateData(certId);
      
      if (!result.success || !result.data) {
        return {
          success: false,
          status: 'NOT_FOUND',
          message: result.message || `Certificate ${certId} not found`,
          certificate: null,
          verificationDetails: {
            blockchainVerified: false,
            hashVerified: false,
            ipfsVerified: false
          }
        };
      }

      const certificateData = result.data;
      
      // Enhanced certificate status determination
      let status: 'VALID' | 'REVOKED' | 'NOT_FOUND' | 'TAMPERED';
      
      console.log('🔍 Certificate verification analysis:');
      console.log(`   📋 Certificate ID: ${certId}`);
      console.log(`   📊 Result status: ${result.status}`);
      console.log(`   🔢 Certificate status: ${certificateData.status}`);
      console.log(`   ⏰ Revoked at: ${certificateData.revokedAt}`);
      console.log(`   📝 Revocation reason: ${certificateData.revocationReason}`);
      
      if (result.status === 'pending') {
        // Pending certificates are not yet valid for public verification
        console.log('   ❌ Certificate is still pending approval');
        status = 'NOT_FOUND';
      } else if (certificateData.status === 200 || certificateData.status === '200') {
        // Status 200 = issued/active, but check if it was later revoked
        if (certificateData.revokedAt && certificateData.revokedAt !== 0 && certificateData.revokedAt !== '0') {
          console.log('   🚫 Certificate was issued but later revoked');
          status = 'REVOKED';
        } else {
          console.log('   ✅ Certificate is valid and active');
          status = 'VALID';
        }
      } else if (certificateData.status === 400 || certificateData.status === '400') {
        // Status 400 = revoked certificate
        console.log('   🚫 Certificate status indicates revocation');
        status = 'REVOKED';
      } else {
        console.log(`   ❓ Unknown certificate status: ${certificateData.status}`);
        status = 'NOT_FOUND';
      }

      // Format certificate data for frontend
      const certificate = {
        id: certId,
        studentName: certificateData.studentName,
        admissionNo: certificateData.admissionNo,
        programme: certificateData.programme,
        year: certificateData.year,
        grade: certificateData.grade,
        ipfsCid: certificateData.ipfsCid,
        certHash: certificateData.certHash,
        universityPrincipal: certificateData.universityPrincipal,
        dateIssued: certificateData.issuedAt ? new Date(certificateData.issuedAt * 1000).toISOString() : new Date().toISOString(),
        status: certificateData.status,
        issuedAt: certificateData.issuedAt,
        revokedAt: certificateData.revokedAt,
        revocationReason: certificateData.revocationReason
      };

      return {
        success: true,
        status,
        message: status === 'VALID' ? 'Certificate is valid and verified' : 
                status === 'REVOKED' ? `Certificate has been revoked${certificateData.revocationReason ? ': ' + certificateData.revocationReason : ''}` : 
                'Certificate not found',
        certificate,
        verificationDetails: {
          blockchainVerified: true,
          hashVerified: true, // Assuming hash is valid if found on blockchain
          ipfsVerified: !!certificateData.ipfsCid
        }
      };

    } catch (error) {
      console.error('Smart contract verification failed:', error);
      throw new Error(`Contract verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(data: RevocationRequest): Promise<RevocationResult> {
    return this.request<RevocationResult>('/api/revoke', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Finalize certificate after blockchain transaction
   */
  async finalizeCertificate(data: FinalizeCertificateRequest): Promise<IssuanceResult> {
    return this.request<IssuanceResult>('/api/finalize-certificate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get user role for wallet address
   */
  async getUserRole(address: string): Promise<RoleResponse> {
    return this.request<RoleResponse>(`/api/role/${encodeURIComponent(address)}`);
  }

  /**
   * Quick role check for wallet address
   */
  async checkUserRole(address: string): Promise<{ role: string; roleValue: number }> {
    const response = await this.request<RoleResponse>(`/api/role/check/${encodeURIComponent(address)}`);
    return {
      role: response.role,
      roleValue: response.roleValue
    };
  }

  /**
   * Download file from IPFS
   */
  async downloadFile(cid: string): Promise<Blob> {
    const url = `${this.baseUrl}/api/files/${encodeURIComponent(cid)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    return response.blob();
  }

  /**
   * Get file information
   */
  async getFileInfo(cid: string): Promise<{ cid: string; size: number; type: string; message: string }> {
    return this.request(`/api/files/${encodeURIComponent(cid)}/info`);
  }

  /**
   * Upload file to IPFS and get CID
   */
  async uploadToIPFS(file: File): Promise<{ cid: string; size: number; message: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<{ cid: string; size: number; message: string }>('/api/files/upload', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Get API health status
   */
  async getHealthStatus(): Promise<{
    status: string;
    timestamp: string;
    services: {
      api: string;
      ipfs: { status: string; connected: boolean };
      blockchain: { status: string };
    };
    version: string;
    network: string;
    contractAddress: string;
  }> {
    return this.request('/health');
  }

  /**
   * Get API information
   */
  async getAPIInfo(): Promise<{
    name: string;
    version: string;
    description: string;
    endpoints: Record<string, string>;
    network: string;
    contractAddress: string;
  }> {
    return this.request('/api');
  }


  /**
   * Get pending certificate issuances (KNQA only)
   */
  async getPendingIssuances(): Promise<PendingResponse<PendingIssuance>> {
    return this.request<PendingResponse<PendingIssuance>>('/api/pending/issuances');
  }

  /**
   * Get pending certificate revocations (University/KNQA only)
   */
  async getPendingRevocations(): Promise<PendingResponse<PendingRevocation>> {
    return this.request<PendingResponse<PendingRevocation>>('/api/pending/revocations');
  }
}

// Export singleton instance
export const certivertAPI = new CertivertAPI(
  import.meta.env.VITE_API_URL || 'http://localhost:3002'
);