/**
 * Public Verification Dashboard
 * Allows anyone to verify certificates by ID without authentication
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { 
  MagnifyingGlassIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
  UserPlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

// Redux imports
import type { AppDispatch, RootState } from '../../store/index.js';
import { 
  verifyCertificate,
  downloadCertificatePDF,
  selectVerificationResult,
  selectCertificateLoadingStates,
  selectCertificateError,
  clearError 
} from '../../store/slices/certificateSlice.js';
import { clearAllSessions } from '../../store/slices/authSlice.js';

// Components
import CertificateViewer from '../certificate/CertificateViewer.js';

const PublicVerification: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const loadingStates = useSelector((state: RootState) => selectCertificateLoadingStates(state));
  const error = useSelector((state: RootState) => selectCertificateError(state));

  // Local state
  const [certId, setCertId] = useState('');
  const [submittedCertId, setSubmittedCertId] = useState('');
  const [showViewer, setShowViewer] = useState(false);

  // Get verification result for the submitted certificate
  const verificationResult = useSelector((state: RootState) => 
    submittedCertId ? selectVerificationResult(submittedCertId)(state) : null
  );

  // Handle verification
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedId = certId.trim();
    if (!trimmedId) {
      return;
    }

    // Clear any existing errors
    if (error) {
      dispatch(clearError());
    }

    setSubmittedCertId(trimmedId);
    
    try {
      await dispatch(verifyCertificate(trimmedId)).unwrap();
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };

  // Handle clear all sessions (for debugging)
  const handleClearAllSessions = async () => {
    if (confirm('This will clear all session data and refresh the page. Continue?')) {
      try {
        await dispatch(clearAllSessions()).unwrap();
        window.location.reload();
      } catch (error) {
        console.error('Failed to clear sessions:', error);
      }
    }
  };

  // Handle download PDF
  const handleDownload = async () => {
    if (!verificationResult?.certificate?.ipfsCid) {
      return;
    }

    try {
      await dispatch(downloadCertificatePDF({
        ipfsCid: verificationResult.certificate.ipfsCid,
        fileName: `certificate-${verificationResult.certificate.admissionNo || 'unknown'}.pdf`,
      })).unwrap();
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Get status color and icon
  const getStatusDisplay = () => {
    if (!verificationResult) return null;

    const status = verificationResult.status;
    switch (status) {
      case 'VALID':
        return {
          color: 'green',
          icon: CheckCircleIcon,
          text: 'Valid Certificate',
          description: 'This certificate is authentic and has not been revoked.'
        };
      case 'REVOKED':
        // Extract revocation reason from verification result message if available
        const revocationReason = verificationResult?.certificate?.revocationReason || 
                               (verificationResult?.message?.includes(':') ? 
                                verificationResult.message.split(':').slice(1).join(':').trim() : null);
        
        return {
          color: 'red',
          icon: XMarkIcon,
          text: 'Revoked Certificate',
          description: revocationReason ? 
            `This certificate has been revoked. Reason: ${revocationReason}` : 
            'This certificate has been revoked and is no longer valid.'
        };
      case 'NOT_FOUND':
        return {
          color: 'gray',
          icon: InformationCircleIcon,
          text: 'Certificate Not Found',
          description: 'No certificate found with this ID in our records.'
        };
      case 'TAMPERED':
        return {
          color: 'orange',
          icon: ExclamationTriangleIcon,
          text: 'Tampered Certificate',
          description: 'The certificate data may have been modified or corrupted.'
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center relative">
        {/* Top Right Buttons */}
        <div className="absolute top-0 right-0 flex space-x-2">
          <button
            onClick={handleClearAllSessions}
            className="inline-flex items-center space-x-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            title="Clear all session data (for debugging)"
          >
            <TrashIcon className="h-4 w-4" />
            <span>Clear Data</span>
          </button>
          <button
            onClick={() => navigate('/connect')}
            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <UserPlusIcon className="h-5 w-5" />
            <span>Connect Wallet</span>
          </button>
          {/* <button
            onClick={() => navigate('/setRole')}
            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <UserPlusIcon className="h-5 w-5" />
            <span>Set Roles</span>
          </button> */}
        </div>

        <div className="flex justify-center mb-4">
          <div className="bg-blue-100 rounded-full p-4">
            <ShieldCheckIcon className="h-12 w-12 text-blue-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Certificate Verification</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Verify the authenticity of academic certificates issued through the Certivert platform.
          Simply enter the certificate ID to get instant verification results.
        </p>
        <div className="mt-4 pt-4 border-t border-gray-200 max-w-2xl mx-auto">
          <p className="text-sm text-gray-500">
            Have a wallet? <button 
              onClick={() => navigate('/connect')} 
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Connect to access your dashboard
            </button>
          </p>
        </div>
      </div>

      {/* Verification Form */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label htmlFor="certId" className="block text-sm font-medium text-gray-700 mb-2">
              Certificate ID
            </label>
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <input
                  id="certId"
                  type="text"
                  value={certId}
                  onChange={(e) => setCertId(e.target.value)}
                  placeholder="Enter certificate ID (e.g., cert_abc123...)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  disabled={loadingStates.verifying}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
              </div>
              <button
                type="submit"
                disabled={loadingStates.verifying || !certId.trim()}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingStates.verifying ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">How to find your certificate ID:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Check your official certificate document</li>
                  <li>Look for the unique identifier provided by your institution</li>
                  <li>Contact your university's registrar if you need assistance</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Verification Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Verification Results */}
      {verificationResult && statusDisplay && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              statusDisplay.color === 'green' ? 'bg-green-100' :
              statusDisplay.color === 'red' ? 'bg-red-100' :
              statusDisplay.color === 'orange' ? 'bg-orange-100' : 'bg-gray-100'
            }`}>
              <statusDisplay.icon className={`h-8 w-8 ${
                statusDisplay.color === 'green' ? 'text-green-600' :
                statusDisplay.color === 'red' ? 'text-red-600' :
                statusDisplay.color === 'orange' ? 'text-orange-600' : 'text-gray-600'
              }`} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{statusDisplay.text}</h2>
            <p className="text-gray-600">{statusDisplay.description}</p>
          </div>

          {/* Certificate Details */}
          {verificationResult.certificate && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Details</h3>
              
              {/* Revocation Information - Show prominently for revoked certificates */}
              {verificationResult.status === 'REVOKED' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <XMarkIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-red-800 mb-1">Certificate Revocation</h4>
                      <p className="text-sm text-red-700">
                        This certificate has been officially revoked and is no longer valid.
                      </p>
                      {verificationResult.certificate.revocationReason && (
                        <div className="mt-2">
                          <span className="text-sm font-medium text-red-800">Reason: </span>
                          <span className="text-sm text-red-700">{verificationResult.certificate.revocationReason}</span>
                        </div>
                      )}
                      {verificationResult.certificate.revokedAt && (
                        <div className="mt-1">
                          <span className="text-sm font-medium text-red-800">Revoked at: </span>
                          <span className="text-sm text-red-700">
                            Block height {verificationResult.certificate.revokedAt}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Student Name</label>
                    <p className="text-lg text-gray-900">{verificationResult.certificate.studentName}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Admission Number</label>
                    <p className="text-lg text-gray-900">{verificationResult.certificate.admissionNo}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Programme</label>
                    <p className="text-lg text-gray-900">{verificationResult.certificate.programme}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Year</label>
                    <p className="text-lg text-gray-900">{verificationResult.certificate.year}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Grade</label>
                    <p className="text-lg text-gray-900">{verificationResult.certificate.grade}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {verificationResult.status === 'VALID' && verificationResult.certificate.ipfsCid && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    {/* <button
                      onClick={handleDownload}
                      disabled={loadingStates.loading}
                      className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                      {loadingStates.loading ? 'Downloading...' : 'Download Certificate'}
                    </button> */}
                    
                    <button
                      onClick={() => setShowViewer(true)}
                      className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      <DocumentCheckIcon className="h-5 w-5 mr-2" />
                      View Certificate
                    </button>
                  </div>
                </div>
              )}
              
              {/* Revoked Certificate Notice */}
              {verificationResult.status === 'REVOKED' && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                    <XMarkIcon className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-sm text-red-700 font-medium">
                      Document viewing and downloads are disabled for revoked certificates
                    </p>
                  </div>
                </div>
              )}

              {/* Security Information */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Verification Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                      verificationResult.verificationDetails?.blockchainVerified ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <p className="text-xs font-medium text-gray-700">Blockchain</p>
                    <p className="text-xs text-gray-500">
                      {verificationResult.verificationDetails?.blockchainVerified ? 'Verified' : 'Failed'}
                    </p>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                      verificationResult.verificationDetails?.hashVerified ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <p className="text-xs font-medium text-gray-700">Hash Integrity</p>
                    <p className="text-xs text-gray-500">
                      {verificationResult.verificationDetails?.hashVerified ? 'Valid' : 'Invalid'}
                    </p>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                      verificationResult.verificationDetails?.ipfsVerified ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <p className="text-xs font-medium text-gray-700">Document</p>
                    <p className="text-xs text-gray-500">
                      {verificationResult.verificationDetails?.ipfsVerified ? 'Available' : 'Unavailable'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Certificate Viewer Modal - Only for valid certificates */}
      {showViewer && verificationResult?.certificate && verificationResult.status === 'VALID' && (
        <CertificateViewer
          certificate={verificationResult.certificate}
          verificationResult={verificationResult}
          onClose={() => setShowViewer(false)}
        />
      )}

      {/* Information Section */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <div className="flex items-start space-x-3">
          <ShieldCheckIcon className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">About Certificate Verification</h3>
            <p className="text-blue-800 mb-4">
              Our verification system uses blockchain technology to ensure certificate authenticity. 
              Each certificate is cryptographically secured and cannot be forged or tampered with.
            </p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Instant verification with tamper-proof blockchain records</li>
              <li>• Secure document storage using IPFS technology</li>
              <li>• Multi-signature approval process for enhanced security</li>
              <li>• Real-time status updates for revoked certificates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicVerification;