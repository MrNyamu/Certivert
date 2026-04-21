/**
 * Wallet Components Export
 * Central export point for all wallet-related components
 */

export { default as WalletConnectionButton } from './WalletConnectionButton.js';
export { default as WalletStatus } from './WalletStatus.js';
export { default as WalletGuard, withWalletGuard, useWalletGuard } from './WalletGuard.js';

// Re-export types for convenience
export type { 
  WalletEventType,
  WalletEvent 
} from '../../infrastructure/wallet/WalletService.js';

export type {
  AuthEventType,
  AuthEvent
} from '../../application/services/AuthService.js';

// Utility functions for components
export const walletUtils = {
  /**
   * Format wallet address for display
   */
  formatAddress: (address: string, length: number = 6): string => {
    if (!address || address.length < 10) return address;
    const start = Math.min(length, address.length / 2);
    const end = Math.min(4, address.length / 2);
    return `${address.substring(0, start)}...${address.substring(address.length - end)}`;
  },

  /**
   * Format role name for display
   */
  formatRole: (role: string): string => {
    if (!role) return 'Unknown';
    return role.charAt(0).toUpperCase() + role.slice(1);
  },

  /**
   * Get role color for UI
   */
  getRoleColor: (role: string): string => {
    switch (role) {
      case 'student':
        return 'bg-blue-100 text-blue-800';
      case 'university':
        return 'bg-green-100 text-green-800';
      case 'knqa':
        return 'bg-purple-100 text-purple-800';
      case 'none':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  },

  /**
   * Get connection status color
   */
  getConnectionColor: (status: string): string => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'disconnected':
        return 'text-gray-600 bg-gray-100';
      case 'connecting':
        return 'text-blue-600 bg-blue-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  },

  /**
   * Check if address is valid Stacks address format
   */
  isValidStacksAddress: (address: string): boolean => {
    if (!address) return false;
    return /^S[TP][0-9A-Z]{39}$/.test(address);
  },

  /**
   * Detect network from address
   */
  getNetworkFromAddress: (address: string): 'mainnet' | 'testnet' | 'unknown' => {
    if (!address) return 'unknown';
    if (address.startsWith('SP')) return 'mainnet';
    if (address.startsWith('ST')) return 'testnet';
    return 'unknown';
  }
};

export default {
  WalletConnectionButton,
  WalletStatus,
  WalletGuard,
  withWalletGuard,
  useWalletGuard,
  walletUtils
};