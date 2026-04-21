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
   * Verify a certificate by ID
   */
  async verifyCertificate(certId: string): Promise<VerificationResult> {
    return this.request<VerificationResult>(`/api/verify/${encodeURIComponent(certId)}`);
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