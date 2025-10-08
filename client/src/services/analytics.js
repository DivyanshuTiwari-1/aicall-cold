import api from './api';

export const analyticsAPI = {
    // Get dashboard analytics
    getDashboardAnalytics: async(params = {}) => {
        const response = await api.get('/analytics/dashboard', { params });
        return response.data;
    },

    // Get ROI calculator
    getROI: async(params = {}) => {
        const response = await api.get('/analytics/roi', { params });
        return response.data;
    }
};