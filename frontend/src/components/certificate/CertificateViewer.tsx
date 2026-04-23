/**
 * Certificate Viewer Component
 * Displays certificate details and PDF document viewer
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  XMarkIcon,
  ArrowDownTrayIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

// Redux imports
import type { AppDispatch, RootState } from '../../store/index.js';
import { 
  downloadCertificatePDF,
  getFileInfo,
  selectCertificateLoadingStates,
  selectCertificateError 
} from '../../store/slices/certificateSlice.js';

// Types
import type { CertificateJSON, VerificationResult } from '../../types/index.js';

interface CertificateViewerProps {
  certificate: CertificateJSON;
  verificationResult?: VerificationResult;
  onClose: () => void;
}

const CertificateViewer: React.FC<CertificateViewerProps> = ({ 
  certificate, 
  verificationResult,
  onClose 
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const loadingStates = useSelector((state: RootState) => selectCertificateLoadingStates(state));
  const error = useSelector((state: RootState) => selectCertificateError(state));

  // Local state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    cid: string;
    size: number;
    type: string;
    message: string;
  } | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Load PDF when component mounts
  useEffect(() => {
    if (certificate.ipfsCid && verificationResult?.status === 'VALID') {
      loadPdf();
      loadFileInfo();
    }
  }, [certificate.ipfsCid, verificationResult?.status]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const loadPdf = async () => {
    if (!certificate.ipfsCid) return;

    setLoadingPdf(true);
    setPdfError(null);

    try {
      // Download the PDF blob
      const result = await dispatch(downloadCertificatePDF({
        ipfsCid: certificate.ipfsCid,
        fileName: `certificate-${certificate.admissionNo}.pdf`,
      })).unwrap();

      // Create object URL for viewing
      const url = URL.createObjectURL(result.blob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Failed to load PDF:', error);
      setPdfError(error instanceof Error ? error.message : 'Failed to load PDF');
    } finally {
      setLoadingPdf(false);
    }
  };

  const loadFileInfo = async () => {
    if (!certificate.ipfsCid) return;

    try {
      const info = await dispatch(getFileInfo(certificate.ipfsCid)).unwrap();
      setFileInfo(info);
    } catch (error) {
      console.error('Failed to load file info:', error);
    }
  };

  const handleDownload = async () => {
    if (!certificate.ipfsCid) return;

    try {
      await dispatch(downloadCertificatePDF({
        ipfsCid: certificate.ipfsCid,
        fileName: `certificate-${certificate.admissionNo}-${certificate.studentName.replace(/\s+/g, '-')}.pdf`,
      })).unwrap();
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'VALID': return 'green';
      case 'REVOKED': return 'red';
      case 'TAMPERED': return 'orange';
      case 'NOT_FOUND': return 'gray';
      default: return 'gray';
    }
  };

  const statusColor = getStatusColor(verificationResult?.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <DocumentIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Certificate Viewer</h2>
              <p className="text-sm text-gray-600">{certificate.studentName}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {verificationResult && (
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                statusColor === 'green' ? 'bg-green-100 text-green-800' :
                statusColor === 'red' ? 'bg-red-100 text-red-800' :
                statusColor === 'orange' ? 'bg-orange-100 text-orange-800' : 
                'bg-gray-100 text-gray-800'
              }`}>
                {verificationResult.status}
              </div>
            )}
            
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Certificate Details */}
          <div className="w-1/3 border-r border-gray-200 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate Details</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Student Name
                    </label>
                    <p className="mt-1 text-sm text-gray-900 font-medium">{certificate.studentName}</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Admission Number
                    </label>
                    <p className="mt-1 text-sm text-gray-900 font-mono">{certificate.admissionNo}</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Programme
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{certificate.programme}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Year
                      </label>
                      <p className="mt-1 text-sm text-gray-900">{certificate.year}</p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Grade
                      </label>
                      <p className="mt-1 text-sm text-gray-900 font-medium">{certificate.grade}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Certificate ID
                    </label>
                    <p className="mt-1 text-xs text-gray-600 font-mono break-all bg-gray-50 p-2 rounded">
                      {certificate.id}
                    </p>
                  </div>
                </div>
              </div>

              {/* File Information */}
              {fileInfo && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">File Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Size:</span>
                      <span className="text-gray-900">{formatFileSize(fileInfo.size)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type:</span>
                      <span className="text-gray-900">{fileInfo.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">IPFS CID:</span>
                      <span className="text-xs text-gray-600 font-mono">{fileInfo.cid.slice(0, 12)}...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Verification Details */}
              {verificationResult && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Verification Status</h4>
                  
                  {/* Security Checks */}
                  {verificationResult.securityChecks && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Blockchain</span>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${
                            verificationResult.securityChecks.blockchainVerified ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className={verificationResult.securityChecks.blockchainVerified ? 'text-green-700' : 'text-red-700'}>
                            {verificationResult.securityChecks.blockchainVerified ? 'Valid' : 'Invalid'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Hash Integrity</span>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${
                            verificationResult.securityChecks.hashVerified ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className={verificationResult.securityChecks.hashVerified ? 'text-green-700' : 'text-red-700'}>
                            {verificationResult.securityChecks.hashVerified ? 'Valid' : 'Invalid'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Document</span>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${
                            verificationResult.securityChecks.ipfsVerified ? 'bg-green-500' : 'bg-yellow-500'
                          }`} />
                          <span className={verificationResult.securityChecks.ipfsVerified ? 'text-green-700' : 'text-yellow-700'}>
                            {verificationResult.securityChecks.ipfsVerified ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                      </div>

                      {verificationResult.securityChecks.securityScore && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Security Score</span>
                            <span className="font-medium text-gray-900">
                              {Math.round(verificationResult.securityChecks.securityScore)}%
                            </span>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                verificationResult.securityChecks.securityScore >= 80 ? 'bg-green-500' :
                                verificationResult.securityChecks.securityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${verificationResult.securityChecks.securityScore}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Warnings */}
                  {verificationResult.warning && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex">
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                        <div className="ml-3">
                          <p className="text-sm text-yellow-800">{verificationResult.warning}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleDownload}
                  disabled={loadingStates.loading || !certificate.ipfsCid}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  {loadingStates.loading ? 'Downloading...' : 'Download PDF'}
                </button>

                {verificationResult?.status === 'VALID' && (
                  <div className="flex items-center space-x-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                    <ShieldCheckIcon className="h-4 w-4" />
                    <span>This certificate is verified and authentic</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - PDF Viewer */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-900">Certificate Document</h3>
            </div>
            
            <div className="flex-1 p-4">
              {loadingPdf ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-600">Loading certificate document...</p>
                  </div>
                </div>
              ) : pdfError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load document</h3>
                    <p className="text-sm text-gray-600 mb-4">{pdfError}</p>
                    <button
                      onClick={loadPdf}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : !certificate.ipfsCid || verificationResult?.status !== 'VALID' ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <DocumentIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Document not available</h3>
                    <p className="text-sm text-gray-600">
                      {verificationResult?.status === 'REVOKED' 
                        ? 'Document access restricted for revoked certificates'
                        : 'Document cannot be displayed due to verification status'}
                    </p>
                  </div>
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border border-gray-200 rounded-lg"
                  title="Certificate PDF"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <InformationCircleIcon className="h-12 w-12 text-blue-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">Click "Download PDF" to view the certificate document</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateViewer;