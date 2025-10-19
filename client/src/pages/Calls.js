import {
    ArrowDownTrayIcon,
    ChartBarIcon,
    CheckCircleIcon,
    ClockIcon,
    EyeIcon,
    MagnifyingGlassIcon,
    PhoneIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { aiIntelligenceAPI } from '../services/aiIntelligence';
import { callsAPI } from '../services/calls';

const Calls = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  const [filters, setFilters] = useState({
    search: '',
    campaign: '',
    outcome: '',
    emotion: '',
    dateRange: '7d',
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

  // Fetch call details with AI analysis
  const { data: callDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['call-details', selectedCall?.id],
    queryFn: () => callsAPI.getCallDetails(selectedCall.id),
    enabled: !!selectedCall && showCallDetails,
  });

  // Fetch AI analysis for call
  const { data: aiAnalysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['call-analysis', selectedCall?.id],
    queryFn: () => aiIntelligenceAPI.getCallAnalysis(selectedCall.id),
    enabled: !!selectedCall && showCallDetails,
  });

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.organizationId) return;

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
  }, [isConnected, user?.organizationId, addListener, queryClient]);

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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Outcome</label>
            <select
              value={filters.outcome}
              onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Outcomes</option>
              <option value="scheduled">Scheduled</option>
              <option value="fit">Fit</option>
              <option value="connected">Connected</option>
              <option value="not_fit">Not Fit</option>
              <option value="no_answer">No Answer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Emotion</label>
            <select
              value={filters.emotion}
              onChange={(e) => setFilters({ ...filters, emotion: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Emotions</option>
              <option value="interested">Interested</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="confused">Confused</option>
              <option value="frustrated">Frustrated</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

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
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calls.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {call.contact?.firstName?.charAt(0) || '?'}
                                {call.contact?.lastName?.charAt(0) || '?'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {call.contact?.firstName} {call.contact?.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{call.contact?.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {call.campaign?.name || '-'}
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
                        {call.csat ? (
                          <div className="flex items-center">
                            <svg
                              className="h-4 w-4 text-orange-500 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-orange-600 font-medium">{call.csat}</span>
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
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <EyeIcon className="h-4 w-4" />
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

      {/* Call Details Modal */}
      {showCallDetails && selectedCall && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowCallDetails(false)}
            />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Call Details - {selectedCall.contact?.firstName} {selectedCall.contact?.lastName}
                  </h3>
                  <button
                    onClick={() => setShowCallDetails(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>

                {detailsLoading || analysisLoading ? (
                  <div className="text-center py-8">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Call Information */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Call Information</h4>
                        <div className="space-y-2 text-sm">
                          <div><span className="font-medium">Duration:</span> {callDetails?.duration ? formatDuration(callDetails.duration) : '-'}</div>
                          <div><span className="font-medium">Outcome:</span> {callDetails?.outcome || '-'}</div>
                          <div><span className="font-medium">CSAT:</span> {callDetails?.csat || '-'}</div>
                          <div><span className="font-medium">Date:</span> {new Date(callDetails?.createdAt).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">AI Analysis</h4>
                        <div className="space-y-2 text-sm">
                          <div><span className="font-medium">Emotion:</span> {aiAnalysis?.emotion || '-'}</div>
                          <div><span className="font-medium">Intent:</span> {aiAnalysis?.intent || '-'}</div>
                          <div><span className="font-medium">Confidence:</span> {aiAnalysis?.confidence ? `${aiAnalysis.confidence}%` : '-'}</div>
                          <div><span className="font-medium">Sentiment:</span> {aiAnalysis?.sentiment || '-'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Transcript */}
                    {callDetails?.transcript && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Transcript</h4>
                        <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{callDetails.transcript}</p>
                        </div>
                      </div>
                    )}

                    {/* AI Highlights */}
                    {aiAnalysis?.highlights && aiAnalysis.highlights.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Key Highlights</h4>
                        <div className="space-y-2">
                          {aiAnalysis.highlights.map((highlight, index) => (
                            <div key={index} className="bg-blue-50 p-3 rounded-lg">
                              <p className="text-sm text-blue-800">{highlight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Objections */}
                    {aiAnalysis?.objections && aiAnalysis.objections.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Objections Detected</h4>
                        <div className="space-y-2">
                          {aiAnalysis.objections.map((objection, index) => (
                            <div key={index} className="bg-red-50 p-3 rounded-lg">
                              <p className="text-sm text-red-800">{objection}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calls;
