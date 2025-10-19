import api from './api';

export const manualCallsAPI = {
  // Start manual call
  startCall: async (data) => {
    const response = await api.post('/manualcalls/start', data);
    return response.data;
  },

  // Log call outcome
  logCall: async (data) => {
    const response = await api.post('/manualcalls/log', data);
    return response.data;
  },

  // Complete call
  completeCall: async (callId, data) => {
    const response = await api.put(`/manualcalls/${callId}/complete`, data);
    return response.data;
  },

  // Get my call history
  getMyCalls: async (params = {}) => {
    const response = await api.get('/manualcalls/my-calls', { params });
    return response.data;
  },

  // Get call statistics
  getStats: async (period = '7d') => {
    const response = await api.get(`/manualcalls/stats?period=${period}`);
    return response.data;
  },
};
