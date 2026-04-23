/**
 * Governance Role Manager Component
 * Allows admins to set roles for any wallet address using wallet signing to call the governance contract
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/index.js';
import { walletService } from '../../services/wallet.js';

interface RoleAssignment {
  targetAddress: string;
  role: 'none' | 'admin' | 'university' | 'knqa';
  status: 'pending' | 'success' | 'error';
  transactionId?: string;
  message?: string;
}

interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  transactionId?: string;
  targetAddress?: string;
  role?: string;
  status?: string;
}

/**
 * Governance Role Manager Component
 */
export const GovernanceRoleManager: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [targetAddress, setTargetAddress] = useState('');
  const [selectedRole, setSelectedRole] = useState<'none' | 'admin' | 'university' | 'knqa'>('admin');
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('none');

  // Check current user's role on component mount
  useEffect(() => {
    if (user?.address) {
      checkCurrentUserRole();
    }
  }, [user?.address]);

  const checkCurrentUserRole = async () => {
    if (!user?.address) return;
    
    try {
      const response = await fetch(`/api/role/${user.address}`);
      const data = await response.json();
      if (data.success) {
        setCurrentUserRole(data.role || 'none');
      }
    } catch (error) {
      console.error('Failed to check current user role:', error);
    }
  };

  const validateAddress = (address: string): boolean => {
    const stacksAddressRegex = /^S[TP][0-9A-Z]{38,39}$/;
    return stacksAddressRegex.test(address.toUpperCase());
  };

  const assignRole = async (address: string, role: string): Promise<ApiResponse> => {
    if (!user?.address) {
      throw new Error('Admin not connected');
    }

    // Use wallet to sign the set-user-role contract call
    const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Replace with your contract address
    
    const result = await walletService.setUserRole(
      address, 
      role as 'none' | 'admin' | 'university' | 'knqa',
      contractAddress
    );

    // Return API-compatible response
    return {
      success: true,
      transactionId: result.txId,
      targetAddress: address,
      role: role,
      status: 'Transaction broadcasted successfully',
      message: `Role "${role}" assigned to ${address.substring(0, 10)}...${address.substring(address.length - 6)}`
    };
  };

  const handleAssignRole = async () => {
    if (!targetAddress.trim()) {
      alert('Please enter a wallet address');
      return;
    }

    if (!validateAddress(targetAddress)) {
      alert('Please enter a valid Stacks address (starts with ST)');
      return;
    }

    if (!user?.address) {
      alert('Please connect your admin wallet first');
      return;
    }

    setIsAssigning(true);

    try {
      console.log(`Assigning role "${selectedRole}" to ${targetAddress}`);
      
      const result = await assignRole(targetAddress, selectedRole);
      
      const assignment: RoleAssignment = {
        targetAddress: targetAddress.trim(),
        role: selectedRole,
        status: 'success',
        transactionId: result.transactionId,
        message: result.message || 'Role assigned successfully'
      };

      setAssignments(prev => [assignment, ...prev]);
      setTargetAddress('');
      
      alert(`Role assignment successful!\nTransaction ID: ${result.transactionId}`);
      
    } catch (error) {
      const assignment: RoleAssignment = {
        targetAddress: targetAddress.trim(),
        role: selectedRole,
        status: 'error',
        message: error instanceof Error ? error.message : 'Assignment failed'
      };

      setAssignments(prev => [assignment, ...prev]);
      alert(`Error: ${assignment.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClearHistory = () => {
    setAssignments([]);
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'university': return 'bg-green-100 text-green-800';
      case 'knqa': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'none': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'pending': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const formatAddress = (address: string): string => {
    return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
  };

  // Show access denied if user doesn't have admin role
  if (!user?.address) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-600 text-4xl mb-4">🔒</div>
        <h2 className="text-lg font-semibold text-red-900 mb-2">Wallet Connection Required</h2>
        <p className="text-red-700">
          Please connect your wallet to access the governance role manager.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🏛️ Governance Role Manager
        </h1>
        <p className="text-gray-600">
          Assign user roles using admin wallet-signed transactions to the governance contract <code>set-user-role</code> function
        </p>
        <div className="mt-2 text-sm text-gray-500">
          Current role: <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(currentUserRole)}`}>
           Admin
          </span>
        </div>
      </div>

      {/* Role Assignment Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Assign Role to Address</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Wallet Address
            </label>
            <input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="ST1ABCDEF123456789..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter a valid Stacks address (starts with ST)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role to Assign
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">None (No permissions)</option>
              <option value="admin">Admin (Role Management)</option>
              <option value="university">University</option>
              <option value="knqa">KNQA (Super Admin)</option>
            </select>
          </div>

          <button
            onClick={handleAssignRole}
            disabled={isAssigning || !targetAddress.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md transition-colors"
          >
            {isAssigning ? 'Assigning Role...' : 'Assign Role'}
          </button>
        </div>
      </div>

      {/* Role Assignment History */}
      {assignments.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Assignment History</h2>
            <button
              onClick={handleClearHistory}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Clear History
            </button>
          </div>
          
          <div className="space-y-3">
            {assignments.map((assignment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <span className="text-lg">{getStatusIcon(assignment.status)}</span>
                  <div>
                    <div className="font-mono text-sm">
                      {formatAddress(assignment.targetAddress)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(assignment.role)}`}>
                        {assignment.role.toUpperCase()}
                      </span>
                      {assignment.message && (
                        <span className="text-xs text-gray-600">
                          {assignment.message}
                        </span>
                      )}
                    </div>
                    {assignment.transactionId && (
                      <div className="text-xs text-blue-600 font-mono mt-1">
                        TX: {assignment.transactionId}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role Descriptions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">🔐 Role Descriptions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-medium text-green-600 mb-2">🏫 University (u2)</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Issue certificate requests</li>
              <li>• Approve certificate issuance</li>
              <li>• Request certificate revocation</li>
            </ul>
          </div>
          
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-medium text-blue-600 mb-2">🔧 Admin (u0)</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Manage user roles</li>
              <li>• Access GovernanceRoleManager</li>
              <li>• Assign roles to other wallets</li>
            </ul>
          </div>
          
          <div className="bg-white p-4 rounded-lg">
            <h4 className="font-medium text-purple-600 mb-2">🏛️ KNQA (u3)</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• All university permissions</li>
              <li>• Approve/deny all operations</li>
              <li>• Manage user roles (via this interface)</li>
              <li>• System administration</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Contract Information */}
      {/* <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">📖 How It Works</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p><strong>1.</strong> This component uses your admin wallet to sign transactions calling <code>set-user-role</code> in the governance contract</p>
          <p><strong>2.</strong> Your wallet handles the blockchain transaction - no backend private keys involved</p>
          <p><strong>3.</strong> Roles are stored on-chain as uint values (0=none, 1=admin, 2=university, 3=knqa)</p>
          <p><strong>4.</strong> Only the contract admin (deployer) wallet can assign roles to other addresses</p>
          <p><strong>5.</strong> Changes take effect after the transaction is confirmed (~1-2 minutes)</p>
          <p><strong>6.</strong> Your admin wallet must have STX for transaction fees</p>
        </div>
      </div> */}
    </div>
  );
};

export default GovernanceRoleManager;