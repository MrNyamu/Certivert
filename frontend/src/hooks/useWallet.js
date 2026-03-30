import { useState, useEffect } from 'react';
import { showConnect } from '@stacks/connect';
import { STACKS_MAINNET, STACKS_TESTNET, STACKS_DEVNET } from '@stacks/network';

const appConfig = {
  name: 'Certivert',
  icon: '/favicon.ico',
};

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

  const connectWallet = () => {
    setIsConnecting(true);
    
    showConnect({
      appDetails: appConfig,
      redirectTo: '/',
      onFinish: (data) => {
        const userSession = data.userSession;
        const userData = userSession.loadUserData();
        
        setAddress(userData.profile.stxAddress.mainnet);
        setPublicKey(userData.profile.publicKey);
        setIsConnected(true);
        setIsConnecting(false);
        
        // Store in session
        sessionStorage.setItem('wallet_address', userData.profile.stxAddress.mainnet);
        sessionStorage.setItem('wallet_publicKey', userData.profile.publicKey);
        
        // Fetch user role from API
        fetchUserRole(userData.profile.stxAddress.mainnet);
      },
      onCancel: () => {
        setIsConnecting(false);
      },
    });
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

  const disconnect = () => {
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
    const savedAddress = sessionStorage.getItem('wallet_address');
    const savedPublicKey = sessionStorage.getItem('wallet_publicKey');
    const savedRole = sessionStorage.getItem('user_role');
    
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
    disconnect,
    truncateAddress,
    network: getNetwork()
  };
}