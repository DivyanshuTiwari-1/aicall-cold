import api from './api';

const complianceAPI = {
  // Get compliance metrics
  getComplianceMetrics: async (timeRange = '7d') => {
    const response = await api.get(`/compliance/metrics?range=${timeRange}`);
    return response.data;
  },

  // Get audit logs
  getAuditLogs: async (params = {}) => {
    const response = await api.get('/compliance/audit-logs', { params });
    return response.data;
  },

  // Update consent settings
  updateConsentSettings: async settings => {
    const response = await api.put('/compliance/consent-settings', settings);
    return response.data;
  },

  // Get consent settings
  getConsentSettings: async () => {
    const response = await api.get('/compliance/consent-settings');
    return response.data;
  },

  // Log consent event
  logConsent: async consentData => {
    const response = await api.post('/compliance/log-consent', consentData);
    return response.data;
  },

  // Log opt-out event
  logOptOut: async optOutData => {
    const response = await api.post('/compliance/log-opt-out', optOutData);
    return response.data;
  },

  // Get compliance report
  getComplianceReport: async (timeRange = '30d') => {
    const response = await api.get(`/compliance/report?range=${timeRange}`);
    return response.data;
  },

  // Export compliance data
  exportComplianceData: async (type, timeRange = '30d', format = 'csv') => {
    const response = await api.get(`/compliance/export/${type}`, {
      params: { range: timeRange, format },
      responseType: 'blob',
    });
    return response.data;
  },

  // Validate phone number compliance
  validatePhoneCompliance: async (phone, country = 'US') => {
    const response = await api.post('/compliance/validate-phone', { phone, country });
    return response.data;
  },

  // Get TCPA compliance status
  getTCPAStatus: async () => {
    const response = await api.get('/compliance/tcpa-status');
    return response.data;
  },

  // Get GDPR compliance status
  getGDPRStatus: async () => {
    const response = await api.get('/compliance/gdpr-status');
    return response.data;
  },

  // Update compliance policies
  updateCompliancePolicies: async policies => {
    const response = await api.put('/compliance/policies', policies);
    return response.data;
  },

  // Get compliance alerts
  getComplianceAlerts: async () => {
    const response = await api.get('/compliance/alerts');
    return response.data;
  },

  // Dismiss compliance alert
  dismissAlert: async alertId => {
    const response = await api.post(`/compliance/alerts/${alertId}/dismiss`);
    return response.data;
  },

  // Get call recording consent status
  getRecordingConsent: async callId => {
    const response = await api.get(`/compliance/recording-consent/${callId}`);
    return response.data;
  },

  // Update recording consent
  updateRecordingConsent: async (callId, consent) => {
    const response = await api.put(`/compliance/recording-consent/${callId}`, { consent });
    return response.data;
  },
};

export default complianceAPI;
export { complianceAPI };
