import { useState, useEffect } from 'react';
import AppShell from '../../components/layout/AppShell';
import StatusStamp from '../../components/ui/StatusStamp';
import QRDisplay from '../../components/ui/QRDisplay';
import QRScanner from '../../components/ui/QRScanner';
import { verifyCertificate } from '../../lib/api';

function VerifyCertificate() {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'scan'
  const [certId, setCertId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [status, setStatus] = useState(null);

  // Check URL params for pre-filled cert ID
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const certParam = urlParams.get('cert');
    if (certParam) {
      setCertId(certParam);
      handleVerification(certParam);
    }
  }, []);

  const handleVerification = async (certificateId = certId) => {
    if (!certificateId.trim()) return;
    
    setIsVerifying(true);
    setStatus('LOADING');
    setVerificationResult(null);

    try {
      const result = await verifyCertificate(certificateId.trim());
      setVerificationResult(result);
      
      if (result.isValid) {
        setStatus('VALID');
      } else if (result.isRevoked) {
        setStatus('REVOKED');
      } else if (result.notFound) {
        setStatus('NOT_FOUND');
      } else if (result.tampered) {
        setStatus('TAMPERED');
      } else {
        setStatus('NOT_FOUND');
      }
    } catch (error) {
      console.error('Verification failed:', error);
      setStatus('NOT_FOUND');
      setVerificationResult(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQRScan = (scannedText) => {
    // Extract cert ID from URL or use the text directly
    let extractedCertId = scannedText;
    
    try {
      const url = new URL(scannedText);
      const certParam = url.searchParams.get('cert');
      if (certParam) {
        extractedCertId = certParam;
      }
    } catch {
      // Not a URL, use as-is
    }
    
    setCertId(extractedCertId);
    setActiveTab('manual');
    handleVerification(extractedCertId);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleVerification();
  };

  return (
    <AppShell pageTitle="Verify Certificate">
      <div className="p-6 max-w-2xl">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="font-serif text-2xl text-ink mb-2">
              Certificate Verification
            </h1>
            <p className="font-sans text-sm font-light text-muted leading-relaxed">
              Enter a certificate ID or scan a QR code to verify authenticity against the blockchain record.
            </p>
          </div>

          {/* Input Methods Tabs */}
          <div className="space-y-4">
            <div className="flex gap-1 bg-cream-soft p-1 rounded-sm">
              <button
                onClick={() => setActiveTab('manual')}
                className={`
                  flex-1 py-2 px-3 text-sm font-medium rounded-sm transition-colors duration-150
                  ${activeTab === 'manual'
                    ? 'bg-linen text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                  }
                `}
              >
                Enter certificate ID
              </button>
              <button
                onClick={() => setActiveTab('scan')}
                className={`
                  flex-1 py-2 px-3 text-sm font-medium rounded-sm transition-colors duration-150
                  ${activeTab === 'scan'
                    ? 'bg-linen text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                  }
                `}
              >
                Scan QR code
              </button>
            </div>

            {/* Tab Content */}
            <div className="bg-linen border border-cream-border rounded-sm p-6">
              {activeTab === 'manual' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      value={certId}
                      onChange={(e) => setCertId(e.target.value)}
                      placeholder="Paste the 64-character certificate identifier"
                      className="w-full bg-transparent border-0 border-b border-cream-border text-ink font-mono text-sm py-3 px-0 placeholder-faint focus:border-coral focus:outline-none transition-colors duration-150"
                      disabled={isVerifying}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={!certId.trim() || isVerifying}
                    className="bg-ink text-cream font-medium text-sm py-3 px-6 rounded-sm transition-colors duration-150 hover:bg-ink-soft disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </form>
              ) : (
                <QRScanner onScan={handleQRScan} />
              )}
            </div>
          </div>

          {/* Verification Result */}
          {status && (
            <div className="space-y-6">
              <StatusStamp 
                status={status} 
                certificate={verificationResult?.certificate}
              />
              
              {/* Share QR if valid */}
              {status === 'VALID' && certId && (
                <QRDisplay certId={certId} />
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default VerifyCertificate;