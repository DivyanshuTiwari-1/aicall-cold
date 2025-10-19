import { useAuth } from '../contexts/AuthContext';

export const useRoleAccess = () => {
  const { user } = useAuth();

  const hasRole = (requiredRoles) => {
    if (!user?.role) return false;
    if (Array.isArray(requiredRoles)) {
      return requiredRoles.includes(user.role);
    }
    return user.role === requiredRoles;
  };

  const hasPermission = (permission) => {
    if (!user?.permissions) return false;
    return user.permissions.includes(permission);
  };

  const canAccess = (resource, action = 'read') => {
    if (!user?.role) return false;

    const rolePermissions = {
      admin: {
        users: ['read', 'write', 'delete'],
        campaigns: ['read', 'write', 'delete', 'manage'],
        contacts: ['read', 'write', 'delete', 'import'],
        calls: ['read', 'write', 'delete'],
        analytics: ['read', 'export'],
        billing: ['read', 'write'],
        settings: ['read', 'write'],
        assignments: ['read', 'write', 'delete'],
        scripts: ['read', 'write', 'delete'],
        knowledge: ['read', 'write', 'delete'],
        compliance: ['read', 'write', 'delete'],
        live_monitor: ['read'],
        ai_intelligence: ['read', 'write'],
      },
      manager: {
        users: ['read'],
        campaigns: ['read', 'write', 'manage'],
        contacts: ['read', 'write', 'import'],
        calls: ['read'],
        analytics: ['read', 'export'],
        billing: ['read'],
        settings: ['read'],
        assignments: ['read', 'write'],
        scripts: ['read', 'write'],
        knowledge: ['read', 'write'],
        compliance: ['read', 'write'],
        live_monitor: ['read'],
        ai_intelligence: ['read'],
      },
      agent: {
        campaigns: ['read'],
        contacts: ['read'],
        calls: ['read', 'write'],
        analytics: ['read'],
        assignments: ['read'],
        scripts: ['read'],
        knowledge: ['read'],
        live_monitor: ['read'],
        ai_intelligence: ['read'],
      },
      data_uploader: {
        contacts: ['read', 'write', 'import'],
        campaigns: ['read'],
        calls: ['read'],
        analytics: ['read'],
      },
    };

    const userPermissions = rolePermissions[user.role];
    if (!userPermissions) return false;

    const resourcePermissions = userPermissions[resource];
    if (!resourcePermissions) return false;

    return resourcePermissions.includes(action);
  };

  const canViewPage = (page) => {
    const pagePermissions = {
      dashboard: ['admin', 'manager', 'agent', 'data_uploader'],
      executive: ['admin'],
      manager: ['manager'],
      agent: ['agent'],
      'data-uploader': ['data_uploader'],
      users: ['admin'],
      'lead-assignment': ['admin', 'manager'],
      campaigns: ['admin', 'manager', 'agent'],
      contacts: ['admin', 'manager', 'agent', 'data_uploader'],
      calls: ['admin', 'manager', 'agent'],
      'live-monitor': ['admin', 'manager', 'agent'],
      'voice-studio': ['admin', 'manager'],
      'ai-intelligence': ['admin', 'manager', 'agent'],
      'knowledge-base': ['admin', 'manager', 'agent'],
      compliance: ['admin', 'manager'],
      analytics: ['admin', 'manager', 'agent'],
      billing: ['admin', 'manager'],
      scripts: ['admin', 'manager', 'agent'],
      settings: ['admin', 'manager', 'agent'],
    };

    const allowedRoles = pagePermissions[page];
    if (!allowedRoles) return false;

    return allowedRoles.includes(user?.role);
  };

  const canPerformAction = (action, resource) => {
    const actionPermissions = {
      create_campaign: ['admin', 'manager'],
      edit_campaign: ['admin', 'manager'],
      delete_campaign: ['admin'],
      start_campaign: ['admin', 'manager'],
      pause_campaign: ['admin', 'manager'],
      stop_campaign: ['admin', 'manager'],
      create_user: ['admin'],
      edit_user: ['admin', 'manager'],
      delete_user: ['admin'],
      assign_leads: ['admin', 'manager'],
      bulk_assign: ['admin', 'manager'],
      make_call: ['agent'],
      view_analytics: ['admin', 'manager', 'agent'],
      export_data: ['admin', 'manager'],
      manage_billing: ['admin', 'manager'],
      manage_settings: ['admin', 'manager'],
      manage_compliance: ['admin', 'manager'],
      view_live_calls: ['admin', 'manager', 'agent'],
      manage_scripts: ['admin', 'manager'],
      manage_knowledge: ['admin', 'manager'],
    };

    const allowedRoles = actionPermissions[action];
    if (!allowedRoles) return false;

    return allowedRoles.includes(user?.role);
  };

  return {
    hasRole,
    hasPermission,
    canAccess,
    canViewPage,
    canPerformAction,
    userRole: user?.role,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    isAgent: user?.role === 'agent',
    isDataUploader: user?.role === 'data_uploader',
  };
};

export default useRoleAccess;
