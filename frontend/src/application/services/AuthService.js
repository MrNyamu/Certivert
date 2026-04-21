/**
 * Authentication Application Service
 * Coordinates authentication, authorization, and user management workflows
 */

import { User } from '../../domain/entities/User.js';
import { WalletAddress } from '../../domain/valueObjects/WalletAddress.js';
import { UserRole } from '../../domain/valueObjects/UserRole.js';
import * as authApi from '../../infrastructure/api/authApi.js';

/**
 * Authentication Service
 * High-level service for user authentication and authorization
 */
export class AuthService {
  constructor() {
    this.currentUser = null;
    this.connectionListeners = new Set();
    this.authStateListeners = new Set();
  }

  /**
   * Connect wallet and authenticate user
   * @param {Object} walletOptions - Wallet connection options
   * @returns {Promise<Object>} Authentication result
   */
  async connectWallet(walletOptions = {}) {
    try {
      // DISABLED - Using Redux-based wallet service instead  
      // const { connect } = await import('@stacks/connect');
      throw new Error('Use Redux auth service instead of legacy AuthService');
      
      const authOptions = {
        appDetails: {
          name: 'Certivert',
          icon: '/favicon.ico'
        },
        redirectTo: '/',
        onFinish: async (authData) => {
          return await this._handleWalletConnection(authData);
        },
        onCancel: () => {
          throw new Error('User cancelled wallet connection');
        },
        ...walletOptions
      };

      return await connect(authOptions);

    } catch (error) {
      const authError = {
        success: false,
        error: error.message || 'Wallet connection failed',
        code: 'WALLET_CONNECTION_FAILED'
      };

      this._notifyConnectionListeners({ type: 'error', ...authError });
      return authError;
    }
  }

  /**
   * Handle successful wallet connection
   * @private
   */
  async _handleWalletConnection(authData) {
    try {
      const address = authData.userSession.loadUserData().profile.stxAddress.mainnet;
      const publicKey = authData.userSession.loadUserData().appPrivateKey;

      // Validate address format
      const walletAddress = new WalletAddress(address);
      if (!walletAddress.isValid()) {
        throw new Error('Invalid wallet address format');
      }

      // Get user profile and role
      const user = await authApi.getUserProfile(address);
      
      // Update user with wallet information
      user.publicKey = publicKey;
      user.isConnected = true;
      user.lastLoginAt = new Date();

      // Set current user
      this.currentUser = user;

      // Save session
      authApi.sessionManager.saveSession(user);

      // Notify listeners
      const connectionResult = {
        success: true,
        user: this._serializeUser(user),
        address: address,
        publicKey: publicKey,
        timestamp: new Date().toISOString()
      };

      this._notifyConnectionListeners({ type: 'success', ...connectionResult });
      this._notifyAuthStateListeners({ type: 'login', user: this._serializeUser(user) });

      return connectionResult;

    } catch (error) {
      const authError = {
        success: false,
        error: error.message || 'Authentication failed',
        code: 'AUTHENTICATION_FAILED'
      };

      this._notifyConnectionListeners({ type: 'error', ...authError });
      return authError;
    }
  }

  /**
   * Disconnect wallet and clear session
   * @returns {Promise<Object>} Disconnect result
   */
  async disconnectWallet() {
    try {
      // Clear current user
      const wasConnected = this.currentUser !== null;
      this.currentUser = null;

      // Clear session storage
      authApi.sessionManager.clearSession();

      // Notify listeners
      const disconnectResult = {
        success: true,
        message: 'Wallet disconnected successfully',
        timestamp: new Date().toISOString()
      };

      if (wasConnected) {
        this._notifyAuthStateListeners({ type: 'logout' });
      }

      return disconnectResult;

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Disconnect failed',
        code: 'DISCONNECT_FAILED'
      };
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return this.currentUser !== null && this.currentUser.isConnected;
  }

  /**
   * Get current user
   * @returns {User|null} Current authenticated user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get current user's role
   * @returns {string|null} User role string
   */
  getCurrentUserRole() {
    return this.currentUser?.role?.toStringValue() || null;
  }

  /**
   * Check if current user has specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean} Permission check result
   */
  hasPermission(permission) {
    if (!this.currentUser) return false;
    return this.currentUser.hasPermission(permission);
  }

