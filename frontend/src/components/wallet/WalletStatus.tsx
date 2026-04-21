/**
 * Wallet Status Component
 * Displays comprehensive wallet and network status information
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/index.js';
import type { ConnectionStatus, BlockchainStatus } from '../../types/index.js';
import { authService } from '../../application/services/AuthService.js';

interface WalletStatusProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

interface SystemStatus {
  connection: ConnectionStatus;
  blockchain?: BlockchainStatus;
  wallet: {
    connected: boolean;
    address?: string;
    network: string;
  };
}

/**
 * Wallet Status Component
 */
export const WalletStatus: React.FC<WalletStatusProps> = ({
  className = '',
  showDetails = false,
  compact = false
}) => {
  const { isConnected, user, connectionStatus } = useSelector(
    (state: RootState) => state.auth
  );

  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch system status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        const status = await authService.getSystemStatus();
        setSystemStatus(status);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Failed to fetch system status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();

    // Update status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'disconnected':
        return 'text-red-600 bg-red-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'disconnected':
        return '🔴';
      case 'error':
        return '⚠️';
      default:
        return '🟡';
    }
  };

  const formatBlockHeight = (height: number): string => {
    return height.toLocaleString();
  };

  const formatNetwork = (network: string): string => {
    return network.charAt(0).toUpperCase() + network.slice(1);
  };

  const getTimeSinceUpdate = (): string => {
    const diff = Date.now() - lastUpdated.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
      return 'Just now';
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ago`;
    } else {
      return `${Math.floor(seconds / 3600)}h ago`;
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
        <span className="text-sm text-gray-600">Loading status...</span>
      </div>
    );
  }

  // Compact view
  if (compact) {
    const walletStatus = isConnected ? 'connected' : 'disconnected';
    const apiStatus = systemStatus?.connection.api || 'disconnected';
    const blockchainStatus = systemStatus?.connection.blockchain || 'disconnected';

    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className="flex items-center space-x-1">
          <span className="text-xs">{getStatusIcon(walletStatus)}</span>
          <span className="text-xs text-gray-600">Wallet</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-xs">{getStatusIcon(apiStatus)}</span>
          <span className="text-xs text-gray-600">API</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-xs">{getStatusIcon(blockchainStatus)}</span>
          <span className="text-xs text-gray-600">Blockchain</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">System Status</h3>
        <span className="text-xs text-gray-500">
          Updated {getTimeSinceUpdate()}
        </span>
      </div>

      {/* Wallet Status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm">{getStatusIcon(isConnected ? 'connected' : 'disconnected')}</span>
            <span className="text-sm font-medium">Wallet</span>
          </div>
          <div className="flex flex-col items-end">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(isConnected ? 'connected' : 'disconnected')}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {systemStatus?.wallet.network && (
              <span className="text-xs text-gray-500 mt-1">
                {formatNetwork(systemStatus.wallet.network)}
              </span>
            )}
          </div>
        </div>

        {/* API Status */}
        {systemStatus && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm">{getStatusIcon(systemStatus.connection.api)}</span>
              <span className="text-sm font-medium">API</span>
            </div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemStatus.connection.api)}`}>
              {systemStatus.connection.api.charAt(0).toUpperCase() + systemStatus.connection.api.slice(1)}
            </span>
          </div>
        )}

        {/* Blockchain Status */}
        {systemStatus && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm">{getStatusIcon(systemStatus.connection.blockchain)}</span>
              <span className="text-sm font-medium">Blockchain</span>
            </div>
            <div className="flex flex-col items-end">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemStatus.connection.blockchain)}`}>
                {systemStatus.connection.blockchain.charAt(0).toUpperCase() + systemStatus.connection.blockchain.slice(1)}
              </span>
              {systemStatus.blockchain && (
                <span className="text-xs text-gray-500 mt-1">
                  Block {formatBlockHeight(systemStatus.blockchain.blockHeight)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* IPFS Status */}
        {systemStatus && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm">{getStatusIcon(systemStatus.connection.ipfs)}</span>
              <span className="text-sm font-medium">IPFS</span>
            </div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemStatus.connection.ipfs)}`}>
              {systemStatus.connection.ipfs.charAt(0).toUpperCase() + systemStatus.connection.ipfs.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* Detailed Information */}
      {showDetails && systemStatus && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <h4 className="text-xs font-medium text-gray-900 mb-2">Details</h4>
          <div className="space-y-2 text-xs text-gray-600">
            {systemStatus.wallet.address && (
              <div className="flex justify-between">
                <span>Wallet Address:</span>
                <span className="font-mono">
                  {systemStatus.wallet.address.substring(0, 8)}...
                  {systemStatus.wallet.address.substring(systemStatus.wallet.address.length - 4)}
                </span>
              </div>
            )}
            {systemStatus.blockchain && (
              <>
                <div className="flex justify-between">
                  <span>Network:</span>
                  <span>{formatNetwork(systemStatus.blockchain.network)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Block Height:</span>
                  <span>{formatBlockHeight(systemStatus.blockchain.blockHeight)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bitcoin Height:</span>
                  <span>{formatBlockHeight(systemStatus.blockchain.burnBlockHeight)}</span>
                </div>
                {systemStatus.blockchain.version && (
                  <div className="flex justify-between">
                    <span>Node Version:</span>
                    <span>{systemStatus.blockchain.version}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Sync Status:</span>
                  <span className={systemStatus.blockchain.isFullySynced ? 'text-green-600' : 'text-yellow-600'}>
                    {systemStatus.blockchain.isFullySynced ? 'Synced' : 'Syncing'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Connection Issues Warning */}
      {systemStatus && (
        Object.values(systemStatus.connection).some(status => status !== 'connected') && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            <div className="flex items-start space-x-1">
              <span>⚠️</span>
              <div>
                <p className="font-medium">Connection Issues Detected</p>
                <p className="mt-1">
                  Some services may be unavailable. Check your internet connection and try refreshing.
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* User Role Information */}
      {user && user.role !== 'none' && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-blue-600 font-medium">Role:</span>
            <span className="text-blue-800">{formatNetwork(user.role)}</span>
          </div>
          {user.permissions.length > 0 && (
            <div className="mt-1">
              <span className="text-blue-600 font-medium">Permissions:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {user.permissions.slice(0, 3).map((permission, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {permission.replace('_', ' ')}
                  </span>
                ))}
                {user.permissions.length > 3 && (
                  <span className="text-blue-600">+{user.permissions.length - 3} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WalletStatus;