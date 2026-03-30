import { useState } from 'react';

function HashDisplay({ hash, className = '' }) {
  const [copyLabel, setCopyLabel] = useState('copy');

  const handleCopy = async () => {
    if (!hash) return;
    
    try {
      await navigator.clipboard.writeText(hash);
      setCopyLabel('copied');
      setTimeout(() => setCopyLabel('copy'), 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!hash) return null;

  const truncatedHash = `${hash.slice(0, 8)}···${hash.slice(-4)}`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span 
        className="font-mono text-[10px] text-faint cursor-pointer"
        title={hash}
      >
        {truncatedHash}
      </span>
      
      <button
        onClick={handleCopy}
        className={`font-sans text-[10px] transition-colors duration-150 ${
          copyLabel === 'copied' 
            ? 'text-verified' 
            : 'text-faint hover:text-muted'
        }`}
      >
        [{copyLabel}]
      </button>
    </div>
  );
}

export default HashDisplay;