/**
 * University Dashboard - Admin Interface
 * Allows university users to issue and revoke certificates
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  PlusIcon, 
  XMarkIcon, 
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';

// Redux imports
import type { AppDispatch, RootState } from '../../store/index.js';
import { 
  issueCertificate,
  revokeCertificate,
  selectCertificateLoadingStates,
  selectCertificateError,
  selectRecentIssuances,
  clearError 
} from '../../store/slices/certificateSlice.js';
import { selectUser, selectWalletAddress, disconnectWallet } from '../../store/slices/authSlice.js';

// Types
import type { IssuanceFormData } from '../../types/index.js';

// Services
import { certificateService } from '../../services/certificate.js';
import { certivertAPI, type PendingIssuance, type PendingRevocation } from '../../services/api.js';

interface UniversityDashboardProps {
  userAddress?: string;
}

const UniversityDashboard: React.FC<UniversityDashboardProps> = () => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => selectUser(state));
  const walletAddress = useSelector((state: RootState) => selectWalletAddress(state));
  const loadingStates = useSelector((state: RootState) => selectCertificateLoadingStates(state));
  const error = useSelector((state: RootState) => selectCertificateError(state));
  const recentActivity = useSelector((state: RootState) => selectRecentIssuances(state));

  // Helper function to extract role from displayName
  const getUserRole = (): 'university' | 'knqa' | 'unknown' => {
    if (!user?.displayName) return 'unknown';
    const displayName = user.displayName.toLowerCase();
    if (displayName.includes('university')) return 'university';
    if (displayName.includes('knqa')) return 'knqa';
    return 'unknown';
  };

  const userRole = getUserRole();
  const isUniversity = userRole === 'university';
  const isKNQA = userRole === 'knqa';

  // Local state - default tab based on role
  const [activeTab, setActiveTab] = useState<'issue' | 'revoke' | 'pending' | 'approvals'>(
    isKNQA ? 'approvals' : 'issue'
  );
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  
  // Form states
  const [issueForm, setIssueForm] = useState<IssuanceFormData>({
    studentName: '',
    admissionNo: '',
    programme: '',
    year: new Date().getFullYear(),
    grade: '',
    file: null as any,
  });
  
  const [revokeForm, setRevokeForm] = useState({
    certId: '',
    reason: '',
  });

  // Form validation
  const [issueFormErrors, setIssueFormErrors] = useState<string[]>([]);
  const [revokeFormErrors, setRevokeFormErrors] = useState<string[]>([]);

  // Pending certificates state
  const [pendingRevocations, setPendingRevocations] = useState<PendingRevocation[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  
  // Pending issuances state (for KNQA approval)
  const [pendingIssuances, setPendingIssuances] = useState<PendingIssuance[]>([]);
  const [loadingIssuances, setLoadingIssuances] = useState(false);

  // Clear errors on mount
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => dispatch(clearError()), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  // Load pending revocations when pending tab is active
  useEffect(() => {
    if (activeTab === 'pending' && isUniversity) {
      loadPendingRevocations();
    }
  }, [activeTab, isUniversity]);

  // Load pending issuances when approvals tab is active (KNQA only)
  useEffect(() => {
    if (activeTab === 'approvals' && isKNQA) {
      loadPendingIssuances();
    }
  }, [activeTab, isKNQA]);

  // Function to load pending revocations
  const loadPendingRevocations = async () => {
    setLoadingPending(true);
    try {
      const response = await certivertAPI.getPendingRevocations();
      setPendingRevocations(response.pending);
    } catch (error) {
      console.error('Failed to load pending revocations:', error);
    } finally {
      setLoadingPending(false);
    }
  };

  // Function to load pending issuances for KNQA approval
  const loadPendingIssuances = async () => {
    setLoadingIssuances(true);
    try {
      const response = await certivertAPI.getPendingIssuances();
      setPendingIssuances(response.pending);
    } catch (error) {
      console.error('Failed to load pending issuances:', error);
    } finally {
      setLoadingIssuances(false);
    }
  };

  // Handle certificate issuance
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!walletAddress) {
      alert('Wallet not connected');
      return;
    }

    // Validate form
    const validation = certificateService.validateCertificateData(issueForm);
    if (!validation.isValid) {
      setIssueFormErrors(validation.errors);
      return;
    }

    setIssueFormErrors([]);

    try {
      await dispatch(issueCertificate({
        formData: issueForm,
        walletAddress,
      })).unwrap();

      // Success - close modal and reset form
      setShowIssueModal(false);
      setIssueForm({
        studentName: '',
        admissionNo: '',
        programme: '',
        year: new Date().getFullYear(),
        grade: '',
        file: null as any,
      });
      
    } catch (error) {
      console.error('Certificate issuance failed:', error);
    }
  };

  // Handle certificate revocation
  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!walletAddress) {
      alert('Wallet not connected');
      return;
    }

    // Basic validation
    const errors: string[] = [];
    if (!revokeForm.certId.trim()) errors.push('Certificate ID is required');
    if (!revokeForm.reason.trim()) errors.push('Revocation reason is required');

    if (errors.length > 0) {
      setRevokeFormErrors(errors);
      return;
    }

    setRevokeFormErrors([]);

    try {
      await dispatch(revokeCertificate({
        certId: revokeForm.certId.trim(),
        reason: revokeForm.reason.trim(),
        walletAddress,
      })).unwrap();

      // Success - close modal and reset form
      setShowRevokeModal(false);
      setRevokeForm({ certId: '', reason: '' });
      
    } catch (error) {
      console.error('Certificate revocation failed:', error);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIssueForm(prev => ({ ...prev, file }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {`${user?.displayName} Dashboard`}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {isKNQA 
                ? 'Review and approve university certificate requests and revocations.'
                : 'Issue certificates and manage revocations. All actions require KNQA approval.'
              }
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Connected as</div>
            <div className="font-semibold text-gray-900">
              {user?.displayName || (isKNQA ? 'KNQA Admin' : 'University Admin')}
            </div>
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

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {/* University tabs */}
            {isUniversity && (
              <>
                <button
                  onClick={() => setActiveTab('issue')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'issue'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Issue Certificates
                </button>
                <button
                  onClick={() => setActiveTab('revoke')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'revoke'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Revoke Certificates
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'pending'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pending Revocations
                </button>
              </>
            )}

            {/* KNQA tabs */}
            {isKNQA && (
              <>
                <button
                  onClick={() => setActiveTab('approvals')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'approvals'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pending Approvals
                </button>
                <button
                  onClick={() => setActiveTab('revoke')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'revoke'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Revoke Certificates
                </button>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Issue Certificate Card - University only */}
        {isUniversity && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-lg p-2">
                  <PlusIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h2 className="text-lg font-semibold text-gray-900">Issue Certificate</h2>
                  <p className="text-sm text-gray-600">Submit new certificate requests</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowIssueModal(true)}
              disabled={loadingStates.issuing}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingStates.issuing ? 'Processing...' : 'Issue New Certificate'}
            </button>
          </div>
        )}

        {/* Revoke Certificate Card - Both University and KNQA */}
        {(isUniversity || isKNQA) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="bg-red-100 rounded-lg p-2">
                  <XMarkIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <h2 className="text-lg font-semibold text-gray-900">Revoke Certificate</h2>
                  <p className="text-sm text-gray-600">
                    {isKNQA ? 'Initiate certificate revocation' : 'Request certificate revocation'}
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowRevokeModal(true)}
              disabled={loadingStates.revoking}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingStates.revoking ? 'Processing...' : 'Revoke Certificate'}
            </button>
          </div>
        )}

        {/* View Certificates Card - Both University and KNQA */}
        {(isUniversity || isKNQA) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-lg p-2">
                  <DocumentCheckIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <h2 className="text-lg font-semibold text-gray-900">View Certificates</h2>
                  <p className="text-sm text-gray-600">
                    View issued and revoked certificates
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setActiveTab('pending')}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              View All Certificates
            </button>
          </div>
        )}
      </div>

      {/* Pending Revocations Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pending Revocations</h2>
              <p className="text-sm text-gray-600 mt-1">
                Certificate revocations awaiting KNQA approval
              </p>
            </div>
            <button
              onClick={loadPendingRevocations}
              disabled={loadingPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loadingPending ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loadingPending ? (
            <div className="text-center py-8">
              <ClockIcon className="h-8 w-8 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500">Loading pending revocations...</p>
            </div>
          ) : pendingRevocations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DocumentCheckIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No pending revocations</p>
              <p className="text-sm">Your revocation requests will appear here awaiting KNQA approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRevocations.map((revocation) => (
                <div key={revocation.certId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">Certificate ID: {revocation.certId}</h3>
                      <p className="text-sm text-gray-600">
                        Initiated by: {revocation.initiator.slice(0, 8)}...{revocation.initiator.slice(-6)}
                      </p>
                    </div>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                      Awaiting KNQA Approval
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Reason:</span>
                      <p className="text-gray-900 mt-1">{revocation.reason}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Requested At:</span>
                      <p className="text-gray-900 mt-1">
                        Block Height: {revocation.requestedAt}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Role: {revocation.initiatorRole === 2 ? 'University' : revocation.initiatorRole === 3 ? 'KNQA' : 'Unknown'}
                    </div>
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="h-4 w-4 text-yellow-500" />
                      <span className="text-xs text-yellow-600">Pending KNQA approval</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KNQA Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pending Certificate Approvals</h2>
              <p className="text-sm text-gray-600 mt-1">
                University certificate issuance requests awaiting your approval
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
              <p className="text-gray-500">Loading pending approvals...</p>
            </div>
          ) : pendingIssuances.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DocumentCheckIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No pending approvals</p>
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
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                      Awaiting KNQA Approval
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Student:</span>
                      <p className="text-gray-900 mt-1">{issuance.studentName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Admission No:</span>
                      <p className="text-gray-900 mt-1">{issuance.admissionNo}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Programme:</span>
                      <p className="text-gray-900 mt-1">{issuance.programme}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Year & Grade:</span>
                      <p className="text-gray-900 mt-1">{issuance.year} - {issuance.grade}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Block Height: {issuance.requestedAt}
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {/* Handle approve */}}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {/* Handle reject */}}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-700"
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

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <ClockIcon className="h-5 w-5 text-gray-400" />
        </div>
        
        {recentActivity.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DocumentCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                  activity.status === 'success' ? 'bg-green-500' : 
                  activity.status === 'revoked' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{activity.message}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
                {activity.id && (
                  <div className="text-xs text-gray-400 font-mono">
                    {activity.id.slice(0, 8)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issue Certificate Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Issue Certificate</h2>
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {issueFormErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                      <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                        {issueFormErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleIssueSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Student Name
                    </label>
                    <input
                      type="text"
                      value={issueForm.studentName}
                      onChange={(e) => setIssueForm(prev => ({ ...prev, studentName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Admission Number
                    </label>
                    <input
                      type="text"
                      value={issueForm.admissionNo}
                      onChange={(e) => setIssueForm(prev => ({ ...prev, admissionNo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Admission number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Programme
                    </label>
                    <input
                      type="text"
                      value={issueForm.programme}
                      onChange={(e) => setIssueForm(prev => ({ ...prev, programme: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Degree programme"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Year
                    </label>
                    <input
                      type="number"
                      value={issueForm.year}
                      onChange={(e) => setIssueForm(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="2000"
                      max={new Date().getFullYear() + 1}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grade
                  </label>
                  <select
                    value={issueForm.grade}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, grade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Grade</option>
                    <option value="First Class">First Class</option>
                    <option value="Second Upper">Second Upper</option>
                    <option value="Second Lower">Second Lower</option>
                    <option value="Third Class">Third Class</option>
                    <option value="Pass">Pass</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Certificate PDF
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {issueForm.file && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {issueForm.file.name} ({(issueForm.file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingStates.issuing}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loadingStates.issuing ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Certificate Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Revoke Certificate</h2>
                <button
                  onClick={() => setShowRevokeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {revokeFormErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                      <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                        {revokeFormErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleRevokeSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Certificate ID
                  </label>
                  <input
                    type="text"
                    value={revokeForm.certId}
                    onChange={(e) => setRevokeForm(prev => ({ ...prev, certId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Enter certificate ID to revoke"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Revocation
                  </label>
                  <textarea
                    value={revokeForm.reason}
                    onChange={(e) => setRevokeForm(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    rows={3}
                    placeholder="Explain why this certificate should be revoked..."
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                    <div className="ml-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning:</strong> This action will request certificate revocation. 
                        KNQA approval is required before the certificate becomes revoked.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowRevokeModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingStates.revoking}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {loadingStates.revoking ? 'Submitting...' : 'Submit Revocation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversityDashboard;