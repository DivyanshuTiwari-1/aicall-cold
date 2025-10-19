import api from './api';

export const aiIntelligenceAPI = {
  // Analyze call transcript
  analyzeCall: async (data) => {
    const response = await api.post('/ai-intelligence/analyze-call', data);
    return response.data;
  },

  // Get call analysis results
  getCallAnalysis: async (callId) => {
    const response = await api.get(`/ai-intelligence/calls/${callId}/analysis`);
    return response.data;
  },

  // Add manual tag to call
  addTag: async (callId, tagData) => {
    const response = await api.post(`/ai-intelligence/calls/${callId}/tags`, tagData);
    return response.data;
  },

  // Get all tags for a call
  getCallTags: async (callId) => {
    const response = await api.get(`/ai-intelligence/calls/${callId}/tags`);
    return response.data;
  },

  // Add call highlight
  addHighlight: async (callId, highlightData) => {
    const response = await api.post(`/ai-intelligence/calls/${callId}/highlights`, highlightData);
    return response.data;
  },

  // Get emotion analytics
  getEmotionAnalytics: async (params = {}) => {
    const response = await api.get('/ai-intelligence/emotion-analytics', { params });
    return response.data;
  },

  // Get emotion heatmap data
  getEmotionHeatmap: async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/ai-intelligence/emotion-heatmap?${params}`);
    return response.data;
  },

  // Get emotion journey for a call
  getEmotionJourney: async (callId) => {
    const response = await api.get(`/ai-intelligence/emotion-journey/${callId}`);
    return response.data;
  },

  // Get agent empathy score
  getAgentEmpathyScore: async (agentId, period = '30d') => {
    const response = await api.get(`/ai-intelligence/agent-empathy-score/${agentId}?period=${period}`);
    return response.data;
  },

  // Get enhanced emotion analytics with volatility trends
  getEnhancedEmotionAnalytics: async (params = {}) => {
    const response = await api.get('/ai-intelligence/emotion-analytics-enhanced', { params });
    return response.data;
  },

  // Get agent empathy scores for all agents
  getAgentEmpathyScores: async (params = {}) => {
    // This would need to be implemented on the backend
    // For now, return empty array
    return { empathyScores: [] };
  },

  // Legacy methods for backward compatibility
  getIntentAnalytics: async (params = {}) => {
    const response = await api.get('/ai-intelligence/emotion-analytics', { params });
    return response.data;
  },

  getRecentAnalyses: async (params = {}) => {
    // This would need to be implemented on the backend
    // For now, return empty array
    return { analyses: [] };
  },

  addManualTag: async (callId, tag) => {
    return this.addTag(callId, { tag });
  },
};

export default aiIntelligenceAPI;
