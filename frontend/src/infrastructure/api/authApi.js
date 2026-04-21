/**
 * Authentication API Layer
 * Handles wallet connection, user roles, and authentication-related operations
 */

import { httpMethods } from './httpClient.js';
import { User } from '../../domain/entities/User.js';
import { WalletAddress } from '../../domain/valueObjects/WalletAddress.js';
import { UserRole } from '../../domain/valueObjects/UserRole.js';

/**
 * Auth API endpoints
 */
const ENDPOINTS = {
  USER_ROLE: '/api/role',
  USER_PROFILE: '/api/profile',
  BLOCKCHAIN_HEIGHT: '/api/blockchain/height'
};

/**
 * Get user role from blockchain
 * @param {string} address - User's wallet address
 * @returns {Promise<UserRole>} User role
 */
export async function getUserRole(address) {
  try {
    // Validate wallet address
    if (!WalletAddress.isValidFormat(address)) {
      throw new Error('Invalid wallet address format');
    }
    
    const response = await httpMethods.get(`${ENDPOINTS.USER_ROLE}/${address}`);
    
    // Handle different response formats
    let roleValue = response.data.role;
    if (typeof roleValue === 'string') {
      roleValue = UserRole.fromString(roleValue);
    }
    
    return new UserRole(roleValue || 0);
  } catch (error) {
    // If role fetch fails, return NONE role instead of throwing
    console.warn(`Failed to fetch user role for ${address}:`, error.message);
    return UserRole.none();
  }
}

/**
 * Get user profile information
 * @param {string} address - User's wallet address
 * @returns {Promise<User>} User profile
 */
export async function getUserProfile(address) {
  try {
    if (!WalletAddress.isValidFormat(address)) {
      throw new Error('Invalid wallet address format');
    }
    
    const response = await httpMethods.get(`${ENDPOINTS.USER_PROFILE}/${address}`);
    
    // Create User entity from API response
    return User.fromJSON({
      address,
      role: response.data.role || 0,
      name: response.data.name,
      email: response.data.email,
      institution: response.data.institution,
      isConnected: true,
      lastLoginAt: new Date()
    });
  } catch (error) {
    // If profile doesn't exist, create minimal user with role
    const role = await getUserRole(address);
    return new User({
      address,
      role,
      isConnected: true,
      lastLoginAt: new Date()
    });
  }
}

/**
 * Update user profile
 * @param {string} address - User's wallet address
 * @param {Object} profileData - Profile update data
 * @returns {Promise<User>} Updated user profile
 */
export async function updateUserProfile(address, profileData) {
  try {
    if (!WalletAddress.isValidFormat(address)) {
      throw new Error('Invalid wallet address format');
    }
    
    // Validate profile data
    if (profileData.email && !isValidEmail(profileData.email)) {
      throw new Error('Invalid email format');
    }
    
    const response = await httpMethods.put(`${ENDPOINTS.USER_PROFILE}/${address}`, {
      name: profileData.name?.trim(),
      email: profileData.email?.trim(),
      institution: profileData.institution?.trim()
    });
    
    return User.fromJSON({
      address,
      ...response.data,
      isConnected: true,
      lastLoginAt: new Date()
    });
  } catch (error) {
    throw new Error(`Profile update failed: ${error.userMessage || error.message}`);
  }
}

/**
 * Get blockchain information for network status
 * @returns {Promise<Object>} Blockchain status
 */
