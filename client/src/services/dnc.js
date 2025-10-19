import api from './api';

const dncAPI = {
    // Get DNC records
    getDNCRecords: async(params = {}) => {
        const response = await api.get('/dnc/records', { params });
        return response.data;
    },

    // Add number to DNC list
    addToDNC: async(dncData) => {
        const response = await api.post('/dnc/add', dncData);
        return response.data;
    },

    // Remove number from DNC list
    removeFromDNC: async(id) => {
        const response = await api.delete(`/dnc/remove/${id}`);
        return response.data;
    },

    // Check if number is on DNC list
    checkDNC: async(phone) => {
        const response = await api.get(`/dnc/check/${phone}`);
        return response.data;
    },

    // Bulk add to DNC
    bulkAddToDNC: async(phones) => {
        const response = await api.post('/dnc/bulk-add', { phones });
        return response.data;
    },

    // Import DNC list from file
    importDNC: async(file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post('/dnc/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    // Export DNC list
    exportDNC: async(format = 'csv') => {
        const response = await api.get('/dnc/export', {
            params: { format },
            responseType: 'blob'
        });
        return response.data;
    },

    // Get DNC statistics
    getDNCStats: async() => {
        const response = await api.get('/dnc/stats');
        return response.data;
    },

    // Sync with national DNC registry
    syncNationalDNC: async() => {
        const response = await api.post('/dnc/sync-national');
        return response.data;
    }
};

export default dncAPI;