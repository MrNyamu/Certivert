import React, { useState, useEffect } from 'react';
import { 
  approveIssueCertificate,
  requestRevokeCertificate,
  approveRevokeCertificate,
  getPendingIssuance,
  getPendingRevocation
} from '../../lib/contractInteraction';

const KNQADashboard = ({ userAddress }) => {
  const [activeTab, setActiveTab] = useState('approve-issue');
  const [pendingIssuances, setPendingIssuances] = useState([]);
  const [pendingRevocations, setPendingRevocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form state for revocation requests
  const [revocationForm, setRevocationForm] = useState({
    certId: '',
    reason: ''
  });

  // Handle issuance approval
  const handleApproveIssuance = async (certId) => {
    setLoading(true);
    setMessage('');

    try {
      await approveIssueCertificate(certId);
      setMessage(`✅ Certificate ${certId} approved for issuance!`);
      // Refresh pending list
      // fetchPendingIssuances();
    } catch (error) {
      console.error('Error approving certificate:', error);
      setMessage('❌ Failed to approve certificate: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle revocation request (KNQA initiating)
  const handleRequestRevocation = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await requestRevokeCertificate(revocationForm.certId, revocationForm.reason);
      setMessage('✅ Certificate revocation requested! Waiting for University approval.');
      setRevocationForm({ certId: '', reason: '' });
    } catch (error) {
      console.error('Error requesting revocation:', error);
      setMessage('❌ Failed to request revocation: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle revocation approval (University initiated, KNQA approving)
  const handleApproveRevocation = async (certId) => {
    setLoading(true);
    setMessage('');

    try {
      await approveRevokeCertificate(certId);
      setMessage(`✅ Certificate ${certId} revocation approved!`);
      // Refresh pending list
      // fetchPendingRevocations();
    } catch (error) {
      console.error('Error approving revocation:', error);
      setMessage('❌ Failed to approve revocation: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-serif text-2xl text-ink mb-2">KNQA Dashboard</h2>
        <p className="text-muted text-sm">
          Approve or reject certificate issuance and revocation requests from universities.
        </p>
      </div>

      {/* Status message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.includes('✅') 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="text-sm">{message}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-cream-border">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('approve-issue')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'approve-issue'
                ? 'border-coral text-coral'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Approve Issuance
          </button>
          <button
            onClick={() => setActiveTab('request-revoke')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'request-revoke'
                ? 'border-coral text-coral'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Request Revocation
          </button>
          <button
            onClick={() => setActiveTab('approve-revoke')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'approve-revoke'
                ? 'border-coral text-coral'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Approve Revocation
          </button>
        </nav>
      </div>

      {/* Approve Issuance Tab */}
      {activeTab === 'approve-issue' && (
        <div className="bg-white rounded-lg p-6 border border-cream-border">
          <h3 className="font-medium text-ink mb-4">Pending Certificate Issuances</h3>
          <p className="text-sm text-muted mb-6">
            Review and approve certificate issuance requests from universities.
          </p>
          
          {/* Placeholder for pending issuances */}
          <div className="space-y-4">
            {/* Example pending issuance - replace with real data */}
            <div className="border border-cream-border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-ink">Certificate Request</h4>
                  <p className="text-sm text-muted">Requested by: University of Nairobi</p>
                </div>
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                  Pending Review
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-muted">Student:</span>
                  <span className="ml-2 text-ink">John Doe</span>
                </div>
                <div>
                  <span className="text-muted">Programme:</span>
                  <span className="ml-2 text-ink">Computer Science</span>
                </div>
                <div>
                  <span className="text-muted">Year:</span>
                  <span className="ml-2 text-ink">2024</span>
                </div>
                <div>
                  <span className="text-muted">Grade:</span>
                  <span className="ml-2 text-ink">First Class</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleApproveIssuance('example-cert-id')}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded-sm text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button className="bg-red-600 text-white px-4 py-2 rounded-sm text-sm hover:bg-red-700">
                  Reject
                </button>
              </div>
            </div>

            {/* No pending items message */}
            <div className="border border-cream-border rounded-lg p-4">
              <p className="text-sm text-muted text-center py-8">
                No pending issuance requests at the moment.
                <br />
                <span className="text-xs">University requests will appear here for your approval.</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Request Revocation Tab */}
      {activeTab === 'request-revoke' && (
        <div className="bg-white rounded-lg p-6 border border-cream-border">
          <h3 className="font-medium text-ink mb-4">Request Certificate Revocation</h3>
          <p className="text-sm text-muted mb-6">
            Initiate revocation of an active certificate. The issuing university must approve.
          </p>
          
          <form onSubmit={handleRequestRevocation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Certificate ID
              </label>
              <input
                type="text"
                value={revocationForm.certId}
                onChange={(e) => setRevocationForm({...revocationForm, certId: e.target.value})}
                className="w-full px-3 py-2 border border-cream-border rounded-sm focus:ring-1 focus:ring-coral focus:border-coral"
                placeholder="Enter certificate ID to revoke"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Revocation Reason
              </label>
              <textarea
                value={revocationForm.reason}
                onChange={(e) => setRevocationForm({...revocationForm, reason: e.target.value})}
                className="w-full px-3 py-2 border border-cream-border rounded-sm focus:ring-1 focus:ring-coral focus:border-coral"
                rows="3"
                placeholder="Explain why this certificate should be revoked (regulatory non-compliance, fraud, etc.)..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting Request...' : 'Request Certificate Revocation'}
            </button>
          </form>
        </div>
      )}

      {/* Approve Revocation Tab */}
      {activeTab === 'approve-revoke' && (
        <div className="bg-white rounded-lg p-6 border border-cream-border">
          <h3 className="font-medium text-ink mb-4">Pending Revocation Approvals</h3>
          <p className="text-sm text-muted mb-6">
            Review and approve certificate revocation requests initiated by universities.
          </p>
          
          {/* Placeholder for pending revocations */}
          <div className="space-y-4">
            {/* Example pending revocation - replace with real data */}
            <div className="border border-cream-border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-ink">Revocation Request</h4>
                  <p className="text-sm text-muted">Requested by: University of Nairobi</p>
                </div>
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                  Awaiting Approval
                </span>
              </div>
              
              <div className="text-sm mb-4">
                <div className="mb-2">
                  <span className="text-muted">Certificate ID:</span>
                  <span className="ml-2 text-ink font-mono">cert_1234567890</span>
                </div>
                <div className="mb-2">
                  <span className="text-muted">Reason:</span>
                  <span className="ml-2 text-ink">Student found guilty of academic misconduct</span>
                </div>
                <div>
                  <span className="text-muted">Requested:</span>
                  <span className="ml-2 text-ink">2 hours ago</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleApproveRevocation('cert_1234567890')}
                  disabled={loading}
                  className="bg-red-600 text-white px-4 py-2 rounded-sm text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Approve Revocation
                </button>
                <button className="bg-gray-600 text-white px-4 py-2 rounded-sm text-sm hover:bg-gray-700">
                  Reject
                </button>
              </div>
            </div>

            {/* No pending items message */}
            <div className="border border-cream-border rounded-lg p-4">
              <p className="text-sm text-muted text-center py-8">
                No pending revocation requests at the moment.
                <br />
                <span className="text-xs">University revocation requests will appear here for your approval.</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KNQADashboard;