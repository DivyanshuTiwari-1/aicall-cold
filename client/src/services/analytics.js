import api from './api';

const analyticsAPI = {
  // Get comprehensive dashboard analytics
  getDashboard: async (range = '7d') => {
    const response = await api.get(`/analytics/dashboard?range=${range}`);
    return response.data;
  },

  // Get agent performance metrics
  getAgentPerformance: async (agentId, period = '7d', startDate, endDate) => {
    const params = { period };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await api.get(`/analytics/agent/${agentId}/performance`, { params });
    return response.data;
  },

  // Get team leaderboard
  getTeamLeaderboard: async (period = '7d', metric = 'conversion_rate') => {
    const response = await api.get(`/analytics/team-leaderboard?period=${period}&metric=${metric}`);
    return response.data;
  },

  // Get productivity metrics for organization
  getProductivity: async (period = '7d') => {
    const response = await api.get(`/analytics/productivity?period=${period}`);
    return response.data;
  },

  // Get live call monitoring data
  getLiveCalls: async () => {
    const response = await api.get('/analytics/live-calls');
    return response.data;
  },
};

export default analyticsAPI;
export { analyticsAPI };
