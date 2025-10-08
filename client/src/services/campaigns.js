import api from './api';

export const campaignsAPI = {
    // Get all campaigns
    getCampaigns: async(params = {}) => {
        const response = await api.get('/campaigns', { params });
        return response.data;
    },

    // Get single campaign
    getCampaign: async(id) => {
        const response = await api.get(`/campaigns/${id}`);
        return response.data;
    },

    // Create campaign
    createCampaign: async(campaignData) => {
        const response = await api.post('/campaigns', campaignData);
        return response.data;
    },

    // Update campaign
    updateCampaign: async(id, campaignData) => {
        const response = await api.put(`/campaigns/${id}`, campaignData);
        return response.data;
    },

    // Delete campaign
    deleteCampaign: async(id) => {
        const response = await api.delete(`/campaigns/${id}`);
        return response.data;
    },

    // Start campaign
    startCampaign: async(id) => {
        const response = await api.post(`/campaigns/${id}/start`);
        return response.data;
    },

    // Pause campaign
    pauseCampaign: async(id) => {
        const response = await api.post(`/campaigns/${id}/pause`);
        return response.data;
    },

    // Stop campaign
    stopCampaign: async(id) => {
        const response = await api.post(`/campaigns/${id}/stop`);
        return response.data;
    }
};