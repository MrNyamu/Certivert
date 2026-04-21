/**
 * Wallet Demo Component
 * Demonstrates the Xverse wallet integration features
 */

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  WalletConnectionButton, 
  WalletStatus, 
  WalletGuard,
  useWalletGuard,
  walletUtils 
} from '../wallet/index.js';
import { 
  connectWallet, 
  disconnectWallet, 
  updateUserProfile,
  selectIsConnected,
  selectUser,
  selectConnectionStatus
} from '../../store/slices/authSlice.js';
import type { RootState } from '../../store/index.js';

/**
 * Wallet Demo Component
 */
export const WalletDemo: React.FC = () => {
  const dispatch = useDispatch();
  const isConnected = useSelector(selectIsConnected);
  const user = useSelector(selectUser);
  const connectionStatus = useSelector(selectConnectionStatus);
  
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    institution: ''
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Wallet guard hook example
  const studentAccess = useWalletGuard('student');
  const universityAccess = useWalletGuard('university');
  const knqaAccess = useWalletGuard('knqa');

  // Load user profile data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        institution: user.institution || ''
      });
    }
  }, [user]);

  const handleProfileUpdate = async () => {
    setIsUpdatingProfile(true);
    try {
      await dispatch(updateUserProfile(profileData)).unwrap();
      alert('Profile updated successfully!');
    } catch (error) {
      alert(`Profile update failed: ${error}`);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleTestAction = (action: string, requiredRole?: string) => {
    if (requiredRole) {
      alert(`Testing ${action} action (requires ${requiredRole} role)`);
    } else {
      alert(`Testing ${action} action`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🔗 Xverse Wallet Integration Demo
        </h1>
        <p className="text-gray-600 mb-8">
          Demonstrates the Certivert wallet connection features with Xverse wallet
        </p>
      </div>

      {/* Connection Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Wallet Connection</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${walletUtils.getConnectionColor(connectionStatus)}`}>
                {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
              </span>
            </div>

            {user && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Address:</span>
                  <span className="text-xs font-mono text-gray-600">
                    {walletUtils.formatAddress(user.address, 8)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Role:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${walletUtils.getRoleColor(user.role)}`}>
                    {walletUtils.formatRole(user.role)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Network:</span>
                  <span className="text-xs text-gray-600">
                    {walletUtils.getNetworkFromAddress(user.address).toUpperCase()}
                  </span>
                </div>
              </>
            )}

            <div className="pt-4 border-t border-gray-100">
              <WalletConnectionButton 
                size="medium"
                variant="primary"
                showAddress={true}
                showRole={true}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">System Status</h2>
          <WalletStatus showDetails={true} />
        </div>
      </div>

      {/* Profile Management Section */}
      <WalletGuard fallback={
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-gray-600">Connect your wallet to manage your profile</p>
        </div>
      }>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Profile Management</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Institution
              </label>
              <input
                type="text"
                value={profileData.institution}
                onChange={(e) => setProfileData(prev => ({ ...prev, institution: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your institution name"
              />
            </div>

            <div className="md:col-span-2">
              <button
                onClick={handleProfileUpdate}
                disabled={isUpdatingProfile}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </div>
        </div>
      </WalletGuard>

      {/* Role-Based Actions Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Role-Based Actions Demo</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Student Actions */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-600 mb-2">👨‍🎓 Student Actions</h3>
            <div className="space-y-2">
              <div className="text-xs text-gray-600 mb-2">
                Access: {studentAccess.canAccess ? '✅ Granted' : '❌ Denied'}
                {!studentAccess.canAccess && (
                  <span className="block text-red-600">{studentAccess.reason}</span>
                )}
              </div>
              
              <WalletGuard requiredRole="student">
                <button
                  onClick={() => handleTestAction('View Certificates', 'student')}
                  className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded text-sm transition-colors"
                >
                  View My Certificates
                </button>
                <button
                  onClick={() => handleTestAction('Download Certificate', 'student')}
                  className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded text-sm transition-colors"
                >
                  Download Certificate
                </button>
              </WalletGuard>
            </div>
          </div>

          {/* University Actions */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-green-600 mb-2">🏫 University Actions</h3>
            <div className="space-y-2">
              <div className="text-xs text-gray-600 mb-2">
                Access: {universityAccess.canAccess ? '✅ Granted' : '❌ Denied'}
                {!universityAccess.canAccess && (
                  <span className="block text-red-600">{universityAccess.reason}</span>
                )}
              </div>
              
              <WalletGuard requiredRole="university">
                <button
                  onClick={() => handleTestAction('Issue Certificate', 'university')}
                  className="w-full bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded text-sm transition-colors"
                >
                  Issue Certificate
                </button>
                <button
                  onClick={() => handleTestAction('Revoke Certificate', 'university')}
                  className="w-full bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded text-sm transition-colors"
                >
                  Revoke Certificate
                </button>
              </WalletGuard>
            </div>
          </div>

          {/* KNQA Actions */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-purple-600 mb-2">🏛️ KNQA Actions</h3>
            <div className="space-y-2">
              <div className="text-xs text-gray-600 mb-2">
                Access: {knqaAccess.canAccess ? '✅ Granted' : '❌ Denied'}
                {!knqaAccess.canAccess && (
                  <span className="block text-red-600">{knqaAccess.reason}</span>
                )}
              </div>
              
              <WalletGuard requiredRole="knqa">
                <button
                  onClick={() => handleTestAction('System Audit', 'knqa')}
                  className="w-full bg-purple-100 hover:bg-purple-200 text-purple-800 px-3 py-2 rounded text-sm transition-colors"
                >
                  System Audit
                </button>
                <button
                  onClick={() => handleTestAction('Manage Universities', 'knqa')}
                  className="w-full bg-purple-100 hover:bg-purple-200 text-purple-800 px-3 py-2 rounded text-sm transition-colors"
                >
                  Manage Universities
                </button>
              </WalletGuard>
            </div>
          </div>
        </div>

        {/* Public Actions */}
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h3 className="font-medium text-gray-600 mb-3">🌍 Public Actions (No wallet required)</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTestAction('Verify Certificate')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm transition-colors"
            >
              Verify Certificate
            </button>
            <button
              onClick={() => handleTestAction('Browse Public Certificates')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm transition-colors"
            >
              Browse Public Certificates
            </button>
          </div>
        </div>
      </div>

      {/* Current User Info */}
      {user && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">Current User Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800">Display Name:</span>
              <span className="ml-2 text-blue-700">{user.displayName}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Role:</span>
              <span className="ml-2 text-blue-700">{walletUtils.formatRole(user.role)}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Address:</span>
              <span className="ml-2 font-mono text-blue-700">{user.address}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Network:</span>
              <span className="ml-2 text-blue-700">
                {walletUtils.getNetworkFromAddress(user.address).toUpperCase()}
              </span>
            </div>
            <div className="md:col-span-2">
              <span className="font-medium text-blue-800">Permissions:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {user.permissions.length > 0 ? (
                  user.permissions.map((permission, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {permission.replace('_', ' ')}
                    </span>
                  ))
                ) : (
                  <span className="text-blue-700">No specific permissions</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🚀 How to Use</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Click "Connect Wallet" to connect your Xverse wallet</li>
          <li>Your role will be determined by your wallet address from the backend</li>
          <li>Try different actions based on your role permissions</li>
          <li>Update your profile information (requires wallet connection)</li>
          <li>View system status and blockchain information</li>
          <li>Observe how role-based access control works</li>
        </ol>
        
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-xs text-yellow-800">
            <strong>Note:</strong> This is a demo component. In a production app, these actions would 
            interact with real API endpoints and blockchain contracts.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletDemo;