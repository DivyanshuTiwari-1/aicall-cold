import api from './api';

export const leadReuseAPI = {
  // Get reuse statistics
  getReuseStats: async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/assignments/reuse-stats?${params}`);
    return response.data;
  },

  // Get reuse settings
  getReuseSettings: async () => {
    const response = await api.get('/assignments/reuse-settings');
    return response.data;
  },

  // Update reuse settings
  updateReuseSettings: async (settings) => {
    const response = await api.put('/assignments/reuse-settings', settings);
    return response.data;
  },

  // Trigger manual reuse for specific leads
  triggerReuse: async (contactIds) => {
    const response = await api.post('/assignments/manual-reuse', { contactIds });
    return response.data;
  },

  // Process unpicked leads automatically
  processUnpickedLeads: async () => {
    const response = await api.post('/assignments/reuse');
    return response.data;
  },

  // Get unpicked leads for manual selection
  getUnpickedLeads: async (limit = 50, offset = 0) => {
    const response = await api.get(`/assignments/unpicked-leads?limit=${limit}&offset=${offset}`);
    return response.data;
  }
};

export default leadReuseAPI;
