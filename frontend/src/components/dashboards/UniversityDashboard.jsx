import React, { useState } from 'react';
import { 
  requestIssueCertificate, 
  requestRevokeCertificate,
  approveRevokeCertificate,
  getPendingRevocation 
} from '../../lib/contractInteraction';

const UniversityDashboard = ({ userAddress }) => {
  const [activeTab, setActiveTab] = useState('issue');
  const [issuanceForm, setIssuanceForm] = useState({
    studentAddress: '',
    studentName: '',
    programme: '',
    year: new Date().getFullYear(),
    grade: '',
    certId: '',
    ipfsCid: '',
    certHash: ''
  });
  const [revocationForm, setRevocationForm] = useState({
    certId: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Handle certificate issuance request
  const handleRequestIssuance = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Generate certificate ID from form data
      const certData = {
        studentName: issuanceForm.studentName,
        programme: issuanceForm.programme,
        year: issuanceForm.year,
        grade: issuanceForm.grade
      };
      const certId = generateCertificateId(certData);
      
      await requestIssueCertificate({
        certId,
        studentAddress: issuanceForm.studentAddress,
        studentName: issuanceForm.studentName,
        programme: issuanceForm.programme,
        year: parseInt(issuanceForm.year),
        grade: issuanceForm.grade,
        ipfsCid: issuanceForm.ipfsCid || 'pending-upload',
        certHash: issuanceForm.certHash || 'pending-hash'
      });

      setMessage('✅ Certificate issuance requested! Waiting for KNQA approval.');
      setIssuanceForm({
        studentAddress: '',
        studentName: '',
        programme: '',
        year: new Date().getFullYear(),
        grade: '',
        certId: '',
        ipfsCid: '',
        certHash: ''
      });
      
    } catch (error) {
      console.error('Error requesting certificate:', error);
      setMessage('❌ Failed to request certificate issuance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle revocation request
  const handleRequestRevocation = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await requestRevokeCertificate(revocationForm.certId, revocationForm.reason);
      setMessage('✅ Certificate revocation requested! Waiting for KNQA approval.');
      setRevocationForm({ certId: '', reason: '' });
    } catch (error) {
      console.error('Error requesting revocation:', error);
      setMessage('❌ Failed to request revocation: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to generate certificate ID
  const generateCertificateId = (certData) => {
    const dataString = JSON.stringify(certData);
    // In a real implementation, use a proper hash function
    return 'cert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-serif text-2xl text-ink mb-2">University Dashboard</h2>
        <p className="text-muted text-sm">
          Request certificate issuance and revocation. All actions require KNQA approval.
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
            onClick={() => setActiveTab('issue')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'issue'
                ? 'border-coral text-coral'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Request Issuance
          </button>
          <button
            onClick={() => setActiveTab('revoke')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'revoke'
                ? 'border-coral text-coral'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Request Revocation
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-coral text-coral'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Pending Actions
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'issue' && (
        <div className="bg-white rounded-lg p-6 border border-cream-border">
          <h3 className="font-medium text-ink mb-4">Request Certificate Issuance</h3>
          <p className="text-sm text-muted mb-6">
            Submit a certificate issuance request. KNQA must approve before the certificate becomes active.
          </p>
          
          <form onSubmit={handleRequestIssuance} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Student Wallet Address
                </label>
                <input
                  type="text"
                  value={issuanceForm.studentAddress}
                  onChange={(e) => setIssuanceForm({...issuanceForm, studentAddress: e.target.value})}
                  className="w-full px-3 py-2 border border-cream-border rounded-sm focus:ring-1 focus:ring-coral focus:border-coral"
                  placeholder="ST1ABC..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Student Name
                </label>
                <input
                  type="text"
                  value={issuanceForm.studentName}
                  onChange={(e) => setIssuanceForm({...issuanceForm, studentName: e.target.value})}
                  className="w-full px-3 py-2 border border-cream-border rounded-sm focus:ring-1 focus:ring-coral focus:border-coral"
                  placeholder="John Doe"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Programme
                </label>
                <input
                  type="text"
                  value={issuanceForm.programme}
                  onChange={(e) => setIssuanceForm({...issuanceForm, programme: e.target.value})}
                  className="w-full px-3 py-2 border border-cream-border rounded-sm focus:ring-1 focus:ring-coral focus:border-coral"
                  placeholder="Computer Science"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={issuanceForm.year}
                  onChange={(e) => setIssuanceForm({...issuanceForm, year: e.target.value})}
                  className="w-full px-3 py-2 border border-cream-border rounded-sm focus:ring-1 focus:ring-coral focus:border-coral"
                  min="2000"
                  max="2030"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Grade
                </label>
                <select
                  value={issuanceForm.grade}
                  onChange={(e) => setIssuanceForm({...issuanceForm, grade: e.target.value})}
                  className="w-full px-3 py-2 border border-cream-border rounded-sm focus:ring-1 focus:ring-coral focus:border-coral"
                  required
                >
                  <option value="">Select Grade</option>
                  <option value="First Class">First Class</option>
                  <option value="Second Upper">Second Upper</option>
                  <option value="Second Lower">Second Lower</option>
                  <option value="Third Class">Third Class</option>
                  <option value="Pass">Pass</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-cream py-3 px-4 rounded-sm hover:bg-ink-soft disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting Request...' : 'Request Certificate Issuance'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'revoke' && (
        <div className="bg-white rounded-lg p-6 border border-cream-border">
          <h3 className="font-medium text-ink mb-4">Request Certificate Revocation</h3>
          <p className="text-sm text-muted mb-6">
            Request revocation of an active certificate. KNQA must approve the revocation.
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
                placeholder="Explain why this certificate should be revoked..."
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

      {activeTab === 'pending' && (
        <div className="bg-white rounded-lg p-6 border border-cream-border">
          <h3 className="font-medium text-ink mb-4">Pending Actions</h3>
          <p className="text-sm text-muted mb-6">
            View requests waiting for approval and actions you need to take.
          </p>
          
          {/* Placeholder for pending items list */}
          <div className="space-y-4">
            <div className="border border-cream-border rounded-lg p-4">
              <p className="text-sm text-muted text-center py-8">
                No pending actions at the moment.
                <br />
                <span className="text-xs">This section will show pending revocation requests initiated by KNQA that require your approval.</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversityDashboard;