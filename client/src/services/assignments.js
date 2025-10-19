import api from './api';

export const assignmentsAPI = {
  // Get all assignments
  getAssignments: async (params = {}) => {
    const response = await api.get('/assignments', { params });
    return response.data;
  },

  // Get my assigned leads
  getMyLeads: async (params = {}) => {
    const response = await api.get('/assignments/my-leads', { params });
    return response.data;
  },

  // Assign single lead to agent
  assignLead: async (data) => {
    const response = await api.post('/assignments/assign', data);
    return response.data;
  },

  // Assign leads to agent (alias)
  assignLeads: async (data) => {
    const response = await api.post('/assignments/assign', data);
    return response.data;
  },

  // Bulk assign leads
  bulkAssign: async (data) => {
    const response = await api.post('/assignments/bulk-assign', data);
    return response.data;
  },

  // Bulk assign leads (alias)
  bulkAssignLeads: async (data) => {
    const response = await api.post('/assignments/bulk-assign', data);
    return response.data;
  },

  // Update assignment status
  updateAssignmentStatus: async (assignmentId, status) => {
    const response = await api.put(`/assignments/${assignmentId}/status`, { status });
    return response.data;
  },

  // Get assignment statistics
  getStats: async (period = '7d') => {
    const response = await api.get(`/assignments/stats?period=${period}`);
    return response.data;
  },
};
