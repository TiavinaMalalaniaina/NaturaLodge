import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  permission?: string;
}

export const ProtectedRoute: React.FC<Props> = ({ permission }) => {
  const { isAuthenticated, isLoading, can } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rotate-45 rounded-xl mx-auto mb-6 animate-pulse" />
          <p className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-on-surface-variant/60">
            Natura Lodge
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (permission && !can(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
