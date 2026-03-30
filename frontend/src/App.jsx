import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useWallet } from './hooks/useWallet';
import ConnectWallet from './components/auth/ConnectWallet';
import VerifyCertificate from './pages/verify/VerifyCertificate';

// Placeholder components for other pages
function IssueCertificate() {
  return <div className="p-6"><h1 className="font-serif text-2xl text-ink">Issue Certificate</h1><p className="text-muted">Coming soon...</p></div>;
}

function MyCertificates() {
  return <div className="p-6"><h1 className="font-serif text-2xl text-ink">My Certificates</h1><p className="text-muted">Coming soon...</p></div>;
}

function AuditRegistry() {
  return <div className="p-6"><h1 className="font-serif text-2xl text-ink">Audit Registry</h1><p className="text-muted">Coming soon...</p></div>;
}

function PrivateRoute({ children, allowedRoles = [] }) {
  const { isConnected, role } = useWallet();
  
  if (!isConnected || !role) {
    return <Navigate to="/connect" replace />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return children;
}

function Unauthorized() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-serif text-2xl text-ink mb-4">Access Denied</h1>
        <p className="text-muted mb-6">You don't have permission to access this page.</p>
        <a href="/connect" className="text-coral underline">Return to login</a>
      </div>
    </div>
  );
}

function App() {
  const { isConnected, role } = useWallet();

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/connect" element={<ConnectWallet />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        
        {/* Verification route - accessible to all authenticated users */}
        <Route 
          path="/verify" 
          element={
            <PrivateRoute>
              <VerifyCertificate />
            </PrivateRoute>
          } 
        />
        
        {/* University routes */}
        <Route 
          path="/university/issue" 
          element={
            <PrivateRoute allowedRoles={['university']}>
              <IssueCertificate />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/university/pending" 
          element={
            <PrivateRoute allowedRoles={['university']}>
              <div className="p-6"><h1 className="font-serif text-2xl text-ink">Pending Approvals</h1></div>
            </PrivateRoute>
          } 
        />
        
        {/* Student routes */}
        <Route 
          path="/student/certificates" 
          element={
            <PrivateRoute allowedRoles={['student']}>
              <MyCertificates />
            </PrivateRoute>
          } 
        />
        
        {/* KNQA routes */}
        <Route 
          path="/knqa/audit" 
          element={
            <PrivateRoute allowedRoles={['knqa']}>
              <AuditRegistry />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/knqa/manage" 
          element={
            <PrivateRoute allowedRoles={['knqa']}>
              <div className="p-6"><h1 className="font-serif text-2xl text-ink">Manage Issuers</h1></div>
            </PrivateRoute>
          } 
        />
        
        {/* Default route - redirect based on auth state */}
        <Route 
          path="/" 
          element={
            isConnected && role ? (
              role === 'university' ? <Navigate to="/university/issue" replace /> :
              role === 'student' ? <Navigate to="/student/certificates" replace /> :
              role === 'knqa' ? <Navigate to="/knqa/audit" replace /> :
              <Navigate to="/verify" replace />
            ) : (
              <Navigate to="/connect" replace />
            )
          } 
        />
        
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App
