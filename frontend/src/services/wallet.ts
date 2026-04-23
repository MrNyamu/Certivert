/**
 * Wallet Service - Application Layer  
 * Handles Stacks wallet connection and authentication using proper Stacks Connect patterns
 */

import { 
  AppConfig, 
  UserSession,
  authenticate,
  isConnected,
  disconnect
} from '@stacks/connect';
import { openContractCall } from '@stacks/connect';
import { 
  stringAsciiCV, 
  uintCV,
  principalCV,
  listCV,
  FungibleConditionCode,
  makeStandardSTXPostCondition,
  PostConditionMode,
  AnchorMode,
  fetchCallReadOnlyFunction
} from '@stacks/transactions';
import { STACKS_DEVNET } from '@stacks/network';
import type { SerializedUser, AuthenticationResult } from '../types/index.js';
import { certivertAPI } from './api.js';

export interface WalletConfig {
  appName: string;
  appIcon: string;
  network: 'mainnet' | 'testnet' | 'devnet';
}

export class WalletService {
  private appConfig: AppConfig;
  private userSession: UserSession;
  private networkType: 'mainnet' | 'testnet' | 'devnet';

  constructor(config: WalletConfig) {
    this.appConfig = new AppConfig(['store_write', 'publish_data']);
    this.userSession = new UserSession({ appConfig: this.appConfig });
    this.networkType = config.network;
  }

  /**
   * Connect to Stacks wallet using proper authenticate function
   */
  async connect(): Promise<AuthenticationResult> {
    return new Promise((resolve, reject) => {
      authenticate({
        appDetails: {
          name: 'Certivert',
          icon: window.location.origin + '/certivert-logo.png',
        },
        onFinish: async (authData) => {
          try {
            console.log('Wallet connected:', authData);
            
            // Store the session
            this.userSession = authData.userSession;
            const userData = this.userSession.loadUserData();
            
            // Get the correct address based on network
            let walletAddress: string;
            if (this.networkType === 'mainnet') {
              walletAddress = userData.profile.stxAddress.mainnet;
            } else if (this.networkType === 'testnet') {
              walletAddress = userData.profile.stxAddress.testnet;
            } else {
              // For devnet, use testnet address format
              walletAddress = userData.profile.stxAddress.testnet;
            }
            
            // Get role from the backend API
            let roleResponse;
            try {
              roleResponse = await certivertAPI.getUserRole(walletAddress);
            } catch (error) {
              console.error('Failed to get user role from API:', error);
              throw new Error('Unable to verify user role. Please try again.');
            }
            
            const user: SerializedUser = {
              address: walletAddress,
              role: roleResponse.role,
              roleValue: roleResponse.roleValue,
              displayName: userData.username || `${roleResponse.role} User`,
              isConnected: true,
              lastLoginAt: new Date().toISOString(),
              permissions: this.getPermissionsForRole(roleResponse.roleValue),
              isStudent: roleResponse.roleValue === 1,
              isUniversity: roleResponse.roleValue === 2,
              isKNQA: roleResponse.roleValue === 3,
              isActive: roleResponse.roleValue > 0,
            };

            resolve({
              success: true,
              user,
              address: user.address,
              publicKey: userData.appPrivateKey,
              timestamp: new Date().toISOString(),
            });
            
          } catch (error) {
            console.error('Failed to authenticate:', error);
            reject({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to authenticate',
              code: 'AUTH_ERROR',
            });
          }
        },
        onCancel: () => {
          resolve({
            success: false,
            error: 'User cancelled wallet connection',
            code: 'USER_CANCELLED',
          });
        },
        userSession: this.userSession,
      });
    });
  }

  /**
   * Disconnect from wallet (both session and wallet)
   */
  async disconnect(): Promise<void> {
    try {
      // Disconnect from wallet
      await disconnect();
    } catch (error) {
      console.warn('Failed to disconnect from wallet:', error);
    }
    
    // Always clear session regardless of wallet disconnect result
    this.userSession.signUserOut('/');
  }

  /**
   * Clear all sessions and storage data (for debugging/testing)
   */
  async clearAllSessions(): Promise<void> {
    try {
      console.log('🧹 Clearing all sessions and storage...');
      
      // Clear Stacks session
      this.userSession.signUserOut();
      
      // Disconnect from wallet if connected
      try {
        await disconnect();
      } catch (error) {
        console.warn('Failed to disconnect wallet during clear:', error);
      }
      
      // Clear all browser storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear any IndexedDB storage related to Stacks
      if ('indexedDB' in window) {
        try {
          // Clear Stacks-related IndexedDB data
          const deleteDB = (dbName: string) => {
            return new Promise((resolve, reject) => {
              const deleteReq = indexedDB.deleteDatabase(dbName);
              deleteReq.onerror = () => reject(deleteReq.error);
              deleteReq.onsuccess = () => resolve(deleteReq.result);
            });
          };
          
          // Common Stacks Connect database names
          await deleteDB('stacks-wallet-data');
          await deleteDB('blockstack-session');
        } catch (error) {
          console.warn('Failed to clear IndexedDB:', error);
        }
      }
      
      console.log('✅ All sessions and storage cleared');
    } catch (error) {
      console.error('❌ Failed to clear all sessions:', error);
      throw error;
    }
  }

