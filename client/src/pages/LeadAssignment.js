import {
    ArrowPathIcon,
    CheckCircleIcon,
    CogIcon,
    EyeIcon,
    FunnelIcon,
    PlusIcon,
    UserGroupIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { assignmentsAPI } from '../services/assignments';
import { contactsAPI } from '../services/contacts';
import { leadReuseAPI } from '../services/leadReuse';
import { usersAPI } from '../services/users';

const LeadAssignment = () => {
  const queryClient = useQueryClient();
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showReuseSettings, setShowReuseSettings] = useState(false);
  const [showUnpickedLeads, setShowUnpickedLeads] = useState(false);
  const [selectedUnpickedLeads, setSelectedUnpickedLeads] = useState([]);
  const [filters, setFilters] = useState({
    campaign: '',
    status: '',
    search: '',
  });
  const [reuseSettingsData, setReuseSettingsData] = useState({
    enabled: false,
    delayHours: 24,
    maxAttempts: 3,
    conditions: []
  });

  // Fetch assignments
  const { data: assignmentsData, isLoading: assignmentsLoading, error: assignmentsError } = useQuery({
    queryKey: ['assignments', filters],
    queryFn: () => assignmentsAPI.getAssignments(filters),
    refetchInterval: 30000,
  });

  // Fetch agents
  const { data: agentsData, isLoading: agentsLoading, error: agentsError } = useQuery({
    queryKey: ['agents'],
    queryFn: () => usersAPI.getAllUsers(),
    refetchInterval: 60000,
  });

  // Fetch contacts for assignment
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts-for-assignment', filters],
    queryFn: () => contactsAPI.getContacts({
      limit: 100,
      ...filters,
      unassigned: true
    }),
    refetchInterval: 30000,
  });

  // Fetch assignment statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['assignment-stats'],
    queryFn: () => assignmentsAPI.getStats(),
    refetchInterval: 60000,
  });

  // Fetch reuse statistics
  const { data: reuseStatsData, isLoading: reuseStatsLoading } = useQuery({
    queryKey: ['reuse-stats'],
    queryFn: () => leadReuseAPI.getReuseStats(),
    refetchInterval: 300000, // 5 minutes
  });

  // Fetch reuse settings
  const { data: fetchedReuseSettings, isLoading: reuseSettingsLoading } = useQuery({
    queryKey: ['reuse-settings'],
    queryFn: () => leadReuseAPI.getReuseSettings(),
    refetchInterval: 300000, // 5 minutes
  });

  // Sync fetched reuse settings with state
  useEffect(() => {
    if (fetchedReuseSettings) {
      setReuseSettingsData(fetchedReuseSettings);
    }
  }, [fetchedReuseSettings]);

  // Fetch unpicked leads
  const { data: unpickedLeadsResponse, isLoading: unpickedLeadsLoading } = useQuery({
    queryKey: ['unpicked-leads'],
    queryFn: () => leadReuseAPI.getUnpickedLeads(50, 0),
    enabled: showUnpickedLeads,
    refetchInterval: 60000,
  });

  // Extract the actual data array from the response
  const unpickedLeadsData = unpickedLeadsResponse?.data || unpickedLeadsResponse || [];

  // Assign lead mutation
  const assignLeadMutation = useMutation({
    mutationFn: (data) => assignmentsAPI.assignLead(data),
    onSuccess: () => {
      toast.success('Lead assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-stats'] });
      setSelectedContacts([]);
      setSelectedAgent('');
    },
    onError: (error) => {
      console.error('Assignment error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to assign lead';
      const errors = error.response?.data?.errors || [];
      const received = error.response?.data?.received;

      if (error.response?.data?.conflicts) {
        const conflicts = error.response.data.conflicts.map(c => c.name).join(', ');
        toast.error(`${errorMessage}: ${conflicts}`);
      } else if (errors.length > 0) {
        toast.error(`${errorMessage}: ${errors.join(', ')}`);
        console.error('Validation errors:', errors);
        console.error('Received data:', received);
      } else {
        toast.error(errorMessage);
      }
    },
  });

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: (data) => assignmentsAPI.assignLeads(data),
    onSuccess: () => {
      toast.success('Leads assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-stats'] });
      setSelectedContacts([]);
      setSelectedAgent('');
      setShowBulkAssign(false);
    },
    onError: (error) => {
      console.error('Bulk assignment error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to assign leads';
      const errors = error.response?.data?.errors || [];
      const received = error.response?.data?.received;

      if (error.response?.data?.conflicts) {
        const conflicts = error.response.data.conflicts.map(c => c.name).join(', ');
        toast.error(`${errorMessage}: ${conflicts}`);
      } else if (errors.length > 0) {
        toast.error(`${errorMessage}: ${errors.join(', ')}`);
        console.error('Validation errors:', errors);
        console.error('Received data:', received);
      } else {
        toast.error(errorMessage);
      }
    },
  });

  // Update assignment status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ assignmentId, status }) => assignmentsAPI.updateAssignmentStatus(assignmentId, status),
    onSuccess: () => {
      toast.success('Assignment status updated');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-stats'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update status');
    },
  });

  // Process unpicked leads mutation
  const processUnpickedMutation = useMutation({
    mutationFn: () => leadReuseAPI.processUnpickedLeads(),
    onSuccess: (data) => {
      toast.success(`Processed ${data.result.processed} leads for reuse`);
      queryClient.invalidateQueries({ queryKey: ['reuse-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unpicked-leads'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to process unpicked leads');
    },
  });

  // Manual reuse mutation
  const manualReuseMutation = useMutation({
    mutationFn: (contactIds) => leadReuseAPI.triggerReuse(contactIds),
    onSuccess: (data) => {
      toast.success(`Manual reuse completed: ${data.result.successful}/${data.result.total} successful`);
      queryClient.invalidateQueries({ queryKey: ['reuse-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unpicked-leads'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setSelectedUnpickedLeads([]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to trigger manual reuse');
    },
  });

  // Update reuse settings mutation
  const updateReuseSettingsMutation = useMutation({
    mutationFn: (settings) => leadReuseAPI.updateReuseSettings(settings),
    onSuccess: () => {
      toast.success('Reuse settings updated successfully');
      queryClient.invalidateQueries({ queryKey: ['reuse-settings'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update reuse settings');
    },
  });

  const handleAssignLead = (contactId) => {
    if (!selectedAgent) {
      toast.error('Please select an agent');
      return;
    }

    const assignmentData = {
      contactIds: [contactId],
      assignedTo: selectedAgent,
    };

    console.log('Assigning lead with data:', assignmentData);
    console.log('Contact ID:', contactId);
    console.log('Selected Agent:', selectedAgent);

    assignLeadMutation.mutate(assignmentData);
  };

  const handleBulkAssign = () => {
    if (!selectedAgent) {
      toast.error('Please select an agent');
      return;
    }

    if (selectedContacts.length === 0) {
      toast.error('Please select contacts to assign');
      return;
    }

    // Check if any selected contacts are already assigned
    const assignedContacts = selectedContacts.filter(contactId => {
      const contact = contacts.find(c => c.id === contactId);
      return contact && contact.assignedTo;
    });

    if (assignedContacts.length > 0) {
      const assignedNames = assignedContacts.map(contactId => {
        const contact = contacts.find(c => c.id === contactId);
        return contact ? `${contact.firstName} ${contact.lastName}` : contactId;
      }).join(', ');
      toast.error(`Some contacts are already assigned: ${assignedNames}`);
      return;
    }

    const assignmentData = {
      contactIds: selectedContacts,
      assignedTo: selectedAgent,
    };

    console.log('Bulk assigning leads with data:', assignmentData);
    console.log('Selected Contacts:', selectedContacts);
    console.log('Selected Agent:', selectedAgent);

    bulkAssignMutation.mutate(assignmentData);
  };

  const handleContactSelect = (contactId) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleUnpickedLeadSelect = (contactId) => {
    setSelectedUnpickedLeads(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleProcessUnpickedLeads = () => {
    processUnpickedMutation.mutate();
  };

  const handleManualReuse = () => {
    if (selectedUnpickedLeads.length === 0) {
      toast.error('Please select leads to reuse');
      return;
    }
    manualReuseMutation.mutate(selectedUnpickedLeads);
  };

  const handleUpdateReuseSettings = (settings) => {
    updateReuseSettingsMutation.mutate(settings);
  };

  const handleSelectAll = () => {
    const contacts = contactsData?.contacts || [];
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  const handleUpdateStatus = (assignmentId, status) => {
    updateStatusMutation.mutate({ assignmentId, status });
  };

  const assignments = assignmentsData?.assignments || assignmentsData || [];
  const allUsers = agentsData?.users || agentsData || [];
  const agents = allUsers.filter(user => user.roleType === 'agent');
  const contacts = contactsData?.contacts || contactsData || [];
  const stats = statsData?.stats || statsData || {};

  // Handle loading states
  if (agentsLoading) {
    console.log('Agents are loading...');
  }
  if (agentsError) {
    console.error('Agents loading error:', agentsError);
  }
  if (assignmentsError) {
    console.error('Assignments loading error:', assignmentsError);
  }

  // Debug logging
  console.log('Debug - contactsData:', contactsData);
  console.log('Debug - contacts:', contacts);
  console.log('Debug - agentsData:', agentsData);
  console.log('Debug - agents:', agents);
  console.log('Debug - agentsError:', agentsError);

  if (assignmentsLoading || agentsLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Assignment</h1>
          <p className="text-gray-600">Assign leads to agents and manage assignments</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowBulkAssign(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Bulk Assign
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Assignments</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.totalAssignments || 0}</dd>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.completedAssignments || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircleIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.pendingAssignments || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FunnelIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Unassigned</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.unassignedLeads || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Reuse Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Lead Reuse Management</h3>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowReuseSettings(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <CogIcon className="h-4 w-4 mr-2" />
                Settings
              </button>
              <button
                onClick={() => setShowUnpickedLeads(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <UserGroupIcon className="h-4 w-4 mr-2" />
                Unpicked Leads
              </button>
              <button
                onClick={handleProcessUnpickedLeads}
                disabled={processUnpickedMutation.isLoading}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
              >
                {processUnpickedMutation.isLoading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                )}
                Process Unpicked
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Reuse Stats */}
          {reuseStatsData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-500">Reuse Rate</div>
                <div className="text-2xl font-bold text-gray-900">
                  {reuseStatsData.reuseRate ? `${(reuseStatsData.reuseRate * 100).toFixed(1)}%` : '0%'}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-500">Total Reused</div>
                <div className="text-2xl font-bold text-gray-900">{reuseStatsData.totalReused || 0}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-500">Success Rate</div>
                <div className="text-2xl font-bold text-gray-900">
                  {reuseStatsData.successRate ? `${(reuseStatsData.successRate * 100).toFixed(1)}%` : '0%'}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-500">Available for Reuse</div>
                <div className="text-2xl font-bold text-gray-900">{reuseStatsData.availableForReuse || 0}</div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowUnpickedLeads(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <EyeIcon className="h-4 w-4 mr-2" />
              View Unpicked Leads
            </button>
            <button
              onClick={handleProcessUnpickedLeads}
              disabled={processUnpickedMutation.isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
            >
              {processUnpickedMutation.isLoading ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <ArrowPathIcon className="h-4 w-4 mr-2" />
              )}
              Auto Process Unpicked
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Campaign</label>
            <select
              value={filters.campaign}
              onChange={(e) => setFilters({ ...filters, campaign: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Campaigns</option>
              {/* Add campaign options here */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search contacts..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Available Contacts for Assignment */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Available Contacts</h3>
            <div className="flex items-center space-x-4">
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.firstName} {agent.lastName}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedContacts.length === contacts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          {contacts.length === 0 ? (
            <div className="text-center py-8">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No contacts available</h3>
              <p className="mt-1 text-sm text-gray-500">
                All contacts have been assigned or no contacts match your filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedContacts.length === contacts.length && contacts.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedContacts.includes(contact.id)}
                          onChange={() => handleContactSelect(contact.id)}
                          disabled={contact.assignedTo}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {contact.firstName?.charAt(0) || '?'}
                                {contact.lastName?.charAt(0) || '?'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {contact.firstName} {contact.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{contact.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contact.company || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contact.campaign?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          contact.assignedTo
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {contact.assignedTo ? `Assigned to ${contact.assignedAgentName || 'Unknown'}` : 'Available'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleAssignLead(contact.id)}
                          disabled={!selectedAgent || contact.assignedTo}
                          className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          {contact.assignedTo ? 'Assigned' : 'Assign'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Current Assignments */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Current Assignments</h3>
          {assignments.length === 0 ? (
            <div className="text-center py-8">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No assignments</h3>
              <p className="mt-1 text-sm text-gray-500">
                Assignments will appear here once leads are assigned to agents.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assignments.map((assignment) => (
                    <tr key={assignment.assignmentId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {assignment.contact.firstName?.charAt(0) || '?'}
                                {assignment.contact.lastName?.charAt(0) || '?'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {assignment.contact.firstName} {assignment.contact.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{assignment.contact.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {assignment.agent.firstName} {assignment.agent.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          assignment.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : assignment.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : assignment.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {assignment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(assignment.assignedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUpdateStatus(assignment.assignmentId, 'in_progress')}
                            className="text-blue-600 hover:text-blue-900"
                            disabled={assignment.status === 'in_progress'}
                          >
                            Start
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(assignment.assignmentId, 'completed')}
                            className="text-green-600 hover:text-green-900"
                            disabled={assignment.status === 'completed'}
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(assignment.assignmentId, 'cancelled')}
                            className="text-red-600 hover:text-red-900"
                            disabled={assignment.status === 'cancelled'}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Assign Modal */}
      {showBulkAssign && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowBulkAssign(false)}
            />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Bulk Assign Leads</h3>
                  <button
                    onClick={() => setShowBulkAssign(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Agent
                    </label>
                    <select
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Agent</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.firstName} {agent.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selected Contacts ({selectedContacts.length})
                    </label>
                    <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                      {selectedContacts.map((contactId) => {
                        const contact = contacts.find(c => c.id === contactId);
                        return contact ? (
                          <div key={contactId} className="flex items-center justify-between py-1">
                            <span className="text-sm">
                              {contact.firstName} {contact.lastName} - {contact.phone}
                            </span>
                            <button
                              onClick={() => handleContactSelect(contactId)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <XCircleIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowBulkAssign(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkAssign}
                    disabled={!selectedAgent || selectedContacts.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Assign {selectedContacts.length} Leads
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reuse Settings Modal */}
      {showReuseSettings && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Reuse Settings</h3>

              {reuseSettingsData && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enable Automatic Reuse
                    </label>
                    <input
                      type="checkbox"
                      checked={reuseSettingsData.enabled}
                      onChange={(e) => setReuseSettingsData({
                        ...reuseSettingsData,
                        enabled: e.target.checked
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reuse Delay (hours)
                    </label>
                    <input
                      type="number"
                      value={reuseSettingsData.delayHours || 24}
                      onChange={(e) => setReuseSettingsData({
                        ...reuseSettingsData,
                        delayHours: parseInt(e.target.value)
                      })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="168"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Reuse Attempts
                    </label>
                    <input
                      type="number"
                      value={reuseSettingsData.maxAttempts || 3}
                      onChange={(e) => setReuseSettingsData({
                        ...reuseSettingsData,
                        maxAttempts: parseInt(e.target.value)
                      })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reuse Conditions
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={reuseSettingsData.conditions?.includes('missed')}
                          onChange={(e) => {
                            const conditions = reuseSettingsData.conditions || [];
                            if (e.target.checked) {
                              setReuseSettingsData({
                                ...reuseSettingsData,
                                conditions: [...conditions, 'missed']
                              });
                            } else {
                              setReuseSettingsData({
                                ...reuseSettingsData,
                                conditions: conditions.filter(c => c !== 'missed')
                              });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                        />
                        Missed Calls
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={reuseSettingsData.conditions?.includes('no_answer')}
                          onChange={(e) => {
                            const conditions = reuseSettingsData.conditions || [];
                            if (e.target.checked) {
                              setReuseSettingsData({
                                ...reuseSettingsData,
                                conditions: [...conditions, 'no_answer']
                              });
                            } else {
                              setReuseSettingsData({
                                ...reuseSettingsData,
                                conditions: conditions.filter(c => c !== 'no_answer')
                              });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                        />
                        No Answer
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={reuseSettingsData.conditions?.includes('busy')}
                          onChange={(e) => {
                            const conditions = reuseSettingsData.conditions || [];
                            if (e.target.checked) {
                              setReuseSettingsData({
                                ...reuseSettingsData,
                                conditions: [...conditions, 'busy']
                              });
                            } else {
                              setReuseSettingsData({
                                ...reuseSettingsData,
                                conditions: conditions.filter(c => c !== 'busy')
                              });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                        />
                        Busy
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowReuseSettings(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateReuseSettings}
                  disabled={updateReuseSettingsMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updateReuseSettingsMutation.isLoading ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : null}
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unpicked Leads Modal */}
      {showUnpickedLeads && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Unpicked Leads</h3>

              {unpickedLeadsData && Array.isArray(unpickedLeadsData) && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      {unpickedLeadsData.length} leads available for reuse
                    </p>
                    <button
                      onClick={handleManualReuse}
                      disabled={selectedUnpickedLeads.length === 0 || manualReuseMutation.isLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {manualReuseMutation.isLoading ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <ArrowPathIcon className="h-4 w-4 mr-2" />
                      )}
                      Reuse Selected ({selectedUnpickedLeads.length})
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <input
                              type="checkbox"
                              checked={selectedUnpickedLeads.length === unpickedLeadsData?.length && unpickedLeadsData?.length > 0}
                              onChange={(e) => {
                                if (e.target.checked && Array.isArray(unpickedLeadsData)) {
                                  setSelectedUnpickedLeads(unpickedLeadsData.map(lead => lead.id));
                                } else {
                                  setSelectedUnpickedLeads([]);
                                }
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Call
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Outcome
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Reuse Count
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Array.isArray(unpickedLeadsData) && unpickedLeadsData.length > 0 ? (
                          unpickedLeadsData.map((lead) => (
                          <tr key={lead.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedUnpickedLeads.includes(lead.id)}
                                onChange={(e) => handleUnpickedLeadSelect(lead.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {lead.firstName} {lead.lastName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {lead.phone}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {lead.lastCallAt ? new Date(lead.lastCallAt).toLocaleDateString() : 'Never'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                lead.lastCallOutcome === 'missed' ? 'bg-red-100 text-red-800' :
                                lead.lastCallOutcome === 'no_answer' ? 'bg-yellow-100 text-yellow-800' :
                                lead.lastCallOutcome === 'busy' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {lead.lastCallOutcome || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {lead.reuseCount || 0}
                            </td>
                          </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                              {unpickedLeadsLoading ? 'Loading...' : 'No unpicked leads available'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowUnpickedLeads(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadAssignment;
