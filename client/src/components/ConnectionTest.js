import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ConnectionTest = () => {
  const [connectionStatus, setConnectionStatus] = useState('testing');
  const [error, setError] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      setConnectionStatus('testing');
      setError(null);

      // Test health endpoint
      const response = await api.get('/health');
      setServerInfo(response.data);
      setConnectionStatus('connected');
    } catch (err) {
      console.error('Connection test failed:', err);
      setError(err.message || 'Failed to connect to backend');
      setConnectionStatus('failed');
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'testing':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '✅';
      case 'failed':
        return '❌';
      case 'testing':
        return '🔄';
      default:
        return '❓';
    }
  };

  return (
    <div className='bg-white p-6 rounded-lg shadow-md border'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold'>Backend Connection Status</h3>
        <button
          onClick={testConnection}
          disabled={connectionStatus === 'testing'}
          className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50'
        >
          {connectionStatus === 'testing' ? 'Testing...' : 'Test Again'}
        </button>
      </div>

      <div className={`p-4 rounded-lg ${getStatusColor()}`}>
        <div className='flex items-center space-x-2'>
          <span className='text-2xl'>{getStatusIcon()}</span>
          <span className='font-medium'>
            {connectionStatus === 'connected' && 'Connected to Backend'}
            {connectionStatus === 'failed' && 'Connection Failed'}
            {connectionStatus === 'testing' && 'Testing Connection...'}
          </span>
        </div>

        {error && (
          <div className='mt-2 text-sm'>
            <strong>Error:</strong> {error}
          </div>
        )}

        {serverInfo && (
          <div className='mt-2 text-sm'>
            <div>
              <strong>Status:</strong> {serverInfo.status}
            </div>
            <div>
              <strong>Version:</strong> {serverInfo.version}
            </div>
            <div>
              <strong>Timestamp:</strong> {new Date(serverInfo.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionTest;
