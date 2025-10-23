import api from './api';

export const simpleCallsAPI = {
  // Get WebRTC token for Telnyx
  getWebRTCToken: async () => {
    const response = await api.post('/simple-calls/webrtc-token');
    return response.data;
  },

  // Start a simple browser-based call
  startCall: async (contactId, campaignId = null) => {
    const payload = { contactId };
    if (campaignId) {
      payload.campaignId = campaignId;
    }
    const response = await api.post('/simple-calls/start', payload);
    return response.data;
  },

  // Complete a call
  completeCall: async (callId, callData) => {
    const response = await api.put(`/simple-calls/${callId}/complete`, callData);
    return response.data;
  },

  // Get call history
  getCallHistory: async (params = {}) => {
    const response = await api.get('/simple-calls/history', { params });
    return response.data;
  },
};

export default simpleCallsAPI;
