import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { getUserRole, canUserPerformAction, ROLES } from '../lib/contractInteraction';

// Individual role-based views
import UniversityDashboard from './dashboards/UniversityDashboard';
import KNQADashboard from './dashboards/KNQADashboard';
import StudentDashboard from './dashboards/StudentDashboard';
import PublicVerification from './dashboards/PublicVerification';

const RoleBasedDashboard = () => {
  const { address, isConnected } = useWallet();
  const [userRole, setUserRole] = useState(ROLES.NONE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user role from blockchain when wallet connects
  useEffect(() => {
    async function fetchUserRole() {
      if (!isConnected || !address) {
        setUserRole(ROLES.NONE);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Get role from blockchain using wallet address
        const role = await getUserRole(address);
        setUserRole(role);
        
        console.log('User role fetched:', {
          address,
          role,
          roleName: getRoleName(role)
        });
        
      } catch (err) {
        console.error('Error fetching user role:', err);
        setError('Failed to fetch user role from blockchain');
        setUserRole(ROLES.NONE);
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, [isConnected, address]);

  // Helper function to get role name for display
  const getRoleName = (role) => {
    switch (role) {
      case ROLES.UNIVERSITY: return 'University';
      case ROLES.KNQA: return 'KNQA';
      case ROLES.STUDENT: return 'Student';
      default: return 'Unassigned';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-ink/30 border-t-ink rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted">Loading your role from blockchain...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-ink text-cream px-4 py-2 rounded-sm text-sm hover:bg-ink-soft"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center">
        <PublicVerification />
      </div>
    );
  }

  // Role-based dashboard rendering
  return (
    <div className="min-h-screen bg-linen">
      {/* Role indicator header */}
      <div className="bg-white border-b border-cream-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl text-ink">Certivert Dashboard</h1>
            <p className="text-sm text-muted">
              Connected as: <span className="font-medium text-ink">{getRoleName(userRole)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-faint">{address}</p>
          </div>
        </div>
      </div>

      {/* Role-specific dashboard content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {userRole === ROLES.UNIVERSITY && (
          <UniversityDashboard userAddress={address} />
        )}
        
        {userRole === ROLES.KNQA && (
          <KNQADashboard userAddress={address} />
        )}
        
        {userRole === ROLES.STUDENT && (
          <StudentDashboard userAddress={address} />
        )}
        
        {userRole === ROLES.NONE && (
          <div className="text-center py-12">
            <div className="bg-amber-bg border-l-4 border-amber rounded-r-lg p-6 max-w-2xl mx-auto">
              <h2 className="font-semibold text-amber-dark mb-2">No Role Assigned</h2>
              <p className="text-amber-dark text-sm mb-4">
                Your wallet address is not assigned to any role in the Certivert system.
              </p>
              <p className="text-amber-dark text-xs">
                Contact your system administrator to get assigned a role (University, KNQA, or Student).
              </p>
            </div>
            
            {/* Still allow public verification */}
            <div className="mt-8">
              <PublicVerification />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleBasedDashboard;