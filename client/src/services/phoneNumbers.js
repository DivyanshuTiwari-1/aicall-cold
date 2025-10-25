import api from './api';

export const phoneNumbersAPI = {
  // Get all phone numbers
  getAllPhoneNumbers: async (params = {}) => {
    const response = await api.get('/phone-numbers', { params });
    return response.data;
  },

  // Add a new phone number
  addPhoneNumber: async (data) => {
    const response = await api.post('/phone-numbers', data);
    return response.data;
  },

  // Bulk upload phone numbers
  bulkUploadPhoneNumbers: async (phoneNumbers) => {
    const response = await api.post('/phone-numbers/bulk-upload', { phoneNumbers });
    return response.data;
  },

  // Assign phone number to agent
  assignPhoneNumber: async (numberId, data) => {
    const response = await api.post(`/phone-numbers/${numberId}/assign`, data);
    return response.data;
  },

  // Unassign phone number from agent
  unassignPhoneNumber: async (numberId) => {
    const response = await api.post(`/phone-numbers/${numberId}/unassign`);
    return response.data;
  },

  // Delete phone number
  deletePhoneNumber: async (numberId) => {
    const response = await api.delete(`/phone-numbers/${numberId}`);
    return response.data;
  },

  // Get phone numbers assigned to an agent
  getAgentPhoneNumbers: async (agentId) => {
    const response = await api.get(`/phone-numbers/agent/${agentId}`);
    return response.data;
  },

  // Get available phone numbers for automated calls (role-based)
  getAvailableNumbers: async () => {
    const response = await api.get('/phone-numbers/available');
    return response.data;
  },
};

export default phoneNumbersAPI;
