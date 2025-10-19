import {
    ChartBarIcon,
    CheckCircleIcon,
    ClockIcon,
    PhoneIcon,
    PhoneXMarkIcon,
    StopIcon,
    UserGroupIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import Softphone from '../components/Softphone';
import WarmTransferManager from '../components/WarmTransferManager';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { assignmentsAPI } from '../services/assignments';
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

    // For manual calls, we don't need SIP extension - we use the manual call API
    // The server will handle the actual call initiation via Asterisk

    setSelectedLead(lead);
    startCallMutation.mutate({
      contactId: lead.contact.id,
      campaignId: lead.contact.campaign?.id,
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
          <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
          <p className="text-gray-600">Manage your leads and make calls</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            SIP Extension: {user?.sipExtension || 'Not configured'}
          </div>
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
                          {call.contact?.firstName?.charAt(0) || '?'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {call.contact?.firstName} {call.contact?.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{call.contact?.phone}</div>
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
                      {call.outcome}
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
    </div>
  );
};

export default AgentDashboard;
