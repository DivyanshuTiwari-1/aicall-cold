import {
    ArrowDownTrayIcon,
    ChartBarIcon,
    CheckCircleIcon,
    ClockIcon,
    EyeIcon,
    MagnifyingGlassIcon,
    PhoneIcon
} from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import CallConversationModal from '../components/CallConversationModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { callsAPI } from '../services/calls';

const Calls = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected, subscribeToOrganization } = useWebSocket();
  const isAgent = user?.role === 'agent';
  const [filters, setFilters] = useState({
    search: '',
    campaign: '',
    callType: '', // 'automated' or 'manual'
  });
  const [selectedCall, setSelectedCall] = useState(null);
  const [showCallDetails, setShowCallDetails] = useState(false);

  // Fetch calls
  const { data: callsData, isLoading, error } = useQuery({
    queryKey: ['calls'],
    queryFn: () => callsAPI.getCalls(filters),
    refetchInterval: 30000,
  });

  // Fetch call statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['call-stats'],
    queryFn: () => callsAPI.getCallStats(filters),
    refetchInterval: 60000,
  });


  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.organizationId) return;

    // Subscribe to organization channel for real-time updates
    subscribeToOrganization(user.organizationId);
    console.log('✅ [CALLS] Subscribed to organization:', user.organizationId);

    const handleCallUpdate = (data) => {
      // Refresh calls when status changes
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      queryClient.invalidateQueries({ queryKey: ['call-stats'] });
    };

    addListener('call_status_update', handleCallUpdate);
    addListener('call_completed', handleCallUpdate);

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.organizationId, addListener, queryClient, subscribeToOrganization]);

  const handleViewDetails = (call) => {
    setSelectedCall(call);
    setShowCallDetails(true);
  };

  const getEmotionColor = (emotion) => {
    switch (emotion) {
      case 'interested':
        return 'bg-green-100 text-green-800';
      case 'positive':
        return 'bg-blue-100 text-blue-800';
      case 'neutral':
        return 'bg-gray-100 text-gray-800';
      case 'confused':
        return 'bg-yellow-100 text-yellow-800';
      case 'frustrated':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case 'scheduled':
      case 'fit':
      case 'interested':
        return 'bg-green-100 text-green-800';
      case 'connected':
      case 'callback':
        return 'bg-yellow-100 text-yellow-800';
      case 'not_interested':
      case 'not_fit':
        return 'bg-red-100 text-red-800';
      case 'no_answer':
      case 'busy':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calls = callsData?.calls || [];
  const stats = statsData?.stats || {};

  if (isLoading || statsLoading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load calls data</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call History</h1>
          <p className="text-gray-600">View and analyze your call records</p>
        </div>
        <button className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Export
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Answered</dt>
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
                <ClockIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Avg Duration</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.averageDuration ? formatDuration(stats.averageDuration) : '0:00'}
                  </dd>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Success Rate</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.successRate || 0}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isAgent ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by contact name..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          {!isAgent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Call Type</label>
              <select
                value={filters.callType}
                onChange={(e) => setFilters({ ...filters, callType: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Calls</option>
                <option value="automated">🤖 AI Automated</option>
                <option value="manual">👤 Manual</option>
              </select>
            </div>
          )}
          {!isAgent && (
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
          )}
        </div>
      </div>

      {/* Info Banner */}
      {calls.length > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <span className="font-medium">Tip:</span> Click the <strong>View</strong> button in the "Conversation" column to see the full chat transcript and AI insights for each call.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Call History Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Call History</h3>
          {calls.length === 0 ? (
            <div className="text-center py-8">
              <PhoneIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No calls found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No calls match your current filters.
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
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Emotion
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Outcome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CSAT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conversation
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calls.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
                              <span className="text-sm font-semibold text-white">
                                {call.contactName?.split(' ')[0]?.charAt(0) || '?'}
                                {call.contactName?.split(' ')[1]?.charAt(0) || ''}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {call.contactName || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-500">{call.phone || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {call.callType === 'automated' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            🤖 AI
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            👤 Manual
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {call.campaignName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {call.duration ? formatDuration(call.duration) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEmotionColor(call.emotion)}`}>
                          {call.emotion || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOutcomeColor(call.outcome)}`}>
                          {call.outcome || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {call.csatScore ? (
                          <div className="flex items-center">
                            <svg
                              className="h-4 w-4 text-orange-500 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-orange-600 font-medium">{call.csatScore}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(call.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(call)}
                          className="inline-flex items-center px-3 py-1 border border-blue-300 rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                          title="View conversation"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          {call.transcript || call.duration > 0 ? 'View' : 'Details'}
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

      {/* Call Conversation Modal */}
      <CallConversationModal
        call={selectedCall}
        isOpen={showCallDetails}
        onClose={() => {
          setShowCallDetails(false);
          setSelectedCall(null);
        }}
      />
    </div>
  );
};

export default Calls;
