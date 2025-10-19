import api from './api';

export const scriptsAPI = {
  // Get all scripts
  getScripts: async (params = {}) => {
    const response = await api.get('/scripts', { params });
    return response.data;
  },

  // Get single script
  getScript: async id => {
    const response = await api.get(`/scripts/${id}`);
    return response.data;
  },

  // Create script
  createScript: async scriptData => {
    const response = await api.post('/scripts', scriptData);
    return response.data;
  },

  // Update script
  updateScript: async (id, scriptData) => {
    const response = await api.put(`/scripts/${id}`, scriptData);
    return response.data;
  },

  // Delete script
  deleteScript: async id => {
    const response = await api.delete(`/scripts/${id}`);
    return response.data;
  },

  // Get script for conversation
  getScriptForConversation: async (callId, question, context = {}) => {
    const response = await api.post('/scripts/conversation', {
      call_id: callId,
      question,
      context,
    });
    return response.data;
  },
};
