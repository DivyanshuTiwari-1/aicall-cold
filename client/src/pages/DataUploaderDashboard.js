import {
    ArrowUpTrayIcon,
    CheckCircleIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { contactsAPI } from '../services/contacts';

const DataUploaderDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);

  // Fetch upload statistics
  const { data: uploadStats, isLoading: statsLoading } = useQuery({
    queryKey: ['upload-stats'],
    queryFn: () => contactsAPI.getUploadStats(),
    refetchInterval: 30000,
  });

  // Fetch recent uploads
  const { data: recentUploads, isLoading: uploadsLoading } = useQuery({
    queryKey: ['recent-uploads'],
    queryFn: () => contactsAPI.getRecentUploads(),
    refetchInterval: 60000,
  });

  // Upload contacts mutation
  const uploadMutation = useMutation({
    mutationFn: (file) => contactsAPI.uploadContacts(file),
    onSuccess: (response) => {
      toast.success(`Successfully uploaded ${response.data.imported} contacts`);
      setShowUploadModal(false);
      setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ['upload-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Upload failed');
    },
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setUploadFile(file);
    }
  };

  const handleUpload = () => {
    if (!uploadFile) {
      toast.error('Please select a file to upload');
      return;
    }
    uploadMutation.mutate(uploadFile);
  };

  if (statsLoading || uploadsLoading) return <LoadingSpinner />;

  const stats = uploadStats?.data || {
    totalUploads: 0,
    totalContacts: 0,
    successfulUploads: 0,
    failedUploads: 0,
    lastUploadDate: null
  };

  const uploads = recentUploads?.uploads || [];

  const statCards = [
    {
      name: 'Total Uploads',
      value: stats.totalUploads,
      icon: ArrowUpTrayIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      name: 'Total Contacts',
      value: stats.totalContacts.toLocaleString(),
      icon: DocumentTextIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      name: 'Success Rate',
      value: stats.totalUploads > 0 ? `${Math.round((stats.successfulUploads / stats.totalUploads) * 100)}%` : '0%',
      icon: CheckCircleIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      name: 'Failed Uploads',
      value: stats.failedUploads,
      icon: XCircleIcon,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Upload Center</h1>
          <p className="text-gray-600">Manage contact data and uploads for your organization</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
          Upload Contacts
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className={`${stat.bgColor} rounded-lg p-6`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon className={`h-8 w-8 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Uploads */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Uploads</h3>
          {uploads.length > 0 ? (
            <div className="space-y-3">
              {uploads.map((upload) => (
                <div key={upload.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      upload.status === 'success' ? 'bg-green-100' :
                      upload.status === 'error' ? 'bg-red-100' : 'bg-yellow-100'
                    }`}>
                      {upload.status === 'success' ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      ) : upload.status === 'error' ? (
                        <XCircleIcon className="h-5 w-5 text-red-600" />
                      ) : (
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{upload.filename}</p>
                      <p className="text-sm text-gray-500">
                        {upload.imported} contacts • {new Date(upload.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      upload.status === 'success' ? 'bg-green-100 text-green-800' :
                      upload.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {upload.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No uploads yet</p>
              <p className="text-sm text-gray-400">Upload your first CSV file to get started</p>
            </div>
          )}
        </div>

        {/* Upload Guidelines */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Guidelines</h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">CSV Format Required</p>
                <p className="text-sm text-gray-500">Only CSV files are supported for uploads</p>
              </div>
            </div>
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Required Columns</p>
                <p className="text-sm text-gray-500">first_name, last_name, phone, email</p>
              </div>
            </div>
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Optional Columns</p>
                <p className="text-sm text-gray-500">company, title, industry, location</p>
              </div>
            </div>
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">File Size Limit</p>
                <p className="text-sm text-gray-500">Maximum 10MB per file</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Upload Contacts</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {uploadFile && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-sm text-green-800">{uploadFile.name}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploadMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataUploaderDashboard;
