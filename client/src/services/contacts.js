import api from './api';

export const contactsAPI = {
  // Get all contacts
  getContacts: async (params = {}) => {
    const response = await api.get('/contacts', { params });
    return response.data;
  },

  // Get single contact
  getContact: async (id) => {
    const response = await api.get(`/contacts/${id}`);
    return response.data;
  },

  // Create contact
  createContact: async (contactData) => {
    const response = await api.post('/contacts', contactData);
    return response.data;
  },

  // Update contact
  updateContact: async (id, contactData) => {
    const response = await api.put(`/contacts/${id}`, contactData);
    return response.data;
  },

  // Delete contact
  deleteContact: async (id) => {
    const response = await api.delete(`/contacts/${id}`);
    return response.data;
  },

  // Bulk import contacts
  bulkImportContacts: async (contactsData) => {
    const response = await api.post('/contacts/bulk', contactsData);
    return response.data;
  },

  // Import contacts (alias for bulk)
  importContacts: async (contactsData) => {
    const response = await api.post('/contacts/import', contactsData);
    return response.data;
  },

  // Get contact statistics
  getContactStats: async () => {
    const response = await api.get('/contacts/stats');
    return response.data;
  },
};
