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
import { certivertAPI, type PendingIssuance } from '../../services/api.js';
import { certificateStorage, type StoredCertificate } from '../../services/certificateStorage.js';

interface KNQADashboardProps {
  userAddress?: string;
}

const KNQADashboard: React.FC<KNQADashboardProps> = () => {
  console.log('🚀 KNQA Dashboard Component Rendering - NEW CODE VERSION');
  
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => selectUser(state));
  const walletAddress = useSelector((state: RootState) => selectWalletAddress(state));

  // Helper function to extract role from displayName (same as University dashboard)
  const getUserRole = (): 'university' | 'knqa' | 'unknown' => {
    try {
      console.log('🔧 getUserRole called with user:', user);
      if (!user?.displayName) {
        console.log('🔧 No displayName found, returning unknown');
        return 'unknown';
      }
      const displayName = user.displayName.toLowerCase();
      console.log('🔧 Checking displayName:', displayName);
      if (displayName.includes('university')) return 'university';
      if (displayName.includes('knqa')) return 'knqa';
      return 'unknown';
    } catch (error) {
      console.error('🚨 Error in getUserRole:', error);
      return 'unknown';
    }
  };
  
  const userRole = getUserRole();
  const isUniversity = userRole === 'university';
  const isKNQA = userRole === 'knqa';

  // Debug role detection
  console.log('🔍 KNQA Dashboard Role Debug:', { 
    userDisplayName: user?.displayName, 
    userRole, 
    isKNQA, 
    isUniversity,
    originalUserIsKNQA: user?.isKNQA 
  });

  // Local state
  const [activeTab, setActiveTab] = useState<'pending-approvals' | 'revoke-certificates' | 'issued-certificates' | 'revoked-certificates'>('pending-approvals');
  const [pendingIssuances, setPendingIssuances] = useState<PendingIssuance[]>([]);
  const [pendingCertificates, setPendingCertificates] = useState<any[]>([]);
  const [pendingRevocations, setPendingRevocations] = useState<any[]>([]);
  const [approvedCertificates, setApprovedCertificates] = useState<any[]>([]);
  const [revokedCertificates, setRevokedCertificates] = useState<any[]>([]);
  const [loadingIssuances, setLoadingIssuances] = useState(false);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [loadingRevocations, setLoadingRevocations] = useState(false);
  const [loadingRevokedCerts, setLoadingRevokedCerts] = useState(false);
  const [approvingCerts, setApprovingCerts] = useState<Set<string>>(new Set());
  const [approvingRevocations, setApprovingRevocations] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string>('');
  const [storedCertIds, setStoredCertIds] = useState<StoredCertificate[]>([]);

  // Debug component state
  console.log('🔍 KNQA Component State:', {
    pendingCertificatesLength: pendingCertificates.length,
    loadingCertificates,
    activeTab,
    walletAddress
  });

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'pending-approvals' && isKNQA) {
      loadPendingCertificates(); // Auto-load pending certificates when tab becomes active
    } else if (activeTab === 'revoke-certificates' && isKNQA) {
      loadPendingRevocations(); // Auto-load pending revocations when tab becomes active
    } else if (activeTab === 'issued-certificates' && isKNQA) {
      handleViewApprovedCertificates(); // Auto-load approved certificates when tab becomes active
    } else if (activeTab === 'revoked-certificates' && isKNQA) {
      loadRevokedCertificates(); // Auto-load revoked certificates when tab becomes active
    }
  }, [activeTab, isKNQA]);

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

  // Function to approve a pending certificate (KNQA only)
  const handleApproveCertificate = async (certId: string) => {
    if (!walletAddress) {
      setMessage('❌ Wallet not connected');
      return;
    }

    if (approvingCerts.has(certId)) {
      return; // Already approving this certificate
    }

    setApprovingCerts(prev => new Set(prev).add(certId));
    setMessage(`🔄 Approving certificate ${certId}...`);

    try {
      const { walletService } = await import('../../services/wallet.js');
      
      console.log(`🔐 KNQA approving certificate: ${certId}`);
      const result = await walletService.approveIssueCertificate(certId);
      
      console.log('✅ Certificate approval successful:', result);
      setMessage(`✅ Certificate ${certId} approved successfully! Transaction ID: ${result.txId}`);
      
      // Refresh both pending and approved lists after successful approval
      setTimeout(() => {
        loadPendingCertificates(); // Refresh pending certificates
        handleViewApprovedCertificates(); // Refresh approved certificates
      }, 2000); // Give time for blockchain confirmation
      
    } catch (error: any) {
      console.error('Failed to approve certificate:', error);
      setMessage(`❌ Failed to approve certificate: ${error.message}`);
    } finally {
      setApprovingCerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(certId);
        return newSet;
      });
    }
  };

  // Exact copy of University dashboard loadPendingCertificates function
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
      
      // Get stored certificate IDs for pending certificates - Modified for KNQA to see all pending certificates
      const pendingCerts = certificateStorage.getCertificatesByAction('pending'); // Remove walletAddress filter for KNQA
      const certIds = pendingCerts.map(cert => cert.certId);
      
      console.log(`📋 Loading ${certIds.length} pending certificates for KNQA dashboard...`);
      
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

  // Function to load approved certificates using batch function
  const handleViewApprovedCertificates = async () => {
    if (!walletAddress) {
      console.error('Wallet not connected');
      return;
    }

    setLoadingApproved(true);
    
    try {
      // Import wallet service and certificate storage
      const { walletService } = await import('../../services/wallet.js');
      const { certificateStorage } = await import('../../services/certificateStorage.js');
      
      // Get all issued/approved certificates from all wallets (KNQA can see all approved certificates)
      const allIssuedCerts = certificateStorage.getCertificatesByAction('issued');
      const allCertIds = allIssuedCerts.map(cert => cert.certId);
      
      console.log(`🔍 KNQA checking ${allCertIds.length} issued certificates from all wallets:`, allCertIds);
      
      if (allCertIds.length > 0) {
        // Use the batch function to get approved certificates
        const batchResult = await walletService.getCertificatesBatch(allCertIds);
        
        if (batchResult.success) {
          console.log('✅ Batch approved certificates result:', batchResult.data);
          setApprovedCertificates(batchResult.data);
          setMessage(`✅ Found ${batchResult.data.length} approved certificates`);
        } else {
          console.log('ℹ️ No approved certificates found:', batchResult.message);
          setApprovedCertificates([]);
          setMessage('ℹ️ No approved certificates found');
        }
      } else {
        console.log('ℹ️ No certificate IDs available to check for approved certificates');
        setApprovedCertificates([]);
      }
      
    } catch (error: any) {
      console.error('Failed to load approved certificates:', error);
      setApprovedCertificates([]);
      setMessage(`❌ Failed to load approved certificates: ${error.message}`);
    } finally {
      setLoadingApproved(false);
    }
  };

  // Function to load pending revocation requests
  const loadPendingRevocations = async () => {
    if (!walletAddress) {
      console.error('Wallet not connected');
      return;
    }

    setLoadingRevocations(true);
    
    try {
      // Import wallet service and certificate storage
      const { walletService } = await import('../../services/wallet.js');
      const { certificateStorage } = await import('../../services/certificateStorage.js');
      
      // STEP 1: Get locally stored pending revocations
      const storedPendingRevs = certificateStorage.getCertificatesByAction('pending-revocation');
      const storedRevCertIds = storedPendingRevs.map(cert => cert.certId);
      
      // STEP 2: Get all issued certificates to check for potential pending revocations
      const issuedCerts = certificateStorage.getCertificatesByAction('issued');
      const issuedCertIds = issuedCerts.map(cert => cert.certId);
      
      // STEP 3: Combine both lists and remove duplicates
      const allCertIdsToCheck = [...new Set([...storedRevCertIds, ...issuedCertIds])];
      
      console.log(`🔍 KNQA loading revocations for ${allCertIdsToCheck.length} certificate IDs...`);
      console.log('📋 Stored pending revocation IDs:', storedRevCertIds);
      console.log('📋 Issued certificate IDs to check:', issuedCertIds);
      console.log('📋 All certificate IDs to check:', allCertIdsToCheck);
      
      let foundRevocations = [];
      
      if (allCertIdsToCheck.length > 0) {
        // Use batch function for efficiency
        const batchResult = await walletService.getPendingRevocationsBatch(allCertIdsToCheck);
        
        if (batchResult.success) {
          foundRevocations = batchResult.data;
          console.log('✅ Pending revocations batch result:', foundRevocations);
          
          // STEP 4: Store newly discovered revocations for future use
          foundRevocations.forEach(revocation => {
            if (!storedRevCertIds.includes(revocation.certId)) {
              console.log(`📝 Storing newly discovered revocation for cert ID: ${revocation.certId}`);
              certificateStorage.storeCertificateId(
                revocation.certId,
                'pending-revocation',
                revocation.initiator // Use initiator's address as the wallet address
              );
            }
          });
          
        } else {
          console.log('ℹ️ Pending revocations batch call failed:', batchResult.message);
        }
      }
      
      // Update the pending revocations state
      setPendingRevocations(foundRevocations);
      console.log(`✅ Loaded ${foundRevocations.length} pending revocations`);
      
    } catch (error: any) {
      console.error('Failed to load pending revocations:', error);
      setPendingRevocations([]);
      setMessage(`❌ Failed to load pending revocations: ${error.message}`);
    } finally {
      setLoadingRevocations(false);
    }
  };

  // Function to approve a pending revocation (KNQA or University)
  const handleApproveRevocation = async (certId: string) => {
    if (!walletAddress) {
      setMessage('❌ Wallet not connected');
      return;
    }

    if (approvingRevocations.has(certId)) {
      return; // Already approving this revocation
    }

    setApprovingRevocations(prev => new Set(prev).add(certId));
    setMessage(`🔄 Approving revocation for certificate ${certId}...`);

    try {
      const { walletService } = await import('../../services/wallet.js');
      
      console.log(`🔐 KNQA approving revocation for certificate: ${certId}`);
      const result = await walletService.approveRevokeCertificate(certId);
      
      console.log('✅ Revocation approval successful:', result);
      setMessage(`✅ Revocation for certificate ${certId} approved successfully! Transaction ID: ${result.txId}`);
      
      // Refresh both pending revocations and approved lists after successful approval
      setTimeout(() => {
        loadPendingRevocations(); // Refresh pending revocations
        handleViewApprovedCertificates(); // Refresh approved certificates
      }, 2000); // Give time for blockchain confirmation
      
    } catch (error: any) {
      console.error('Failed to approve revocation:', error);
      setMessage(`❌ Failed to approve revocation: ${error.message}`);
    } finally {
      setApprovingRevocations(prev => {
        const newSet = new Set(prev);
        newSet.delete(certId);
        return newSet;
      });
    }
  };

  // Debug function to manually add the missing revocation request from blockchain
  const addMissingRevocation = async () => {
    try {
      const { certificateStorage } = await import('../../services/certificateStorage.js');
      // Add the certificate that was already requested on blockchain but not stored locally
      certificateStorage.storeCertificateId(
        'SmFtZXMgamltbXkt', // From the blockchain transaction (corrected ID)
        'pending-revocation', 
        'ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50' // University wallet from transaction
      );
      setMessage('✅ Added missing revocation request to storage - refresh pending revocations');
      console.log('🔧 Added missing certificate to storage');
    } catch (error: any) {
      console.error('Failed to add missing revocation:', error);
      setMessage(`❌ Failed to add missing revocation: ${error.message}`);
    }
  };

  // Function to load revoked certificates
  const loadRevokedCertificates = async () => {
    if (!walletAddress) {
      console.error('Wallet not connected');
      return;
    }

    setLoadingRevokedCerts(true);
    
    try {
      const { walletService } = await import('../../services/wallet.js');
      const { certificateStorage } = await import('../../services/certificateStorage.js');
      
      // KNQA should check ALL certificates it has approved, not just locally stored ones
      // Get certificates from approvedCertificates state (already loaded when KNQA approves them)
      let certIdsToCheck = [];
      
      // Method 1: Use approved certificates that are already loaded
      if (approvedCertificates && approvedCertificates.length > 0) {
        certIdsToCheck = approvedCertificates
          .map(cert => cert.id)
          .filter(id => id && typeof id === 'string' && id.trim() !== ''); // Filter out invalid IDs
        console.log(`🔍 KNQA checking ${certIdsToCheck.length} approved certificates for revocation status...`, certIdsToCheck);
      } else {
        // Method 2: Fallback - get from localStorage 
        const issuedCerts = certificateStorage.getCertificatesByAction('issued') || [];
        const revokedStoredCerts = certificateStorage.getCertificatesByAction('revoked') || [];
        certIdsToCheck = [...new Set([
          ...issuedCerts.map(cert => cert.certId).filter(id => id && typeof id === 'string' && id.trim() !== ''),
          ...revokedStoredCerts.map(cert => cert.certId).filter(id => id && typeof id === 'string' && id.trim() !== '')
        ])];
        console.log(`🔍 KNQA checking ${certIdsToCheck.length} stored certificates for revocation status...`, certIdsToCheck);
      }
      
      let foundRevokedCertificates = [];
      
      if (certIdsToCheck && certIdsToCheck.length > 0) {
        console.log(`📋 Calling getCertificatesBatch with ${certIdsToCheck.length} certificate IDs:`, certIdsToCheck);
        
        // Use batch function to get certificate data and check revocation status
        const batchResult = await walletService.getCertificatesBatch(certIdsToCheck);
        
        console.log('📋 Batch result received:', batchResult);
        
        if (batchResult && batchResult.success && batchResult.data) {
          console.log('🔍 === KNQA REVOKED CERTIFICATES ANALYSIS ===');
          
          // Enhanced filtering for revoked certificates
          foundRevokedCertificates = batchResult.data.filter(cert => {
            if (!cert) return false;
            
            const certId = cert.id || cert.certId || 'unknown';
            const isRevoked = cert.revokedAt && cert.revokedAt !== '0' && cert.revokedAt !== 0;
            
            console.log(`\n📄 Checking certificate ${certId}:`);
            console.log(`   🔢 Status: ${cert.status}`);
            console.log(`   ⏰ RevokedAt: ${cert.revokedAt}`);
            console.log(`   🚫 Is Revoked: ${isRevoked}`);
            
            return isRevoked;
          });
          
          console.log(`\n✅ KNQA found ${foundRevokedCertificates.length} revoked certificates:`, foundRevokedCertificates);
          
          // Store newly discovered revoked certificates for future use
          foundRevokedCertificates.forEach(cert => {
            console.log(`📝 KNQA storing revoked certificate: ${cert.id}`);
            certificateStorage.storeCertificateId(
              cert.id,
              'revoked',
              cert.universityPrincipal
            );
          });
          
        } else {
          console.log('ℹ️ Revoked certificates batch call failed:', batchResult.message);
        }
      } else {
        console.log('ℹ️ No certificates found to check for revocation status. Trying alternative methods...');
        
        // Method 3: Load approved certificates first and check them
        try {
          console.log('🔍 Loading approved certificates first...');
          await handleViewApprovedCertificates();
          
          // Check again after loading
          if (approvedCertificates && approvedCertificates.length > 0) {
            const validCertIds = approvedCertificates
              .map(cert => cert.id)
              .filter(id => id && typeof id === 'string' && id.trim() !== '');
            
            console.log(`🔍 Checking ${validCertIds.length} newly loaded approved certificates...`, validCertIds);
            
            if (validCertIds.length > 0) {
              const batchResult = await walletService.getCertificatesBatch(validCertIds);
              console.log('📋 Method 3 batch result:', batchResult);
              
              if (batchResult && batchResult.success && batchResult.data) {
                foundRevokedCertificates = batchResult.data.filter(cert => 
                  cert && cert.revokedAt && cert.revokedAt !== null && cert.revokedAt !== 0
                );
                console.log(`✅ Found ${foundRevokedCertificates.length} revoked certificates from approved certificates`);
              }
            }
          }
        } catch (error) {
          console.error('Failed to load approved certificates:', error);
        }
        
        // Method 4: If still no results, check all stored certificates from localStorage
        if (foundRevokedCertificates.length === 0) {
          console.log('🔍 Checking all stored certificates from localStorage...');
          const allStoredCerts = certificateStorage.getStoredCertificates() || []; // Get all certificates from any user
          const validStoredCertIds = allStoredCerts
            .map(cert => cert.certId)
            .filter(id => id && typeof id === 'string' && id.trim() !== '');
          
          console.log(`📋 Found ${validStoredCertIds.length} stored certificate IDs:`, validStoredCertIds);
          
          if (validStoredCertIds.length > 0) {
            try {
              const batchResult = await walletService.getCertificatesBatch(validStoredCertIds);
              console.log('📋 Method 4 batch result:', batchResult);
              
              if (batchResult && batchResult.success && batchResult.data) {
                foundRevokedCertificates = batchResult.data.filter(cert => 
                  cert && cert.revokedAt && cert.revokedAt !== null && cert.revokedAt !== 0
                );
                console.log(`✅ Found ${foundRevokedCertificates.length} revoked certificates from all stored certificates`);
              }
            } catch (error) {
              console.error('Method 4 batch call failed:', error);
            }
          }
        }
      }
      
      setRevokedCertificates(foundRevokedCertificates);
      console.log(`✅ KNQA loaded ${foundRevokedCertificates.length} revoked certificates`);
      
    } catch (error: any) {
      console.error('Failed to load revoked certificates:', error);
      setRevokedCertificates([]);
      setMessage(`❌ Failed to load revoked certificates: ${error.message}`);
    } finally {
      setLoadingRevokedCerts(false);
    }
  };

  // If user is not KNQA, redirect or show access denied
  if (!isKNQA) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You need KNQA credentials to access this dashboard.</p>
          <p className="text-gray-500 text-sm mt-2">
            Current role: {userRole} (from: {user?.displayName})
          </p>
          <button
            onClick={() => dispatch(disconnectWallet())}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Disconnect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">KNQA Dashboard</h1>
            <p className="text-gray-600 mt-1">Kenya National Qualifications Authority</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Connected as</div>
            <div className="font-semibold text-gray-900">
              {user?.displayName || 'KNQA Administrator'}
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

      {/* Status Message */}
      {message && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">{message}</p>
        </div>
      )}

      {/* Debug Section - Remove this after testing */}
      {/* <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Debug: Add Missing Revocation</h3>
            <p className="text-xs text-yellow-700">Add the blockchain revocation that wasn't stored locally</p>
          </div>
          <button
            onClick={addMissingRevocation}
            className="bg-yellow-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-yellow-700"
          >
            Add Missing Revocation
          </button>
        </div>
      </div> */}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('pending-approvals')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'pending-approvals'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
            Pending Approvals
            </button>
            <button
              onClick={() => setActiveTab('revoke-certificates')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'revoke-certificates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Revoke Certificates
            </button>
            <button
              onClick={() => setActiveTab('issued-certificates')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'issued-certificates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Issued Certificates
            </button>
            <button
              onClick={() => setActiveTab('revoked-certificates')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'revoked-certificates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Revoked Certificates
            </button>
          </nav>
        </div>
      </div>

      {/* Pending Approvals Tab */}
      {activeTab === 'pending-approvals' && (
        <div>
          {/* Pending Certificates List - Reusing University Dashboard Pattern */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Pending issued Certificates</h2>
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
                      {/* Conditional Action Button - Only show for KNQA users */}
                      {isKNQA ? (
                        <button
                          onClick={() => handleApproveCertificate(certificate.certId)}
                          disabled={approvingCerts.has(certificate.certId)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {approvingCerts.has(certificate.certId) ? 'Approving...' : 'Approve Certificate'}
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <ClockIcon className="h-4 w-4 text-yellow-500" />
                          <span className="text-xs text-yellow-600">Pending KNQA approval</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revoke Certificates Tab */}
      {activeTab === 'revoke-certificates' && (
        <div className="space-y-6">
          {/* Pending Revocations Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Pending Revocation Requests</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Revocation requests awaiting approval
                </p>
              </div>
              <button
                onClick={loadPendingRevocations}
                disabled={loadingRevocations}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50 text-sm"
              >
                {loadingRevocations ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {loadingRevocations ? (
              <div className="text-center py-8">
                <ClockIcon className="h-8 w-8 text-gray-300 mx-auto mb-3 animate-spin" />
                <p className="text-gray-500">Loading pending revocation requests...</p>
              </div>
            ) : pendingRevocations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <XMarkIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium">No pending revocations</p>
                <p className="text-sm">Revocation requests awaiting approval will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRevocations.map((revocation) => (
                  <div key={revocation.certId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">Certificate ID: {revocation.certId}</h3>
                        <p className="text-sm text-gray-600">
                          Requested by: {revocation.initiator.slice(0, 8)}...{revocation.initiator.slice(-6)}
                        </p>
                      </div>
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                        Awaiting Approval
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-gray-600">Initiator Role:</span>
                        <p className="text-gray-900 mt-1">
                          {revocation.initiatorRole === 1 ? 'Admin' : 
                           revocation.initiatorRole === 2 ? 'University' : 
                           revocation.initiatorRole === 3 ? 'KNQA' : 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Requested At:</span>
                        <p className="text-gray-900 mt-1">Block Height: {revocation.requestedAt}</p>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-gray-600">Reason:</span>
                        <p className="text-gray-900 mt-1">{revocation.reason}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500">
                        Certificate: {revocation.certId}
                      </div>
                      <button
                        onClick={() => handleApproveRevocation(revocation.certId)}
                        disabled={approvingRevocations.has(revocation.certId)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        {approvingRevocations.has(revocation.certId) ? 'Approving...' : 'Approve Revocation'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Issued Certificates Tab */}
      {activeTab === 'issued-certificates' && (
        <div>
          {/* View Issued Certificates Button Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-lg p-3">
                  <DocumentCheckIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <h2 className="text-lg font-semibold text-gray-900">View Issued Certificates</h2>
                  <p className="text-sm text-gray-600">All certificates that have been successfully issued</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleViewApprovedCertificates}
              disabled={loadingApproved}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingApproved ? 'Loading...' : 'View Issued Certificates'}
            </button>
          </div>

          {/* Issued Certificates List */}
          {approvedCertificates.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Issued Certificates</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Certificates that have been approved and issued
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {approvedCertificates.map((certificate) => (
                  <div key={certificate.certId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">Issued Certificate</h3>
                        <p className="text-sm text-gray-600">
                          University: {certificate.universityPrincipal?.slice(0, 8)}...{certificate.universityPrincipal?.slice(-6)}
                        </p>
                      </div>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        Approved & Issued
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
                        <span className="text-gray-600">Issued At:</span>
                        <p className="text-gray-900 mt-1">Block Height: {certificate.approvedAt || certificate.requestedAt}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500">
                        Hash: {certificate.certHash}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="h-4 w-4 bg-green-500 rounded-full" />
                        <span className="text-xs text-green-600">Active Certificate</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revoked Certificates Tab */}
      {activeTab === 'revoked-certificates' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Successfully Revoked Certificates</h2>
              <p className="text-sm text-gray-600 mt-1">
                Certificates that have been revoked by KNQA approval
              </p>
            </div>
            <button
              onClick={loadRevokedCertificates}
              disabled={loadingRevokedCerts}
              className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 text-sm"
            >
              {loadingRevokedCerts ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loadingRevokedCerts ? (
            <div className="text-center py-12 text-gray-500">
              <XMarkIcon className="h-8 w-8 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500">Loading revoked certificates...</p>
            </div>
          ) : revokedCertificates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <XMarkIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No revoked certificates</p>
              <p className="text-sm">Successfully revoked certificates will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {revokedCertificates.map((certificate) => (
                <div key={certificate.id || certificate.certId} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">Certificate ID: {certificate.id || certificate.certId}</h3>
                      <p className="text-sm text-gray-600">
                        Student: {certificate.studentName} ({certificate.admissionNo})
                      </p>
                      <p className="text-sm text-gray-600">
                        Programme: {certificate.programme} | Year: {certificate.year} | Grade: {certificate.grade}
                      </p>
                    </div>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                      Revoked
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">University:</span>
                      <p className="text-gray-900 mt-1 font-mono text-xs">
                        {certificate.universityPrincipal.slice(0, 8)}...{certificate.universityPrincipal.slice(-6)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Revoked At:</span>
                      <p className="text-gray-900 mt-1">Block Height: {certificate.revokedAt}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-gray-600">IPFS CID:</span>
                      <p className="text-gray-900 mt-1 font-mono text-xs break-all">{certificate.ipfsCid}</p>
                    </div>
                    {certificate.revocationReason && (
                      <div className="md:col-span-2">
                        <span className="text-gray-600">Revocation Reason:</span>
                        <p className="text-gray-900 mt-1">{certificate.revocationReason}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Hash: {certificate.certHash}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 bg-red-500 rounded-full" />
                      <span className="text-xs text-red-600">Revoked Certificate</span>
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