  /**
   * Get current wallet address
   */
  getAddress(): string | null {
    if (this.isConnected()) {
      const userData = this.userSession.loadUserData();
      return this.networkType === 'mainnet' 
        ? userData.profile.stxAddress.mainnet 
        : userData.profile.stxAddress.testnet;
    }
    return null;
  }

  /**
   * Get user role from backend
   */
  async getRole(): Promise<{ role: string; roleValue: number }> {
    const address = this.getAddress();
    if (!address) {
      throw new Error('Wallet not connected');
    }
    
    return certivertAPI.checkUserRole(address);
  }

  /**
   * Check if wallet is connected (both session and actual wallet)
   */
  async isConnected(): Promise<boolean> {
    // First check if we have a valid session
    if (!this.userSession.isUserSignedIn()) {
      return false;
    }

    try {
      // Then check if wallet is actually connected
      const walletConnected = await isConnected();
      return walletConnected;
    } catch (error) {
      console.warn('Failed to check wallet connection status:', error);
      return false;
    }
  }

  /**
   * Check if session exists (without checking wallet connection)
   */
  hasSession(): boolean {
    return this.userSession.isUserSignedIn();
  }


  /**
   * Restore user session if available and wallet is still connected
   */
  async restoreSession(): Promise<SerializedUser | null> {
    // Check if we have a session
    if (!this.userSession.isUserSignedIn()) {
      return null;
    }

    // Check if wallet is still connected
    const isWalletConnected = await this.isConnected();
    if (!isWalletConnected) {
      // Clear invalid session
      this.userSession.signUserOut();
      return null;
    }

    try {
      const userData = this.userSession.loadUserData();
      const address = this.networkType === 'mainnet' 
        ? userData.profile.stxAddress.mainnet 
        : userData.profile.stxAddress.testnet;
      
      // Get fresh role data from backend
      const roleResponse = await certivertAPI.getUserRole(address);
      
      return {
        address,
        role: roleResponse.role,
        roleValue: roleResponse.roleValue,
        displayName: userData.username || 'Unknown User',
        isConnected: true,
        lastLoginAt: new Date().toISOString(),
        permissions: this.getPermissionsForRole(roleResponse.roleValue),
        isStudent: roleResponse.roleValue === 1,
        isUniversity: roleResponse.roleValue === 2,
        isKNQA: roleResponse.roleValue === 3,
        isActive: roleResponse.roleValue > 0,
      };
      
    } catch (error) {
      console.error('Failed to restore session:', error);
      return null;
    }
  }

  /**
   * Get permissions based on role
   */
  private getPermissionsForRole(roleValue: number): string[] {
    switch (roleValue) {
      case 1: // Student
        return ['view_certificates', 'verify_certificates'];
      case 2: // University
        return ['view_certificates', 'verify_certificates', 'request_issue', 'request_revoke'];
      case 3: // KNQA
        return ['view_certificates', 'verify_certificates', 'approve_issue', 'approve_revoke', 'request_issue', 'request_revoke'];
      default: // None
        return ['verify_certificates'];
    }
  }

  /**
   * Validate current session and clear if wallet disconnected
   */
  async validateSession(): Promise<boolean> {
    const isValid = await this.isConnected();
    if (!isValid && this.hasSession()) {
      // Session exists but wallet is disconnected - clear it
      this.userSession.signUserOut();
      return false;
    }
    return isValid;
  }

  /**
   * Get network info
   */
  getNetworkInfo() {
    return {
      network: this.networkType,
      url: this.networkType === 'mainnet' 
        ? 'https://stacks-node-api.mainnet.stacks.co'
        : 'https://stacks-node-api.testnet.stacks.co',
    };
  }


