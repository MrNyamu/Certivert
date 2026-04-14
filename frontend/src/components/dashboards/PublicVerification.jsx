import React, { useState } from 'react';
import { getCertificate, isCertificateValid, CERTIFICATE_STATUS } from '../../lib/contractInteraction';

const PublicVerification = () => {
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
        return { 
          text: 'Pending Issuance', 
          color: 'bg-yellow-100 text-yellow-800',
          icon: '⏳',
          description: 'This certificate is awaiting final approval from KNQA.'
        };
      case CERTIFICATE_STATUS.ACTIVE:
        return { 
          text: 'Valid & Active', 
          color: 'bg-green-100 text-green-800',
          icon: '✅',
          description: 'This certificate is authentic and currently valid.'
        };
      case CERTIFICATE_STATUS.PENDING_REVOKE:
        return { 
          text: 'Pending Revocation', 
          color: 'bg-orange-100 text-orange-800',
          icon: '⚠️',
          description: 'This certificate is pending revocation approval.'
        };
      case CERTIFICATE_STATUS.REVOKED:
        return { 
          text: 'Revoked', 
          color: 'bg-red-100 text-red-800',
          icon: '❌',
          description: 'This certificate has been officially revoked and is no longer valid.'
        };
      default:
        return { 
          text: 'Unknown Status', 
          color: 'bg-gray-100 text-gray-800',
          icon: '❓',
          description: 'Certificate status could not be determined.'
        };
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-serif text-2xl text-ink mb-2">Certificate Verification</h2>
        <p className="text-muted text-sm">
          Verify any certificate issued through the Certivert system
        </p>
      </div>

      {/* Verification Form */}
      <div className="bg-white rounded-lg p-6 border border-cream-border shadow-sm">
        <form onSubmit={handleVerifyCertificate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Certificate ID
            </label>
            <input
              type="text"
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              className="w-full px-3 py-3 border border-cream-border rounded-sm focus:ring-1 focus:ring-coral focus:border-coral"
              placeholder="Enter certificate ID to verify"
              required
            />
            <p className="text-xs text-muted mt-1">
              Enter the certificate ID provided by the graduate or institution
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !certId.trim()}
            className="w-full bg-ink text-cream py-3 px-4 rounded-sm hover:bg-ink-soft disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Certificate'
            )}
          </button>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-400 text-lg mr-2">❌</span>
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Certificate Details */}
      {certificateData && (
        <div className="bg-white rounded-lg border border-cream-border shadow-sm overflow-hidden">
          {/* Status Header */}
          <div className={`px-6 py-4 ${getStatusDisplay(certificateData.status).color.replace('text-', 'text-').replace('bg-', 'bg-')}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">{getStatusDisplay(certificateData.status).icon}</span>
                <div>
                  <h3 className="font-semibold">
                    {getStatusDisplay(certificateData.status).text}
                  </h3>
                  <p className="text-sm opacity-90">
                    {getStatusDisplay(certificateData.status).description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Certificate Information */}
          <div className="px-6 py-4">
            <h4 className="font-semibold text-ink mb-4">Certificate Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div>
                  <span className="text-muted font-medium">Graduate Name</span>
                  <p className="text-ink text-base font-semibold">{certificateData['student-name']}</p>
                </div>
                
                <div>
                  <span className="text-muted font-medium">Programme</span>
                  <p className="text-ink">{certificateData.programme}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <span className="text-muted font-medium">Graduation Year</span>
                  <p className="text-ink">{certificateData.year}</p>
                </div>
                
                <div>
                  <span className="text-muted font-medium">Grade Achieved</span>
                  <p className="text-ink font-semibold">{certificateData.grade}</p>
                </div>
              </div>
            </div>

            {/* Institution Information */}
            <div className="mt-6 pt-4 border-t border-cream-border">
              <div className="mb-3">
                <span className="text-muted font-medium">Issuing Institution</span>
                <p className="text-ink text-sm font-mono mt-1 bg-gray-50 p-2 rounded">
                  {certificateData['university-principal']}
                </p>
              </div>
              
              {certificateData['issued-at'] && (
                <div>
                  <span className="text-muted font-medium">Issued at Block Height</span>
                  <p className="text-ink">{certificateData['issued-at']}</p>
                </div>
              )}
              
              {certificateData['revocation-reason'] && (
                <div className="mt-3">
                  <span className="text-muted font-medium">Revocation Reason</span>
                  <p className="text-ink">{certificateData['revocation-reason']}</p>
                </div>
              )}
            </div>
          </div>

          {/* Blockchain Verification Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-start">
              <div className="w-6 h-6 bg-verified rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">₿</span>
              </div>
              <div>
                <p className="text-sm font-medium text-ink mb-1">Blockchain Verified</p>
                <p className="text-xs text-muted">
                  This certificate is cryptographically secured and immutably recorded on the Stacks blockchain. 
                  The information displayed here cannot be tampered with or falsified.
                </p>
                <p className="text-xs text-muted mt-2 font-mono">
                  Certificate Hash: {certificateData['cert-hash']}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">About Certificate Verification</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• All certificates are secured on the blockchain and cannot be forged</li>
          <li>• Verification is instant and available 24/7</li>
          <li>• Only certificates issued through official university channels appear here</li>
          <li>• Revoked certificates are clearly marked and no longer valid</li>
        </ul>
      </div>
    </div>
  );
};

export default PublicVerification;