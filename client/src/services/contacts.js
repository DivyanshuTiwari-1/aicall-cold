import api from './api';

export const contactsAPI = {
    // Get all contacts
    getContacts: async(params = {}) => {
        const response = await api.get('/contacts', { params });
        return response.data;
    },

    // Get single contact
    getContact: async(id) => {
        const response = await api.get(`/contacts/${id}`);
        return response.data;
    },

    // Create contact
    createContact: async(contactData) => {
        const response = await api.post('/contacts', contactData);
        return response.data;
    },

    // Update contact
    updateContact: async(id, contactData) => {
        const response = await api.put(`/contacts/${id}`, contactData);
        return response.data;
    },

    // Delete contact
    deleteContact: async(id) => {
        const response = await api.delete(`/contacts/${id}`);
        return response.data;
    },

    // Bulk import contacts
    importContacts: async(contactsData) => {
        const response = await api.post('/contacts/import', contactsData);
        return response.data;
    },

    // Add to DNC list
    addToDNC: async(phoneData) => {
        const response = await api.post('/contacts/dnc', phoneData);
        return response.data;
    }
};