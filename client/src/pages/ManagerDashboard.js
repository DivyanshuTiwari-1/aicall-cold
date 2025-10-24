import {
    ChartBarIcon,
    CheckCircleIcon,
    PhoneIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import analyticsAPI from '../services/analytics';
import { usersAPI } from '../services/users';

const ManagerDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  const [dateRange, setDateRange] = React.useState('7d');

  // Fetch team performance data
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-performance', dateRange],
    queryFn: () => analyticsAPI.getProductivity(dateRange),
    refetchInterval: 30000,
  });

  // Fetch team members
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAllUsers(),
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
      // Refresh team performance and live calls when call status changes
      queryClient.invalidateQueries({ queryKey: ['team-performance'] });
      queryClient.invalidateQueries({ queryKey: ['live-calls'] });
    };

    const handleAgentUpdate = (data) => {
      // Refresh users and team performance when agent status changes
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['team-performance'] });
    };

    const handleLeadAssignment = (data) => {
      // Refresh team performance when leads are assigned
      queryClient.invalidateQueries({ queryKey: ['team-performance'] });
    };

    addListener('call_status_update', handleCallUpdate);
    addListener('call_completed', handleCallUpdate);
    addListener('agent_status_change', handleAgentUpdate);
    addListener('new_lead_assigned', handleLeadAssignment);

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.organizationId, addListener, queryClient]);

  if (teamLoading || usersLoading) return <LoadingSpinner />;

  const productivity = teamData?.productivity || {};
  const users = usersData?.users || [];
  const agents = users.filter(u => u.roleType === 'agent');
  const teamSize = agents.length;

  const teamStats = {
    totalCalls: productivity.total_calls_made || 0,
    completedCalls: productivity.total_calls_answered || 0,
    conversionRate: productivity.overallConversionRate || 0,
    avgCallDuration: productivity.avgTalkTimeMinutes || 0,
    teamSize: teamSize,
    activeAgents: productivity.active_agents || 0
  };

  const liveCalls = liveCallsData?.liveCalls || [];

  // Format change values
  const formatChange = (value) => {
    if (value === 0 || value === undefined || value === null) return '0%';
    const formatted = Math.abs(value).toFixed(1);
    return value > 0 ? `+${formatted}%` : `-${formatted}%`;
  };

  const stats = [
    {
      name: 'Total Calls',
      value: teamStats.totalCalls,
      change: formatChange(productivity.totalCallsChange),
      changeType: (productivity.totalCallsChange || 0) >= 0 ? 'positive' : 'negative',
      icon: PhoneIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      name: 'Completed Calls',
      value: teamStats.completedCalls,
      change: formatChange(productivity.answeredCallsChange),
      changeType: (productivity.answeredCallsChange || 0) >= 0 ? 'positive' : 'negative',
      icon: CheckCircleIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      name: 'Conversion Rate',
      value: `${teamStats.conversionRate.toFixed(1)}%`,
      change: formatChange(productivity.conversionRateChange),
      changeType: (productivity.conversionRateChange || 0) >= 0 ? 'positive' : 'negative',
      icon: ChartBarIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      name: 'Active Agents',
      value: teamStats.activeAgents,
      change: `${teamStats.activeAgents}/${teamStats.teamSize}`,
      changeType: 'neutral',
      icon: UserGroupIcon,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-gray-600">Monitor your team's performance and activity</p>
        </div>
        <div className='flex items-center space-x-3'>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className='px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          >
            <option value='1d'>Today</option>
            <option value='7d'>Last 7 Days</option>
            <option value='30d'>Last 30 Days</option>
          </select>
          <div className="text-sm text-gray-500">
            Updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
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
                  <p className={`text-sm ${
                    stat.changeType === 'positive' ? 'text-green-600' :
                    stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {stat.change}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Performance */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
          <div className="space-y-4">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700">
                      {agent.firstName.charAt(0)}{agent.lastName.charAt(0)}
                    </span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {agent.firstName} {agent.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{agent.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {agent.totalCalls || 0} calls
                  </p>
                  <p className="text-sm text-gray-500">
                    {agent.answeredCalls || 0} answered
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Calls */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Calls</h3>
          {liveCalls.length > 0 ? (
            <div className="space-y-3">
              {liveCalls.map((call) => (
                <div key={call.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <PhoneIcon className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {call.contactName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {call.agentName} • {call.duration}s
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Live
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <PhoneIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No active calls</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-blue-50 rounded-lg">
            <CheckCircleIcon className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">John Doe completed a call</p>
              <p className="text-sm text-gray-500">2 minutes ago • Outcome: Interested</p>
            </div>
          </div>
          <div className="flex items-center p-3 bg-green-50 rounded-lg">
            <UserGroupIcon className="h-5 w-5 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">New lead assigned to Sarah Smith</p>
              <p className="text-sm text-gray-500">5 minutes ago • Acme Corp</p>
            </div>
          </div>
          <div className="flex items-center p-3 bg-purple-50 rounded-lg">
            <ChartBarIcon className="h-5 w-5 text-purple-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">Team reached daily target</p>
              <p className="text-sm text-gray-500">1 hour ago • 150/150 calls</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
