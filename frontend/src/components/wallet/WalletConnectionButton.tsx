/**
 * Wallet Connection Button Component
 * Main button component for connecting/disconnecting Xverse wallet
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { connectWallet, disconnectWallet, restoreSession } from '../../store/slices/authSlice.js';
import type { RootState } from '../../store/index.js';
import type { SerializedUser } from '../../types/index.js';

interface WalletConnectionButtonProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'outline';
  showAddress?: boolean;
  showRole?: boolean;
  onConnectionChange?: (isConnected: boolean, user?: SerializedUser) => void;
}

/**
 * Wallet Connection Button Component
 */
export const WalletConnectionButton: React.FC<WalletConnectionButtonProps> = ({
  className = '',
  size = 'medium',
  variant = 'primary',
  showAddress = true,
  showRole = true,
  onConnectionChange
}) => {
  const dispatch = useDispatch();
  const { isConnected, user, connectionStatus, error } = useSelector(
    (state: RootState) => state.auth
  );

  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Restore session on component mount
  useEffect(() => {
    if (!isConnected && connectionStatus === 'idle') {
      dispatch(restoreSession());
    }
  }, [dispatch, isConnected, connectionStatus]);

  // Notify parent of connection changes
  useEffect(() => {
    if (onConnectionChange) {
      onConnectionChange(isConnected, user || undefined);
    }
  }, [isConnected, user, onConnectionChange]);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await dispatch(connectWallet()).unwrap();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setShowDropdown(false);
    try {
      await dispatch(disconnectWallet()).unwrap();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'px-3 py-1.5 text-sm';
      case 'large':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2 text-base';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-gray-600 hover:bg-gray-700 text-white';
      case 'outline':
        return 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  const truncateAddress = (address: string): string => {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatRole = (role: string): string => {
    if (!role) return '';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Show loading state
  if (connectionStatus === 'connecting' || isLoading) {
    return (
      <button
        disabled
        className={`
          ${getSizeClasses()} 
          ${getVariantClasses()}
          rounded-lg font-medium transition-all duration-200
          opacity-70 cursor-not-allowed flex items-center space-x-2
          ${className}
        `}
      >
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        <span>Connecting...</span>
      </button>
    );
  }

  // Show error state
  if (error && connectionStatus === 'error') {
    return (
      <div className={`flex flex-col space-y-2 ${className}`}>
        <button
          onClick={handleConnect}
          className={`
            ${getSizeClasses()} 
            bg-red-600 hover:bg-red-700 text-white
            rounded-lg font-medium transition-all duration-200
            flex items-center space-x-2
          `}
        >
          <span>⚠️ Connection Failed</span>
        </button>
        <p className="text-xs text-red-600 max-w-xs">{error}</p>
      </div>
    );
  }

  // Connected state - show user info with dropdown
  if (isConnected && user) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`
            ${getSizeClasses()}
            bg-green-600 hover:bg-green-700 text-white
            rounded-lg font-medium transition-all duration-200
            flex items-center space-x-2 max-w-xs
          `}
        >
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
            <div className="flex flex-col items-start min-w-0">
              {showAddress && (
                <span className="text-xs font-mono truncate">
                  {truncateAddress(user.address)}
                </span>
              )}
              {showRole && user.role !== 'none' && (
                <span className="text-xs opacity-90">
                  {formatRole(user.role)}
                </span>
              )}
              {(!showAddress && !showRole) || user.role === 'none' ? (
                <span>Connected</span>
              ) : null}
            </div>
          </div>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">
                    {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.displayName || 'Unknown User'}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    {truncateAddress(user.address)}
                  </p>
                </div>
              </div>
              {user.role !== 'none' && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {formatRole(user.role)}
                  </span>
                </div>
              )}
            </div>
            
            <div className="p-2">
              {user.institution && (
                <div className="px-3 py-2 text-xs text-gray-600">
                  <span className="font-medium">Institution:</span> {user.institution}
                </div>
              )}
              {user.email && (
                <div className="px-3 py-2 text-xs text-gray-600">
                  <span className="font-medium">Email:</span> {user.email}
                </div>
              )}
              
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors duration-150"
              >
                {isLoading ? 'Disconnecting...' : 'Disconnect Wallet'}
              </button>
            </div>
          </div>
        )}

        {/* Backdrop to close dropdown */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  // Disconnected state - show connect button
  return (
    <button
      onClick={handleConnect}
      className={`
        ${getSizeClasses()} 
        ${getVariantClasses()}
        rounded-lg font-medium transition-all duration-200
        flex items-center space-x-2 hover:transform hover:scale-105
        ${className}
      `}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
      <span>Connect Wallet</span>
    </button>
  );
};

export default WalletConnectionButton;