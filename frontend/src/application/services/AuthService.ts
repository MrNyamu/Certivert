/**
 * Authentication Application Service (TypeScript)
 * Coordinates authentication, authorization, and user management workflows with Wallet Service
 */

import { User } from '../../domain/entities/User.js';
import { WalletAddress } from '../../domain/valueObjects/WalletAddress.js';
import { UserRole } from '../../domain/valueObjects/UserRole.js';
import WalletService, { WalletEvent } from '../../infrastructure/wallet/WalletService.js';
import * as authApi from '../../infrastructure/api/authApi.js';
import type { 
  AuthenticationResult,
  SerializedUser,
  DashboardConfig,
  ConnectionStatus,
  BlockchainStatus
} from '../../types/index.js';

/**
 * Authentication event types
 */
export type AuthEventType = 'login' | 'logout' | 'restore' | 'profile_updated' | 'session_expired';

export interface AuthEvent {
  type: AuthEventType;
  user?: SerializedUser;
  timestamp: string;
  data?: any;
}

/**
 * Enhanced Authentication Service with Wallet Integration
 */
export class AuthService {
  private currentUser: User | null = null;
  private walletService: WalletService;
  private connectionListeners: Set<Function> = new Set();
  private authStateListeners: Set<Function> = new Set();
  private sessionCheckInterval: NodeJS.Timeout | null = null;

  constructor(walletService?: WalletService) {
    this.walletService = walletService || WalletService.createDefault();
    this.setupWalletEventListeners();
    this.startSessionMonitoring();
  }

