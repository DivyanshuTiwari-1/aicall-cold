import api from './api';

const voiceStudioAPI = {
    // Voice Personas
    getVoicePersonas: async() => {
        const response = await api.get('/voice-studio/personas');
        return response.data;
    },

    createVoicePersona: async(voiceData) => {
        const response = await api.post('/voice-studio/personas', voiceData);
        return response.data;
    },

    updateVoicePersona: async(id, voiceData) => {
        const response = await api.put(`/voice-studio/personas/${id}`, voiceData);
        return response.data;
    },

    deleteVoicePersona: async(id) => {
        const response = await api.delete(`/voice-studio/personas/${id}`);
        return response.data;
    },

    exportVoicePersona: async(id) => {
        const response = await api.get(`/voice-studio/personas/${id}/export`, {
            responseType: 'blob'
        });
        return response.data;
    },

    importVoicePersona: async(file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post('/voice-studio/personas/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    // Scripts
    getScripts: async(params = {}) => {
        const response = await api.get('/voice-studio/scripts', { params });
        return response.data;
    },

    createScript: async(scriptData) => {
        const response = await api.post('/voice-studio/scripts', scriptData);
        return response.data;
    },

    updateScript: async(id, scriptData) => {
        const response = await api.put(`/voice-studio/scripts/${id}`, scriptData);
        return response.data;
    },

    deleteScript: async(id) => {
        const response = await api.delete(`/voice-studio/scripts/${id}`);
        return response.data;
    },

    // TTS Generation
    generateTTS: async(ttsData) => {
        const response = await api.post('/voice-studio/generate', ttsData);
        return response.data;
    },

    // TTS Settings
    getTTSSettings: async() => {
        const response = await api.get('/voice-studio/settings');
        return response.data;
    },

    updateTTSSettings: async(settings) => {
        const response = await api.put('/voice-studio/settings', settings);
        return response.data;
    },

    // Voice Testing
    testVoice: async(testData) => {
        const response = await api.post('/voice-studio/test', testData);
        return response.data;
    },

    // Voice Analytics
    getVoiceAnalytics: async(timeRange = '7d') => {
        const response = await api.get(`/voice-studio/analytics?range=${timeRange}`);
        return response.data;
    },

    // Voice Templates
    getVoiceTemplates: async() => {
        const response = await api.get('/voice-studio/templates');
        return response.data;
    },

    createVoiceTemplate: async(templateData) => {
        const response = await api.post('/voice-studio/templates', templateData);
        return response.data;
    },

    // Voice Cloning (if supported)
    cloneVoice: async(voiceData) => {
        const response = await api.post('/voice-studio/clone', voiceData);
        return response.data;
    },

    // Voice Quality Analysis
    analyzeVoiceQuality: async(audioData) => {
        const response = await api.post('/voice-studio/analyze-quality', audioData);
        return response.data;
    },

    // Voice Comparison
    compareVoices: async(voiceIds) => {
        const response = await api.post('/voice-studio/compare', { voiceIds });
        return response.data;
    },

    // Voice Recommendations
    getVoiceRecommendations: async(context) => {
        const response = await api.post('/voice-studio/recommendations', context);
        return response.data;
    }
};

export default voiceStudioAPI;