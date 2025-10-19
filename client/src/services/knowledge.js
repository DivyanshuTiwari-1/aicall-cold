import api from './api';

const knowledgeAPI = {
  // Knowledge Entries
  getKnowledgeEntries: async (params = {}) => {
    const response = await api.get('/knowledge/entries', { params });
    return response.data;
  },

  createEntry: async entryData => {
    const response = await api.post('/knowledge/entries', entryData);
    return response.data;
  },

  updateEntry: async (id, entryData) => {
    const response = await api.put(`/knowledge/entries/${id}`, entryData);
    return response.data;
  },

  deleteEntry: async id => {
    const response = await api.delete(`/knowledge/entries/${id}`);
    return response.data;
  },

  getEntry: async id => {
    const response = await api.get(`/knowledge/entries/${id}`);
    return response.data;
  },

  // Knowledge Query
  queryKnowledge: async (queryData) => {
    const response = await api.post('/knowledge/query', queryData);
    return response.data;
  },

  feedbackSuggestion: async (suggestionId, wasHelpful) => {
    const response = await api.post(`/knowledge/feedback/${suggestionId}`, { wasHelpful });
    return response.data;
  },

  // Knowledge Categories
  getCategories: async () => {
    const response = await api.get('/knowledge/categories');
    return response.data;
  },

  createCategory: async categoryData => {
    const response = await api.post('/knowledge/categories', categoryData);
    return response.data;
  },

  updateCategory: async (id, categoryData) => {
    const response = await api.put(`/knowledge/categories/${id}`, categoryData);
    return response.data;
  },

  deleteCategory: async id => {
    const response = await api.delete(`/knowledge/categories/${id}`);
    return response.data;
  },

  // Knowledge Analytics
  getAnalytics: async (timeRange = '7d') => {
    const response = await api.get(`/knowledge/analytics?range=${timeRange}`);
    return response.data;
  },

  getUsageStats: async entryId => {
    const response = await api.get(`/knowledge/entries/${entryId}/stats`);
    return response.data;
  },

  // Knowledge Search
  searchKnowledge: async (query, params = {}) => {
    const response = await api.post('/knowledge/search', { query, ...params });
    return response.data;
  },

  // Knowledge Import/Export
  importKnowledge: async file => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/knowledge/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  exportKnowledge: async (format = 'json') => {
    const response = await api.get(`/knowledge/export?format=${format}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Knowledge Suggestions
  getSuggestions: async context => {
    const response = await api.post('/knowledge/suggestions', context);
    return response.data;
  },

  // Knowledge Validation
  validateEntry: async entryData => {
    const response = await api.post('/knowledge/validate', entryData);
    return response.data;
  },

  // Knowledge Templates
  getTemplates: async () => {
    const response = await api.get('/knowledge/templates');
    return response.data;
  },

  createTemplate: async templateData => {
    const response = await api.post('/knowledge/templates', templateData);
    return response.data;
  },

  // Knowledge Learning
  learnFromCall: async callData => {
    const response = await api.post('/knowledge/learn', callData);
    return response.data;
  },

  // Knowledge Quality
  getQualityScore: async entryId => {
    const response = await api.get(`/knowledge/entries/${entryId}/quality`);
    return response.data;
  },

  // Knowledge Feedback
  submitFeedback: async (entryId, feedback) => {
    const response = await api.post(`/knowledge/entries/${entryId}/feedback`, feedback);
    return response.data;
  },

  // Knowledge Versioning
  getEntryVersions: async entryId => {
    const response = await api.get(`/knowledge/entries/${entryId}/versions`);
    return response.data;
  },

  restoreVersion: async (entryId, versionId) => {
    const response = await api.post(`/knowledge/entries/${entryId}/versions/${versionId}/restore`);
    return response.data;
  },

  // Knowledge Collaboration
  shareEntry: async (entryId, shareData) => {
    const response = await api.post(`/knowledge/entries/${entryId}/share`, shareData);
    return response.data;
  },

  getSharedEntries: async () => {
    const response = await api.get('/knowledge/shared');
    return response.data;
  },

  // Knowledge Automation
  enableAutoLearning: async settings => {
    const response = await api.post('/knowledge/auto-learning', settings);
    return response.data;
  },

  getAutoLearningSettings: async () => {
    const response = await api.get('/knowledge/auto-learning');
    return response.data;
  },

  // Knowledge Integration
  integrateWithCRM: async crmData => {
    const response = await api.post('/knowledge/integrate/crm', crmData);
    return response.data;
  },

  syncWithExternalSource: async sourceData => {
    const response = await api.post('/knowledge/sync', sourceData);
    return response.data;
  },
};

export { knowledgeAPI };
export default knowledgeAPI;