  /**
   * Setup wallet service event listeners
   * @private
   */
  private setupWalletEventListeners(): void {
    this.walletService.addEventListener('connected', (event: WalletEvent) => {
      this.handleWalletConnected(event.data);
    });

    this.walletService.addEventListener('disconnected', (event: WalletEvent) => {
      this.handleWalletDisconnected();
    });

    this.walletService.addEventListener('error', (event: WalletEvent) => {
      this.notifyConnectionListeners({ 
        type: 'error', 
        error: event.data?.error || 'Wallet connection error',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Connect wallet and authenticate user
   */
  async connectWallet(): Promise<AuthenticationResult> {
    try {
      const connectionResult = await this.walletService.connectWallet();
      
      if (!connectionResult.success || !connectionResult.address) {
        return connectionResult;
      }

      // Fetch user profile and role from backend
      const user = await this.fetchUserProfile(connectionResult.address);
      
      // Update user with wallet connection details
      const connectedUser = user.withConnectionState(true, new Date());
      this.currentUser = connectedUser;

      // Save session
      authApi.sessionManager.saveSession(connectedUser);

      const result: AuthenticationResult = {
        success: true,
        user: this.serializeUser(connectedUser),
        address: connectionResult.address,
        publicKey: connectionResult.publicKey,
        timestamp: new Date().toISOString()
      };

      this.notifyAuthStateListeners({ 
        type: 'login', 
        user: this.serializeUser(connectedUser),
        timestamp: result.timestamp
      });

      return result;

    } catch (error) {
      const errorResult: AuthenticationResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        code: 'AUTHENTICATION_FAILED',
        timestamp: new Date().toISOString()
      };

      this.notifyConnectionListeners({ type: 'error', ...errorResult });
      return errorResult;
    }
  }

  /**
   * Handle wallet connection event
   * @private
   */
  private async handleWalletConnected(connectionData: any): Promise<void> {
    try {
      if (connectionData?.address) {
        const user = await this.fetchUserProfile(connectionData.address);
        const connectedUser = user.withConnectionState(true, new Date());
        this.currentUser = connectedUser;
        
        authApi.sessionManager.saveSession(connectedUser);
        
        this.notifyAuthStateListeners({
          type: 'login',
          user: this.serializeUser(connectedUser),
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error handling wallet connection:', error);
    }
  }

  /**
   * Handle wallet disconnection
   * @private
   */
  private handleWalletDisconnected(): void {
    const wasAuthenticated = this.currentUser !== null;
    this.currentUser = null;
    authApi.sessionManager.clearSession();

    if (wasAuthenticated) {
      this.notifyAuthStateListeners({
        type: 'logout',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Fetch user profile from backend
   * @private
   */
  private async fetchUserProfile(address: string): Promise<User> {
    try {
      const user = await authApi.getUserProfile(address);
      return user;
    } catch (error) {
      // If profile doesn't exist, create basic user with role from backend
      console.warn('Failed to fetch full profile, getting role only:', error);
      const role = await authApi.getUserRole(address);
      
      return new User({
        address,
        role,
        isConnected: false,
        lastLoginAt: new Date()
      });
    }
  }

  /**
   * Disconnect wallet and clear session
   */
  async disconnectWallet(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // Disconnect from wallet service
      const walletResult = await this.walletService.disconnectWallet();
      
      // Clear local state
      const wasConnected = this.currentUser !== null;
      this.currentUser = null;
      authApi.sessionManager.clearSession();

      if (wasConnected) {
        this.notifyAuthStateListeners({ 
          type: 'logout',
          timestamp: new Date().toISOString()
        });
      }

      return walletResult;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect wallet'
      };
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && 
           this.currentUser.isConnected && 
           this.walletService.isUserSignedIn();
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get current user's role
   */
  getCurrentUserRole(): string | null {
    return this.currentUser?.role?.toStringValue() || null;
  }

  /**
   * Check if current user has specific permission
   */
  hasPermission(permission: string): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.hasPermission(permission);
  }

  /**
   * Check if current user can perform action
   */
  canPerformAction(action: string): boolean {
    if (!this.currentUser) return false;

    switch (action) {
      case 'issue_certificates':
        return this.currentUser.canIssueCertificates();
      case 'approve_certificates':
        return this.currentUser.canApproveCertificates();
      case 'revoke_certificates':
        return this.currentUser.canRevokeCertificates();
      case 'audit_system':
        return this.currentUser.isKNQA();
      case 'view_own_certificates':
        return this.currentUser.isStudent();
      case 'verify_certificates':
        return true;
      default:
        return false;
    }
  }

  /**
   * Restore session from storage
   */
  async restoreSession(): Promise<AuthenticationResult> {
    try {
      // First check if wallet is still connected
      if (!this.walletService.isUserSignedIn()) {
        return {
          success: false,
          message: 'Wallet not connected',
          code: 'WALLET_NOT_CONNECTED',
          timestamp: new Date().toISOString()
        };
      }

      // Load session from storage
      const user = authApi.sessionManager.loadSession();
      
      if (!user) {
        return {
          success: false,
          message: 'No session found',
          code: 'NO_SESSION',
          timestamp: new Date().toISOString()
        };
      }

      // Verify session is still valid and wallet address matches
      const walletAddress = this.walletService.getCurrentAddress();
      if (!walletAddress || walletAddress !== user.address.value) {
        authApi.sessionManager.clearSession();
        return {
          success: false,
          message: 'Session address mismatch',
          code: 'SESSION_ADDRESS_MISMATCH',
          timestamp: new Date().toISOString()
        };
      }

      // Refresh user data from backend
      try {
        const freshUser = await this.fetchUserProfile(user.address.value);
        const connectedUser = freshUser.withConnectionState(true, new Date());
        
        this.currentUser = connectedUser;
        authApi.sessionManager.saveSession(connectedUser);

        const restoreResult: AuthenticationResult = {
          success: true,
          user: this.serializeUser(connectedUser),
          address: walletAddress,
          message: 'Session restored successfully',
          timestamp: new Date().toISOString()
        };

        this.notifyAuthStateListeners({ 
          type: 'restore', 
          user: this.serializeUser(connectedUser),
          timestamp: restoreResult.timestamp
        });

        return restoreResult;

      } catch (error) {
        // If backend fetch fails, use cached user data but mark as potentially stale
        this.currentUser = user.withConnectionState(true, new Date());
        
        return {
          success: true,
          user: this.serializeUser(this.currentUser),
          address: walletAddress,
          message: 'Session restored from cache (data may be stale)',
          timestamp: new Date().toISOString()
        };
      }

    } catch (error) {
      authApi.sessionManager.clearSession();
      this.currentUser = null;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session restoration failed',
        code: 'SESSION_RESTORE_FAILED',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData: {
    name?: string;
    email?: string;
    institution?: string;
  }): Promise<AuthenticationResult> {
    try {
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }

      const updatedUser = await authApi.updateUserProfile(
        this.currentUser.address.value,
        profileData
      );

      this.currentUser = updatedUser;
      authApi.sessionManager.saveSession(this.currentUser);

      const updateResult: AuthenticationResult = {
        success: true,
        user: this.serializeUser(updatedUser),
        message: 'Profile updated successfully',
        timestamp: new Date().toISOString()
      };

      this.notifyAuthStateListeners({ 
        type: 'profile_updated', 
        user: this.serializeUser(updatedUser),
        timestamp: updateResult.timestamp
      });

      return updateResult;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Profile update failed',
        code: 'PROFILE_UPDATE_FAILED',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get user dashboard configuration
   */
  async getDashboardConfig(): Promise<{ success: boolean; config?: DashboardConfig; error?: string }> {
    try {
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }

      const config = await authApi.getUserDashboardConfig(this.currentUser.address.value);
      return { success: true, config };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get dashboard config'
      };
    }
  }

  /**
   * Get blockchain and connection status
   */
  async getSystemStatus(): Promise<{
    connection: ConnectionStatus;
    blockchain?: BlockchainStatus;
    wallet: {
      connected: boolean;
      address?: string;
      network: string;
    };
  }> {
    const connectionStatus = this.walletService.getConnectionStatus();
    const networkInfo = this.walletService.getNetworkInfo();
    
    const status = {
      connection: connectionStatus,
      wallet: {
        connected: this.walletService.isUserSignedIn(),
        address: this.walletService.getCurrentAddress() || undefined,
        network: networkInfo.network
      }
    };

    try {
      const blockchainStatus = await this.walletService.getBlockchainStatus();
      return { ...status, blockchain: blockchainStatus };
    } catch (error) {
      console.warn('Failed to get blockchain status:', error);
      return status;
    }
  }

  /**
   * Start session monitoring
   * @private
   */
  private startSessionMonitoring(): void {
    // Check session validity every 5 minutes
    this.sessionCheckInterval = setInterval(() => {
      if (this.currentUser && !this.currentUser.isSessionValid()) {
        this.handleSessionExpired();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Handle session expiration
   * @private
   */
  private handleSessionExpired(): void {
    this.currentUser = null;
    authApi.sessionManager.clearSession();
    
    this.notifyAuthStateListeners({
      type: 'session_expired',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add connection state listener
   */
  addConnectionListener(listener: Function): void {
    this.connectionListeners.add(listener);
  }

  /**
   * Remove connection state listener
   */
  removeConnectionListener(listener: Function): void {
    this.connectionListeners.delete(listener);
  }

  /**
   * Add auth state listener
   */
  addAuthStateListener(listener: Function): void {
    this.authStateListeners.add(listener);
  }

  /**
   * Remove auth state listener
   */
  removeAuthStateListener(listener: Function): void {
    this.authStateListeners.delete(listener);
  }

  /**
   * Notify connection listeners
   * @private
   */
  private notifyConnectionListeners(event: any): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Connection listener error:', error);
      }
    });
  }

  /**
   * Notify auth state listeners
   * @private
   */
  private notifyAuthStateListeners(event: AuthEvent): void {
    this.authStateListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Auth state listener error:', error);
      }
    });
  }

  /**
   * Serialize user for safe transmission
   * @private
   */
  private serializeUser(user: User): SerializedUser {
    return {
      address: user.address.value,
      role: user.role.toStringValue(),
      roleValue: user.role.value,
      name: user.name,
      email: user.email,
      institution: user.institution,
      displayName: user.getDisplayName(),
      isConnected: user.isConnected,
      lastLoginAt: user.lastLoginAt,
      permissions: user.role.getPermissions(),
      isStudent: user.isStudent(),
      isUniversity: user.isUniversity(),
      isKNQA: user.isKNQA(),
      isActive: user.isActive()
    };
  }

  /**
   * Get wallet service instance
   */
  getWalletService(): WalletService {
    return this.walletService;
  }

  /**
   * Check session validity
   */
  hasValidSession(): boolean {
    return this.currentUser?.isSessionValid() === true && 
           this.walletService.isUserSignedIn();
  }

  /**
   * Force session refresh
   */
  async refreshSession(): Promise<AuthenticationResult> {
    if (!this.currentUser) {
      return {
        success: false,
        error: 'No active session to refresh',
        code: 'NO_ACTIVE_SESSION',
        timestamp: new Date().toISOString()
      };
    }

    return await this.restoreSession();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }
    this.connectionListeners.clear();
    this.authStateListeners.clear();
    this.walletService.destroy();
  }
}

// Create and export singleton instance
const walletService = WalletService.createDefault();
const authService = new AuthService(walletService);

export { authService, walletService };
export default authService;