import { useState, useEffect } from 'react';
import { useWallet } from '../../hooks/useWallet';

function ConnectWallet() {
  const { connectWallet, isConnecting, isConnected, address, role } = useWallet();
  const [showUnregistered, setShowUnregistered] = useState(false);

  useEffect(() => {
    if (isConnected && role === null) {
      setShowUnregistered(true);
    } else {
      setShowUnregistered(false);
    }
  }, [isConnected, role]);

  // Redirect if connected and has role
  useEffect(() => {
    if (isConnected && role) {
      switch (role) {
        case 'university':
          window.location.href = '/university/issue';
          break;
        case 'student':
          window.location.href = '/student/certificates';
          break;
        case 'employer':
          window.location.href = '/verify';
          break;
        case 'knqa':
          window.location.href = '/knqa/audit';
          break;
        default:
          break;
      }
    }
  }, [isConnected, role]);

  return (
    <div className="min-h-screen bg-linen flex items-center justify-center relative overflow-hidden">
      {/* Subtle grain texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="w-full max-w-md px-6 relative z-10">
        <div className="text-center">
          {/* Top eyebrow */}
          <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-coral mb-4">
            CERTIVERT · KENYA
          </div>
          
          {/* Wordmark */}
          <h1 className="font-serif text-[42px] leading-tight text-ink mb-3">
            Certi<em className="not-italic italic">vert</em>
          </h1>
          
          {/* Tagline */}
          <p className="font-sans text-sm font-light text-muted leading-relaxed max-w-[300px] mx-auto mb-8">
            Blockchain-anchored certificate verification for Kenya's universities and employers
          </p>
          
          {/* Seal SVG */}
          <div className="w-16 h-16 mx-auto mb-8">
            <svg viewBox="0 0 64 64" className="w-full h-full">
              <circle 
                cx="32" 
                cy="32" 
                r="30" 
                fill="none" 
                stroke="var(--cream-border)" 
                strokeWidth="1"
              />
              <circle 
                cx="32" 
                cy="32" 
                r="22" 
                fill="none" 
                stroke="var(--verified)" 
                strokeWidth="1" 
                opacity="0.6"
              />
              <circle 
                cx="32" 
                cy="32" 
                r="16" 
                fill="var(--verified-bg)"
              />
              <text 
                x="32" 
                y="36" 
                textAnchor="middle" 
                className="font-mono text-[8px] fill-verified"
              >
                ₿
              </text>
              <text 
                x="32" 
                y="8" 
                textAnchor="middle" 
                className="font-mono text-[4.5px] fill-faint"
              >
                STACKS
              </text>
              <text 
                x="32" 
                y="58" 
                textAnchor="middle" 
                className="font-mono text-[4.5px] fill-faint"
              >
                BITCOIN
              </text>
              <line x1="48" y1="32" x2="52" y2="32" stroke="var(--faint)" strokeWidth="1" />
              <line x1="12" y1="32" x2="16" y2="32" stroke="var(--faint)" strokeWidth="1" />
            </svg>
          </div>
          
          {/* Connect button */}
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full bg-ink text-cream font-medium text-sm py-3 px-6 rounded-sm transition-colors duration-150 hover:bg-ink-soft disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <div className="w-4 h-4 bg-cream/80 rounded-[1px]" />
                Connect Hiro wallet
              </>
            )}
          </button>
          
          {/* Below button text */}
          <p className="font-sans text-[11px] font-light text-faint leading-relaxed mt-3">
            Requires Hiro or Leather wallet · No account or password
          </p>
          
          {/* Unregistered wallet state */}
          {showUnregistered && (
            <div className="mt-4 bg-amber-bg border-l-2 border-amber p-3 rounded-sm">
              <p className="font-sans text-sm text-amber">
                Your wallet is not registered. Contact your institution administrator.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConnectWallet;