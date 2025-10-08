import api from './api';

export const callsAPI = {
  // Get all calls
  getCalls: async (params = {}) => {
    const response = await api.get('/calls', { params });
    return response.data;
  },

  // Get single call
  getCall: async (id) => {
    const response = await api.get(`/calls/${id}`);
    return response.data;
  },

  // Start a call
  startCall: async (callData) => {
    const response = await api.post('/calls/start', callData);
    return response.data;
  },

  // Update call status
  updateCallStatus: async (id, statusData) => {
    const response = await api.put(`/calls/${id}/status`, statusData);
    return response.data;
  },

  // Complete a call
  completeCall: async (id, callData) => {
    const response = await api.post(`/calls/complete/${id}`, callData);
    return response.data;
  },

  // Get call conversation context
  getCallConversation: async (id) => {
    const response = await api.get(`/calls/${id}/conversation`);
    return response.data;
  }
};