  /**
   * Set user role via wallet transaction
   */
  async setUserRole(
    targetAddress: string,
    role: 'none' | 'admin' | 'university' | 'knqa',
    contractAddress: string
  ): Promise<{ txId: string }> {
    return new Promise((resolve, reject) => {
      // Validation checks
      if (!this.isConnected()) {
        reject(new Error('WALLET_NOT_CONNECTED: Please connect your wallet first'));
        return;
      }

      if (!targetAddress || !targetAddress.startsWith('ST')) {
        reject(new Error('INVALID_ADDRESS: Target address must be a valid Stacks address'));
        return;
      }

      if (!contractAddress || !contractAddress.startsWith('ST')) {
        reject(new Error('INVALID_CONTRACT: Invalid contract address'));
        return;
      }

      // Map role strings to uint values for governance contract
      const roleMap = {
        'none': 0,
        'admin': 1,     // Changed from 'student' to 'admin'
        'university': 2,
        'knqa': 3
      };

      const roleUint = roleMap[role];
      if (roleUint === undefined) {
        reject(new Error('INVALID_ROLE: Role must be none, admin, university, or knqa'));
        return;
      }

      try {
        openContractCall({
          network: this.networkType === 'mainnet' ? 'mainnet' : 'testnet',
          contractAddress,
          contractName: 'certificate-governance-v3',
          functionName: 'set-user-role',
          functionArgs: [
            principalCV(targetAddress),
            uintCV(roleUint)
          ],
          postConditionMode: PostConditionMode.Allow,
          onFinish: (data) => {
            console.log('✅ Set user role transaction submitted:', data);
            if (!data.txId) {
              reject(new Error('TRANSACTION_FAILED: No transaction ID received'));
              return;
            }
            resolve({ txId: data.txId });
          },
          onCancel: () => {
            reject(new Error('USER_CANCELLED: User cancelled wallet transaction'));
          },
        });
      } catch (error) {
        console.error('Wallet transaction error:', error);
        
        // Parse common wallet errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('USER_CANCELLED') || errorMessage.includes('User cancelled')) {
          reject(new Error('USER_CANCELLED: Transaction cancelled by user'));
        } else if (errorMessage.includes('NoSuchContract')) {
          reject(new Error('CONTRACT_ERROR: Contract not found. The certificate-governance-v3 contract may not be deployed on this network.'));
        } else if (errorMessage.includes('NoSuchPublicFunction')) {
          reject(new Error('CONTRACT_ERROR: Function not found in contract. Please check the contract implementation.'));
        } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('balance')) {
          reject(new Error('INSUFFICIENT_FUNDS: Insufficient STX balance to pay transaction fees. Please add STX to your wallet.'));
        } else if (errorMessage.includes('NotAuthorized')) {
          reject(new Error('NOT_AUTHORIZED: You do not have permission to set user roles. Only the contract deployer can assign roles.'));
        } else if (errorMessage.includes('network')) {
          reject(new Error('NETWORK_ERROR: Network connection issue. Please check your internet and try again.'));
        } else if (errorMessage.includes('contract') || errorMessage.includes('Contract')) {
          reject(new Error('CONTRACT_ERROR: Smart contract interaction failed. Please try again.'));
        } else {
          reject(new Error(`WALLET_ERROR: ${errorMessage}`));
        }
      }
    });
  }

  /**
   * Submit certificate issuance request via wallet transaction
   */
  async requestIssueCertificate(
    certId: string, 
    certData: { 
      studentName: string;
      admissionNo: string; 
      programme: string;
      year: number;
      grade: string;
      certHash: string;
    },
    ipfsCid: string,
    contractAddress: string
  ): Promise<{ txId: string }> {
    return new Promise((resolve, reject) => {
      // Validation checks
      if (!this.isConnected()) {
        reject(new Error('WALLET_NOT_CONNECTED: Please connect your wallet first'));
        return;
      }

      if (!certId || certId.length < 8) {
        reject(new Error('INVALID_CERT_ID: Certificate ID must be at least 8 characters'));
        return;
      }

      if (!contractAddress || !contractAddress.startsWith('ST')) {
        reject(new Error('INVALID_CONTRACT: Invalid contract address'));
        return;
      }

      try {
        openContractCall({
          network: this.networkType === 'mainnet' ? 'mainnet' : 'testnet', 
          contractAddress,
          contractName: 'certificate-governance-v3',
          functionName: 'request-issue-certificate',
          functionArgs: [
            stringAsciiCV(certId),
            stringAsciiCV(certData.studentName),
            stringAsciiCV(certData.admissionNo),
            stringAsciiCV(certData.programme),
            uintCV(certData.year),
            stringAsciiCV(certData.grade),
            stringAsciiCV(ipfsCid),
            stringAsciiCV(certData.certHash)
          ],
          postConditionMode: PostConditionMode.Allow,
          onFinish: (data) => {
            console.log('✅ Certificate proposal transaction submitted:', data);
            if (!data.txId) {
              reject(new Error('TRANSACTION_FAILED: No transaction ID received'));
              return;
            }
            
            // Automatically store the certificate ID for later retrieval
            try {
              const walletAddress = this.getAddress();
              if (walletAddress) {
                // Import and use certificateStorage
                import('../services/certificateStorage.js').then(({ certificateStorage }) => {
                  certificateStorage.storeCertificateId(certId, 'pending', walletAddress);
                  console.log('📋 Automatically stored certificate ID for later viewing:', certId);
                });
              }
            } catch (error) {
              console.warn('Failed to store certificate ID:', error);
              // Don't fail the transaction for storage errors
            }
            
            resolve({ txId: data.txId });
          },
          onCancel: () => {
            reject(new Error('USER_CANCELLED: User cancelled wallet transaction'));
          },
        });
      } catch (error) {
        console.error('Wallet transaction error:', error);
        
        // Parse common wallet errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('USER_CANCELLED') || errorMessage.includes('User cancelled')) {
          reject(new Error('USER_CANCELLED: Transaction cancelled by user'));
        } else if (errorMessage.includes('NoSuchContract')) {
          reject(new Error('CONTRACT_ERROR: Contract not found. The certificate-governance-v3 contract may not be deployed on this network.'));
        } else if (errorMessage.includes('NoSuchPublicFunction')) {
          reject(new Error('CONTRACT_ERROR: Function not found in contract. Please check the contract implementation.'));
        } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('balance')) {
          reject(new Error('INSUFFICIENT_FUNDS: Insufficient STX balance to pay transaction fees. Please add STX to your wallet.'));
        } else if (errorMessage.includes('network')) {
          reject(new Error('NETWORK_ERROR: Network connection issue. Please check your internet and try again.'));
        } else if (errorMessage.includes('contract') || errorMessage.includes('Contract')) {
          reject(new Error('CONTRACT_ERROR: Smart contract interaction failed. Please try again.'));
        } else {
          reject(new Error(`WALLET_ERROR: ${errorMessage}`));
        }
      }
    });
  }

  /**
   * Request certificate revocation via contract call
   * Uses request-revoke-certificate function
   */
  async requestRevokeCertificate(
    certId: string,
    reason: string
  ): Promise<{ txId: string }> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🚫 Requesting revocation for certificate: ${certId}`);
        console.log(`📝 Reason: ${reason}`);
        
        openContractCall({
          network: STACKS_DEVNET,
          contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
          contractName: 'certificate-governance-v3',
          functionName: 'request-revoke-certificate',
          functionArgs: [
            stringAsciiCV(certId),
            stringAsciiCV(reason)
          ],
          postConditionMode: PostConditionMode.Allow,
          onFinish: (data) => {
            console.log('✅ Certificate revocation request submitted:', data);
            if (!data.txId) {
              reject(new Error('TRANSACTION_FAILED: No transaction ID received'));
              return;
            }
            
            resolve({ txId: data.txId });
          },
          onCancel: () => {
            reject(new Error('USER_CANCELLED: User cancelled wallet transaction'));
          },
        });
      } catch (error) {
        console.error('Revocation request error:', error);
        
        // Parse common wallet errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('USER_CANCELLED') || errorMessage.includes('User cancelled')) {
          reject(new Error('USER_CANCELLED: Transaction cancelled by user'));
        } else if (errorMessage.includes('NoSuchContract')) {
          reject(new Error('CONTRACT_ERROR: Contract not found. The certificate-governance-v3 contract may not be deployed on this network.'));
        } else if (errorMessage.includes('NoSuchPublicFunction')) {
          reject(new Error('CONTRACT_ERROR: Function not found in contract. Please check the contract implementation.'));
        } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('balance')) {
          reject(new Error('INSUFFICIENT_FUNDS: Insufficient STX balance to pay transaction fees. Please add STX to your wallet.'));
        } else if (errorMessage.includes('network')) {
          reject(new Error('NETWORK_ERROR: Network connection issue. Please check your internet and try again.'));
        } else if (errorMessage.includes('contract') || errorMessage.includes('Contract')) {
          reject(new Error('CONTRACT_ERROR: Smart contract interaction failed. Please try again.'));
        } else {
          reject(new Error(`WALLET_ERROR: ${errorMessage}`));
        }
      }
    });
  }

  /**
   * Get pending certificate data via read-only contract call
   * Returns the actual pending certificate data from the blockchain
   */
  async getPendingCertificateData(certId: string): Promise<{ 
    success: boolean; 
    data: any; 
    message: string 
  }> {
    try {
      const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      const contractName = 'certificate-governance-v3';
      const functionName = 'get-pending-issuance';
      const network = STACKS_DEVNET;
      
      console.log(`🔍 Calling read-only contract function for cert: ${certId}`);
      
      // Use proper Stacks.js call with stringAsciiCV
      const result = await fetchCallReadOnlyFunction({
        network,
        contractAddress,
        contractName,
        functionName,
        functionArgs: [stringAsciiCV(certId)],
        senderAddress: contractAddress
      });
      
      console.log('📋 Contract response:', result);
      
      // Parse the Clarity response: (ok (some (tuple ...)))
      if (result.type === 'ok' && result.value) {
        const value = result.value;
        
        // Check if it's (some tuple) or none
        if (value.type === 'some' && value.value) {
          const tupleData = value.value.value; // Access the tuple's value object
          
          // Extract the tuple data - Clarity values are wrapped objects
          const certificateData = {
            certId: certId,
            admissionNo: tupleData['admission-no'].value,
            certHash: tupleData['cert-hash'].value,
            grade: tupleData['grade'].value,
            ipfsCid: tupleData['ipfs-cid'].value,
            programme: tupleData['programme'].value,
            requestedAt: Number(tupleData['requested-at'].value),
            studentName: tupleData['student-name'].value,
            universityPrincipal: tupleData['university-principal'].value,
            year: Number(tupleData['year'].value)
          };
          
          return {
            success: true,
            data: certificateData,
            message: `Found pending certificate for ${certificateData.studentName}`
          };
        } else {
          // (none) - no pending certificate found
          return {
            success: true,
            data: null,
            message: `No pending certificate found for ID: ${certId}`
          };
        }
      } else {
        throw new Error('Invalid response format from contract');
      }
      
    } catch (error) {
      console.error('Failed to get pending certificate data:', error);
      return {
        success: false,
        data: null,
        message: `Failed to get pending certificate: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get certificate data via read-only contract call
   * Returns the full certificate information including status (active, revoked, etc.)
   */
  async getCertificate(certId: string): Promise<{ 
    success: boolean; 
    data: any; 
    message: string 
  }> {
    try {
      const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      const contractName = 'certificate-governance-v3';
      const functionName = 'get-certificate';
      const network = STACKS_DEVNET;
      
      console.log(`🔍 Getting certificate data for: ${certId}`);
      
      // Use proper Stacks.js call with stringAsciiCV
      const result = await fetchCallReadOnlyFunction({
        network,
        contractAddress,
        contractName,
        functionName,
        functionArgs: [stringAsciiCV(certId)],
        senderAddress: contractAddress
      });
      
      console.log('📋 Certificate data response:', result);
      
      // Parse the Clarity response: (ok (some (tuple ...))) or (ok none)
      if (result.type === 'ok' && result.value) {
        const value = result.value;
        
        // Check if it's (some tuple) or none
        if (value.type === 'some' && value.value) {
          const tupleData = value.value.value; // Access the tuple's value object
          
          // Extract the certificate data - Clarity values are wrapped objects
          const certificateData = {
            certId: certId,
            admissionNo: tupleData['admission-no']?.value || '',
            certHash: tupleData['cert-hash']?.value || '',
            grade: tupleData['grade']?.value || '',
            ipfsCid: tupleData['ipfs-cid']?.value || '',
            programme: tupleData['programme']?.value || '',
            requestedAt: tupleData['requested-at']?.value ? parseInt(tupleData['requested-at'].value) : 0,
            studentName: tupleData['student-name']?.value || '',
            universityPrincipal: tupleData['university-principal']?.value || '',
            year: tupleData['year']?.value ? parseInt(tupleData['year'].value) : 0,
            status: tupleData['status']?.value || 'unknown', // active, revoked, pending, etc.
            issuedAt: tupleData['issued-at']?.value ? parseInt(tupleData['issued-at'].value) : null,
            revokedAt: tupleData['revoked-at']?.value ? parseInt(tupleData['revoked-at'].value) : null
          };
          
          return {
            success: true,
            data: certificateData,
            message: `✅ Certificate found: ${certificateData.studentName} - ${certificateData.programme}`
          };
          
        } else if (value.type === 'none') {
          return {
            success: false,
            data: null,
            message: `❌ Certificate not found for ID: ${certId}`
          };
        }
      }
      
      // If we get here, the response format was unexpected
      return {
        success: false,
        data: null,
        message: 'Invalid response format from contract'
      };
      
    } catch (error) {
      console.error('Failed to get certificate data:', error);
      return {
        success: false,
        data: null,
        message: `Failed to get certificate: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get multiple pending certificate data via read-only batch contract call
   * Uses get-pending-issuances-batch function which takes a list of certificate IDs
   * Returns: (ok (list (ok (some (tuple ...))) (ok none) ...))
   */
  async getPendingIssuancesBatch(certIds: string[]): Promise<{ 
    success: boolean; 
    data: any[]; 
    message: string 
  }> {
    try {
      const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      const contractName = 'certificate-governance-v3';
      const functionName = 'get-pending-issuances-batch';
      const network = STACKS_DEVNET;
      
      console.log(`🔍 Calling batch read-only contract function for ${certIds.length} certificates:`, certIds);
      
      // Convert certificate IDs to list of stringAsciiCV
      const certIdArgs = certIds.map(certId => stringAsciiCV(certId));
      
      // Use proper Stacks.js call with list of stringAsciiCV
      const result = await fetchCallReadOnlyFunction({
        network,
        contractAddress,
        contractName,
        functionName,
        functionArgs: [listCV(certIdArgs)], // Pass as list argument
        senderAddress: contractAddress
      });
      
      console.log('📋 Batch contract response:', result);
      
      // Parse the Clarity response: (ok (list (ok (some (tuple ...))) (ok none) ...))
      if (result.type === 'ok' && result.value) {
        const listValue = result.value;
        
        if (listValue.type === 'list') {
          const foundCertificates = [];
          
          // Process each item in the list
          listValue.value.forEach((item, index) => {
            const certId = certIds[index];
            
            if (item.type === 'ok' && item.value) {
              const value = item.value;
              
              // Check if it's (some tuple) or none
              if (value.type === 'some' && value.value) {
                const tupleData = value.value.value; // Access the tuple's value object
                
                // Extract the certificate data - Clarity values are wrapped objects
                const certificateData = {
                  certId: certId,
                  admissionNo: tupleData['admission-no']?.value || '',
                  certHash: tupleData['cert-hash']?.value || '',
                  grade: tupleData['grade']?.value || '',
                  ipfsCid: tupleData['ipfs-cid']?.value || '',
                  programme: tupleData['programme']?.value || '',
                  requestedAt: tupleData['requested-at']?.value ? parseInt(tupleData['requested-at'].value) : 0,
                  studentName: tupleData['student-name']?.value || '',
                  universityPrincipal: tupleData['university-principal']?.value || '',
                  year: tupleData['year']?.value ? parseInt(tupleData['year'].value) : 0,
                  source: 'pending' // Mark as pending data
                };
                
                foundCertificates.push(certificateData);
                console.log(`✅ Found pending certificate ${index}:`, certificateData);
              } else {
                console.log(`ℹ️ Certificate ${certId} not found (none)`);
              }
            } else {
              console.log(`ℹ️ Certificate ${certId} returned error or invalid response`);
            }
          });
          
          return {
            success: true,
            data: foundCertificates,
            message: `✅ Found ${foundCertificates.length} pending certificates out of ${certIds.length} checked`
          };
        }
      }
      
      // If we get here, the response format was unexpected
      return {
        success: false,
        data: [],
        message: 'Invalid response format from batch contract call'
      };
      
    } catch (error) {
      console.error('Failed to get batch pending certificate data:', error);
      return {
        success: false,
        data: [],
        message: `Failed to get batch pending certificates: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get multiple pending revocation data via read-only batch contract call
   * Uses get-pending-revocations-batch function which takes a list of certificate IDs
   * Returns: (ok (list (ok (some (tuple ...))) (ok none) ...))
   */
  async getPendingRevocationsBatch(certIds: string[]): Promise<{ 
    success: boolean; 
    data: any[]; 
    message: string 
  }> {
    try {
      const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      const contractName = 'certificate-governance-v3';
      const functionName = 'get-pending-revocations-batch';
      const network = STACKS_DEVNET;
      
      console.log(`🔍 Calling batch revocations read-only contract function for ${certIds.length} certificates:`, certIds);
      
      // Convert certificate IDs to list of stringAsciiCV
      const certIdArgs = certIds.map(certId => stringAsciiCV(certId));
      
      // Use proper Stacks.js call with list of stringAsciiCV
      const result = await fetchCallReadOnlyFunction({
        network,
        contractAddress,
        contractName,
        functionName,
        functionArgs: [listCV(certIdArgs)], // Pass as list argument
        senderAddress: contractAddress
      });
      
      console.log('📋 Batch revocations contract response:', result);
      
      // Parse the Clarity response: (ok (list (ok (some (tuple ...))) (ok none) ...))
      if (result.type === 'ok' && result.value) {
        const listValue = result.value;
        
        if (listValue.type === 'list') {
          const foundRevocations = [];
          
          // Process each item in the list
          listValue.value.forEach((item, index) => {
            const certId = certIds[index];
            
            if (item.type === 'ok' && item.value) {
              const value = item.value;
              
              // Check if it's (some tuple) or none
              if (value.type === 'some' && value.value) {
                const tupleData = value.value.value; // Access the tuple's value object
                
                // Extract the revocation data - Clarity values are wrapped objects
                const revocationData = {
                  certId: certId,
                  initiator: tupleData['initiator']?.value || '',
                  initiatorRole: tupleData['initiator-role']?.value ? parseInt(tupleData['initiator-role'].value) : 0,
                  reason: tupleData['reason']?.value || '',
                  requestedAt: tupleData['requested-at']?.value ? parseInt(tupleData['requested-at'].value) : 0,
                  source: 'pending-revocation' // Mark as pending revocation data
                };
                
                foundRevocations.push(revocationData);
                console.log(`✅ Found pending revocation ${index}:`, revocationData);
              } else {
                console.log(`ℹ️ Revocation for certificate ${certId} not found (none)`);
              }
            } else {
              console.log(`ℹ️ Revocation for certificate ${certId} returned error or invalid response`);
            }
          });
          
          return {
            success: true,
            data: foundRevocations,
            message: `✅ Found ${foundRevocations.length} pending revocations out of ${certIds.length} checked`
          };
        }
      }
      
      // If we get here, the response format was unexpected
      return {
        success: false,
        data: [],
        message: 'Invalid response format from batch revocations contract call'
      };
      
    } catch (error) {
      console.error('Failed to get batch pending revocations data:', error);
      return {
        success: false,
        data: [],
        message: `Failed to get batch pending revocations: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Approve a pending certificate issuance (KNQA only)
   * Calls approve-issue-certificate function requiring KNQA role
   */
  async approveIssueCertificate(certId: string): Promise<{ txId: string }> {
    return new Promise((resolve, reject) => {
      // Validation checks
      if (!this.isConnected()) {
        reject(new Error('WALLET_NOT_CONNECTED: Please connect your wallet first'));
        return;
      }

      if (!certId || certId.length < 8) {
        reject(new Error('INVALID_CERT_ID: Certificate ID must be at least 8 characters'));
        return;
      }

      try {
        const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
        const contractName = 'certificate-governance-v3';
        const functionName = 'approve-issue-certificate';

        console.log(`🔐 KNQA approving certificate: ${certId}`);

        openContractCall({
          network: this.networkType === 'mainnet' ? 'mainnet' : 'testnet', 
          contractAddress,
          contractName,
          functionName,
          functionArgs: [
            stringAsciiCV(certId)
          ],
          postConditionMode: PostConditionMode.Allow,
          onFinish: (data) => {
            console.log('✅ Certificate approval transaction submitted:', data);
            if (!data.txId) {
              reject(new Error('TRANSACTION_FAILED: No transaction ID received'));
              return;
            }
            
            // Automatically update certificate storage to reflect approval
            try {
              const walletAddress = this.getAddress();
              if (walletAddress) {
                import('../services/certificateStorage.js').then(({ certificateStorage }) => {
                  certificateStorage.storeCertificateId(certId, 'issued', walletAddress);
                  console.log('📋 Updated certificate status to approved:', certId);
                });
              }
            } catch (error) {
              console.warn('Failed to update certificate storage:', error);
            }
            
            resolve({ txId: data.txId });
          },
          onCancel: () => {
            reject(new Error('USER_CANCELLED: User cancelled approval transaction'));
          },
        });
      } catch (error) {
        console.error('Certificate approval error:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('USER_CANCELLED')) {
          reject(new Error('USER_CANCELLED: Transaction cancelled by user'));
        } else if (errorMessage.includes('NoSuchContract')) {
          reject(new Error('CONTRACT_ERROR: Contract not found'));
        } else if (errorMessage.includes('unauthorized')) {
          reject(new Error('AUTHORIZATION_ERROR: Only KNQA can approve certificates'));
        } else {
          reject(new Error(`APPROVAL_FAILED: ${errorMessage}`));
        }
      }
    });
  }

  /**
   * Approve a pending revocation request (KNQA only if University initiated, or University if KNQA initiated)
   * Calls approve-revoke-certificate function requiring proper role authorization
   */
  async approveRevokeCertificate(certId: string): Promise<{ txId: string }> {
    return new Promise((resolve, reject) => {
      // Validation checks
      if (!this.isConnected()) {
        reject(new Error('WALLET_NOT_CONNECTED: Please connect your wallet first'));
        return;
      }

      if (!certId || certId.length < 8) {
        reject(new Error('INVALID_CERT_ID: Certificate ID must be at least 8 characters'));
        return;
      }

      try {
        const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
        const contractName = 'certificate-governance-v3';
        const functionName = 'approve-revoke-certificate';

        console.log(`🔐 Approving revocation for certificate: ${certId}`);

        openContractCall({
          network: this.networkType === 'mainnet' ? 'mainnet' : 'testnet', 
          contractAddress,
          contractName,
          functionName,
          functionArgs: [
            stringAsciiCV(certId)
          ],
          onFinish: (data: any) => {
            console.log('✅ Revocation approval transaction submitted:', data.txId);
            resolve({ txId: data.txId });
          },
          onCancel: () => {
            console.log('ℹ️ User cancelled revocation approval transaction');
            reject(new Error('USER_CANCELLED: User cancelled revocation approval transaction'));
          },
        });
      } catch (error) {
        console.error('Revocation approval error:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('USER_CANCELLED')) {
          reject(new Error('USER_CANCELLED: Transaction cancelled by user'));
        } else if (errorMessage.includes('NoSuchContract')) {
          reject(new Error('CONTRACT_ERROR: Contract not found'));
        } else if (errorMessage.includes('unauthorized')) {
          reject(new Error('AUTHORIZATION_ERROR: Not authorized to approve this revocation'));
        } else if (errorMessage.includes('same-initiator')) {
          reject(new Error('AUTHORIZATION_ERROR: Cannot approve your own revocation request'));
        } else {
          reject(new Error(`REVOCATION_APPROVAL_FAILED: ${errorMessage}`));
        }
      }
    });
  }

  /**
   * Check if a certificate is valid (approved and active)
   * Calls is-certificate-valid read-only function
   */
  async isCertificateValid(certId: string): Promise<{ 
    success: boolean; 
    valid: boolean; 
    message: string 
  }> {
    try {
      const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      const contractName = 'certificate-governance-v3';
      const functionName = 'is-certificate-valid';
      const network = STACKS_DEVNET;
      
      console.log(`🔍 Checking certificate validity for: ${certId}`);
      
      const result = await fetchCallReadOnlyFunction({
        network,
        contractAddress,
        contractName,
        functionName,
        functionArgs: [stringAsciiCV(certId)],
        senderAddress: contractAddress
      });
      
      console.log('📋 Certificate validity response:', result);
      
      // Parse the Clarity response: (ok true) or (ok false)
      if (result.type === 'ok' && result.value) {
        const isValid = result.value.type === 'bool' && result.value.value === true;
        
        return {
          success: true,
          valid: isValid,
          message: isValid ? '✅ Certificate is valid and approved' : '❌ Certificate is not approved or invalid'
        };
      }
      
      return {
        success: false,
        valid: false,
        message: 'Invalid response format from contract'
      };
      
    } catch (error) {
      console.error('Failed to check certificate validity:', error);
      return {
        success: false,
        valid: false,
        message: `Failed to check certificate validity: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get multiple approved certificate data via read-only batch contract call
   * Uses get-certificates-batch function which returns approved/issued certificates
   * Returns: (ok (list (ok (some (tuple ...))) (ok none) ...))
   */
  async getCertificatesBatch(certIds: string[]): Promise<{ 
    success: boolean; 
    data: any[]; 
    message: string 
  }> {
    try {
      const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      const contractName = 'certificate-governance-v3';
      const functionName = 'get-certificates-batch';
      const network = STACKS_DEVNET;
      
      console.log(`🔍 Calling approved certificates batch function for ${certIds.length} certificates:`, certIds);
      
      // Convert certificate IDs to list of stringAsciiCV
      const certIdArgs = certIds.map(certId => stringAsciiCV(certId));
      
      const result = await fetchCallReadOnlyFunction({
        network,
        contractAddress,
        contractName,
        functionName,
        functionArgs: [listCV(certIdArgs)],
        senderAddress: contractAddress
      });
      
      console.log('📋 Approved certificates batch response:', result);
      
      // Parse the Clarity response: (ok (list (ok (some (tuple ...))) (ok none) ...))
      if (result.type === 'ok' && result.value) {
        const listValue = result.value;
        
        if (listValue.type === 'list') {
          const foundCertificates = [];
          
          // Process each item in the list
          listValue.value.forEach((item, index) => {
            const certId = certIds[index];
            
            if (item.type === 'ok' && item.value) {
              const value = item.value;
              
              // Check if it's (some tuple) or none
              if (value.type === 'some' && value.value) {
                const tupleData = value.value.value;
                
                // Extract the approved certificate data
                const certificateData = {
                  certId: certId,
                  admissionNo: tupleData['admission-no']?.value || '',
                  certHash: tupleData['cert-hash']?.value || '',
                  grade: tupleData['grade']?.value || '',
                  ipfsCid: tupleData['ipfs-cid']?.value || '',
                  programme: tupleData['programme']?.value || '',
                  studentName: tupleData['student-name']?.value || '',
                  universityPrincipal: tupleData['university-principal']?.value || '',
                  year: tupleData['year']?.value ? parseInt(tupleData['year'].value) : 0,
                  status: tupleData['status']?.value ? parseInt(tupleData['status'].value) : 0,
                  issuedAt: tupleData['issued-at']?.value?.value ? parseInt(tupleData['issued-at'].value.value) : null,
                  revokedAt: tupleData['revoked-at']?.value?.value ? parseInt(tupleData['revoked-at'].value.value) : null,
                  revocationReason: tupleData['revocation-reason']?.value?.value || null,
                  studentPrincipal: tupleData['student-principal']?.value?.value || null,
                  source: 'approved' // Mark as approved certificate data
                };
                
                foundCertificates.push(certificateData);
                console.log(`✅ Found approved certificate ${index}:`, certificateData);
              } else {
                console.log(`ℹ️ Certificate ${certId} not found (none)`);
              }
            } else {
              console.log(`ℹ️ Certificate ${certId} returned error or invalid response`);
            }
          });
          
          return {
            success: true,
            data: foundCertificates,
            message: `✅ Found ${foundCertificates.length} approved certificates out of ${certIds.length} checked`
          };
        }
      }
      
      return {
        success: false,
        data: [],
        message: 'Invalid response format from approved certificates batch call'
      };
      
    } catch (error) {
      console.error('Failed to get approved certificates batch data:', error);
      return {
        success: false,
        data: [],
        message: `Failed to get approved certificates: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Call a smart contract function using wallet (opens wallet for user to sign)
   */
  async callContractFunction({
    contractAddress,
    contractName,
    functionName,
    functionArgs = [],
    onFinish,
    onCancel
  }: {
    contractAddress: string;
    contractName: string;
    functionName: string;
    functionArgs?: any[];
    onFinish?: (data: any) => void;
    onCancel?: () => void;
  }) {
    try {
      console.log(`🔗 Opening wallet for contract call: ${contractName}.${functionName}`);
      
      await openContractCall({
        network: STACKS_DEVNET,
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        onFinish: (data) => {
          console.log('✅ Contract call completed:', data);
          if (onFinish) onFinish(data);
        },
        onCancel: () => {
          console.log('❌ Contract call cancelled');
          if (onCancel) onCancel();
        }
      });
      
    } catch (error) {
      console.error('Failed to open contract call:', error);
      throw error;
    }
  }

  /**
   * Get any certificate data (both pending and issued) via read-only contract call
   * First checks pending-issuance, then checks issued certificates
   */
  async getCertificateData(certId: string): Promise<{ 
    success: boolean; 
    data: any; 
    message: string;
    status: 'pending' | 'issued' | 'not-found';
  }> {
    try {
      // First try to get pending certificate
      const pendingResult = await this.getPendingCertificateData(certId);
      
      if (pendingResult.success && pendingResult.data) {
        return {
          ...pendingResult,
          status: 'pending'
        };
      }
      
      // If not found in pending, check issued certificates
      const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      const contractName = 'certificate-governance-v3';
      const functionName = 'get-certificate';
      const network = STACKS_DEVNET;
      
      console.log(`🔍 Checking issued certificates for cert: ${certId}`);
      
      const result = await fetchCallReadOnlyFunction({
        network,
        contractAddress,
        contractName,
        functionName,
        functionArgs: [stringAsciiCV(certId)],
        senderAddress: contractAddress
      });
      
      console.log('📋 Issued certificate response:', result);
      
      // Parse the Clarity response: (ok (some (tuple ...)))
      if (result.type === 'ok' && result.value) {
        const value = result.value;
        
        // Check if it's (some tuple) or none
        if (value.type === 'some' && value.value) {
          const tupleData = value.value.value; // Access the tuple's value object
          
          // Extract the issued certificate data
          const certificateData = {
            certId: certId,
            admissionNo: tupleData['admission-no'].value,
            certHash: tupleData['cert-hash'].value,
            grade: tupleData['grade'].value,
            ipfsCid: tupleData['ipfs-cid'].value,
            programme: tupleData['programme'].value,
            studentName: tupleData['student-name'].value,
            universityPrincipal: tupleData['university-principal'].value,
            year: Number(tupleData['year'].value),
            status: Number(tupleData['status'].value),
            issuedAt: tupleData['issued-at'] && tupleData['issued-at'].type === 'some' ? 
              Number(tupleData['issued-at'].value.value) : null,
            revokedAt: tupleData['revoked-at'] && tupleData['revoked-at'].type === 'some' ? 
              Number(tupleData['revoked-at'].value.value) : null,
            revocationReason: tupleData['revocation-reason'] && tupleData['revocation-reason'].type === 'some' ? 
              tupleData['revocation-reason'].value.value : null
          };
          
          return {
            success: true,
            data: certificateData,
            message: `Found issued certificate for ${certificateData.studentName}`,
            status: 'issued'
          };
        } else {
          // Neither pending nor issued - not found
          return {
            success: true,
            data: null,
            message: `No certificate found for ID: ${certId}`,
            status: 'not-found'
          };
        }
      } else {
        throw new Error('Invalid response format from contract');
      }
      
    } catch (error) {
      console.error('Failed to get certificate data:', error);
      return {
        success: false,
        data: null,
        message: `Failed to get certificate: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'not-found'
      };
    }
  }
}

// Export singleton instance
export const walletService = new WalletService({
  appName: 'Certivert',
  appIcon: '/certivert-logo.png',
  network: (import.meta.env.VITE_STACKS_NETWORK as 'mainnet' | 'testnet' | 'devnet') || 'devnet',
});