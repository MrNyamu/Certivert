/**
 * Wallet Service Infrastructure
 * Handles Xverse wallet integration with Stacks Connect
 */

// TEMPORARILY DISABLED TO FIX STACKSPROVIDER CONFLICT - Using Redux-based wallet service instead
// import { 
//   authenticate, 
//   UserSession, 
//   AppConfig
// } from '@stacks/connect';
import { StacksTestnet, StacksMainnet } from '@stacks/network';
import type { 
  AuthenticationResult, 
  ConnectionStatus,
  BlockchainStatus 
} from '../../types/index.js';

/**
 * Wallet connection configuration
 */
interface WalletConfig {
  appName: string;
  appIcon: string;
  network: 'testnet' | 'mainnet' | 'devnet';
  apiUrl?: string;
}

/**
 * Wallet connection event types
 */
export type WalletEventType = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WalletEvent {
  type: WalletEventType;
  data?: any;
  error?: string;
  timestamp: number;
}

/**
 * Wallet Service
 * Manages Xverse wallet connections and Stacks blockchain interactions
 */
export class WalletService {
  private userSession: UserSession;
  private appConfig: AppConfig;
  private network: StacksNetwork;
  private config: WalletConfig;
  private eventListeners: Map<WalletEventType, Set<Function>> = new Map();

  constructor(config: WalletConfig) {
    this.config = config;
    
    // Initialize app config with required permissions
    this.appConfig = new AppConfig(['store_write', 'publish_data'], {
      appDetails: {
        name: this.config.appName,
        icon: this.config.appIcon
      }
    });

    // Initialize user session
    this.userSession = new UserSession({ appConfig: this.appConfig });

    // Set up network configuration
    this.network = this.getNetworkInstance();

    // Initialize event listeners map
    this.eventListeners.set('connecting', new Set());
    this.eventListeners.set('connected', new Set());
    this.eventListeners.set('disconnected', new Set());
    this.eventListeners.set('error', new Set());
  }

  /**
   * Get network instance based on configuration
   * @private
   */
  private getNetworkInstance(): StacksNetwork {
    switch (this.config.network) {
      case 'mainnet':
        return new StacksMainnet();
      case 'testnet':
        return new StacksTestnet();
      case 'devnet':
        return new StacksTestnet({ 
          url: this.config.apiUrl || 'http://localhost:3999' 
        });
      default:
        return new StacksTestnet();
    }
  }

  /**
   * Connect to Xverse wallet
   */
  async connectWallet(): Promise<AuthenticationResult> {
    try {
      this.emitEvent('connecting', { message: 'Initiating wallet connection' });

      return new Promise<AuthenticationResult>((resolve, reject) => {
        authenticate({
          appDetails: {
            name: this.config.appName,
            icon: this.config.appIcon,
          },
          redirectTo: '/',
          onFinish: (authData) => {
            try {
              const result = this.handleSuccessfulConnection(authData);
              this.emitEvent('connected', result);
              resolve(result);
            } catch (error) {
              const errorResult = this.handleConnectionError(error);
              this.emitEvent('error', errorResult);
              reject(errorResult);
            }
          },
          onCancel: () => {
            const cancelledResult: AuthenticationResult = {
              success: false,
              error: 'User cancelled wallet connection',
              code: 'CONNECTION_CANCELLED',
              timestamp: new Date().toISOString()
            };
            this.emitEvent('error', cancelledResult);
            reject(cancelledResult);
          },
          userSession: this.userSession,
        });
      });

    } catch (error) {
      const errorResult = this.handleConnectionError(error);
      this.emitEvent('error', errorResult);
      return errorResult;
    }
  }

