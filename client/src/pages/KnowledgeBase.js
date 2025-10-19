import {
    BookOpenIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    PencilIcon,
    PlusIcon,
    TrashIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { knowledgeAPI } from '../services/knowledge';

const KnowledgeBase = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Fetch knowledge entries
  const { data: entriesData, isLoading, error } = useQuery({
    queryKey: ['knowledge-entries'],
    queryFn: () => knowledgeAPI.getKnowledgeEntries({ search: searchTerm, category: selectedCategory }),
    refetchInterval: 30000,
  });

  // Fetch categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['knowledge-categories'],
    queryFn: () => knowledgeAPI.getCategories(),
    refetchInterval: 60000,
  });

  // Create entry mutation
  const createEntryMutation = useMutation({
    mutationFn: (data) => knowledgeAPI.createEntry(data),
    onSuccess: () => {
      toast.success('Knowledge entry created successfully');
      queryClient.invalidateQueries({ queryKey: ['knowledge-entries'] });
      setIsCreateModalOpen(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create knowledge entry');
    },
  });

  // Update entry mutation
  const updateEntryMutation = useMutation({
    mutationFn: ({ id, data }) => knowledgeAPI.updateEntry(id, data),
    onSuccess: () => {
      toast.success('Knowledge entry updated successfully');
      queryClient.invalidateQueries({ queryKey: ['knowledge-entries'] });
      setIsEditModalOpen(false);
      setSelectedEntry(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update knowledge entry');
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: (id) => knowledgeAPI.deleteEntry(id),
    onSuccess: () => {
      toast.success('Knowledge entry deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['knowledge-entries'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete knowledge entry');
    },
  });

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.organizationId) return;

    const handleKnowledgeUpdate = (data) => {
      // Refresh knowledge entries when data changes
      queryClient.invalidateQueries({ queryKey: ['knowledge-entries'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
    };

    addListener('knowledge_entry_created', handleKnowledgeUpdate);
    addListener('knowledge_entry_updated', handleKnowledgeUpdate);
    addListener('knowledge_entry_deleted', handleKnowledgeUpdate);

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.organizationId, addListener, queryClient]);

  const handleCreateEntry = (formData) => {
    createEntryMutation.mutate(formData);
  };

  const handleUpdateEntry = (formData) => {
    updateEntryMutation.mutate({ id: selectedEntry.id, data: formData });
  };

  const handleDeleteEntry = (entryId) => {
    if (window.confirm('Are you sure you want to delete this knowledge entry?')) {
      deleteEntryMutation.mutate(entryId);
    }
  };

  const handleEditEntry = (entry) => {
    setSelectedEntry(entry);
    setIsEditModalOpen(true);
  };

  const entries = entriesData?.entries || [];
  const categories = categoriesData?.categories || [];

  if (isLoading || categoriesLoading) return <LoadingSpinner />;
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load knowledge base</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-600">Manage FAQ and knowledge entries for AI agents</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Entry
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpenIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Entries</dt>
                  <dd className="text-lg font-medium text-gray-900">{entries.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Categories</dt>
                  <dd className="text-lg font-medium text-gray-900">{categories.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">High Confidence</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {entries.filter(e => e.confidence >= 0.8).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
          Search Knowledge Base
        </h3>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by question or answer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id || category} value={category.name || category}>
                  {category.name || category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Knowledge Entries List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Knowledge Entries</h3>
          {entries.length === 0 ? (
            <div className="text-center py-8">
              <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No knowledge entries</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first knowledge entry.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{entry.question}</h4>
                        {entry.category && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {entry.category}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.confidence >= 0.8
                            ? 'bg-green-100 text-green-800'
                            : entry.confidence >= 0.6
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {Math.round(entry.confidence * 100)}% confidence
                        </span>
                      </div>

                      <p className="text-gray-700 mb-3">{entry.answer}</p>

                      <div className="flex items-center text-sm text-gray-500">
                        <span>Created: {new Date(entry.createdAt).toLocaleDateString()}</span>
                        {entry.updatedAt !== entry.createdAt && (
                          <span className="ml-4">
                            Updated: {new Date(entry.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                        {entry.usageCount && (
                          <span className="ml-4">
                            Used: {entry.usageCount} times
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEditEntry(entry)}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="Delete"
                        disabled={deleteEntryMutation.isLoading}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Entry Modal */}
      <CreateEntryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateEntry}
        categories={categories}
        isLoading={createEntryMutation.isLoading}
      />

      {/* Edit Entry Modal */}
      <EditEntryModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEntry(null);
        }}
        onSubmit={handleUpdateEntry}
        entry={selectedEntry}
        categories={categories}
        isLoading={updateEntryMutation.isLoading}
      />
    </div>
  );
};

// Create Entry Modal Component
const CreateEntryModal = ({ isOpen, onClose, onSubmit, categories, isLoading }) => {
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: '',
    confidence: 0.8,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'range' ? parseFloat(value) : value,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create Knowledge Entry</h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="question"
                    value={formData.question}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter the question"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Answer <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="answer"
                    value={formData.answer}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter the answer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id || category} value={category.name || category}>
                        {category.name || category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confidence Score: <span className="font-semibold">{Math.round(formData.confidence * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    name="confidence"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.confidence}
                    onChange={handleChange}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Entry'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Edit Entry Modal Component
const EditEntryModal = ({ isOpen, onClose, onSubmit, entry, categories, isLoading }) => {
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: '',
    confidence: 0.8,
  });

  useEffect(() => {
    if (entry) {
      setFormData({
        question: entry.question || '',
        answer: entry.answer || '',
        category: entry.category || '',
        confidence: entry.confidence || 0.8,
      });
    }
  }, [entry]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'range' ? parseFloat(value) : value,
    }));
  };

  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Knowledge Entry</h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="question"
                    value={formData.question}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter the question"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Answer <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="answer"
                    value={formData.answer}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter the answer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id || category} value={category.name || category}>
                        {category.name || category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confidence Score: <span className="font-semibold">{Math.round(formData.confidence * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    name="confidence"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.confidence}
                    onChange={handleChange}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {isLoading ? 'Updating...' : 'Update Entry'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
