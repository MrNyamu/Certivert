import { useEffect, useState } from 'react';
import { useWallet } from '../../hooks/useWallet';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

function AppShell({ children, pageTitle }) {
  const { isConnected, role } = useWallet();
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  // Redirect to connect if not authenticated
  if (!isConnected) {
    window.location.href = '/connect';
    return null;
  }

  // Redirect to connect if no role
  if (!role) {
    window.location.href = '/connect';
    return null;
  }

  return (
    <div className="h-screen flex bg-cream">
      <Sidebar currentPath={currentPath} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar pageTitle={pageTitle} />
        
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;