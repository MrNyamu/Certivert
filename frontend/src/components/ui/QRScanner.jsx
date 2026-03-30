import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function QRScanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let scanner;

    if (isScanning && scannerRef.current) {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        false
      );

      const onScanSuccess = (decodedText) => {
        if (onScan) {
          onScan(decodedText);
        }
        setIsScanning(false);
        scanner.clear();
      };

      const onScanFailure = (error) => {
        // Ignore frequent scanning errors - they're normal
        if (!error.includes('No QR code found')) {
          console.warn('QR scan failed:', error);
        }
      };

      scanner.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scanner) {
        try {
          scanner.clear();
        } catch (error) {
          console.warn('Error clearing scanner:', error);
        }
      }
    };
  }, [isScanning, onScan]);

  const startScanning = () => {
    setIsScanning(true);
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  return (
    <div className="space-y-4">
      {!isScanning ? (
        <div className="text-center">
          <button
            onClick={startScanning}
            className="bg-ink text-cream font-medium text-sm py-3 px-6 rounded-sm transition-colors duration-150 hover:bg-ink-soft flex items-center gap-2 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start camera scanner
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <div id="qr-reader" className="rounded-sm overflow-hidden" />
            
            {/* Scanning reticle overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative">
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-verified" />
                <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-verified" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-verified" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-verified" />
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <button
              onClick={stopScanning}
              className="text-muted font-sans text-sm underline hover:text-ink transition-colors duration-150"
            >
              Cancel scanning
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QRScanner;