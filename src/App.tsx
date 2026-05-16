import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import OfficerDashboard from './pages/OfficerDashboard';
import NewRecord from './pages/NewRecord';
import AdminDashboard from './pages/AdminDashboard';

function ProtectedRoute({ children, role }: { children: React.ReactNode, role?: 'admin' | 'officer' }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    // Redirect based on their actual role if they try to access unauthorized pages
    return <Navigate to={user.role === 'admin' ? '/admin' : '/officer'} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/officer" element={
            <ProtectedRoute role="officer">
              <OfficerDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/officer/new" element={
            <ProtectedRoute role="officer">
              <NewRecord />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
