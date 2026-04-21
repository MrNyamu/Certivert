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
  FungibleConditionCode,
  makeStandardSTXPostCondition,
  PostConditionMode,
  AnchorMode
} from '@stacks/transactions';
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
}

// Export singleton instance
export const walletService = new WalletService({
  appName: 'Certivert',
  appIcon: '/certivert-logo.png',
  network: (import.meta.env.VITE_STACKS_NETWORK as 'mainnet' | 'testnet' | 'devnet') || 'devnet',
});