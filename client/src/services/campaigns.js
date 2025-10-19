import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const campaignsAPI = {
    // Get all campaigns
    getCampaigns: async () => {
        const response = await axios.get(`${API_BASE_URL}/api/v1/campaigns`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    },

    // Get single campaign
    getCampaign: async (id) => {
        const response = await axios.get(`${API_BASE_URL}/api/v1/campaigns/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    },

    // Create campaign
    createCampaign: async (data) => {
        const response = await axios.post(`${API_BASE_URL}/api/v1/campaigns`, data, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    },

    // Update campaign
    updateCampaign: async (id, data) => {
        const response = await axios.put(`${API_BASE_URL}/api/v1/campaigns/${id}`, data, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    },

    // Delete campaign
    deleteCampaign: async (id) => {
        const response = await axios.delete(`${API_BASE_URL}/api/v1/campaigns/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    },

    // Get campaign stats
    getCampaignStats: async (id) => {
        const response = await axios.get(`${API_BASE_URL}/api/v1/campaigns/${id}/stats`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    }
};

export { campaignsAPI };
export default campaignsAPI;
