/**
 * Connect Wallet Component
 * Modern Redux-based wallet connection with navigation
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { 
  WalletIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

// Redux imports
import type { AppDispatch, RootState } from '../../store/index.js';
import { 
  connectWallet,
  clearError,
  selectIsConnected,
  selectUser,
  selectConnectionStatus,
  selectAuthError
} from '../../store/slices/authSlice.js';

// Import GovernanceRoleManager
import GovernanceRoleManager from '../admin/GovernanceRoleManager.js';

const ConnectWallet: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  
  // Redux state
  const isConnected = useSelector((state: RootState) => selectIsConnected(state));
  const user = useSelector((state: RootState) => selectUser(state));
  const connectionStatus = useSelector((state: RootState) => selectConnectionStatus(state));
  const error = useSelector((state: RootState) => selectAuthError(state));


  // Auto-navigate when connected - DISABLED to show GovernanceRoleManager
  // useEffect(() => {
  //   if (isConnected && user) {
  //     // Role-based navigation
  //     switch (user.role) {
  //       case 'university':
  //         navigate('/dashboard/university');
  //         break;
  //       case 'knqa':
  //         navigate('/dashboard/knqa');
  //         break;
  //       case 'student':
  //         navigate('/dashboard/student');
  //         break;
  //       default:
  //         // If no role or unrecognized role, go to verification
  //         navigate('/verify');
  //         break;
  //     }
  //   }
  // }, [isConnected, user, navigate]);

  // Handle wallet connection
  const handleConnect = async () => {
    if (error) {
      dispatch(clearError());
    }
    
    try {
      await dispatch(connectWallet()).unwrap();
    } catch (error) {
      // Error is handled by Redux state
      console.error('Wallet connection failed:', error);
    }
  };

  const isLoading = connectionStatus === 'connecting';

  // Handle navigation effects at the top level (Rules of Hooks)
  useEffect(() => {
    if (isConnected && user) {
      // University/KNQA users get admin dashboard
      if (user.role === 'university' || user.role === 'knqa') {
        navigate('/dashboard/university');
        return;
      }

      // Admin role gets GovernanceRoleManager (don't navigate, will be handled by conditional render)
      if (user.role === 'admin') {
        // Stay on current page to show GovernanceRoleManager
        return;
      }

      // Users with no role get dashboard where DashboardRouter will handle them  
      if (user.role === 'none' || !user.role) {
        navigate('/dashboard');
        return;
      }

      // Students and other roles get verification screen
      if (user.role === 'student') {
        navigate('/verify');
        return;
      }

      // For any other cases, redirect to dashboard for proper routing
      navigate('/dashboard');
    }
  }, [isConnected, user, navigate]);

  // If connected, check user role and show appropriate content
  if (isConnected && user) {
    // Admin role (u1) gets GovernanceRoleManager
    if (user.role === 'admin') {
      return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  🏛️ Certivert Admin
                </h1>
                <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  ROLE SETUP
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Connected as</div>
                  <div className="font-semibold text-gray-900">
                    {user.address.slice(0, 8)}...{user.address.slice(-6)}
                  </div>
                  <div className="text-xs text-gray-400">Current Role: {user.role}</div>
                </div>
                <button
                  onClick={() => navigate('/verify')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium underline"
                >
                  Go to Verification
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <GovernanceRoleManager />
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-sm text-gray-500">
              <p>Certivert Role Management System</p>
              <p className="mt-1">
                Set user roles via wallet-signed transactions to the governance contract
              </p>
            </div>
          </div>
        </footer>
      </div>
      );
    }

    // For all other connected users, show loading while navigation happens
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 flex items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full opacity-20 blur-3xl" />
      </div>

      <div className="w-full max-w-md px-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            {/* Logo/Icon */}
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <WalletIcon className="h-8 w-8 text-blue-600" />
            </div>
            
            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Connect to Certivert
            </h1>
            
            {/* Subtitle */}
            <p className="text-gray-600 text-sm leading-relaxed">
              Blockchain-anchored certificate verification for Kenya's universities and employers
            </p>
          </div>

          {/* Connection Status */}
          {isConnected && user && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">Connected Successfully</p>
                  <p className="text-xs text-green-700">
                    Role: {user.role} • {user.address.slice(0, 8)}...{user.address.slice(-6)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Redirecting to dashboard...</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Connection Failed</p>
                  <p className="text-xs text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}


          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={isLoading || isConnected}
            className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : isConnected ? (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WalletIcon className="h-5 w-5" />
                <span>Connect Stacks Wallet</span>
              </>
            )}
          </button>


          {/* Helper Text */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 leading-relaxed">
              Requires Hiro Wallet or Leather • No account needed
            </p>
            
            {/* Demo Instructions */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Demo Mode:</strong> Connect any wallet to access the University Admin Dashboard
              </p>
            </div>
          </div>

          {/* Wallet Not Found */}
          {!isLoading && !isConnected && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Don't have a Stacks wallet?</h3>
              <div className="space-y-2">
                <a 
                  href="https://wallet.hiro.so/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  → Download Hiro Wallet
                </a>
                <a 
                  href="https://leather.io/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  → Download Leather Wallet
                </a>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-start space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0" />
              <p className="text-xs text-gray-600 leading-relaxed">
                Secured by Bitcoin blockchain through Stacks. Your private keys never leave your wallet.
              </p>
            </div>
          </div>
        </div>

        {/* Public Access */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Need to verify a certificate?</p>
          <button
            onClick={() => navigate('/verify')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium underline"
          >
            Try Public Verification
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectWallet;