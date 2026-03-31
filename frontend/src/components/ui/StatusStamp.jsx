import { useEffect, useState } from 'react';

function StatusStamp({ status, certificate }) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (status === 'VALID' || status === 'REVOKED') {
      setIsAnimating(true);
    }
  }, [status]);

  const renderStatusGlyph = () => {
    switch (status) {
      case 'VALID':
        return (
          <svg 
            className={`w-9 h-9 transition-all duration-250 ease-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
            viewBox="0 0 36 36"
          >
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--verified)" strokeWidth="2" />
            <circle cx="18" cy="18" r="10" fill="var(--verified)" fillOpacity="0.1" />
            <path d="M12 18l5 5 10-10" fill="none" stroke="var(--verified)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'REVOKED':
        return (
          <svg 
            className={`w-9 h-9 transition-all duration-250 ease-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
            viewBox="0 0 36 36"
          >
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--revoked)" strokeWidth="2" />
            <path d="M12 12l12 12M24 12L12 24" stroke="var(--revoked)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'NOT_FOUND':
        return (
          <svg className="w-9 h-9" viewBox="0 0 36 36">
            <circle 
              cx="18" 
              cy="18" 
              r="16" 
              fill="none" 
              stroke="var(--cream-border)" 
              strokeWidth="2" 
              strokeDasharray="4 3"
            />
          </svg>
        );
      case 'TAMPERED':
        return (
          <svg className="w-9 h-9" viewBox="0 0 36 36">
            <path 
              d="M18 4l14 24H4L18 4z" 
              fill="none" 
              stroke="var(--amber)" 
              strokeWidth="2" 
              strokeLinejoin="round"
            />
            <circle cx="18" cy="22" r="1.5" fill="var(--amber)" />
            <path d="M18 12v6" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'LOADING':
        return (
          <div className="w-9 h-9 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-cream-border border-t-muted rounded-full animate-spin" />
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'VALID':
        return {
          bgClass: 'bg-verified-bg',
          borderClass: 'border-l-2 border-verified',
          heading: 'Verified valid',
          headingClass: 'text-verified-deep',
          subtext: 'Authentic and unrevoked. Hash confirmed against on-chain record.'
        };
      case 'REVOKED':
        return {
          bgClass: 'bg-revoked-bg',
          borderClass: 'border-l-2 border-revoked',
          heading: 'Certificate revoked',
          headingClass: 'text-revoked',
          subtext: 'Permanently invalidated and anchored to Bitcoin. Cannot be undone.'
        };
      case 'NOT_FOUND':
        return {
          bgClass: 'bg-cream-soft',
          borderClass: 'border-l-2 border-cream-border',
          heading: 'Not found',
          headingClass: 'text-muted',
          subtext: 'No certificate record exists on the blockchain for this identifier.'
        };
      case 'TAMPERED':
        return {
          bgClass: 'bg-amber-bg',
          borderClass: 'border-l-2 border-amber',
          heading: 'Document tampered',
          headingClass: 'text-amber',
          subtext: 'Hash mismatch detected. The file does not match the on-chain record.'
        };
      case 'LOADING':
        return {
          bgClass: 'bg-cream-soft relative overflow-hidden',
          borderClass: '',
          heading: 'Querying blockchain…',
          headingClass: 'text-faint',
          subtext: ''
        };
      default:
        return {};
    }
  };

  const config = getStatusConfig();

  const renderMetadata = () => {
    if (!certificate || (status !== 'VALID' && status !== 'REVOKED')) return null;

    return (
      <div className="space-y-3">
        <div className="h-px bg-cream-border" />
        
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {certificate.studentName && (
            <div>
              <div className="font-sans text-[9px] uppercase text-faint tracking-wide mb-1">
                STUDENT
              </div>
              <div className="font-sans text-xs font-medium text-ink">
                {certificate.studentName}
              </div>
            </div>
          )}
          
          {certificate.year && (
            <div>
              <div className="font-sans text-[9px] uppercase text-faint tracking-wide mb-1">
                YEAR
              </div>
              <div className="font-sans text-xs font-medium text-ink">
                {certificate.year}
              </div>
            </div>
          )}
          
          {certificate.programme && (
            <div className="col-span-2">
              <div className="font-sans text-[9px] uppercase text-faint tracking-wide mb-1">
                PROGRAMME
              </div>
              <div className="font-sans text-xs font-medium text-ink">
                {certificate.programme}
              </div>
            </div>
          )}
          
          {certificate.grade && (
            <div>
              <div className="font-sans text-[9px] uppercase text-faint tracking-wide mb-1">
                GRADE
              </div>
              <div className="font-sans text-xs font-medium text-ink">
                {certificate.grade}
              </div>
            </div>
          )}
          
          {status === 'REVOKED' && certificate.revokedBy && (
            <div className="col-span-2">
              <div className="font-sans text-[9px] uppercase text-faint tracking-wide mb-1">
                REVOKED BY
              </div>
              <div className="font-mono text-[10px] text-ink">
                {certificate.revokedBy.slice(0, 16)}...{certificate.revokedBy.slice(-8)}
              </div>
            </div>
          )}
          
          {certificate.blockHeight && (
            <div>
              <div className="font-sans text-[9px] uppercase text-faint tracking-wide mb-1">
                BTC BLOCK
              </div>
              <div className="font-mono text-xs font-medium text-ink">
                {certificate.blockHeight.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`w-full rounded-sm p-6 ${config.bgClass} ${config.borderClass}`}
      role="region"
      aria-live="polite"
      aria-label="Certificate verification result"
    >
      {/* Loading animation overlay */}
      {status === 'LOADING' && (
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute top-0 left-0 w-full h-px bg-cream-border animate-slide-down"
            style={{
              animation: 'slideDown 1.2s linear infinite'
            }}
          />
        </div>
      )}
      
      <div className="flex items-start gap-4">
        {/* Status glyph */}
        <div className="flex-shrink-0">
          {renderStatusGlyph()}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h2 className={`font-serif text-xl font-bold mb-2 ${config.headingClass}`}>
            {config.heading}
          </h2>
          
          {config.subtext && (
            <p className="font-sans text-[11px] font-light text-muted leading-relaxed max-w-xs mb-4">
              {config.subtext}
            </p>
          )}
          
          {renderMetadata()}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slideDown {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100vh);
          }
        }
      `}</style>
    </div>
  );
}

export default StatusStamp;