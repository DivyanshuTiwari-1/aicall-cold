import api from './api';

export const callsAPI = {
  // Get all calls
  getCalls: async (params = {}) => {
    const response = await api.get('/calls', { params });
    return response.data;
  },

  // Get single call
  getCall: async id => {
    const response = await api.get(`/calls/${id}`);
    return response.data;
  },

  // Start a call
  startCall: async callData => {
    const response = await api.post('/calls/start', callData);
    return response.data;
  },

  // Complete a call
  completeCall: async (callId, callData) => {
    const response = await api.post(`/calls/complete/${callId}`, callData);
    return response.data;
  },

  // Update call status
  updateCallStatus: async (callId, statusData) => {
    const response = await api.put(`/calls/${callId}/status`, statusData);
    return response.data;
  },

  // Get call conversation context
  getCallConversation: async callId => {
    const response = await api.get(`/calls/${callId}/conversation`);
    return response.data;
  },

  // Start automated calls for a campaign
  startAutomatedCalls: async (campaignId) => {
    const response = await api.post(`/calls/automated/start`, { campaignId });
    return response.data;
  },

  // Stop automated calls for a campaign
  stopAutomatedCalls: async (campaignId) => {
    const response = await api.post(`/calls/automated/stop`, { campaignId });
    return response.data;
  },

  // Get campaign stats
  getCampaignStats: async () => {
    const response = await api.get('/calls/campaign-stats');
    return response.data;
  },

  // Get automated call queue status
  getQueueStatus: async (campaignId) => {
    const response = await api.get(`/calls/queue/status/${campaignId}`);
    return response.data;
  },
};
