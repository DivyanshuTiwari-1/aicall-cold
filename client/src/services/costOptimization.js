import api from './api';

const costOptimizationAPI = {
    // Get cost analysis
    getCostAnalysis: async(params = {}) => {
        const response = await api.get('/cost-optimization/analysis', { params });
        return response.data;
    },

    // Get optimization recommendations
    getRecommendations: async(params = {}) => {
        const response = await api.get('/cost-optimization/recommendations', { params });
        return response.data;
    },

    // Update optimization settings
    updateSettings: async(settings) => {
        const response = await api.put('/cost-optimization/settings', settings);
        return response.data;
    },

    // Get optimization settings
    getSettings: async() => {
        const response = await api.get('/cost-optimization/settings');
        return response.data;
    },

    // Get cost trends
    getCostTrends: async(timeRange = '30d') => {
        const response = await api.get(`/cost-optimization/trends?range=${timeRange}`);
        return response.data;
    },

    // Get cost comparison
    getCostComparison: async(timeRange = '30d') => {
        const response = await api.get(`/cost-optimization/comparison?range=${timeRange}`);
        return response.data;
    },

    // Export cost report
    exportCostReport: async(timeRange = '30d', format = 'csv') => {
        const response = await api.get(`/cost-optimization/export?range=${timeRange}&format=${format}`, {
            responseType: 'blob'
        });
        return response.data;
    },

    // Get cost alerts
    getCostAlerts: async() => {
        const response = await api.get('/cost-optimization/alerts');
        return response.data;
    },

    // Dismiss cost alert
    dismissAlert: async(alertId) => {
        const response = await api.post(`/cost-optimization/alerts/${alertId}/dismiss`);
        return response.data;
    },

    // Get cost benchmarks
    getCostBenchmarks: async() => {
        const response = await api.get('/cost-optimization/benchmarks');
        return response.data;
    },

    // Calculate projected costs
    calculateProjectedCosts: async(scenarios) => {
        const response = await api.post('/cost-optimization/project', scenarios);
        return response.data;
    },

    // Get optimization history
    getOptimizationHistory: async(params = {}) => {
        const response = await api.get('/cost-optimization/history', { params });
        return response.data;
    },

    // Apply optimization
    applyOptimization: async(optimizationId) => {
        const response = await api.post(`/cost-optimization/apply/${optimizationId}`);
        return response.data;
    },

    // Revert optimization
    revertOptimization: async(optimizationId) => {
        const response = await api.post(`/cost-optimization/revert/${optimizationId}`);
        return response.data;
    }
};

export default costOptimizationAPI;