import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const Campaigns = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading, error } = useQuery('campaigns', () =>
    api.get('/campaigns').then((res) => res.data)
  );

  const createMutation = useMutation((campaignData) => api.post('/campaigns', campaignData), {
    onSuccess: () => {
      queryClient.invalidateQueries('campaigns');
      setShowCreateModal(false);
      toast.success('Campaign created successfully!');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to create campaign');
    },
  });

  const updateMutation = useMutation(
    ({ id, data }) => api.put(`/campaigns/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('campaigns');
        toast.success('Campaign updated successfully!');
      },
      onError: (error) => {
        toast.error(error?.response?.data?.message || 'Failed to update campaign');
      },
    }
  );

  const deleteMutation = useMutation((id) => api.delete(`/campaigns/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries('campaigns');
      toast.success('Campaign deleted successfully!');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to delete campaign');
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load campaigns</p>
      </div>
    );

  const handleStatusToggle = (campaign) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    updateMutation.mutate({ id: campaign.id, data: { status: newStatus } });
  };

  const handleDelete = (campaign) => {
    if (window.confirm(`Are you sure you want to delete "${campaign.name}"?`)) {
      deleteMutation.mutate(campaign.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-600">Manage your calling campaigns</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Campaign
        </button>
      </div>

      {/* Campaigns Grid */}
      {campaigns?.campaigns?.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0
                 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5
                 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0
                 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No campaigns</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new campaign.</p>
          <div className="mt-6">
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              Create Campaign
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns?.campaigns?.map((campaign) => (
            <div key={campaign.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{campaign.type} Campaign</p>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    campaign.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : campaign.status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {campaign.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{campaign.contactCount}</p>
                  <p className="text-sm text-gray-500">Contacts</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{campaign.callCount}</p>
                  <p className="text-sm text-gray-500">Calls</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleStatusToggle(campaign)}
                    className={`p-2 rounded-lg ${
                      campaign.status === 'active'
                        ? 'text-yellow-600 hover:bg-yellow-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                    title={campaign.status === 'active' ? 'Pause' : 'Resume'}
                  >
                    {campaign.status === 'active' ? (
                      <PauseIcon className="h-4 w-4" />
                    ) : (
                      <PlayIcon className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(campaign)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-700">View Details</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={createMutation.mutate}
          loading={createMutation.isLoading}
        />
      )}
    </div>
  );
};

const CreateCampaignModal = ({ onClose, onSubmit, loading }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'sales',
    voice_persona: 'professional',
    auto_retry: true,
    best_time_enabled: true,
    emotion_detection: true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen text-center">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        <div className="inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Campaign</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Campaign Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Q4 Sales Outreach"
                    required
                  />
                </div>
                <div>
                  <label className="label">Campaign Type</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="input-field"
                  >
                    <option value="sales">Sales</option>
                    <option value="recruitment">Recruitment</option>
                  </select>
                </div>
                <div>
                  <label className="label">Voice Persona</label>
                  <select
                    name="voice_persona"
                    value={formData.voice_persona}
                    onChange={handleChange}
                    className="input-field"
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="authoritative">Authoritative</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="auto_retry"
                      checked={formData.auto_retry}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Auto-retry failed calls
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="best_time_enabled"
                      checked={formData.best_time_enabled}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Enable best time prediction
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="emotion_detection"
                      checked={formData.emotion_detection}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Enable emotion detection
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 flex justify-end space-x-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Create Campaign'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
