import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { ErrorPage } from './ErrorDisplay';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({
  children,
  requiredRoles = [],
  requiredPermissions = [],
  fallback = null
}) => {
  const { user, loading } = useAuth();
  const { hasRole, hasPermission, canViewPage } = useRoleAccess();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (requiredRoles.length > 0 && !hasRole(requiredRoles)) {
    return fallback || (
      <ErrorPage
        title="Access Denied"
        description="You don't have permission to access this page."
      />
    );
  }

  // Check permission-based access
  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission =>
      hasPermission(permission)
    );

    if (!hasAllPermissions) {
      return fallback || (
        <ErrorPage
          title="Access Denied"
          description="You don't have the required permissions to access this page."
        />
      );
    }
  }

  // Check page-based access
  const currentPage = location.pathname.split('/')[1];
  if (currentPage && !canViewPage(currentPage)) {
    return fallback || (
      <ErrorPage
        title="Access Denied"
        description="You don't have permission to access this page."
      />
    );
  }

  return children;
};

export const AdminRoute = ({ children }) => (
  <ProtectedRoute requiredRoles={['admin']}>
    {children}
  </ProtectedRoute>
);

export const ManagerRoute = ({ children }) => (
  <ProtectedRoute requiredRoles={['admin', 'manager']}>
    {children}
  </ProtectedRoute>
);

export const AgentRoute = ({ children }) => (
  <ProtectedRoute requiredRoles={['admin', 'manager', 'agent']}>
    {children}
  </ProtectedRoute>
);

export const DataUploaderRoute = ({ children }) => (
  <ProtectedRoute requiredRoles={['admin', 'manager', 'data_uploader']}>
    {children}
  </ProtectedRoute>
);

export default ProtectedRoute;