  /**
   * Check if current user can perform action
   * @param {string} action - Action to check
   * @returns {boolean} Authorization result
   */
  canPerformAction(action) {
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
        return true; // Everyone can verify
      default:
        return false;
    }
  }

  /**
   * Restore session from storage
   * @returns {Promise<Object>} Session restoration result
   */
  async restoreSession() {
    try {
      const user = authApi.sessionManager.loadSession();
      
      if (!user) {
        return {
          success: false,
          message: 'No session found',
          code: 'NO_SESSION'
        };
      }

      // Verify session is still valid by checking role
      const freshUser = await authApi.getUserProfile(user.address.value);
      
      // Update current user
      this.currentUser = freshUser;
      this.currentUser.isConnected = true;

      // Update session with fresh data
      authApi.sessionManager.saveSession(this.currentUser);

      const restoreResult = {
        success: true,
        user: this._serializeUser(this.currentUser),
        message: 'Session restored successfully',
        timestamp: new Date().toISOString()
      };

      this._notifyAuthStateListeners({ type: 'restore', user: this._serializeUser(this.currentUser) });

      return restoreResult;

    } catch (error) {
      // Clear invalid session
      authApi.sessionManager.clearSession();
      this.currentUser = null;

      return {
        success: false,
        error: error.message || 'Session restoration failed',
        code: 'SESSION_RESTORE_FAILED'
      };
    }
  }

  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object>} Update result
   */
  async updateProfile(profileData) {
    try {
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }

      const updatedUser = await authApi.updateUserProfile(
        this.currentUser.address.value,
        profileData
      );

      // Update current user
      this.currentUser = updatedUser;

      // Update session
      authApi.sessionManager.saveSession(this.currentUser);

      // Notify listeners
      const updateResult = {
        success: true,
        user: this._serializeUser(updatedUser),
        message: 'Profile updated successfully',
        timestamp: new Date().toISOString()
      };

      this._notifyAuthStateListeners({ type: 'profile_updated', user: this._serializeUser(updatedUser) });

      return updateResult;

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Profile update failed',
        code: 'PROFILE_UPDATE_FAILED'
      };
    }
  }

  /**
   * Get user dashboard configuration
   * @returns {Promise<Object>} Dashboard configuration
   */
  async getDashboardConfig() {
    try {
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }

      return await authApi.getUserDashboardConfig(this.currentUser.address.value);

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to get dashboard config',
        code: 'DASHBOARD_CONFIG_FAILED'
      };
    }
  }

  /**
   * Verify wallet ownership with signature
   * @param {string} message - Message to sign
   * @param {string} signature - Signature to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyWalletOwnership(message, signature) {
    try {
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }

      const isValid = await authApi.verifyWalletOwnership(
        this.currentUser.address.value,
        message,
        signature
      );

      return {
        success: true,
        isValid,
        message: isValid ? 'Wallet ownership verified' : 'Invalid signature',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Verification failed',
        code: 'VERIFICATION_FAILED'
      };
    }
  }

  /**
   * Get blockchain status
   * @returns {Promise<Object>} Blockchain status
   */
  async getBlockchainStatus() {
    try {
      const status = await authApi.getBlockchainStatus();
      return {
        success: true,
        status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to get blockchain status',
        code: 'BLOCKCHAIN_STATUS_FAILED'
      };
    }
  }

  /**
   * Add connection state listener
   * @param {Function} listener - Listener function
   */
  addConnectionListener(listener) {
    this.connectionListeners.add(listener);
  }

  /**
   * Remove connection state listener
   * @param {Function} listener - Listener function
   */
  removeConnectionListener(listener) {
    this.connectionListeners.delete(listener);
  }

  /**
   * Add auth state listener
   * @param {Function} listener - Listener function
   */
  addAuthStateListener(listener) {
    this.authStateListeners.add(listener);
  }

  /**
   * Remove auth state listener
   * @param {Function} listener - Listener function
   */
  removeAuthStateListener(listener) {
    this.authStateListeners.delete(listener);
  }

  /**
   * Notify connection listeners
   * @private
   */
  _notifyConnectionListeners(event) {
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
  _notifyAuthStateListeners(event) {
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
  _serializeUser(user) {
    if (!user) return null;

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
      // Role checks
      isStudent: user.isStudent(),
      isUniversity: user.isUniversity(),
      isKNQA: user.isKNQA(),
      isActive: user.isActive()
    };
  }

  /**
   * Clear all listeners
   */
  clearAllListeners() {
    this.connectionListeners.clear();
    this.authStateListeners.clear();
  }

  /**
   * Check session validity
   * @returns {boolean} Session validity
   */
  hasValidSession() {
    return authApi.sessionManager.hasValidSession();
  }

  /**
   * Force session refresh
   * @returns {Promise<Object>} Refresh result
   */
  async refreshSession() {
    if (!this.currentUser) {
      return {
        success: false,
        error: 'No active session to refresh',
        code: 'NO_ACTIVE_SESSION'
      };
    }

    return await this.restoreSession();
  }
}

// Export singleton instance
export default new AuthService();