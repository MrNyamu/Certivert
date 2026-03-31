import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useState } from 'react';

function QRDisplay({ certId, baseUrl = window.location.origin }) {
  const canvasRef = useRef(null);
  const [copyLabel, setCopyLabel] = useState('copy link');
  
  const verificationUrl = `${baseUrl}/verify?cert=${certId}`;

  useEffect(() => {
    if (canvasRef.current && certId) {
      QRCode.toCanvas(canvasRef.current, verificationUrl, {
        width: 120,
        margin: 1,
        color: {
          dark: '#1A1A18', // --ink
          light: '#FAF7F2', // --linen
        }
      });
    }
  }, [certId, verificationUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopyLabel('copied');
      setTimeout(() => setCopyLabel('copy link'), 1500);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  if (!certId) return null;

  return (
    <div className="bg-linen border border-cream-border rounded-sm p-4">
      <h3 className="font-sans text-[11px] font-medium uppercase text-muted tracking-wide mb-3">
        Share this verification link
      </h3>
      
      <div className="flex items-center gap-4">
        {/* QR Code */}
        <canvas 
          ref={canvasRef} 
          className="border border-cream-border rounded-sm"
        />
        
        {/* Link and copy button */}
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-faint break-all mb-2">
            {verificationUrl}
          </div>
          
          <button
            onClick={handleCopyLink}
            className={`
              font-sans text-[11px] font-medium px-3 py-1 rounded-sm border transition-colors duration-150
              ${copyLabel === 'copied'
                ? 'bg-verified-bg text-verified border-verified'
                : 'bg-cream text-ink border-cream-border hover:bg-cream-soft'
              }
            `}
          >
            {copyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QRDisplay;