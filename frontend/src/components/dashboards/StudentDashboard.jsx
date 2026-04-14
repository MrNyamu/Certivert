import React, { useState } from 'react';
import { getCertificate, isCertificateValid, CERTIFICATE_STATUS } from '../../lib/contractInteraction';

const StudentDashboard = ({ userAddress }) => {
  const [certId, setCertId] = useState('');
  const [certificateData, setCertificateData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle certificate verification
  const handleVerifyCertificate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setCertificateData(null);

    try {
      const certificate = await getCertificate(certId);
      if (certificate) {
        setCertificateData(certificate);
      } else {
        setError('Certificate not found');
      }
    } catch (err) {
      console.error('Error fetching certificate:', err);
      setError('Failed to fetch certificate: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get status display
  const getStatusDisplay = (status) => {
    switch (status) {
      case CERTIFICATE_STATUS.PENDING_ISSUE:
        return { text: 'Pending Issuance', color: 'bg-yellow-100 text-yellow-800' };
      case CERTIFICATE_STATUS.ACTIVE:
        return { text: 'Active', color: 'bg-green-100 text-green-800' };
      case CERTIFICATE_STATUS.PENDING_REVOKE:
        return { text: 'Pending Revocation', color: 'bg-orange-100 text-orange-800' };
      case CERTIFICATE_STATUS.REVOKED:
        return { text: 'Revoked', color: 'bg-red-100 text-red-800' };
      default:
        return { text: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-serif text-2xl text-ink mb-2">Student Dashboard</h2>
        <p className="text-muted text-sm">
          Verify your certificates and view their status on the blockchain.
        </p>
      </div>

      {/* Certificate Verification Form */}
      <div className="bg-white rounded-lg p-6 border border-cream-border">
        <h3 className="font-medium text-ink mb-4">Verify Certificate</h3>
        <p className="text-sm text-muted mb-6">
          Enter your certificate ID to view its details and verification status.
        </p>
        
        <form onSubmit={handleVerifyCertificate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Certificate ID
            </label>
            <input
              type="text"
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              className="w-full px-3 py-2 border border-cream-border rounded-sm focus:ring-1 focus:ring-coral focus:border-coral"
              placeholder="Enter your certificate ID"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !certId.trim()}
            className="w-full bg-ink text-cream py-3 px-4 rounded-sm hover:bg-ink-soft disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify Certificate'}
          </button>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Certificate Details */}
      {certificateData && (
        <div className="bg-white rounded-lg p-6 border border-cream-border">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-medium text-ink">Certificate Details</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusDisplay(certificateData.status).color}`}>
              {getStatusDisplay(certificateData.status).text}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted">Student Name:</span>
              <span className="ml-2 text-ink font-medium">{certificateData['student-name']}</span>
            </div>
            
            <div>
              <span className="text-muted">Programme:</span>
              <span className="ml-2 text-ink">{certificateData.programme}</span>
            </div>
            
            <div>
              <span className="text-muted">Year:</span>
              <span className="ml-2 text-ink">{certificateData.year}</span>
            </div>
            
            <div>
              <span className="text-muted">Grade:</span>
              <span className="ml-2 text-ink">{certificateData.grade}</span>
            </div>
            
            <div>
              <span className="text-muted">Issued by:</span>
              <span className="ml-2 text-ink font-mono text-xs">{certificateData['university-principal']}</span>
            </div>
            
            {certificateData['issued-at'] && (
              <div>
                <span className="text-muted">Issued at Block:</span>
                <span className="ml-2 text-ink">{certificateData['issued-at']}</span>
              </div>
            )}
            
            {certificateData['revoked-at'] && (
              <div>
                <span className="text-muted">Revoked at Block:</span>
                <span className="ml-2 text-ink">{certificateData['revoked-at']}</span>
              </div>
            )}
            
            {certificateData['revocation-reason'] && (
              <div className="md:col-span-2">
                <span className="text-muted">Revocation Reason:</span>
                <span className="ml-2 text-ink">{certificateData['revocation-reason']}</span>
              </div>
            )}
          </div>

          {/* Verification Status */}
          <div className="mt-6 pt-4 border-t border-cream-border">
            <div className="flex items-center">
              {certificateData.status === CERTIFICATE_STATUS.ACTIVE ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-green-700 font-medium">✅ Certificate is Valid and Active</span>
                </>
              ) : certificateData.status === CERTIFICATE_STATUS.REVOKED ? (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                  <span className="text-red-700 font-medium">❌ Certificate has been Revoked</span>
                </>
              ) : certificateData.status === CERTIFICATE_STATUS.PENDING_ISSUE ? (
                <>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                  <span className="text-yellow-700 font-medium">⏳ Certificate is Pending Approval</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-orange-500 rounded-full mr-3"></div>
                  <span className="text-orange-700 font-medium">⏳ Certificate is Pending Revocation</span>
                </>
              )}
            </div>
          </div>

          {/* Blockchain Proof */}
          <div className="mt-4 p-3 bg-gray-50 rounded border">
            <p className="text-xs text-gray-600 mb-1">Blockchain Verification:</p>
            <p className="text-xs text-gray-800 font-mono">
              Certificate ID: {certId}
            </p>
            <p className="text-xs text-gray-800 font-mono">
              Hash: {certificateData['cert-hash']}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              This certificate is cryptographically secured and immutably recorded on the Stacks blockchain.
            </p>
          </div>
        </div>
      )}

      {/* Help Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">How to Use</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Enter your certificate ID in the form above</li>
          <li>• The system will fetch your certificate details from the blockchain</li>
          <li>• You can share the certificate ID with employers for verification</li>
          <li>• All certificate data is immutably stored and cannot be falsified</li>
        </ul>
      </div>
    </div>
  );
};

export default StudentDashboard;