  /**
   * Handle successful wallet connection
   * @private
   */
  private handleSuccessfulConnection(authData: any): AuthenticationResult {
    if (!this.userSession.isUserSignedIn()) {
      throw new Error('User session not properly established');
    }

    const userData = this.userSession.loadUserData();
    
    if (!userData || !userData.profile) {
      throw new Error('Invalid user data received from wallet');
    }

    // Get address for the current network
    const address = this.getAddressForNetwork(userData);
    
    if (!address) {
      throw new Error(`No address found for ${this.config.network} network`);
    }

    return {
      success: true,
      user: {
        address,
        role: 'none', // Will be determined by backend
        roleValue: 0,
        displayName: userData.profile.name || this.truncateAddress(address),
        isConnected: true,
        lastLoginAt: new Date(),
        permissions: [],
        isStudent: false,
        isUniversity: false,
        isKNQA: false,
        isActive: false
      },
      address,
      publicKey: userData.appPrivateKey,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get address for current network from user data
   * @private
   */
  private getAddressForNetwork(userData: any): string | null {
    if (!userData.profile.stxAddress) {
      return null;
    }

    switch (this.config.network) {
      case 'mainnet':
        return userData.profile.stxAddress.mainnet;
      case 'testnet':
      case 'devnet':
        return userData.profile.stxAddress.testnet;
      default:
        return userData.profile.stxAddress.testnet;
    }
  }

  /**
   * Handle connection errors
   * @private
   */
  private handleConnectionError(error: any): AuthenticationResult {
    let errorMessage = 'Failed to connect wallet';
    let errorCode = 'CONNECTION_FAILED';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    // Map specific error conditions
    if (errorMessage.includes('User denied')) {
      errorCode = 'USER_DENIED';
      errorMessage = 'User denied wallet connection request';
    } else if (errorMessage.includes('No wallet')) {
      errorCode = 'NO_WALLET';
      errorMessage = 'No Stacks wallet found. Please install Xverse wallet';
    } else if (errorMessage.includes('Network')) {
      errorCode = 'NETWORK_ERROR';
      errorMessage = 'Network connection error. Please check your internet connection';
    }

    return {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (this.userSession.isUserSignedIn()) {
        this.userSession.signUserOut();
      }

      this.emitEvent('disconnected', { 
        message: 'Wallet disconnected successfully',
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Wallet disconnected successfully'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect wallet';
      
      this.emitEvent('error', { 
        error: errorMessage,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Check if user is currently signed in
   */
  isUserSignedIn(): boolean {
    return this.userSession.isUserSignedIn();
  }

  /**
   * Get current wallet address
   */
  getCurrentAddress(): string | null {
    if (!this.userSession.isUserSignedIn()) {
      return null;
    }

    try {
      const userData = this.userSession.loadUserData();
      return this.getAddressForNetwork(userData);
    } catch (error) {
      console.warn('Failed to get current address:', error);
      return null;
    }
  }

  /**
   * Get current user data
   */
  getCurrentUserData(): any | null {
    if (!this.userSession.isUserSignedIn()) {
      return null;
    }

    try {
      return this.userSession.loadUserData();
    } catch (error) {
      console.warn('Failed to get user data:', error);
      return null;
    }
  }

  /**
   * Get network information
   */
  getNetworkInfo(): {
    network: string;
    url: string;
    isMainnet: boolean;
    isTestnet: boolean;
  } {
    return {
      network: this.config.network,
      url: this.network.coreApiUrl,
      isMainnet: this.config.network === 'mainnet',
      isTestnet: this.config.network === 'testnet' || this.config.network === 'devnet'
    };
  }

  /**
   * Check wallet connection status
   */
  getConnectionStatus(): ConnectionStatus {
    const isConnected = this.isUserSignedIn();
    const address = this.getCurrentAddress();

    return {
      api: isConnected ? 'connected' : 'disconnected',
      blockchain: isConnected && address ? 'connected' : 'disconnected',
      ipfs: 'connected' // Assume IPFS is always available through API
    };
  }

  /**
   * Get blockchain status
   */
  async getBlockchainStatus(): Promise<BlockchainStatus> {
    try {
      const response = await fetch(`${this.network.coreApiUrl}/v2/info`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch blockchain status');
      }

      const data = await response.json();

      return {
        network: this.config.network,
        blockHeight: data.stacks_tip_height || 0,
        burnBlockHeight: data.burn_block_height || 0,
        version: data.server_version,
        isFullySynced: data.is_fully_synced || false,
        peerVersion: data.peer_version,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Blockchain status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add event listener
   */
  addEventListener(type: WalletEventType, listener: Function): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(type: WalletEventType, listener: Function): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit wallet event to all listeners
   * @private
   */
  private emitEvent(type: WalletEventType, data?: any): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const event: WalletEvent = {
        type,
        data,
        timestamp: Date.now()
      };

      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.warn(`Wallet event listener error:`, error);
        }
      });
    }
  }

  /**
   * Truncate address for display
   * @private
   */
  private truncateAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  /**
   * Validate wallet configuration
   */
  static validateConfig(config: Partial<WalletConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.appName) {
      errors.push('App name is required');
    }

    if (!config.appIcon) {
      errors.push('App icon is required');
    }

    if (config.network && !['testnet', 'mainnet', 'devnet'].includes(config.network)) {
      errors.push('Invalid network. Must be testnet, mainnet, or devnet');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create wallet service instance with default configuration
   */
  static createDefault(): WalletService {
    const isDevelopment = import.meta.env.MODE === 'development';
    
    return new WalletService({
      appName: 'Certivert',
      appIcon: '/favicon.ico',
      network: isDevelopment ? 'devnet' : 'testnet',
      apiUrl: isDevelopment ? 'http://localhost:3999' : undefined
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.eventListeners.clear();
  }
}

export default WalletService;