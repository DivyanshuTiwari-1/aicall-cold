import api from './api';

const analyticsAPI = {
    // Get comprehensive dashboard analytics
    getDashboard: async(timeRange = '7d') => {
        const response = await api.get(`/analytics/dashboard?range=${timeRange}`);
        return response.data;
    },

    // Get call analytics
    getCallAnalytics: async(timeRange = '7d', campaignId = null) => {
        const params = { range: timeRange };
        if (campaignId) params.campaignId = campaignId;

        const response = await api.get('/analytics/calls', { params });
        return response.data;
    },

    // Get conversion analytics
    getConversionAnalytics: async(timeRange = '7d') => {
        const response = await api.get(`/analytics/conversions?range=${timeRange}`);
        return response.data;
    },

    // Get cost analytics
    getCostAnalytics: async(timeRange = '7d') => {
        const response = await api.get(`/analytics/costs?range=${timeRange}`);
        return response.data;
    },

    // Get emotion analytics
    getEmotionAnalytics: async(timeRange = '7d') => {
        const response = await api.get(`/analytics/emotions?range=${timeRange}`);
        return response.data;
    },

    // Get script performance analytics
    getScriptAnalytics: async(timeRange = '7d') => {
        const response = await api.get(`/analytics/scripts?range=${timeRange}`);
        return response.data;
    },

    // Get real-time metrics
    getRealTimeMetrics: async() => {
        const response = await api.get('/analytics/realtime');
        return response.data;
    },

    // Get campaign comparison
    getCampaignComparison: async(campaignIds, timeRange = '7d') => {
        const response = await api.post('/analytics/campaigns/compare', {
            campaignIds,
            timeRange
        });
        return response.data;
    },

    // Get ROI analytics
    getROIAnalytics: async(timeRange = '7d') => {
        const response = await api.get(`/analytics/roi?range=${timeRange}`);
        return response.data;
    },

    // Get objection handling analytics
    getObjectionAnalytics: async(timeRange = '7d') => {
        const response = await api.get(`/analytics/objections?range=${timeRange}`);
        return response.data;
    },

    // Get hourly performance
    getHourlyPerformance: async(date) => {
        const response = await api.get(`/analytics/hourly?date=${date}`);
        return response.data;
    },

    // Get agent performance (for human handovers)
    getAgentPerformance: async(timeRange = '7d') => {
        const response = await api.get(`/analytics/agents?range=${timeRange}`);
        return response.data;
    },

    // Export analytics data
    exportAnalytics: async(type, timeRange = '7d', format = 'csv') => {
        const response = await api.get(`/analytics/export/${type}`, {
            params: { range: timeRange, format },
            responseType: 'blob'
        });
        return response.data;
    },

    // Get predictive analytics
    getPredictiveAnalytics: async(timeRange = '7d') => {
        const response = await api.get(`/analytics/predictive?range=${timeRange}`);
        return response.data;
    },

    // Get compliance metrics
    getComplianceMetrics: async(timeRange = '7d') => {
        const response = await api.get(`/analytics/compliance?range=${timeRange}`);
        return response.data;
    }
};

export default analyticsAPI;