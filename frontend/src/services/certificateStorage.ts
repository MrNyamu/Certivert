/**
 * Certificate ID Storage Service
 * Manages local storage of certificate IDs after issue/revoke operations
 */

interface StoredCertificate {
  certId: string;
  action: 'issued' | 'revoked' | 'pending' | 'pending-revocation';
  timestamp: number;
  walletAddress: string;
}

class CertificateStorageService {
  private storageKey = 'certivert_certificate_ids';

  /**
   * Store a certificate ID after an operation
   */
  storeCertificateId(
    certId: string, 
    action: 'issued' | 'revoked' | 'pending' | 'pending-revocation', 
    walletAddress: string
  ): void {
    try {
      const stored = this.getStoredCertificates();
      
      const newCertificate: StoredCertificate = {
        certId,
        action,
        timestamp: Date.now(),
        walletAddress
      };
      
      // Remove any existing entry with the same certId to avoid duplicates
      const filtered = stored.filter(cert => cert.certId !== certId);
      
      // Add the new certificate at the beginning (most recent first)
      const updated = [newCertificate, ...filtered];
      
      // Keep only last 50 certificates to avoid storage bloat
      const limited = updated.slice(0, 50);
      
      localStorage.setItem(this.storageKey, JSON.stringify(limited));
      
      console.log(`📋 Stored certificate ID: ${certId} (${action})`);
    } catch (error) {
      console.error('Failed to store certificate ID:', error);
    }
  }

  /**
   * Get all stored certificate IDs
   */
  getStoredCertificates(): StoredCertificate[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get stored certificates:', error);
      return [];
    }
  }

  /**
   * Get certificate IDs for a specific wallet address
   */
  getCertificatesForWallet(walletAddress: string): StoredCertificate[] {
    return this.getStoredCertificates().filter(
      cert => cert.walletAddress === walletAddress
    );
  }

  /**
   * Get certificate IDs by action type
   */
  getCertificatesByAction(
    action: 'issued' | 'revoked' | 'pending' | 'pending-revocation',
    walletAddress?: string
  ): StoredCertificate[] {
    const certificates = walletAddress 
      ? this.getCertificatesForWallet(walletAddress)
      : this.getStoredCertificates();
    
    return certificates.filter(cert => cert.action === action);
  }

  /**
   * Get recent certificate IDs (last 24 hours)
   */
  getRecentCertificates(walletAddress?: string): StoredCertificate[] {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const certificates = walletAddress 
      ? this.getCertificatesForWallet(walletAddress)
      : this.getStoredCertificates();
    
    return certificates.filter(cert => cert.timestamp > oneDayAgo);
  }

  /**
   * Clear all stored certificate IDs
   */
  clearStoredCertificates(): void {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('🗑️ Cleared all stored certificate IDs');
    } catch (error) {
      console.error('Failed to clear stored certificates:', error);
    }
  }

  /**
   * Remove a specific certificate ID
   */
  removeCertificateId(certId: string): void {
    try {
      const stored = this.getStoredCertificates();
      const filtered = stored.filter(cert => cert.certId !== certId);
      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
      console.log(`🗑️ Removed certificate ID: ${certId}`);
    } catch (error) {
      console.error('Failed to remove certificate ID:', error);
    }
  }
}

// Export singleton instance
export const certificateStorage = new CertificateStorageService();
export type { StoredCertificate };