import {
    ChartBarIcon,
    CurrencyDollarIcon,
    PhoneIcon,
    TrophyIcon,
    UserGroupIcon,
    UsersIcon
} from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import {
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { analyticsAPI } from '../services/analytics';

const Analytics = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  const [dateRange, setDateRange] = useState('7d');
  const [selectedAgent, setSelectedAgent] = useState('');

  // Fetch dashboard analytics
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard-analytics', dateRange],
    queryFn: () => analyticsAPI.getDashboard(dateRange),
    refetchInterval: 30000,
  });

  // Fetch agent performance
  const { data: agentPerformance, isLoading: agentLoading } = useQuery({
    queryKey: ['agent-performance', selectedAgent, dateRange],
    queryFn: () => selectedAgent ? analyticsAPI.getAgentPerformance(selectedAgent, dateRange) : null,
    enabled: !!selectedAgent,
  });

  // Fetch team leaderboard
  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['team-leaderboard', dateRange],
    queryFn: () => analyticsAPI.getTeamLeaderboard(dateRange),
    refetchInterval: 60000,
  });

  // Fetch productivity metrics
  const { data: productivityData, isLoading: productivityLoading } = useQuery({
    queryKey: ['productivity', dateRange],
    queryFn: () => analyticsAPI.getProductivity(dateRange),
    refetchInterval: 60000,
  });

  // Fetch live calls
  const { data: liveCallsData, isLoading: liveCallsLoading } = useQuery({
    queryKey: ['live-calls'],
    queryFn: () => analyticsAPI.getLiveCalls(),
    refetchInterval: 10000,
  });

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.organizationId) return;

    const handleCallUpdate = (data) => {
      // Refresh analytics when call status changes
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['agent-performance'] });
      queryClient.invalidateQueries({ queryKey: ['team-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
      queryClient.invalidateQueries({ queryKey: ['live-calls'] });
    };

    const handleAgentUpdate = (data) => {
      // Refresh agent-specific data
      queryClient.invalidateQueries({ queryKey: ['agent-performance'] });
      queryClient.invalidateQueries({ queryKey: ['team-leaderboard'] });
    };

    const handleTeamUpdate = (data) => {
      // Refresh team data
      queryClient.invalidateQueries({ queryKey: ['team-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
    };

    addListener('call_status_update', handleCallUpdate);
    addListener('agent_status_change', handleAgentUpdate);
    addListener('team_performance_update', handleTeamUpdate);

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.organizationId, addListener, queryClient]);

  if (dashboardLoading || leaderboardLoading || productivityLoading) return <LoadingSpinner />;

  // Get data from API responses
  const dashboard = dashboardData?.data || {};
  const leaderboard = leaderboardData?.leaderboard || [];
  const productivity = productivityData?.productivity || {};
  const liveCalls = liveCallsData?.liveCalls || [];
  const agentPerf = agentPerformance?.performance || {};

  // Prepare chart data from API responses
  const callTrendsData = dashboard.callTrends || [
    { date: '2024-01-01', calls: 0, conversions: 0 },
    { date: '2024-01-02', calls: 0, conversions: 0 },
    { date: '2024-01-03', calls: 0, conversions: 0 },
    { date: '2024-01-04', calls: 0, conversions: 0 },
    { date: '2024-01-05', calls: 0, conversions: 0 },
    { date: '2024-01-06', calls: 0, conversions: 0 },
    { date: '2024-01-07', calls: 0, conversions: 0 },
  ];

  const campaignPerformanceData = dashboard.campaigns || [];

  const outcomeData = [
    { name: 'Interested', value: dashboard.interestedCalls || 0, color: '#10B981' },
    { name: 'Not Interested', value: dashboard.notInterestedCalls || 0, color: '#EF4444' },
    { name: 'Callback', value: dashboard.callbackCalls || 0, color: '#F59E0B' },
    { name: 'No Answer', value: dashboard.noAnswerCalls || 0, color: '#6B7280' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Comprehensive analytics and performance metrics</p>
        </div>
        <div className="flex space-x-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Calls */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PhoneIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Calls</dt>
                  <dd className="text-lg font-medium text-gray-900">{dashboard.totalCalls || 0}</dd>
                </dl>
            </div>
            </div>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Conversion Rate</dt>
                  <dd className="text-lg font-medium text-gray-900">{dashboard.conversionRate || 0}%</dd>
                </dl>
            </div>
            </div>
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UsersIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Campaigns</dt>
                  <dd className="text-lg font-medium text-gray-900">{dashboard.activeCampaigns || 0}</dd>
                </dl>
            </div>
            </div>
          </div>
        </div>

        {/* Cost per Lead */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Cost per Lead</dt>
                  <dd className="text-lg font-medium text-gray-900">₹{dashboard.costPerLead || 0}</dd>
                </dl>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Leaderboard */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrophyIcon className="h-5 w-5 text-yellow-500 mr-2" />
          Team Leaderboard
        </h3>
        {leaderboard.length === 0 ? (
          <div className="text-center py-8">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No team data</h3>
            <p className="mt-1 text-sm text-gray-500">
              Team performance data will appear here once agents start making calls.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {leaderboard.map((agent, index) => (
              <div key={agent.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">
                        {agent.firstName?.charAt(0) || '?'}
                        {agent.lastName?.charAt(0) || '?'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {agent.firstName} {agent.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{agent.role}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{agent.totalCalls || 0}</div>
                    <div className="text-xs text-gray-500">Calls</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{agent.conversionRate || 0}%</div>
                    <div className="text-xs text-gray-500">Conversion</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">{agent.avgCSAT || 0}/5</div>
                    <div className="text-xs text-gray-500">CSAT</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">#{index + 1}</div>
                    <div className="text-xs text-gray-500">Rank</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent Performance */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Performance</h3>
        <div className="mb-4">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select an agent to view performance</option>
            {leaderboard.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.firstName} {agent.lastName}
              </option>
            ))}
          </select>
        </div>

        {selectedAgent && agentPerf ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Calls Made</h4>
              <div className="text-2xl font-bold text-blue-900">{agentPerf.totalCalls || 0}</div>
              <div className="text-sm text-blue-700">This period</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-green-900 mb-2">Conversion Rate</h4>
              <div className="text-2xl font-bold text-green-900">{agentPerf.conversionRate || 0}%</div>
              <div className="text-sm text-green-700">Success rate</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-purple-900 mb-2">Average CSAT</h4>
              <div className="text-2xl font-bold text-purple-900">{agentPerf.avgCSAT || 0}/5</div>
              <div className="text-sm text-purple-700">Customer satisfaction</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Select an agent</h3>
            <p className="mt-1 text-sm text-gray-500">
              Choose an agent from the dropdown to view their performance metrics.
            </p>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Trends */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={callTrendsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="calls" stroke="#3B82F6" strokeWidth={2} />
              <Line type="monotone" dataKey="conversions" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Call Outcomes */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Outcomes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={outcomeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="value"
              >
                {outcomeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        </div>

      {/* Live Calls */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <PhoneIcon className="h-5 w-5 text-green-500 mr-2" />
          Live Calls
        </h3>
        {liveCalls.length === 0 ? (
          <div className="text-center py-8">
            <PhoneIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No active calls</h3>
            <p className="mt-1 text-sm text-gray-500">
              Live calls will appear here when agents are making calls.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {liveCalls.map((call) => (
              <div key={call.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-green-300 flex items-center justify-center">
                      <span className="text-sm font-medium text-green-700">
                        {call.contact?.firstName?.charAt(0) || '?'}
                        {call.contact?.lastName?.charAt(0) || '?'}
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
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">{call.agent?.firstName} {call.agent?.lastName}</div>
                    <div className="text-xs text-gray-500">Agent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">{call.duration || 0}s</div>
                    <div className="text-xs text-gray-500">Duration</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">{call.campaign?.name || '-'}</div>
                    <div className="text-xs text-gray-500">Campaign</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Productivity Metrics */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Productivity Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{productivity.totalCalls || 0}</div>
            <div className="text-sm text-gray-500">Total Calls</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{productivity.avgCallsPerAgent || 0}</div>
            <div className="text-sm text-gray-500">Avg Calls/Agent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{productivity.avgCallDuration || 0}s</div>
            <div className="text-sm text-gray-500">Avg Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{productivity.peakHours || '-'}</div>
            <div className="text-sm text-gray-500">Peak Hours</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
