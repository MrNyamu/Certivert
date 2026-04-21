/**
 * Main Application Component
 * Handles routing and authentication state management
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Provider } from 'react-redux';
// Persistence setup
import { PersistGate } from 'redux-persist/integration/react';

// Store setup
import { store, persistor } from './store/index.js';

// Redux hooks and actions
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store/index.js';
import { 
  restoreSession,
  selectIsConnected,
  selectUser,
  selectConnectionStatus,
  selectAuthError
} from './store/slices/authSlice.js';

// Components
import UniversityDashboard from './components/dashboards/UniversityDashboard.js';
import PublicVerification from './components/dashboards/PublicVerification.js';
import ConnectWallet from './components/auth/ConnectWallet.js';
import SessionValidator from './components/auth/SessionValidator.js';

// Loading Component
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-600">Loading Certivert...</p>
    </div>
  </div>
);

// Error Component
const ErrorScreen: React.FC<{ error: string }> = ({ error }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center max-w-md px-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Connection Error</h2>
        <p className="text-red-700 text-sm">{error}</p>
      </div>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  </div>
);

// Auth Guard Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRoles = [] }) => {
  const isConnected = useSelector((state: RootState) => selectIsConnected(state));
  const user = useSelector((state: RootState) => selectUser(state));
  const connectionStatus = useSelector((state: RootState) => selectConnectionStatus(state));
  
  // Still loading
  if (connectionStatus === 'connecting') {
    return <LoadingScreen />;
  }
  
  // Not connected
  if (!isConnected || !user) {
    return <Navigate to="/connect" replace />;
  }
  
  // Check role requirements
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return <>{children}</>;
};

// Dashboard Router - automatically routes to appropriate dashboard based on role
const DashboardRouter: React.FC = () => {
  const user = useSelector((state: RootState) => selectUser(state));
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Proper role-based routing
      console.log('🔄 Routing user with role:', user.role);
      
      switch (user.role) {
        case 'university':
          navigate('/dashboard/university', { replace: true });
          break;
        case 'knqa':
          // KNQA uses the same dashboard as university with different permissions
          navigate('/dashboard/university', { replace: true });
          break;
        case 'student':
          navigate('/dashboard/student', { replace: true });
          break;
        default:
          console.warn('⚠️ Unknown role, redirecting to verification:', user.role);
          navigate('/verify', { replace: true });
          break;
      }
    }
  }, [user, navigate]);

  return <LoadingScreen />;
};

// Unauthorized Page
const UnauthorizedPage: React.FC = () => {
  const user = useSelector((state: RootState) => selectUser(state));

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Access Denied</h2>
          <p className="text-yellow-700 text-sm mb-4">
            Your current role ({user?.role || 'unknown'}) doesn't have permission to access this page.
          </p>
          <Navigate to="/" />
        </div>
      </div>
    </div>
  );
};

// App Routes Component
const AppRoutes: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isConnected = useSelector((state: RootState) => selectIsConnected(state));
  const connectionStatus = useSelector((state: RootState) => selectConnectionStatus(state));
  const error = useSelector((state: RootState) => selectAuthError(state));

  // Try to restore session on app start
  useEffect(() => {
    if (connectionStatus === 'idle') {
      dispatch(restoreSession());
    }
  }, [dispatch, connectionStatus]);

  // Show error screen if there's a critical error
  if (error && connectionStatus === 'error') {
    return <ErrorScreen error={error} />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/connect" element={<ConnectWallet />} />
      <Route path="/verify" element={<PublicVerification />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      
      {/* Protected Dashboard Routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardRouter />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/dashboard/university" 
        element={
          <ProtectedRoute requiredRoles={['university', 'knqa']}>
            <UniversityDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Redirect KNQA to university dashboard */}
      <Route 
        path="/dashboard/knqa" 
        element={<Navigate to="/dashboard/university" replace />} 
      />
      
      <Route 
        path="/dashboard/student" 
        element={
          <ProtectedRoute requiredRoles={['student']}>
            <div className="p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Student Dashboard</h1>
              <p className="text-gray-600">Coming soon...</p>
            </div>
          </ProtectedRoute>
        } 
      />
      
      {/* Root Route - Redirect based on authentication */}
      <Route 
        path="/" 
        element={
          isConnected ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/verify" replace />
          )
        } 
      />
      
      {/* Catch All - Redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={<div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>} persistor={persistor}>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <SessionValidator />
            <AppRoutes />
          </div>
        </Router>
      </PersistGate>
    </Provider>
  );
};

export default App;