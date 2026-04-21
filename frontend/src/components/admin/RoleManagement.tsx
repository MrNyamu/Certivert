/**
 * Self-Service Role Management Component
 * Allows users to assign roles to wallet addresses
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { WalletGuard, walletUtils } from '../wallet/index.js';
import type { RootState } from '../../store/index.js';

interface RoleAssignment {
  address: string;
  role: 'student' | 'university' | 'knqa' | 'none';
  status: 'pending' | 'success' | 'error';
  message?: string;
}

interface ExistingRole {
  address: string;
  role: string;
  assignedAt: string;
}

/**
 * Role Management Component
 */
export const RoleManagement: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [newAssignment, setNewAssignment] = useState<{
    address: string;
    role: 'student' | 'university' | 'knqa' | 'none';
  }>({
    address: '',
    role: 'student'
  });

  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [existingRoles, setExistingRoles] = useState<ExistingRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  // Load existing roles on component mount
  useEffect(() => {
    loadExistingRoles();
  }, []);

  const loadExistingRoles = async () => {
    try {
      setIsLoadingExisting(true);
      // This would call your backend API to get existing roles
      // For demo purposes, showing the configured addresses
      const roles: ExistingRole[] = [
        {
          address: 'ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50',
          role: 'university',
          assignedAt: new Date().toISOString()
        },
        {
          address: 'ST2Y2SFNVZBT8SSZ00XXKH930MCN0RFREB2GQG7CJ',
          role: 'knqa',
          assignedAt: new Date().toISOString()
        },
        {
          address: 'STPJ2HPED2TMR1HAFBFA5VQF986CRD4ZWHH36F6X',
          role: 'student',
          assignedAt: new Date().toISOString()
        }
      ];
      setExistingRoles(roles);
    } catch (error) {
      console.error('Failed to load existing roles:', error);
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const validateAddress = (address: string): boolean => {
    return walletUtils.isValidStacksAddress(address);
  };

  const assignRole = async (address: string, role: string) => {
    if (!validateAddress(address)) {
      throw new Error('Invalid Stacks address format');
    }

    // In a real implementation, this would call the backend API
    // For demo purposes, we'll simulate the blockchain transaction
    
    // Step 1: Call backend API to assign role
    const response = await fetch('/api/admin/assign-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: user?.address, // Admin's address
        targetAddress: address,
        role
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to assign role');
    }

    const result = await response.json();
    return result;
  };

  const handleAddAssignment = () => {
    const { address, role } = newAssignment;

    if (!address.trim()) {
      alert('Please enter a wallet address');
      return;
    }

    if (!validateAddress(address)) {
      alert('Please enter a valid Stacks address (starts with ST)');
      return;
    }

    // Check if address already exists in assignments
    const existsInAssignments = assignments.some(a => a.address === address);
    const existsInExisting = existingRoles.some(r => r.address === address);

    if (existsInAssignments) {
      alert('Address is already in the assignment queue');
      return;
    }

    if (existsInExisting) {
      const confirmUpdate = window.confirm(
        `Address ${walletUtils.formatAddress(address)} already has a role. Update it to ${role}?`
      );
      if (!confirmUpdate) return;
    }

    // Add to assignments queue
    const assignment: RoleAssignment = {
      address: address.trim(),
      role,
      status: 'pending'
    };

    setAssignments(prev => [...prev, assignment]);
    setNewAssignment({ address: '', role: 'student' });
  };

  const handleExecuteAssignments = async () => {
    setIsLoading(true);
    
    try {
      const updatedAssignments = [...assignments];
      
      for (let i = 0; i < updatedAssignments.length; i++) {
        const assignment = updatedAssignments[i];
        
        if (assignment.status !== 'pending') continue;

        try {
          console.log(`Assigning role "${assignment.role}" to ${assignment.address}`);
          
          // This is where you would call the actual blockchain transaction
          await assignRole(assignment.address, assignment.role);
          
          updatedAssignments[i] = {
            ...assignment,
            status: 'success',
            message: `Role "${assignment.role}" assigned successfully`
          };

          // Add a small delay between transactions
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          updatedAssignments[i] = {
            ...assignment,
            status: 'error',
            message: error instanceof Error ? error.message : 'Assignment failed'
          };
        }

        // Update UI with current progress
        setAssignments([...updatedAssignments]);
      }

      // Refresh existing roles after all assignments
      setTimeout(loadExistingRoles, 3000);

    } catch (error) {
      console.error('Assignment execution failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAssignment = (index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearCompleted = () => {
    setAssignments(prev => prev.filter(a => a.status === 'pending'));
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'university': return 'bg-green-100 text-green-800';
      case 'knqa': return 'bg-purple-100 text-purple-800';
      case 'student': return 'bg-blue-100 text-blue-800';
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

  return (
    <WalletGuard requiredRole="knqa" fallback={
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-600 text-4xl mb-4">🔒</div>
        <h2 className="text-lg font-semibold text-red-900 mb-2">Admin Access Required</h2>
        <p className="text-red-700">
          Role management requires KNQA (admin) permissions. 
          Please connect with an admin wallet to access this feature.
        </p>
      </div>
    }>
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🛠️ Role Management
          </h1>
          <p className="text-gray-600">
            Assign roles to wallet addresses for the Certivert system
          </p>
        </div>

        {/* Add New Role Assignment */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Add New Role Assignment</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Wallet Address
              </label>
              <input
                type="text"
                value={newAssignment.address}
                onChange={(e) => setNewAssignment(prev => ({ ...prev, address: e.target.value }))}
                placeholder="ST1ABCDEF123456789..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a valid Stacks address (starts with ST)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={newAssignment.role}
                onChange={(e) => setNewAssignment(prev => ({ 
                  ...prev, 
                  role: e.target.value as any 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="student">Student</option>
                <option value="university">University</option>
                <option value="knqa">KNQA (Admin)</option>
                <option value="none">No Role</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={handleAddAssignment}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Add to Queue
            </button>
            
            {assignments.length > 0 && (
              <>
                <button
                  onClick={handleExecuteAssignments}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-md transition-colors"
                >
                  {isLoading ? 'Executing...' : `Execute All (${assignments.filter(a => a.status === 'pending').length})`}
                </button>
                
                <button
                  onClick={handleClearCompleted}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Clear Completed
                </button>
              </>
            )}
          </div>
        </div>

        {/* Assignment Queue */}
        {assignments.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Assignment Queue</h2>
            
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
                        {walletUtils.formatAddress(assignment.address, 10)}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(assignment.role)}`}>
                          {walletUtils.formatRole(assignment.role)}
                        </span>
                        {assignment.message && (
                          <span className="text-xs text-gray-600">
                            {assignment.message}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {assignment.status === 'pending' && (
                    <button
                      onClick={() => handleRemoveAssignment(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Roles */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Current Role Assignments</h2>
            <button
              onClick={loadExistingRoles}
              disabled={isLoadingExisting}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              {isLoadingExisting ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {isLoadingExisting ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-2"></div>
              <p className="text-gray-600">Loading existing roles...</p>
            </div>
          ) : existingRoles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Network
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {existingRoles.map((roleAssignment, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-mono text-sm">
                          {roleAssignment.address}
                        </div>
                        <div className="text-xs text-gray-500">
                          {walletUtils.formatAddress(roleAssignment.address)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(roleAssignment.role)}`}>
                          {walletUtils.formatRole(roleAssignment.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {walletUtils.getNetworkFromAddress(roleAssignment.address).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(roleAssignment.assignedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600">
              No role assignments found
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">📖 How to Use</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p><strong>1.</strong> Enter a valid Stacks address (starts with ST)</p>
            <p><strong>2.</strong> Select the appropriate role for that address</p>
            <p><strong>3.</strong> Add multiple assignments to the queue</p>
            <p><strong>4.</strong> Execute all assignments at once</p>
            <p><strong>5.</strong> Monitor progress and check for any errors</p>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> Role assignments create blockchain transactions that may take a few minutes to confirm.
              Make sure you have sufficient STX tokens for transaction fees.
            </p>
          </div>
        </div>

        {/* Role Permissions Reference */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">🔐 Role Permissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium text-green-600 mb-2">🏫 University</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Issue certificates</li>
                <li>• Revoke certificates</li>
                <li>• View issued certificates</li>
                <li>• Upload certificate files</li>
              </ul>
            </div>
            
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium text-blue-600 mb-2">👨‍🎓 Student</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• View own certificates</li>
                <li>• Download certificates</li>
                <li>• Verify certificates</li>
                <li>• Request revocations</li>
              </ul>
            </div>
            
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-medium text-purple-600 mb-2">🏛️ KNQA (Admin)</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• All university permissions</li>
                <li>• Approve certificates</li>
                <li>• Manage user roles</li>
                <li>• System administration</li>
                <li>• Audit system activities</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </WalletGuard>
  );
};

export default RoleManagement;