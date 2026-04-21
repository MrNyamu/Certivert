import { useState, useEffect } from 'react';
// TEMPORARILY DISABLED TO FIX STACKSPROVIDER CONFLICT
// import { connect, disconnect, isConnected as checkIsConnected, getLocalStorage } from '@stacks/connect';
import { STACKS_MAINNET, STACKS_TESTNET, STACKS_DEVNET } from '@stacks/network';

// Temporary stubs to prevent errors (useWallet hook is being replaced by Redux)
const connect = async () => ({ success: false, error: 'Use Redux auth instead' });
const disconnect = () => {};
const checkIsConnected = () => false;
const getLocalStorage = () => null;

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [role, setRole] = useState(null);

  const getNetwork = () => {
    const networkName = import.meta.env.VITE_STACKS_NETWORK || 'simnet';
    switch (networkName) {
      case 'mainnet':
        return STACKS_MAINNET;
      case 'testnet':
        return STACKS_TESTNET;
      default:
        return STACKS_DEVNET;
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    
    try {
      // Use the new connect API
      const response = await connect();
      
      if (response && response.addresses && response.addresses.length > 0) {
        // Find the STX address
        const stxAddress = response.addresses.find(addr => 
          addr.symbol === 'STX' || addr.address.startsWith('S')
        );
        
        if (stxAddress) {
          setAddress(stxAddress.address);
          setPublicKey(stxAddress.publicKey || '');
          setIsConnected(true);
          
          // Store in session storage
          sessionStorage.setItem('wallet_address', stxAddress.address);
          sessionStorage.setItem('wallet_publicKey', stxAddress.publicKey || '');
          
          // Fetch user role from API
          fetchUserRole(stxAddress.address);
        }
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchUserRole = async (walletAddress) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/role/${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        setRole(data.role || null);
        sessionStorage.setItem('user_role', data.role || '');
      } else {
        setRole(null);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setRole(null);
    }
  };

  const disconnectWallet = () => {
    // Use the official disconnect function
    disconnect();
    
    setAddress(null);
    setPublicKey(null);
    setIsConnected(false);
    setRole(null);
    
    sessionStorage.removeItem('wallet_address');
    sessionStorage.removeItem('wallet_publicKey');
    sessionStorage.removeItem('user_role');
  };

  // Restore session on load
  useEffect(() => {
    // Check if wallet was previously connected using the official method
    const wasConnected = checkIsConnected();
    
    if (wasConnected) {
      // Try to get addresses from local storage
      const localData = getLocalStorage();
      
      if (localData && localData.addresses && localData.addresses.stx) {
        const stxAddress = localData.addresses.stx[0];
        if (stxAddress) {
          setAddress(stxAddress.address);
          setPublicKey(stxAddress.publicKey || '');
          setIsConnected(true);
          
          // Re-verify role from API
          fetchUserRole(stxAddress.address);
          return;
        }
      }
    }
    
    // Fallback to session storage
    const savedAddress = sessionStorage.getItem('wallet_address');
    const savedPublicKey = sessionStorage.getItem('wallet_publicKey');
    
    if (savedAddress && savedPublicKey) {
      setAddress(savedAddress);
      setPublicKey(savedPublicKey);
      setIsConnected(true);
      
      // Re-verify role from API
      fetchUserRole(savedAddress);
    }
  }, []);

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 8)}···${addr.slice(-4)}`;
  };

  return {
    address,
    publicKey,
    isConnected,
    isConnecting,
    role,
    connectWallet,
    disconnect: disconnectWallet,
    truncateAddress,
    network: getNetwork()
  };
}