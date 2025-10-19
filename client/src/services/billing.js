import api from './api';

export const billingAPI = {
  // Get credit balance
  getBalance: async () => {
    const response = await api.get('/billing/balance');
    return response.data;
  },

  // Purchase credits
  purchaseCredits: async (data) => {
    const response = await api.post('/billing/purchase', data);
    return response.data;
  },

  // Consume credits
  consumeCredits: async (data) => {
    const response = await api.post('/billing/consume', data);
    return response.data;
  },

  // Get transaction history
  getTransactions: async (params = {}) => {
    const response = await api.get('/billing/transactions', { params });
    return response.data;
  },

  // Get usage analytics
  getUsageAnalytics: async (params = {}) => {
    const response = await api.get('/billing/usage-analytics', { params });
    return response.data;
  },

  // Refund credits
  refundCredits: async (data) => {
    const response = await api.post('/billing/refund', data);
    return response.data;
  },
};

export default billingAPI;
