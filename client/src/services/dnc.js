import api from './api';

const dncAPI = {
  // Get DNC records
  getDncRecords: async (params = {}) => {
    const response = await api.get('/dnc/records', { params });
    return response.data;
  },
  // Legacy method name for backward compatibility
  getDNCRecords: async (params = {}) => {
    const response = await api.get('/dnc/records', { params });
    return response.data;
  },

  // Add number to DNC list
  addDncRecord: async dncData => {
    const response = await api.post('/dnc/add', dncData);
    return response.data;
  },
  // Legacy method name for backward compatibility
  addToDNC: async dncData => {
    const response = await api.post('/dnc/add', dncData);
    return response.data;
  },

  // Remove number from DNC list
  removeDncRecord: async id => {
    const response = await api.delete(`/dnc/remove/${id}`);
    return response.data;
  },
  // Legacy method name for backward compatibility
  removeFromDNC: async id => {
    const response = await api.delete(`/dnc/remove/${id}`);
    return response.data;
  },

  // Check if number is on DNC list
  checkDnc: async phone => {
    const response = await api.get(`/dnc/check/${phone}`);
    return response.data;
  },
  // Legacy method name for backward compatibility
  checkDNC: async phone => {
    const response = await api.get(`/dnc/check/${phone}`);
    return response.data;
  },

  // Bulk add to DNC
  bulkAddDnc: async phones => {
    const response = await api.post('/dnc/bulk-add', { phones });
    return response.data;
  },
  // Legacy method name for backward compatibility
  bulkAddToDNC: async phones => {
    const response = await api.post('/dnc/bulk-add', { phones });
    return response.data;
  },

  // Import DNC list from file
  importDnc: async file => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/dnc/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  // Legacy method name for backward compatibility
  importDNC: async file => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/dnc/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Export DNC list
  exportDnc: async (format = 'csv') => {
    const response = await api.get('/dnc/export', {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },
  // Legacy method name for backward compatibility
  exportDNC: async (format = 'csv') => {
    const response = await api.get('/dnc/export', {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  // Get DNC statistics
  getDncStats: async () => {
    const response = await api.get('/dnc/stats');
    return response.data;
  },
  // Legacy method name for backward compatibility
  getDNCStats: async () => {
    const response = await api.get('/dnc/stats');
    return response.data;
  },

  // Sync with national DNC registry
  syncNationalDnc: async () => {
    const response = await api.post('/dnc/sync-national');
    return response.data;
  },
  // Legacy method name for backward compatibility
  syncNationalDNC: async () => {
    const response = await api.post('/dnc/sync-national');
    return response.data;
  },
};

export default dncAPI;
export { dncAPI };
