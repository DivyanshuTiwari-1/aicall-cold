import api from './api';

export const conversationAPI = {
  // Process conversation input
  processConversation: async conversationData => {
    const response = await api.post('/conversation/process', conversationData);
    return response.data;
  },

  // Get conversation history
  getConversationHistory: async callId => {
    const response = await api.get(`/conversation/history/${callId}`);
    return response.data;
  },

  // Get conversation context
  getConversationContext: async callId => {
    const response = await api.get(`/conversation/context/${callId}`);
    return response.data;
  },

  // Update conversation context
  updateConversationContext: async (callId, contextData) => {
    const response = await api.put(`/conversation/context/${callId}`, contextData);
    return response.data;
  },

  // Send message to conversation
  sendMessage: async (callId, message) => {
    const response = await api.post(`/conversation/message/${callId}`, { message });
    return response.data;
  },

  // Get AI response
  getAIResponse: async (callId, userInput) => {
    const response = await api.post(`/conversation/ai-response/${callId}`, {
      user_input: userInput,
    });
    return response.data;
  },
};
