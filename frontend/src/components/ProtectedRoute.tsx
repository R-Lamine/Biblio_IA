import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Props {
  role?: 'adherent' | 'bibliothecaire';
}

const ProtectedRoute: React.FC<Props> = ({ role }) => {
  const { user, token } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    // Redirection selon le rôle si accès refusé
    return <Navigate to={user.role === 'bibliothecaire' ? '/dashboard' : '/recherche'} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;