import api from './api';

const queueAPI = {
  // Start automated queue for a campaign
  startQueue: async campaignId => {
    const response = await api.post(`/queue/start/${campaignId}`);
    return response.data;
  },

  // Stop automated queue for a campaign
  stopQueue: async campaignId => {
    const response = await api.post(`/queue/stop/${campaignId}`);
    return response.data;
  },

  // Get queue status for a specific campaign
  getQueueStatus: async campaignId => {
    const response = await api.get(`/queue/status/${campaignId}`);
    return response.data;
  },

  // Get all queue statuses
  getQueueStatuses: async () => {
    const response = await api.get('/queue/status');
    return response.data;
  },

  // Update queue settings
  updateQueueSettings: async (campaignId, settings) => {
    const response = await api.put(`/queue/settings/${campaignId}`, settings);
    return response.data;
  },

  // Get queue metrics
  getQueueMetrics: async campaignId => {
    const response = await api.get(`/queue/metrics/${campaignId}`);
    return response.data;
  },

  // Pause queue temporarily
  pauseQueue: async campaignId => {
    const response = await api.post(`/queue/pause/${campaignId}`);
    return response.data;
  },

  // Resume paused queue
  resumeQueue: async campaignId => {
    const response = await api.post(`/queue/resume/${campaignId}`);
    return response.data;
  },

  // Get queue history
  getQueueHistory: async (campaignId, limit = 50, offset = 0) => {
    const response = await api.get(`/queue/history/${campaignId}`, {
      params: { limit, offset },
    });
    return response.data;
  },

  // Get queue performance analytics
  getQueueAnalytics: async (campaignId, timeRange = '24h') => {
    const response = await api.get(`/queue/analytics/${campaignId}`, {
      params: { timeRange },
    });
    return response.data;
  },
};

export default queueAPI;
