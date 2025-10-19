import api from './api';

const warmTransferAPI = {
  // Request a warm transfer
  requestTransfer: async (data) => {
    const response = await api.post('/warm-transfers/request', data);
    return response.data;
  },

  // Accept a warm transfer
  acceptTransfer: async (transferId) => {
    const response = await api.post('/warm-transfers/accept', { transferId });
    return response.data;
  },

  // Reject a warm transfer
  rejectTransfer: async (transferId, reason = null) => {
    const response = await api.post('/warm-transfers/reject', { transferId, reason });
    return response.data;
  },

  // Complete a warm transfer
  completeTransfer: async (transferId) => {
    const response = await api.post('/warm-transfers/complete', { transferId });
    return response.data;
  },

  // Get pending transfers for current agent
  getPendingTransfers: async () => {
    const response = await api.get('/warm-transfers/pending');
    return response.data;
  },

  // Get transfer history
  getTransferHistory: async (limit = 20, offset = 0) => {
    const response = await api.get(`/warm-transfers/history?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  // Get specific transfer details
  getTransferDetails: async (transferId) => {
    const response = await api.get(`/warm-transfers/${transferId}`);
    return response.data;
  }
};

export default warmTransferAPI;
