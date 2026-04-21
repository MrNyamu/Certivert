/**
 * Wallet Debug Info Component
 * Use this temporarily to see your wallet address
 */

import { useWallet } from '../../hooks/useWallet';

function WalletDebugInfo() {
  const { address, isConnected, role } = useWallet();

  if (!isConnected) {
    return <div>Wallet not connected</div>;
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '1px solid #ccc', 
      padding: '10px',
      fontSize: '12px',
      zIndex: 9999
    }}>
      <h4>Debug Info:</h4>
      <p><strong>Your Address:</strong> {address}</p>
      <p><strong>Role:</strong> {role || 'none'}</p>
      <button 
        onClick={() => navigator.clipboard.writeText(address)}
        style={{ fontSize: '10px', padding: '2px 4px' }}
      >
        Copy Address
      </button>
    </div>
  );
}

export default WalletDebugInfo;