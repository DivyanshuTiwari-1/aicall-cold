import {
    ChartBarIcon,
    CheckCircleIcon,
    PhoneIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import analyticsAPI from '../services/analytics';
import { usersAPI } from '../services/users';

const ManagerDashboard = () => {
  const { user } = useAuth();

  // Fetch team performance data
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-performance'],
    queryFn: () => analyticsAPI.getTeamPerformance('7d'),
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

  if (teamLoading || usersLoading) return <LoadingSpinner />;

  const teamStats = teamData?.data || {
    totalCalls: 0,
    completedCalls: 0,
    conversionRate: 0,
    avgCallDuration: 0,
    teamSize: 0,
    activeAgents: 0
  };

  const users = usersData?.users || [];
  const agents = users.filter(u => u.roleType === 'agent');
  const liveCalls = liveCallsData?.calls || [];

  const stats = [
    {
      name: 'Total Calls Today',
      value: teamStats.totalCalls,
      change: '+12%',
      changeType: 'positive',
      icon: PhoneIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      name: 'Completed Calls',
      value: teamStats.completedCalls,
      change: '+8%',
      changeType: 'positive',
      icon: CheckCircleIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      name: 'Conversion Rate',
      value: `${teamStats.conversionRate}%`,
      change: '+2.1%',
      changeType: 'positive',
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
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
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
