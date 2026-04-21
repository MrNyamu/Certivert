/**
 * KNQA Dashboard - TypeScript Version
 * Allows KNQA users to approve certificate issuances and revocations
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// Redux imports
import type { AppDispatch, RootState } from '../../store/index.js';
import { selectUser, selectWalletAddress, disconnectWallet } from '../../store/slices/authSlice.js';

// Services
import { certivertAPI, type PendingIssuance, type PendingRevocation } from '../../services/api.js';

interface KNQADashboardProps {
  userAddress?: string;
}

const KNQADashboard: React.FC<KNQADashboardProps> = () => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => selectUser(state));
  const walletAddress = useSelector((state: RootState) => selectWalletAddress(state));

  // Local state
  const [activeTab, setActiveTab] = useState<'approve-issue' | 'approve-revoke'>('approve-issue');
  const [pendingIssuances, setPendingIssuances] = useState<PendingIssuance[]>([]);
  const [pendingRevocations, setPendingRevocations] = useState<PendingRevocation[]>([]);
  const [loadingIssuances, setLoadingIssuances] = useState(false);
  const [loadingRevocations, setLoadingRevocations] = useState(false);
  const [message, setMessage] = useState<string>('');

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'approve-issue' && user?.isKNQA) {
      loadPendingIssuances();
    } else if (activeTab === 'approve-revoke' && user?.isKNQA) {
      loadPendingRevocations();
    }
  }, [activeTab, user]);

  // Function to load pending issuances
  const loadPendingIssuances = async () => {
    setLoadingIssuances(true);
    try {
      const response = await certivertAPI.getPendingIssuances();
      setPendingIssuances(response.pending);
      console.log(`Loaded ${response.count} pending issuances`);
    } catch (error) {
      console.error('Failed to load pending issuances:', error);
      setMessage('❌ Failed to load pending issuances');
    } finally {
      setLoadingIssuances(false);
    }
  };

  // Function to load pending revocations  
  const loadPendingRevocations = async () => {
    setLoadingRevocations(true);
    try {
      const response = await certivertAPI.getPendingRevocations();
      setPendingRevocations(response.pending);
      console.log(`Loaded ${response.count} pending revocations`);
    } catch (error) {
      console.error('Failed to load pending revocations:', error);
      setMessage('❌ Failed to load pending revocations');
    } finally {
      setLoadingRevocations(false);
    }
  };

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">KNQA Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">
              Approve or reject certificate issuance and revocation requests from universities.
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Connected as</div>
            <div className="font-semibold text-gray-900">{user?.displayName || 'KNQA Admin'}</div>
            <div className="text-xs text-gray-400">{walletAddress?.slice(0, 8)}...{walletAddress?.slice(-6)}</div>
            <button
              onClick={() => dispatch(disconnectWallet())}
              className="mt-2 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`border rounded-lg p-4 ${
          message.includes('✅') 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex">
            {message.includes('✅') ? (
              <CheckCircleIcon className="h-5 w-5 text-green-400 mt-0.5" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />
            )}
            <div className="ml-3">
              <p className="text-sm">{message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('approve-issue')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'approve-issue'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Approve Issuances
            </button>
            <button
              onClick={() => setActiveTab('approve-revoke')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'approve-revoke'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Approve Revocations
            </button>
          </nav>
        </div>
      </div>

      {/* Approve Issuances Tab */}
      {activeTab === 'approve-issue' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pending Certificate Issuances</h2>
              <p className="text-sm text-gray-600 mt-1">
                Review and approve certificate issuance requests from universities
              </p>
            </div>
            <button
              onClick={loadPendingIssuances}
              disabled={loadingIssuances}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loadingIssuances ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loadingIssuances ? (
            <div className="text-center py-8">
              <ClockIcon className="h-8 w-8 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500">Loading pending issuances...</p>
            </div>
          ) : pendingIssuances.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DocumentCheckIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No pending issuances</p>
              <p className="text-sm">University certificate requests will appear here for your approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingIssuances.map((issuance) => (
                <div key={issuance.certId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">Certificate Request</h3>
                      <p className="text-sm text-gray-600">
                        From: {issuance.universityPrincipal.slice(0, 8)}...{issuance.universityPrincipal.slice(-6)}
                      </p>
                    </div>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                      Pending Review
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Student:</span>
                      <p className="text-gray-900">{issuance.studentName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Admission No:</span>
                      <p className="text-gray-900">{issuance.admissionNo}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Programme:</span>
                      <p className="text-gray-900">{issuance.programme}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Year:</span>
                      <p className="text-gray-900">{issuance.year}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Grade:</span>
                      <p className="text-gray-900">{issuance.grade}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">IPFS CID:</span>
                      <p className="text-gray-900 font-mono text-xs">{issuance.ipfsCid}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Certificate ID: {issuance.certId}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // TODO: Implement wallet transaction for approval
                          setMessage(`✅ Certificate ${issuance.certId} approved for issuance!`);
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approve Revocations Tab */}
      {activeTab === 'approve-revoke' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pending Revocation Approvals</h2>
              <p className="text-sm text-gray-600 mt-1">
                Review and approve certificate revocation requests initiated by universities
              </p>
            </div>
            <button
              onClick={loadPendingRevocations}
              disabled={loadingRevocations}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loadingRevocations ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loadingRevocations ? (
            <div className="text-center py-8">
              <ClockIcon className="h-8 w-8 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500">Loading pending revocations...</p>
            </div>
          ) : pendingRevocations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <XMarkIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No pending revocations</p>
              <p className="text-sm">University revocation requests will appear here for your approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRevocations.map((revocation) => (
                <div key={revocation.certId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">Revocation Request</h3>
                      <p className="text-sm text-gray-600">
                        Initiated by: {revocation.initiator.slice(0, 8)}...{revocation.initiator.slice(-6)}
                      </p>
                    </div>
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                      Awaiting Approval
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Certificate ID:</span>
                      <p className="text-gray-900 font-mono">{revocation.certId}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Requested At:</span>
                      <p className="text-gray-900">Block Height: {revocation.requestedAt}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-gray-600">Reason:</span>
                      <p className="text-gray-900 mt-1">{revocation.reason}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Role: {revocation.initiatorRole === 2 ? 'University' : revocation.initiatorRole === 3 ? 'KNQA' : 'Unknown'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // TODO: Implement wallet transaction for approval
                          setMessage(`✅ Certificate ${revocation.certId} revocation approved!`);
                        }}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
                      >
                        Approve Revocation
                      </button>
                      <button
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KNQADashboard;