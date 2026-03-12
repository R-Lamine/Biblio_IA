import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import SearchPage from './pages/SearchPage';
import CatalogPage from './pages/CatalogPage';
import DashboardPage from './pages/DashboardPage';
import AdherentHomePage from './pages/AdherentHomePage';
import MembersPage from './pages/MembersPage';
import LoansPage from './pages/LoansPage';
import MyLoansPage from './pages/MyLoansPage';

// Create a client
const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; role?: 'adherent' | 'bibliothecaire' }> = ({ children, role }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (role && user?.role !== role) {
    return <Navigate to={user?.role === 'bibliothecaire' ? '/dashboard' : '/espace-client'} />;
  }

  return <>{children}</>;
};

function App() {
  const { user } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/espace-client" element={
            <ProtectedRoute role="adherent">
              <AdherentHomePage />
            </ProtectedRoute>
          } />

          <Route path="/espace-adherent" element={<Navigate to="/espace-client" replace />} />
          
          <Route path="/recherche" element={
            <ProtectedRoute>
              <SearchPage />
            </ProtectedRoute>
          } />
          
          <Route path="/catalogue" element={
            <ProtectedRoute>
              <CatalogPage />
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute role="bibliothecaire">
              <DashboardPage />
            </ProtectedRoute>
          } />

          <Route path="/adherents" element={
            <ProtectedRoute role="bibliothecaire">
              <MembersPage />
            </ProtectedRoute>
          } />

          <Route path="/emprunts" element={
            <ProtectedRoute role="bibliothecaire">
              <LoansPage />
            </ProtectedRoute>
          } />

          <Route path="/mes-lectures" element={
            <ProtectedRoute role="adherent">
              <MyLoansPage />
            </ProtectedRoute>
          } />

          <Route path="/" element={
            user ? (
              <Navigate to={user.role === 'bibliothecaire' ? '/dashboard' : '/espace-client'} />
            ) : (
              <Navigate to="/login" />
            )
          } />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
