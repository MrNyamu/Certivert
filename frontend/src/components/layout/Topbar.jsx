import { useState, useEffect } from 'react';
import { getBitcoinBlockHeight } from '../../lib/api';

function Topbar({ pageTitle }) {
  const [blockHeight, setBlockHeight] = useState(0);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    const fetchBlockHeight = async () => {
      try {
        const height = await getBitcoinBlockHeight();
        setBlockHeight(height);
        setIsLive(true);
      } catch (error) {
        console.error('Failed to fetch block height:', error);
        setIsLive(false);
      }
    };

    // Initial fetch
    fetchBlockHeight();

    // Update every 30 seconds
    const interval = setInterval(fetchBlockHeight, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-12 bg-linen border-b border-cream-border flex items-center justify-between px-6">
      {/* Page title */}
      <h1 className="font-serif text-[15px] text-ink">
        {pageTitle}
      </h1>
      
      {/* Bitcoin block height pill */}
      <div className="flex items-center gap-3">
        <div className="bg-cream border border-cream-border rounded-sm px-3 py-1 flex items-center gap-2">
          <span className="font-mono text-[10px] text-faint">BTC</span>
          <span className="font-mono text-[10px] font-medium text-ink">
            {blockHeight.toLocaleString()}
          </span>
          <div 
            className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-verified animate-pulse' : 'bg-faint'}`}
            style={{
              animationDuration: isLive ? '2.5s' : '0s'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Topbar;