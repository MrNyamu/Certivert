/**
 * Wallet Guard Component
 * Protects routes/components that require wallet connection and specific roles
 */

import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/index.js';
import type { SerializedUser } from '../../types/index.js';
import WalletConnectionButton from './WalletConnectionButton.js';

interface WalletGuardProps {
  children: React.ReactNode;
  requiredRole?: 'student' | 'university' | 'knqa';
  requiredPermissions?: string[];
  fallback?: React.ReactNode;
  showConnectButton?: boolean;
  className?: string;
}

/**
 * Wallet Guard Component
 * Conditionally renders children based on wallet connection and user permissions
 */
export const WalletGuard: React.FC<WalletGuardProps> = ({
  children,
  requiredRole,
  requiredPermissions = [],
  fallback,
  showConnectButton = true,
  className = ''
}) => {
  const { isConnected, user, connectionStatus, error } = useSelector(
    (state: RootState) => state.auth
  );

  const checkRoleRequirement = (user: SerializedUser): boolean => {
    if (!requiredRole) return true;

    switch (requiredRole) {
      case 'student':
        return user.isStudent;
      case 'university':
        return user.isUniversity;
      case 'knqa':
        return user.isKNQA;
      default:
        return false;
    }
  };

  const checkPermissionRequirements = (user: SerializedUser): boolean => {
    if (requiredPermissions.length === 0) return true;
    return requiredPermissions.every(permission => 
      user.permissions.includes(permission)
    );
  };

  const getMissingPermissions = (user: SerializedUser): string[] => {
    return requiredPermissions.filter(permission => 
      !user.permissions.includes(permission)
    );
  };

  const formatRole = (role: string): string => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const formatPermission = (permission: string): string => {
    return permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Show loading state during connection
  if (connectionStatus === 'connecting') {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
          <span className="text-gray-600">Connecting wallet...</span>
        </div>
      </div>
    );
  }

  // Show connection error
  if (connectionStatus === 'error' && error) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <div className="text-center max-w-md">
          <div className="mb-4">
            <span className="text-4xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Connection Failed
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            {error}
          </p>
          {showConnectButton && (
            <WalletConnectionButton 
              variant="primary"
              className="mx-auto"
            />
          )}
        </div>
      </div>
    );
  }

  // Show wallet connection required
  if (!isConnected) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <div className="text-center max-w-md">
          <div className="mb-4">
            <span className="text-4xl">🔗</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Wallet Connection Required
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            Please connect your Xverse wallet to access this feature.
            {requiredRole && (
              <span className="block mt-2 font-medium">
                This feature requires a {formatRole(requiredRole)} role.
              </span>
            )}
          </p>
          {showConnectButton && (
            <WalletConnectionButton 
              variant="primary"
              className="mx-auto"
            />
          )}
        </div>
      </div>
    );
  }

  // User is connected but we don't have user data yet
  if (!user) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
          <span className="text-gray-600">Loading user profile...</span>
        </div>
      </div>
    );
  }

  // Check role requirements
  if (requiredRole && !checkRoleRequirement(user)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <div className="text-center max-w-md">
          <div className="mb-4">
            <span className="text-4xl">🚫</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Insufficient Role
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            This feature requires a <span className="font-medium">{formatRole(requiredRole)}</span> role.
            You are currently connected as <span className="font-medium">{formatRole(user.role)}</span>.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Need the right role?</p>
            <p>Contact your administrator or connect with a different wallet that has the required permissions.</p>
          </div>
        </div>
      </div>
    );
  }

  // Check permission requirements
  if (requiredPermissions.length > 0 && !checkPermissionRequirements(user)) {
    const missingPermissions = getMissingPermissions(user);

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <div className="text-center max-w-md">
          <div className="mb-4">
            <span className="text-4xl">🔐</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Insufficient Permissions
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            You don't have the required permissions to access this feature.
          </p>
          
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <p className="font-medium text-red-800 text-sm mb-2">Missing Permissions:</p>
            <div className="space-y-1">
              {missingPermissions.map((permission, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm text-red-700">
                  <span>•</span>
                  <span>{formatPermission(permission)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Current Role:</p>
            <p className="mb-2">{formatRole(user.role)}</p>
            {user.permissions.length > 0 && (
              <>
                <p className="font-medium mb-1">Available Permissions:</p>
                <div className="flex flex-wrap gap-1">
                  {user.permissions.map((permission, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {formatPermission(permission)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // All checks passed - render children
  return <>{children}</>;
};

// Higher-order component version
export const withWalletGuard = <P extends object>(
  Component: React.ComponentType<P>,
  guardProps: Omit<WalletGuardProps, 'children'>
) => {
  return (props: P) => (
    <WalletGuard {...guardProps}>
      <Component {...props} />
    </WalletGuard>
  );
};

// Hook for checking wallet guard conditions
export const useWalletGuard = (
  requiredRole?: 'student' | 'university' | 'knqa',
  requiredPermissions: string[] = []
) => {
  const { isConnected, user } = useSelector(
    (state: RootState) => state.auth
  );

  if (!isConnected || !user) {
    return {
      canAccess: false,
      reason: 'not_connected',
      message: 'Wallet not connected'
    };
  }

  if (requiredRole) {
    const hasRole = (() => {
      switch (requiredRole) {
        case 'student':
          return user.isStudent;
        case 'university':
          return user.isUniversity;
        case 'knqa':
          return user.isKNQA;
        default:
          return false;
      }
    })();

    if (!hasRole) {
      return {
        canAccess: false,
        reason: 'insufficient_role',
        message: `Requires ${requiredRole} role`,
        currentRole: user.role
      };
    }
  }

  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission => 
      user.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(permission => 
        !user.permissions.includes(permission)
      );

      return {
        canAccess: false,
        reason: 'insufficient_permissions',
        message: 'Missing required permissions',
        missingPermissions
      };
    }
  }

  return {
    canAccess: true,
    reason: 'authorized',
    message: 'Access granted'
  };
};

export default WalletGuard;