import {
    ChartBarIcon,
    CheckCircleIcon,
    ClockIcon,
    PhoneIcon,
    PhoneXMarkIcon,
    PlusIcon,
    StopIcon,
    UserGroupIcon,
    XCircleIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import SimpleBrowserPhone from '../components/SimpleBrowserPhone';
import Softphone from '../components/Softphone';
import WarmTransferManager from '../components/WarmTransferManager';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { assignmentsAPI } from '../services/assignments';
import { contactsAPI } from '../services/contacts';
import { manualCallsAPI } from '../services/manualCalls';

const AgentDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  const [selectedLead, setSelectedLead] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callNotes, setCallNotes] = useState('');
  const [callStatus, setCallStatus] = useState('idle');
  const [currentCall, setCurrentCall] = useState(null);
  const [callingContact, setCallingContact] = useState(null);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLead, setNewLead] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    company: '',
    title: ''
  });

  // Fetch assigned leads
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['my-leads'],
    queryFn: () => assignmentsAPI.getMyLeads({ status: 'pending' }),
    refetchInterval: 30000,
  });

  // Fetch call statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['call-stats'],
    queryFn: () => manualCallsAPI.getStats('7d'),
    refetchInterval: 60000,
  });

  // Fetch my call history
  const { data: callsData } = useQuery({
    queryKey: ['my-calls'],
    queryFn: () => manualCallsAPI.getMyCalls({ limit: 10 }),
    refetchInterval: 30000,
  });

  // Start call mutation
  const startCallMutation = useMutation({
    mutationFn: (data) => manualCallsAPI.startCall(data),
    onSuccess: (response) => {
      toast.success('Call initiated successfully');
      setIsCalling(true);
      setCallDuration(0);
      setCallStatus('ringing');
      setCurrentCall(response.call);
      queryClient.invalidateQueries({ queryKey: ['my-leads'] });
      queryClient.invalidateQueries({ queryKey: ['call-stats'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to start call');
      setCallStatus('idle');
      setCurrentCall(null);
    },
  });

  // Log call mutation
  const logCallMutation = useMutation({
    mutationFn: (data) => manualCallsAPI.logCall(data),
    onSuccess: () => {
      toast.success('Call logged successfully');
      setIsCalling(false);
      setCallDuration(0);
      setCallNotes('');
      setCallStatus('idle');
      setSelectedLead(null);
      setCurrentCall(null);
      queryClient.invalidateQueries({ queryKey: ['my-calls'] });
      queryClient.invalidateQueries({ queryKey: ['call-stats'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to log call');
    },
  });

  // Add manual lead mutation
  const addLeadMutation = useMutation({
    mutationFn: (data) => {
      // Transform data to match API expectations
      const apiData = {
        first_name: data.firstName,
        last_name: data.lastName || '',
        phone: data.phone,
        email: data.email || '',
        company: data.company || '',
        title: data.title || '',
        campaign_id: '' // Will use default campaign on backend
      };
      return contactsAPI.createContact(apiData);
    },
    onSuccess: (response) => {
      toast.success('Lead added successfully');
      setShowAddLeadModal(false);
      setNewLead({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        company: '',
        title: ''
      });
      // Immediately call the new lead
      if (response.contact) {
        setCallingContact({
          id: response.contact.id,
          firstName: response.contact.firstName,
          lastName: response.contact.lastName,
          phone: response.contact.phone,
          company: response.contact.company,
          title: response.contact.title
        });
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add lead');
    },
  });

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.id) return;

    const handleCallUpdate = (data) => {
      // Refresh call data when call status changes
      queryClient.invalidateQueries({ queryKey: ['my-calls'] });
      queryClient.invalidateQueries({ queryKey: ['call-stats'] });
    };

    const handleLeadAssignment = (data) => {
      // Refresh leads when new assignments are made
      queryClient.invalidateQueries({ queryKey: ['my-leads'] });
    };

    const handleAgentUpdate = (data) => {
      // Refresh agent-specific data
      if (data.agentId === user.id) {
        queryClient.invalidateQueries({ queryKey: ['my-leads'] });
        queryClient.invalidateQueries({ queryKey: ['my-calls'] });
        queryClient.invalidateQueries({ queryKey: ['call-stats'] });
      }
    };

    addListener('call_status_update', handleCallUpdate);
    addListener('new_lead_assigned', handleLeadAssignment);
    addListener('agent_status_change', handleAgentUpdate);

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.id, addListener, queryClient]);

  const handleStartCall = (lead) => {
    // Check if already calling
    if (isCalling) {
      toast.error('A call is already in progress. Please complete the current call first.');
      return;
    }

    // Use browser-based calling
    setCallingContact({
      id: lead.contact.id,
      firstName: lead.contact.firstName,
      lastName: lead.contact.lastName,
      phone: lead.contact.phone,
      company: lead.contact.company,
      title: lead.contact.title
    });
  };

  // Call status handlers
  const handleCallStart = (phoneNumber) => {
    setCallStatus('ringing');
  };

  const handleCallStatusChange = (status) => {
    setCallStatus(status);

    if (status === 'connected') {
      // Start call timer when connected
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Store interval ID for cleanup
      setCurrentCall(prev => ({ ...prev, timerInterval: interval }));
    } else if (status === 'ended' || status === 'failed') {
      // Stop call timer and reset state
      if (currentCall?.timerInterval) {
        clearInterval(currentCall.timerInterval);
      }
      setIsCalling(false);
      setCallDuration(0);
      setCallStatus('idle');
      setCurrentCall(null);
    }
  };

  const handleCallEnd = () => {
    if (currentCall?.timerInterval) {
      clearInterval(currentCall.timerInterval);
    }
    setIsCalling(false);
    setCallDuration(0);
    setCallStatus('idle');
    setCurrentCall(null);
  };

  const handleLogCall = (outcome) => {
    if (!selectedLead) return;

    logCallMutation.mutate({
      callId: selectedLead.callId || 'temp-id', // This would come from the start call response
      outcome,
      duration: callDuration,
      notes: callNotes,
      answered: outcome !== 'no_answer' && outcome !== 'busy',
      rejected: outcome === 'not_interested',
    });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddLead = (e) => {
    e.preventDefault();

    // Basic validation
    if (!newLead.firstName || !newLead.phone) {
      toast.error('Please fill in first name and phone number');
      return;
    }

    // Validate phone number format - allow digits, spaces, +, -, (, )
    const phoneRegex = /^[\d+\-() ]+$/;
    if (!phoneRegex.test(newLead.phone.trim())) {
      toast.error('Please enter a valid phone number (digits, +, -, (), and spaces only)');
      return;
    }

    // Clean phone number - remove spaces, dashes, parentheses
    const cleanedPhone = newLead.phone.replace(/[\s\-()]/g, '');

    // Ensure phone number has at least 10 digits (excluding country code symbols)
    const digitCount = cleanedPhone.replace(/\+/g, '').length;
    if (digitCount < 10) {
      toast.error('Phone number must have at least 10 digits');
      return;
    }

    addLeadMutation.mutate({
      ...newLead,
      phone: cleanedPhone
    });
  };

  const leads = leadsData?.leads || [];
  const stats = statsData?.stats || {};
  const calls = callsData?.calls || [];

  if (leadsLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Manage your leads and make calls</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowAddLeadModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Lead & Call
          </button>
          <div className={`px-3 py-1 rounded-full text-sm ${
            user?.isAvailable
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {user?.isAvailable ? 'Available' : 'Unavailable'}
          </div>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Assigned Leads</dt>
                  <dd className="text-lg font-medium text-gray-900">{leads.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PhoneIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Calls</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.totalCalls || 0}</dd>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Answered Calls</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.answeredCalls || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Conversion Rate</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.conversionRate || 0}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Call Section */}
      {isCalling && selectedLead && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900">
                Call in Progress - {callStatus === 'ringing' ? 'Ringing...' :
                                   callStatus === 'connected' ? 'Connected' :
                                   callStatus === 'initiated' ? 'Connecting...' : 'Call Active'}
              </h3>
              <p className="text-blue-700">
                {callStatus === 'ringing' ? 'Ringing' : 'Calling'} {selectedLead.contact.firstName} {selectedLead.contact.lastName}
              </p>
              <p className="text-sm text-blue-600">{selectedLead.contact.phone}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">
                {formatDuration(callDuration)}
              </div>
              <div className="text-sm text-blue-600">Duration</div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Call Notes
            </label>
            <textarea
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Add notes about the call..."
            />
          </div>

          {/* Call Controls */}
          {callStatus === 'connected' && (
            <div className="mt-4 flex space-x-3">
              <button
                onClick={() => {
                  // This would trigger hangup in the softphone
                  handleCallEnd();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                <PhoneXMarkIcon className="h-4 w-4 inline mr-2" />
                Hang Up
              </button>
            </div>
          )}

          {/* Call Outcome Buttons */}
          <div className="mt-4 flex space-x-3">
            <button
              onClick={() => handleLogCall('scheduled')}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <CheckCircleIcon className="h-4 w-4 inline mr-2" />
              Scheduled
            </button>
            <button
              onClick={() => handleLogCall('interested')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <CheckCircleIcon className="h-4 w-4 inline mr-2" />
              Interested
            </button>
            <button
              onClick={() => handleLogCall('not_interested')}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              <XCircleIcon className="h-4 w-4 inline mr-2" />
              Not Interested
            </button>
            <button
              onClick={() => handleLogCall('callback')}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              <ClockIcon className="h-4 w-4 inline mr-2" />
              Callback
            </button>
            <button
              onClick={() => handleLogCall('no_answer')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              <StopIcon className="h-4 w-4 inline mr-2" />
              No Answer
            </button>
          </div>
        </div>
      )}

      {/* Assigned Leads */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Assigned Leads</h3>
          {leads.length === 0 ? (
            <div className="text-center py-8">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No leads assigned</h3>
              <p className="mt-1 text-sm text-gray-500">
                Contact your manager to get leads assigned to you.
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
                  {leads.map((lead) => (
                    <tr key={lead.assignmentId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {lead.contact.firstName?.charAt(0) || '?'}
                                {lead.contact.lastName?.charAt(0) || '?'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {lead.contact.firstName} {lead.contact.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{lead.contact.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {lead.contact.company || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {lead.campaign?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleStartCall(lead)}
                          disabled={isCalling || startCallMutation.isLoading}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          {startCallMutation.isLoading && selectedLead?.assignmentId === lead.assignmentId ? (
                            <LoadingSpinner size="sm" className="mr-1" />
                          ) : (
                            <PhoneIcon className="h-4 w-4 mr-1" />
                          )}
                          {isCalling && selectedLead?.assignmentId === lead.assignmentId ? 'Calling...' :
                           startCallMutation.isLoading && selectedLead?.assignmentId === lead.assignmentId ? 'Starting...' : 'Call'}
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

      {/* Recent Calls */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Calls</h3>
          {calls.length === 0 ? (
            <div className="text-center py-8">
              <PhoneIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No calls yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Your call history will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map((call) => (
                <div key={call.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {call.contact?.firstName?.charAt(0) || call.contactName?.charAt(0) || '?'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {call.contact ? `${call.contact.firstName} ${call.contact.lastName}` : (call.contactName || 'Unknown')}
                      </div>
                      <div className="text-sm text-gray-500">{call.contact?.phone || call.phone || '-'}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      call.outcome === 'scheduled' || call.outcome === 'interested'
                        ? 'bg-green-100 text-green-800'
                        : call.outcome === 'not_interested'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {call.outcome || call.status || 'N/A'}
                    </span>
                    <div className="text-sm text-gray-500">
                      {call.duration ? formatDuration(call.duration) : '-'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(call.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Lead</h3>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleAddLead} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newLead.firstName}
                  onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={newLead.lastName}
                  onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+1234567890"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={newLead.company}
                  onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newLead.title}
                  onChange={(e) => setNewLead({ ...newLead, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={addLeadMutation.isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                >
                  {addLeadMutation.isLoading ? 'Adding...' : 'Add & Call'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warm Transfer Manager */}
      <div className="mt-6">
        <WarmTransferManager />
      </div>

      {/* Softphone Component */}
      <Softphone
        onCallStart={handleCallStart}
        onCallEnd={handleCallEnd}
        onCallStatusChange={handleCallStatusChange}
        onMakeCall={(phoneNumber) => {
          // This will be called when the softphone dial button is clicked
          if (selectedLead) {
            handleStartCall(selectedLead);
          }
        }}
        contactInfo={selectedLead ? {
          firstName: selectedLead.contact.firstName,
          lastName: selectedLead.contact.lastName,
          phone: selectedLead.contact.phone
        } : null}
        isVisible={isCalling}
      />

      {/* Browser Phone Modal */}
      {callingContact && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <SimpleBrowserPhone
            contact={callingContact}
            onClose={() => {
              setCallingContact(null);
              queryClient.invalidateQueries({ queryKey: ['my-leads'] });
              queryClient.invalidateQueries({ queryKey: ['call-stats'] });
              queryClient.invalidateQueries({ queryKey: ['my-calls'] });
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;