export async function getBlockchainStatus() {
  try {
    const stacksApiUrl = import.meta.env.VITE_STACKS_API_URL || 'http://localhost:3999';
    
    // Direct call to Stacks API for network info
    const response = await fetch(`${stacksApiUrl}/v2/info`);
    
    if (!response.ok) {
      throw new Error('Blockchain API unavailable');
    }
    
    const data = await response.json();
    
    return {
      network: data.network_id === 1 ? 'mainnet' : 'testnet',
      blockHeight: data.stacks_tip_height || 0,
      burnBlockHeight: data.burn_block_height || 0,
      version: data.server_version,
      isFullySynced: data.is_fully_synced || false,
      peerVersion: data.peer_version,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Blockchain status check failed: ${error.message}`);
  }
}

/**
 * Get Bitcoin block height (for UI display)
 * @returns {Promise<number>} Current Bitcoin block height
 */
export async function getBitcoinBlockHeight() {
  try {
    const status = await getBlockchainStatus();
    return status.burnBlockHeight || 0;
  } catch (error) {
    console.warn('Failed to fetch Bitcoin block height:', error.message);
    return 0;
  }
}

/**
 * Verify wallet ownership (sign a message)
 * @param {string} address - Wallet address
 * @param {string} message - Message to sign
 * @param {string} signature - Signature to verify
 * @returns {Promise<boolean>} Verification result
 */
export async function verifyWalletOwnership(address, message, signature) {
  try {
    const response = await httpMethods.post('/api/auth/verify-signature', {
      address,
      message,
      signature
    });
    
    return response.data.valid === true;
  } catch (error) {
    console.warn('Wallet ownership verification failed:', error.message);
    return false;
  }
}

/**
 * Check if user has specific permission
 * @param {string} address - User's wallet address
 * @param {string} permission - Permission to check
 * @returns {Promise<boolean>} Permission check result
 */
export async function checkUserPermission(address, permission) {
  try {
    const user = await getUserProfile(address);
    return user.hasPermission(permission);
  } catch (error) {
    console.warn(`Permission check failed for ${address}:`, error.message);
    return false;
  }
}

/**
 * Get user's role-based dashboard configuration
 * @param {string} address - User's wallet address
 * @returns {Promise<Object>} Dashboard configuration
 */
export async function getUserDashboardConfig(address) {
  try {
    const user = await getUserProfile(address);
    
    // Return role-based configuration
    const baseConfig = {
      address: user.address.value,
      role: user.role.toStringValue(),
      displayName: user.getDisplayName(),
      permissions: user.role.getPermissions()
    };
    
    if (user.isStudent()) {
      return {
        ...baseConfig,
        dashboardType: 'student',
        features: ['verify_certificates', 'view_own_certificates', 'download_certificates'],
        defaultRoute: '/student/certificates'
      };
    }
    
    if (user.isUniversity()) {
      return {
        ...baseConfig,
        dashboardType: 'university',
        features: ['issue_certificates', 'view_issued_certificates', 'revoke_certificates', 'pending_approvals'],
        defaultRoute: '/university/issue'
      };
    }
    
    if (user.isKNQA()) {
      return {
        ...baseConfig,
        dashboardType: 'knqa',
        features: ['audit_system', 'view_all_certificates', 'system_statistics', 'manage_universities'],
        defaultRoute: '/knqa/audit'
      };
    }
    
    return {
      ...baseConfig,
      dashboardType: 'public',
      features: ['verify_certificates'],
      defaultRoute: '/verify'
    };
  } catch (error) {
    throw new Error(`Dashboard config fetch failed: ${error.userMessage || error.message}`);
  }
}

/**
 * Session management
 */
export const sessionManager = {
  /**
   * Save session data
   * @param {User} user - User to save in session
   */
  saveSession(user) {
    try {
      const sessionData = {
        address: user.address.value,
        role: user.role.value,
        publicKey: user.publicKey,
        name: user.name,
        email: user.email,
        institution: user.institution,
        lastLoginAt: user.lastLoginAt,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };
      
      sessionStorage.setItem('certivert_session', JSON.stringify(sessionData));
      localStorage.setItem('certivert_last_login', user.lastLoginAt);
    } catch (error) {
      console.warn('Failed to save session:', error);
    }
  },
  
  /**
   * Load session data
   * @returns {User|null} Restored user or null
   */
  loadSession() {
    try {
      const sessionData = sessionStorage.getItem('certivert_session');
      if (!sessionData) return null;
      
      const session = JSON.parse(sessionData);
      
      // Check if session is expired
      if (session.expiresAt && Date.now() > session.expiresAt) {
        this.clearSession();
        return null;
      }
      
      return User.fromJSON(session);
    } catch (error) {
      console.warn('Failed to load session:', error);
      this.clearSession();
      return null;
    }
  },
  
  /**
   * Clear session data
   */
  clearSession() {
    sessionStorage.removeItem('certivert_session');
    sessionStorage.removeItem('user_role');
    sessionStorage.removeItem('wallet_address');
    sessionStorage.removeItem('wallet_publicKey');
  },
  
  /**
   * Check if session exists and is valid
   * @returns {boolean} Session validity
   */
  hasValidSession() {
    const user = this.loadSession();
    return user !== null;
  }
};

// Helper functions
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Export all functions
export {
  getUserRole as getRole,
  getUserProfile as getProfile,
  updateUserProfile as updateProfile,
  getBlockchainStatus as getBlockchainInfo,
  getBitcoinBlockHeight as getBitcoinHeight,
  verifyWalletOwnership as verifyOwnership,
  checkUserPermission as checkPermission,
  getUserDashboardConfig as getDashboardConfig
};