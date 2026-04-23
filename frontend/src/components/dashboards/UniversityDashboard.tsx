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

// Stacks imports
import { stringAsciiCV } from '@stacks/transactions';

// Services
import { certificateService } from '../../services/certificate.js';
import { certivertAPI, type PendingIssuance } from '../../services/api.js';

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
  const [activeTab, setActiveTab] = useState<'issue' | 'revoke' | 'pending' | 'approved' | 'approvals'>(
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

  // Certificate search state
  const [searchCertId, setSearchCertId] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Form validation
  const [issueFormErrors, setIssueFormErrors] = useState<string[]>([]);
  const [revokeFormErrors, setRevokeFormErrors] = useState<string[]>([]);

  // Pending certificates state
  const [pendingCertificates, setPendingCertificates] = useState<PendingIssuance[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  
  // Approved certificates state
  const [approvedCertificates, setApprovedCertificates] = useState<any[]>([]);
  const [loadingApproved, setLoadingApproved] = useState(false);
  
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

  // Load pending certificates when pending tab is active
  useEffect(() => {
    if (activeTab === 'pending' && (isUniversity || isKNQA)) {
      loadPendingCertificates();
    }
  }, [activeTab, isUniversity, isKNQA]);

  // Load pending issuances when approvals tab is active (KNQA only)
  useEffect(() => {
    if (activeTab === 'approvals' && isKNQA) {
      loadPendingIssuances();
    }
  }, [activeTab, isKNQA]);

  // Load approved certificates when approved tab is active (University only)
  useEffect(() => {
    if (activeTab === 'approved' && isUniversity) {
      handleViewApprovedCertificates();
    }
  }, [activeTab, isUniversity]);

  // Function to fetch actual pending certificate data using batch function
  const handleViewCertificates = async () => {
    if (!walletAddress) {
      console.error('Wallet not connected');
      return;
    }

    setLoadingPending(true);
    
    try {
      // Import wallet service and certificate storage
      const { walletService } = await import('../../services/wallet.js');
      const { certificateStorage } = await import('../../services/certificateStorage.js');
      
      // Get stored certificate IDs for this wallet - use stored certs as primary source
      const storedCerts = certificateStorage.getCertificatesForWallet(walletAddress);
      
      // Extract certificate IDs from stored certificates
      const allCertIds = storedCerts.map(cert => cert.certId);
      
      console.log(`📋 Found ${storedCerts.length} stored certificates for wallet ${walletAddress.slice(0, 8)}...`);
      
      console.log('🔍 Using batch function to fetch certificate data for IDs:', allCertIds);
      let foundCertificates = [];
      
      if (allCertIds.length > 0) {
        // Use the new batch function to get pending certificates efficiently
        const batchResult = await walletService.getPendingIssuancesBatch(allCertIds);
        
        if (batchResult.success) {
          console.log('✅ Batch pending certificates result:', batchResult.data);
          foundCertificates = batchResult.data;
        } else {
          console.log('ℹ️ Batch pending certificates call failed:', batchResult.message);
        }
      }
      
      // Update the pending certificates state with real data
      setPendingCertificates(foundCertificates);
      
      console.log(`✅ Found ${foundCertificates.length} pending certificates using batch function`);
      
      // Switch to pending tab to show the results
      setActiveTab('pending');
      
    } catch (error: any) {
      console.error('Failed to fetch certificates:', error);
      
      const errorMessage = error.message || String(error);
      console.error('Failed to fetch certificates:', errorMessage);
    } finally {
      setLoadingPending(false);
    }
  };

  // Load pending certificates using stored certificate IDs
  const loadPendingCertificates = async () => {
    if (!walletAddress) {
      console.error('Wallet not connected');
      return;
    }

    setLoadingPending(true);
    
    try {
      // Import wallet service and certificate storage
      const { walletService } = await import('../../services/wallet.js');
      const { certificateStorage } = await import('../../services/certificateStorage.js');
      
      // Get stored certificate IDs for pending certificates
      const pendingCerts = certificateStorage.getCertificatesByAction('pending', walletAddress);
      const certIds = pendingCerts.map(cert => cert.certId);
      
      console.log(`📋 Loading ${certIds.length} pending certificates for wallet ${walletAddress.slice(0, 8)}...`);
      
      let foundCertificates = [];
      
      if (certIds.length > 0) {
        // Use batch function for efficiency
        const batchResult = await walletService.getPendingIssuancesBatch(certIds);
        
        if (batchResult.success) {
          foundCertificates = batchResult.data;
          console.log('✅ Pending certificates batch result:', foundCertificates);
        } else {
          console.log('ℹ️ Pending certificates batch call failed:', batchResult.message);
        }
      }
      
      // Update the pending certificates state
      setPendingCertificates(foundCertificates);
      console.log(`✅ Loaded ${foundCertificates.length} pending certificates`);
      
    } catch (error: any) {
      console.error('Failed to load pending certificates:', error);
    } finally {
      setLoadingPending(false);
    }
  };

  // Search for specific certificate by ID using read-only call
  const handleSearchCertificate = async () => {
    if (!searchCertId.trim()) {
      alert('Please enter a certificate ID');
      return;
    }

    if (!walletAddress) {
      alert('Wallet not connected');
      return;
    }

    setSearchLoading(true);
    setSearchResult(null);
    
    try {
      console.log(`🔍 Searching for certificate: ${searchCertId}`);
      
      // Import wallet service to make read-only contract call
      const { walletService } = await import('../../services/wallet.js');
      
      const result = await walletService.getPendingCertificateData(searchCertId);
      
      if (result.success && result.data) {
        console.log('✅ Certificate found:', result.data);
        setSearchResult(result.data);
      } else {
        console.log('ℹ️ No certificate found:', result.message);
        setSearchResult({ notFound: true, message: result.message });
      }
      
    } catch (error: any) {
      console.error('Failed to search certificate:', error);
      setSearchResult({ 
        error: true, 
        message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setSearchLoading(false);
    }
  };

  // Function to load pending issuances for KNQA approval
  const loadPendingIssuances = async () => {
    if (!walletAddress) {
      console.error('Wallet not connected');
      return;
    }

    setLoadingPending(true);
    
    try {
      // Import wallet service and certificate storage
      const { walletService } = await import('../../services/wallet.js');
      const { certificateStorage } = await import('../../services/certificateStorage.js');
      
      // Get all pending certificates from all wallets (KNQA needs to see all pending requests)
      const allPendingCerts = certificateStorage.getCertificatesByAction('pending');
      const certIds = allPendingCerts.map(cert => cert.certId);
      
      console.log(`📋 KNQA loading ${certIds.length} pending certificate requests for approval...`);
      
      let foundCertificates = [];
      
      if (certIds.length > 0) {
        // Use batch function for efficiency
        const batchResult = await walletService.getPendingIssuancesBatch(certIds);
        
        if (batchResult.success) {
          foundCertificates = batchResult.data;
          console.log('✅ KNQA pending issuances batch result:', foundCertificates);
        } else {
          console.log('ℹ️ KNQA pending issuances batch call failed:', batchResult.message);
        }
      }
      
      // Update the pending certificates state  
      setPendingCertificates(foundCertificates);
      console.log(`✅ Loaded ${foundCertificates.length} pending issuances for KNQA approval`);
      
    } catch (error: any) {
      console.error('Failed to load pending issuances:', error);
    } finally {
      setLoadingPending(false);
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
      // Import wallet service
      const { walletService } = await import('../../services/wallet.js');
      
      // Call the revocation function directly
      const result = await walletService.requestRevokeCertificate(
        revokeForm.certId.trim(),
        revokeForm.reason.trim()
      );
      
      console.log('✅ Revocation request submitted:', result.txId);

      // Success - close modal and reset form
      setShowRevokeModal(false);
      setRevokeForm({ certId: '', reason: '' });
      
      // Show success message (optional)
      alert('Certificate revocation request submitted successfully! Transaction ID: ' + result.txId);
      
    } catch (error: any) {
      console.error('Certificate revocation failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Show user-friendly error messages
      if (errorMessage.includes('USER_CANCELLED')) {
        // Don't show error for user cancellation
        console.log('User cancelled revocation request');
      } else if (errorMessage.includes('INSUFFICIENT_FUNDS')) {
        alert('Insufficient STX balance to pay transaction fees. Please add STX to your wallet.');
      } else if (errorMessage.includes('CONTRACT_ERROR')) {
        alert('Contract error: ' + errorMessage);
      } else if (errorMessage.includes('NETWORK_ERROR')) {
        alert('Network error. Please check your internet connection and try again.');
      } else {
        alert('Revocation request failed: ' + errorMessage);
      }
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIssueForm(prev => ({ ...prev, file }));
    }
  };

  // Function to load approved certificates that this university issued
  const handleViewApprovedCertificates = async () => {
    if (!walletAddress) {
      console.error('❌ University wallet not connected');
      return;
    }

    setLoadingApproved(true);
    console.log(`🏛️ === UNIVERSITY APPROVED CERTIFICATES LOADING (${walletAddress.slice(0, 8)}...) ===`);

    try {
      // Import wallet service and certificate storage
      const { walletService } = await import('../../services/wallet.js');
      const { certificateStorage } = await import('../../services/certificateStorage.js');
      
      // Method 1: Use existing loaded certificates if available
      console.log('📋 Method 1: Checking localStorage for stored certificates...');
      const issuedCerts = certificateStorage.getCertificatesByAction('issued', walletAddress) || [];
      const pendingCerts = certificateStorage.getCertificatesByAction('pending', walletAddress) || [];
      const allStoredCerts = certificateStorage.getCertificatesForWallet(walletAddress) || [];
      
      console.log(`   - Issued certificates in storage: ${issuedCerts.length}`);
      console.log(`   - Pending certificates in storage: ${pendingCerts.length}`);
      console.log(`   - Total stored certificates: ${allStoredCerts.length}`);
      
      // Combine all certificate IDs from this university
      const storedCertIds = [...new Set([
        ...issuedCerts.map(cert => cert.certId),
        ...pendingCerts.map(cert => cert.certId),
        ...allStoredCerts.map(cert => cert.certId)
      ])].filter(id => id && typeof id === 'string' && id.trim() !== '');
      
      console.log(`🔍 University checking ${storedCertIds.length} stored certificates:`, storedCertIds);
      
      let foundApprovedCertificates = [];
      
      // Method 2: Query blockchain for certificate status
      if (storedCertIds.length > 0) {
        console.log('🔗 Method 2: Querying blockchain for certificate status...');
        const batchResult = await walletService.getCertificatesBatch(storedCertIds);
        console.log('📋 University blockchain query result:', batchResult);
        
        if (batchResult && batchResult.success && batchResult.data) {
          console.log(`✅ Successfully retrieved ${batchResult.data.length} certificates from blockchain`);
          
          // Enhanced debugging - analyze each certificate thoroughly
          console.log('🔍 === DETAILED CERTIFICATE ANALYSIS ===');
          batchResult.data.forEach((cert, index) => {
            const certId = cert.id || cert.certId || `cert_${index}`;
            console.log(`\n📄 Certificate ${index + 1}: ${certId}`);
            console.log(`   📊 Full certificate data:`, cert);
            console.log(`   🏛️  University Principal: ${cert.universityPrincipal}`);
            console.log(`   💼 Connected Wallet: ${walletAddress}`);
            console.log(`   ✅ University Match: ${cert.universityPrincipal === walletAddress}`);
            console.log(`   🔢 Status Code: ${cert.status} (type: ${typeof cert.status})`);
            console.log(`   ⏰ Revoked At: ${cert.revokedAt} (${new Date(Number(cert.revokedAt) * 1000).toISOString()})`);
            console.log(`   📅 Approved At: ${cert.approvedAt || 'N/A'}`);
            console.log(`   📅 Requested At: ${cert.requestedAt || 'N/A'}`);
            
            // Check if this certificate was approved (status 200 = active, 400 = revoked but was approved)
            const isActive = cert.status === 200 || cert.status === '200';
            const wasRevoked = cert.status === 400 || cert.status === '400';
            const altActive = cert.status === 1 || cert.status === '1';
            const wasApproved = isActive || wasRevoked || altActive;
            
            console.log(`   📈 Status Analysis:`);
            console.log(`      - Is Active (200): ${isActive}`);
            console.log(`      - Was Revoked (400): ${wasRevoked}`);
            console.log(`      - Alternative Active (1): ${altActive}`);
            console.log(`      - Was Approved: ${wasApproved}`);
            
            if (cert.revokedAt && cert.revokedAt !== '0' && cert.revokedAt !== 0) {
              console.log(`   🚫 REVOCATION INFO: This certificate was revoked at block ${cert.revokedAt}`);
            } else {
              console.log(`   ✅ ACTIVE STATUS: This certificate is currently active`);
            }
          });
          
          // Enhanced filtering logic
          console.log('\n🎯 === FILTERING CERTIFICATES ===');
          foundApprovedCertificates = batchResult.data.filter(cert => {
            if (!cert) {
              console.log('⚠️  Skipping null/undefined certificate');
              return false;
            }
            
            const certId = cert.id || cert.certId || 'unknown';
            const universityMatch = cert.universityPrincipal === walletAddress;
            
            // Enhanced approval check - accept certificates that were processed by KNQA
            const wasApproved = cert.status && (
              cert.status === 200 || cert.status === '200' || // Currently active
              cert.status === 400 || cert.status === '400' || // Revoked (but was approved first)
              cert.status === 1 || cert.status === '1' // Alternative active status
            );
            
            const shouldInclude = universityMatch && wasApproved;
            
            console.log(`\n🎯 Filter Decision for ${certId}:`);
            console.log(`   🏛️  University Match: ${universityMatch} (${cert.universityPrincipal} === ${walletAddress})`);
            console.log(`   ✅ Was Approved: ${wasApproved} (status: ${cert.status})`);
            console.log(`   📊 Include in Results: ${shouldInclude}`);
            
            if (cert.revokedAt && cert.revokedAt !== '0' && cert.revokedAt !== 0) {
              console.log(`   📋 Note: This certificate is REVOKED but still included (was previously approved)`);
            }
            
            return shouldInclude;
          });
          
          console.log(`\n✅ === FILTERING COMPLETE ===`);
          console.log(`📊 Total certificates analyzed: ${batchResult.data.length}`);
          console.log(`✅ Approved certificates found: ${foundApprovedCertificates.length}`);
          
          if (foundApprovedCertificates.length > 0) {
            console.log('📋 Approved certificates details:');
            foundApprovedCertificates.forEach((cert, index) => {
              const isRevoked = cert.revokedAt && cert.revokedAt !== '0' && cert.revokedAt !== 0;
              console.log(`   ${index + 1}. ${cert.id || cert.certId} - ${isRevoked ? 'REVOKED' : 'ACTIVE'} (status: ${cert.status})`);
            });
          }
          
          // Store newly discovered approved certificates for future use
          foundApprovedCertificates.forEach(cert => {
            const certId = cert.id || cert.certId;
            if (certId) {
              console.log(`📝 Storing approved certificate in localStorage: ${certId}`);
              certificateStorage.storeCertificateId(
                certId,
                'issued', // Mark as issued since it was approved by KNQA
                walletAddress
              );
            }
          });
          
        } else {
          console.log('❌ University certificates batch query failed:', batchResult?.message || 'Unknown error');
        }
      } else {
        console.log('ℹ️  No stored certificates found - this university may not have issued any certificates yet');
      }
      
      // Method 3: Fallback - check all certificates in localStorage from any user
      if (foundApprovedCertificates.length === 0) {
        console.log('\n🔄 Method 3: Fallback search across all stored certificates...');
        const allStoredCertificates = certificateStorage.getStoredCertificates();
        console.log(`   Found ${allStoredCertificates.length} total certificates in localStorage`);
        
        if (allStoredCertificates.length > 0) {
          const allCertIds = allStoredCertificates.map(cert => cert.certId).filter(id => id);
          console.log(`   Checking ${allCertIds.length} certificate IDs for university match...`);
          
          if (allCertIds.length > 0) {
            const fallbackResult = await walletService.getCertificatesBatch(allCertIds);
            
            if (fallbackResult && fallbackResult.success && fallbackResult.data) {
              const universityMatches = fallbackResult.data.filter(cert => {
                return cert && cert.universityPrincipal === walletAddress && 
                       cert.status && (cert.status === 200 || cert.status === '200' || cert.status === 400 || cert.status === '400' || cert.status === 1);
              });
              
              if (universityMatches.length > 0) {
                console.log(`   ✅ Fallback found ${universityMatches.length} additional university certificates`);
                foundApprovedCertificates = universityMatches;
                
                // Store these newly found certificates
                universityMatches.forEach(cert => {
                  const certId = cert.id || cert.certId;
                  if (certId) {
                    certificateStorage.storeCertificateId(certId, 'issued', walletAddress);
                  }
                });
              } else {
                console.log('   ℹ️  No additional university certificates found in fallback search');
              }
            }
          }
        }
      }
      
      console.log(`\n🎯 === FINAL RESULTS ===`);
      console.log(`✅ University ${walletAddress.slice(0, 8)}... found ${foundApprovedCertificates.length} approved certificates`);
      
      if (foundApprovedCertificates.length > 0) {
        const activeCount = foundApprovedCertificates.filter(cert => !(cert.revokedAt && cert.revokedAt !== '0' && cert.revokedAt !== 0)).length;
        const revokedCount = foundApprovedCertificates.length - activeCount;
        console.log(`   📊 Active: ${activeCount}, Revoked: ${revokedCount}`);
      }
      
      setApprovedCertificates(foundApprovedCertificates);
      
    } catch (error: any) {
      console.error('❌ Failed to load approved certificates:', error);
      console.error('   Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
    } finally {
      setLoadingApproved(false);
      console.log('🏁 University approved certificates loading complete\n');
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
                  Pending Certificates
                </button>
                <button
                  onClick={() => setActiveTab('approved')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'approved'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Approved Certificates
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
      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> */}
        {/* Issue Certificate Card - University only */}
        {/* {isUniversity && (
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
        )} */}

        {/* Revoke Certificate Card - Both University and KNQA */}
        {/* {(isUniversity || isKNQA) && (
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
        )} */}

        {/* View Certificates Card - Both University and KNQA */}
        {/* {(isUniversity || isKNQA) && (
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
              onClick={handleViewCertificates}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              View All Certificates (Wallet)
            </button>
          </div>
        )} */}
      {/* </div> */}

      {/* Issue Certificates Tab Content */}
      {activeTab === 'issue' && isUniversity && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Issue Certificates</h2>
              <p className="text-sm text-gray-600 mt-1">
                Submit new certificate requests for KNQA approval
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <PlusIcon className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-blue-600">Ready to Issue</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Issue Certificate Action Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 rounded-lg p-3">
                  <DocumentCheckIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">New Certificate</h3>
                  <p className="text-sm text-gray-600">Create a certificate issuance request</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowIssueModal(true)}
                disabled={loadingStates.issuing}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <PlusIcon className="h-5 w-5" />
                <span>{loadingStates.issuing ? 'Processing...' : 'Issue Certificate'}</span>
              </button>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending Approval</span>
                  <span className="font-semibold text-yellow-600">{pendingCertificates.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Approved</span>
                  <span className="font-semibold text-green-600">{approvedCertificates.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Recent Activity</span>
                  <span className="font-semibold text-gray-600">{recentActivity.length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-blue-400 rounded-full mt-2"></div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> All certificate issuance requests require KNQA approval before becoming active. 
                  You can track the status in the "Pending Certificates" tab.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Certificates Tab Content */}
      {activeTab === 'revoke' && (isUniversity || isKNQA) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Revoke Certificates</h2>
              <p className="text-sm text-gray-600 mt-1">
                {isKNQA ? 'Initiate certificate revocation' : 'Request certificate revocation from KNQA'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <XMarkIcon className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-red-600">Revocation Tools</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revoke Certificate Action Card */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="bg-red-100 rounded-lg p-3">
                  <XMarkIcon className="h-8 w-8 text-red-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Revoke Certificate</h3>
                  <p className="text-sm text-gray-600">
                    {isKNQA ? 'Process revocation request' : 'Submit revocation request'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setShowRevokeModal(true)}
                disabled={loadingStates.revoking}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <XMarkIcon className="h-5 w-5" />
                <span>{loadingStates.revoking ? 'Processing...' : 'Revoke Certificate'}</span>
              </button>
            </div>

            {/* Certificate Search Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Certificate</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter certificate ID"
                  value={searchCertId}
                  onChange={(e) => setSearchCertId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={searchLoading}
                />
                <button
                  onClick={handleSearchCertificate}
                  disabled={searchLoading}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {searchLoading ? 'Searching...' : 'Search Certificate'}
                </button>
              </div>
            </div>
          </div>

          {/* Search Results */}
          {searchResult && (
            <div className="mt-6">
              {searchResult.error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-900 mb-1">Error</h4>
                  <p className="text-red-800 text-sm">{searchResult.message}</p>
                </div>
              ) : searchResult.notFound ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-900 mb-1">Not Found</h4>
                  <p className="text-yellow-800 text-sm">{searchResult.message}</p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">Certificate Found</h4>
                  <div className="text-sm text-green-800 space-y-1">
                    <p><strong>Student:</strong> {searchResult.studentName}</p>
                    <p><strong>ID:</strong> {searchResult.admissionNo}</p>
                    <p><strong>Programme:</strong> {searchResult.programme}</p>
                    <p><strong>Year:</strong> {searchResult.year} | <strong>Grade:</strong> {searchResult.grade}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Certificate revocation is irreversible. 
                  {isKNQA ? ' As KNQA, your approval will immediately revoke the certificate.' 
                          : ' Your request will need KNQA approval before the certificate is revoked.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Certificates Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pending Certificates</h2>
              <p className="text-sm text-gray-600 mt-1">
                Certificates awaiting KNQA approval
              </p>
            </div>
            <button
              onClick={loadPendingCertificates}
              disabled={loadingPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loadingPending ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loadingPending ? (
            <div className="text-center py-8">
              <ClockIcon className="h-8 w-8 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500">Loading pending certificates...</p>
            </div>
          ) : pendingCertificates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DocumentCheckIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No pending certificates</p>
              <p className="text-sm">Certificate issuance requests awaiting KNQA approval will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCertificates.map((certificate) => (
                <div key={certificate.certId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">Certificate ID: {certificate.certId}</h3>
                      <p className="text-sm text-gray-600">
                        University: {certificate.universityPrincipal.slice(0, 8)}...{certificate.universityPrincipal.slice(-6)}
                      </p>
                    </div>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                      Awaiting KNQA Approval
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Student:</span>
                      <p className="text-gray-900 mt-1">{certificate.studentName}</p>
                      <p className="text-gray-600 text-xs">ID: {certificate.admissionNo}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Programme:</span>
                      <p className="text-gray-900 mt-1">{certificate.programme}</p>
                      <p className="text-gray-600 text-xs">Year: {certificate.year} | Grade: {certificate.grade}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">IPFS CID:</span>
                      <p className="text-gray-900 mt-1 font-mono text-xs break-all">{certificate.ipfsCid}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Requested At:</span>
                      <p className="text-gray-900 mt-1">Block Height: {certificate.requestedAt}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Hash: {certificate.certHash}
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

      {/* Approved Certificates Tab */}
      {activeTab === 'approved' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Approved Certificates</h2>
              <p className="text-sm text-gray-600 mt-1">
                Certificates approved by KNQA 
              </p>
            </div>
            <button
              onClick={handleViewApprovedCertificates}
              disabled={loadingApproved}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loadingApproved ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loadingApproved ? (
            <div className="text-center py-8">
              <ClockIcon className="h-8 w-8 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500">Loading approved certificates...</p>
            </div>
          ) : approvedCertificates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DocumentCheckIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No approved certificates</p>
              <p className="text-sm">Certificates approved by KNQA will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedCertificates.map((certificate) => (
                <div key={certificate.id || certificate.certId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">Certificate ID: {certificate.id || certificate.certId}</h3>
                      <p className="text-sm text-gray-600">
                        University: {certificate.universityPrincipal?.slice(0, 8)}...{certificate.universityPrincipal?.slice(-6)}
                      </p>
                    </div>
                    {certificate.revokedAt && certificate.revokedAt !== '0' && certificate.revokedAt !== 0 ? (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                        Revoked
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Student:</span>
                      <p className="text-gray-900 mt-1">{certificate.studentName}</p>
                      <p className="text-gray-600 text-xs">ID: {certificate.admissionNo}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Programme:</span>
                      <p className="text-gray-900 mt-1">{certificate.programme}</p>
                      <p className="text-gray-600 text-xs">Year: {certificate.year} | Grade: {certificate.grade}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">IPFS CID:</span>
                      <p className="text-gray-900 mt-1 font-mono text-xs break-all">{certificate.ipfsCid}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Approved At:</span>
                      <p className="text-gray-900 mt-1">Block Height: {certificate.approvedAt || certificate.requestedAt}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Hash: {certificate.certHash}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 bg-green-500 rounded-full" />
                      <span className="text-xs text-green-600">Ready for use</span>
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