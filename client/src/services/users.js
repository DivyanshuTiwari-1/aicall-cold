import api from './api';

export const usersAPI = {
  // Get all users in organization
  getAllUsers: async () => {
    const response = await api.get('/users');
    return response.data;
  },

  // Get users with optional filters (alias for getAllUsers)
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  // Create new user
  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  // Update user
  updateUser: async (userId, userData) => {
    const response = await api.put(`/users/${userId}`, userData);
    return response.data;
  },

  // Delete user
  deleteUser: async (userId) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },

  // Get user by ID
  getUserById: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  // Update user role
  updateUserRole: async (userId, roleType) => {
    const response = await api.put(`/users/${userId}`, { roleType });
    return response.data;
  },

  // Toggle user active status
  toggleUserStatus: async (userId, isActive) => {
    const response = await api.put(`/users/${userId}`, { isActive });
    return response.data;
  },

  // Get user statistics
  getUserStats: async (userId) => {
    const response = await api.get(`/users/${userId}/stats`);
    return response.data;
  },

  // Get team performance
  getTeamPerformance: async (params = {}) => {
    const response = await api.get('/users/team-performance', { params });
    return response.data;
  }
};

export default usersAPI;
