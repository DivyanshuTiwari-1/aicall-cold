import React from 'react';
import { useRoleAccess } from '../hooks/useRoleAccess';

export const RoleBasedRender = ({
  children,
  allowedRoles = [],
  allowedPermissions = [],
  fallback = null
}) => {
  const { hasRole, hasPermission } = useRoleAccess();

  // Check role-based access
  if (allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return fallback;
  }

  // Check permission-based access
  if (allowedPermissions.length > 0) {
    const hasAllPermissions = allowedPermissions.every(permission =>
      hasPermission(permission)
    );

    if (!hasAllPermissions) {
      return fallback;
    }
  }

  return children;
};

export const AdminOnly = ({ children, fallback = null }) => (
  <RoleBasedRender allowedRoles={['admin']} fallback={fallback}>
    {children}
  </RoleBasedRender>
);

export const ManagerOnly = ({ children, fallback = null }) => (
  <RoleBasedRender allowedRoles={['admin', 'manager']} fallback={fallback}>
    {children}
  </RoleBasedRender>
);

export const AgentOnly = ({ children, fallback = null }) => (
  <RoleBasedRender allowedRoles={['admin', 'manager', 'agent']} fallback={fallback}>
    {children}
  </RoleBasedRender>
);

export const DataUploaderOnly = ({ children, fallback = null }) => (
  <RoleBasedRender allowedRoles={['admin', 'manager', 'data_uploader']} fallback={fallback}>
    {children}
  </RoleBasedRender>
);

export const ActionButton = ({
  action,
  resource,
  children,
  fallback = null,
  ...props
}) => {
  const { canPerformAction, canAccess } = useRoleAccess();

  const hasAccess = canPerformAction(action, resource) || canAccess(resource, 'write');

  if (!hasAccess) {
    return fallback;
  }

  return <button {...props}>{children}</button>;
};

export const ConditionalRender = ({
  condition,
  children,
  fallback = null
}) => {
  const { canPerformAction, canAccess, hasRole } = useRoleAccess();

  let hasAccess = false;

  if (typeof condition === 'string') {
    // Check if it's an action
    hasAccess = canPerformAction(condition);
  } else if (typeof condition === 'object' && condition.action) {
    // Check specific action and resource
    hasAccess = canPerformAction(condition.action, condition.resource);
  } else if (typeof condition === 'object' && condition.roles) {
    // Check roles
    hasAccess = hasRole(condition.roles);
  } else if (typeof condition === 'function') {
    // Custom condition function
    hasAccess = condition({ canPerformAction, canAccess, hasRole });
  }

  return hasAccess ? children : fallback;
};

export default RoleBasedRender;
