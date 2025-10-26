import {
    ArrowDownTrayIcon,
    CalendarIcon,
    ChartBarIcon,
    ChartPieIcon,
    CheckCircleIcon,
    ClockIcon,
    CurrencyDollarIcon,
    EyeIcon,
    HandThumbUpIcon,
    PhoneIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import analyticsAPI from '../services/analytics';
import { callsAPI } from '../services/calls';
import { campaignsAPI } from '../services/campaigns';
import { usersAPI } from '../services/users';

const Dashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  const [dateRange, setDateRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('executive');
  
  // Call History filters
  const [callFilters, setCallFilters] = useState({
    type: 'all',
    campaign: 'all',
    search: '',
  });

  const {
    data: analytics,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['dashboard-analytics', dateRange],
    queryFn: () => analyticsAPI.getDashboard(dateRange),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch productivity metrics for team performance
  const { data: productivityData, isLoading: productivityLoading } = useQuery({
    queryKey: ['productivity', dateRange],
    queryFn: () => analyticsAPI.getProductivity(dateRange),
    refetchInterval: 60000,
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

  // Fetch call history for Call History tab
  const { data: callHistoryData, isLoading: callHistoryLoading } = useQuery({
    queryKey: ['call-history-dashboard', callFilters],
    queryFn: () => callsAPI.getCalls({
      limit: 100,
      offset: 0,
      ...callFilters,
      type: callFilters.type === 'all' ? undefined : callFilters.type,
      campaign_id: callFilters.campaign === 'all' ? undefined : callFilters.campaign,
    }),
    refetchInterval: 30000,
    enabled: activeTab === 'call-history',
  });

  // Fetch campaigns for filter dropdown
  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsAPI.getCampaigns(),
    enabled: activeTab === 'call-history',
  });

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.organizationId) return;

    const handleCallUpdate = (data) => {
      // Refresh dashboard data when call status changes
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    };

    const handleAgentUpdate = (data) => {
      // Refresh dashboard data when agent status changes
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    };

    const handleOrganizationUpdate = (data) => {
      // Refresh dashboard data when organization data changes
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
    };

    const handleLeadAssignment = (data) => {
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
    };

    addListener('call_status_update', handleCallUpdate);
    addListener('call_completed', handleCallUpdate);
    addListener('agent_status_change', handleAgentUpdate);
    addListener('organization_update', handleOrganizationUpdate);
    addListener('new_lead_assigned', handleLeadAssignment);

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.organizationId, addListener, queryClient]);

  if (isLoading || productivityLoading || usersLoading) return <LoadingSpinner />;
  if (error)
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Failed to load dashboard data</p>
      </div>
    );

  // Use real data from API or fallback to empty state
  const data = analytics?.data || {
    totalCalls: 0,
    completed: 0,
    meetings: 0,
    avgCSAT: 0,
    roi: 0,
    costPerLead: 0,
    creditsUsed: 0,
    conversionRate: 0,
    projectedROI: 0,
    campaigns: [],
    recentCalls: [],
  };

  const productivity = productivityData?.productivity || {};
  const users = usersData?.users || [];
  const agents = users.filter(u => u.roleType === 'agent');
  const teamSize = agents.length;
  const liveCalls = liveCallsData?.liveCalls || [];

  const teamStats = {
    totalCalls: productivity.total_calls_made || 0,
    completedCalls: productivity.total_calls_answered || 0,
    conversionRate: productivity.overallConversionRate || 0,
    avgCallDuration: productivity.avgTalkTimeMinutes || 0,
    teamSize: teamSize,
    activeAgents: productivity.active_agents || 0
  };

  // Format change values
  const formatChange = (value, label) => {
    if (value === 0 || value === undefined || value === null) return '0% vs last period';
    const formatted = Math.abs(value).toFixed(1);
    const direction = value > 0 ? '+' : '-';
    return `${direction}${formatted}% vs last period`;
  };

  const formatCsatChange = (value) => {
    if (value === 0 || value === undefined || value === null) return '0 vs last period';
    const formatted = Math.abs(value).toFixed(1);
    const direction = value > 0 ? '+' : '-';
    return `${direction}${formatted} vs last period`;
  };

  // Calculate conversion funnel
  const totalAttempts = data.totalCalls || 0;
  const connected = data.completed || 0;
  const interested = data.interested || 0;
  const qualified = data.qualifiedLeads || 0;
  const converted = data.meetings || 0;
  const engaged = interested + converted;

  const conversionFunnel = [
    {
      stage: 'Total Attempts',
      value: totalAttempts,
      percentage: 100,
      color: 'bg-blue-500'
    },
    {
      stage: 'Connected',
      value: connected,
      percentage: totalAttempts > 0 ? Math.round((connected / totalAttempts) * 100) : 0,
      color: 'bg-green-500'
    },
    {
      stage: 'Engaged',
      value: engaged,
      percentage: totalAttempts > 0 ? Math.round((engaged / totalAttempts) * 100) : 0,
      color: 'bg-purple-500'
    },
    {
      stage: 'Qualified',
      value: qualified,
      percentage: totalAttempts > 0 ? Math.round((qualified / totalAttempts) * 100) : 0,
      color: 'bg-orange-500'
    },
    {
      stage: 'Converted',
      value: converted,
      percentage: totalAttempts > 0 ? Math.round((converted / totalAttempts) * 100) : 0,
      color: 'bg-red-500'
    },
  ];

  const tabs = [
    { id: 'executive', name: 'Executive View' },
    { id: 'team', name: 'Team Performance' },
    { id: 'call-history', name: 'Call History' },
  ];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Dashboard</h1>
          <p className='text-sm text-gray-600 mt-1'>Comprehensive view of your organization's performance</p>
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
            <option value='90d'>Last 90 Days</option>
          </select>
          {activeTab === 'executive' && (
            <button className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'>
              <ArrowDownTrayIcon className='h-4 w-4 mr-2' />
              Export Report
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className='border-b border-gray-200'>
        <nav className='-mb-px flex space-x-8'>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Executive View Tab */}
      {activeTab === 'executive' && (
        <>
          {/* Key Executive Metrics */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
            {[
              {
                title: 'Total Revenue Impact',
                value: `₹${((data.totalRevenue || 0) / 100000).toFixed(1)}L`,
                description: 'From qualified leads',
                change: formatChange(data.totalCallsChange),
                changeColor: (data.totalCallsChange || 0) >= 0 ? 'text-green-600' : 'text-red-600',
                icon: CurrencyDollarIcon,
                iconColor: 'text-green-600',
                bgColor: 'bg-green-50',
              },
              {
                title: 'Cost Efficiency',
                value: `₹${(data.costPerLead || 0).toFixed(2)}`,
                description: 'Per qualified lead',
                change: formatChange(data.costPerLeadChange),
                changeColor: (data.costPerLeadChange || 0) <= 0 ? 'text-green-600' : 'text-red-600',
                icon: ChartPieIcon,
                iconColor: 'text-blue-600',
                bgColor: 'bg-blue-50',
              },
              {
                title: 'Campaign ROI',
                value: `${data.roi || 0}%`,
                description: 'Average return',
                change: formatChange(data.conversionRateChange),
                changeColor: (data.conversionRateChange || 0) >= 0 ? 'text-green-600' : 'text-red-600',
                icon: ChartBarIcon,
                iconColor: 'text-purple-600',
                bgColor: 'bg-purple-50',
              },
              {
                title: 'Customer Satisfaction',
                value: `${(data.avgCSAT || 0).toFixed(1)}/5`,
                description: 'Avg CSAT score',
                change: formatCsatChange(data.csatChange),
                changeColor: (data.csatChange || 0) >= 0 ? 'text-green-600' : 'text-red-600',
                icon: HandThumbUpIcon,
                iconColor: 'text-orange-600',
                bgColor: 'bg-orange-50',
              },
            ].map((metric, idx) => {
              const Icon = metric.icon;
              return (
                <div key={idx} className={`${metric.bgColor} rounded-lg p-6`}>
                  <div className='flex items-center justify-between mb-4'>
                    <div className='p-3 rounded-lg bg-white'>
                      <Icon className={`h-6 w-6 ${metric.iconColor}`} />
                    </div>
                    <span className={`text-sm font-medium ${metric.changeColor}`}>{metric.change}</span>
                  </div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-1'>{metric.title}</h3>
                  <p className='text-3xl font-bold text-gray-900 mb-1'>{metric.value}</p>
                  <p className='text-sm text-gray-600'>{metric.description}</p>
                </div>
              );
            })}
          </div>

          {/* Conversion Funnel */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>Conversion Funnel</h3>
            <div className='space-y-4'>
              {conversionFunnel.map((stage, idx) => (
                <div key={idx} className='flex items-center justify-between'>
                  <span className='text-sm font-medium text-gray-700 w-32'>{stage.stage}</span>
                  <div className='flex items-center flex-1 mx-4'>
                    <div className='flex-1 bg-gray-200 rounded-full h-2'>
                      <div
                        className={`h-2 rounded-full ${stage.color}`}
                        style={{ width: `${stage.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className='text-sm text-gray-600 w-20 text-right'>
                    {stage.value} ({stage.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cost Per Qualified Lead - Executive */}
          <div className='bg-green-50 rounded-lg p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
              <CurrencyDollarIcon className='h-5 w-5 mr-2' />
              Cost Per Qualified Lead
            </h3>
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-6'>
              <div>
                <p className='text-sm text-gray-600'>Cost / Lead</p>
                <p className='text-2xl font-bold text-green-600'>₹{(data.costPerLead || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>Total Cost</p>
                <p className='text-2xl font-bold text-blue-600'>₹{(data.totalCost || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>Conversion Rate</p>
                <p className='text-2xl font-bold text-purple-600'>{(data.conversionRate || 0)}%</p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>Campaign ROI</p>
                <p className='text-2xl font-bold text-green-600'>{data.roi || 0}%</p>
              </div>
            </div>
          </div>

          {/* Recent High-Value Calls */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>Recent High-Value Interactions</h3>
            {data.recentCalls.length > 0 ? (
              <div className='space-y-3'>
                {data.recentCalls.slice(0, 4).map((call, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      call.outcome === 'scheduled' ? 'bg-green-50' : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className='flex items-center space-x-4'>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          call.outcome === 'scheduled' || call.outcome === 'fit'
                            ? 'bg-green-100'
                            : call.outcome === 'connected'
                              ? 'bg-yellow-100'
                              : 'bg-gray-100'
                        }`}
                      >
                        {call.outcome === 'scheduled' || call.outcome === 'fit' ? (
                          <CheckCircleIcon className='h-5 w-5 text-green-600' />
                        ) : call.outcome === 'connected' ? (
                          <div className='w-2 h-2 bg-yellow-500 rounded-full'></div>
                        ) : (
                          <CheckCircleIcon className='h-5 w-5 text-gray-600' />
                        )}
                      </div>
                      <div>
                        <p className='font-medium text-gray-900'>{call.name}</p>
                        <p className='text-sm text-gray-500'>
                          {call.timestamp ? new Date(call.timestamp).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center space-x-4'>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          call.emotion === 'interested'
                            ? 'bg-green-100 text-green-800'
                            : call.emotion === 'positive'
                              ? 'bg-gray-100 text-gray-800'
                              : call.emotion === 'neutral'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {call.emotion}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          call.outcome === 'scheduled' || call.outcome === 'fit'
                            ? 'bg-green-100 text-green-800'
                            : call.outcome === 'connected'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {call.outcome}
                      </span>
                      {call.csat && <p className='text-sm text-gray-600'>CSAT: {call.csat}/5</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8'>
                <p className='text-gray-500'>No recent calls</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Team Performance Tab */}
      {activeTab === 'team' && (
        <>
          {/* Team Stats Grid */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
            {[
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
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className={`${stat.bgColor} rounded-lg p-6`}>
                  <div className='flex items-center'>
                    <div className='flex-shrink-0'>
                      <Icon className={`h-8 w-8 ${stat.color}`} />
                    </div>
                    <div className='ml-4'>
                      <p className='text-sm font-medium text-gray-600'>{stat.name}</p>
                      <p className='text-2xl font-bold text-gray-900'>{stat.value}</p>
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

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Team Performance */}
            <div className='bg-white rounded-lg shadow-sm p-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4'>Team Performance</h3>
              {agents.length > 0 ? (
                <div className='space-y-4'>
                  {agents.map((agent) => (
                    <div key={agent.id} className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
                      <div className='flex items-center'>
                        <div className='h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center'>
                          <span className='text-sm font-medium text-gray-700'>
                            {agent.firstName.charAt(0)}{agent.lastName.charAt(0)}
                          </span>
                        </div>
                        <div className='ml-3'>
                          <p className='text-sm font-medium text-gray-900'>
                            {agent.firstName} {agent.lastName}
                          </p>
                          <p className='text-sm text-gray-500'>{agent.email}</p>
                        </div>
                      </div>
                      <div className='text-right'>
                        <p className='text-sm font-medium text-gray-900'>
                          {agent.totalCalls || 0} calls
                        </p>
                        <p className='text-sm text-gray-500'>
                          {agent.answeredCalls || 0} answered
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center py-8'>
                  <UserGroupIcon className='h-12 w-12 text-gray-400 mx-auto mb-4' />
                  <p className='text-gray-500'>No team members found</p>
                </div>
              )}
            </div>

            {/* Live Calls */}
            <div className='bg-white rounded-lg shadow-sm p-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4'>Live Calls</h3>
              {liveCalls.length > 0 ? (
                <div className='space-y-3'>
                  {liveCalls.map((call) => (
                    <div key={call.id} className='flex items-center justify-between p-3 bg-green-50 rounded-lg'>
                      <div className='flex items-center'>
                        <div className='h-8 w-8 rounded-full bg-green-100 flex items-center justify-center'>
                          <PhoneIcon className='h-4 w-4 text-green-600' />
                        </div>
                        <div className='ml-3'>
                          <p className='text-sm font-medium text-gray-900'>
                            {call.contactName}
                          </p>
                          <p className='text-sm text-gray-500'>
                            {call.agentName} • {call.duration}s
                          </p>
                        </div>
                      </div>
                      <div className='text-right'>
                        <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                          Live
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center py-8'>
                  <PhoneIcon className='h-12 w-12 text-gray-400 mx-auto mb-4' />
                  <p className='text-gray-500'>No active calls</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>Recent Team Activity</h3>
            <div className='space-y-3'>
              <div className='flex items-center p-3 bg-blue-50 rounded-lg'>
                <CheckCircleIcon className='h-5 w-5 text-blue-600 mr-3' />
                <div>
                  <p className='text-sm font-medium text-gray-900'>Team member completed a call</p>
                  <p className='text-sm text-gray-500'>Recent activity • Outcome: Interested</p>
                </div>
              </div>
              <div className='flex items-center p-3 bg-green-50 rounded-lg'>
                <UserGroupIcon className='h-5 w-5 text-green-600 mr-3' />
                <div>
                  <p className='text-sm font-medium text-gray-900'>New lead assigned to agent</p>
                  <p className='text-sm text-gray-500'>Lead distribution active</p>
                </div>
              </div>
              <div className='flex items-center p-3 bg-purple-50 rounded-lg'>
                <ChartBarIcon className='h-5 w-5 text-purple-600 mr-3' />
                <div>
                  <p className='text-sm font-medium text-gray-900'>Team performance improving</p>
                  <p className='text-sm text-gray-500'>Daily targets on track</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'call-history' && (
        <>
          {/* Summary Stats */}
          <div className='grid grid-cols-1 md:grid-cols-4 gap-6 mb-6'>
            <div className='bg-white rounded-lg shadow-sm p-6'>
              <div className='flex items-center'>
                <PhoneIcon className='h-8 w-8 text-blue-600' />
                <div className='ml-4'>
                  <p className='text-sm font-medium text-gray-500'>Total Calls</p>
                  <p className='text-2xl font-semibold text-gray-900'>
                    {callHistoryData?.total || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className='bg-white rounded-lg shadow-sm p-6'>
              <div className='flex items-center'>
                <CheckCircleIcon className='h-8 w-8 text-green-600' />
                <div className='ml-4'>
                  <p className='text-sm font-medium text-gray-500'>Answered</p>
                  <p className='text-2xl font-semibold text-gray-900'>
                    {callHistoryData?.calls?.filter(c => c.status === 'completed').length || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className='bg-white rounded-lg shadow-sm p-6'>
              <div className='flex items-center'>
                <ClockIcon className='h-8 w-8 text-purple-600' />
                <div className='ml-4'>
                  <p className='text-sm font-medium text-gray-500'>Avg Duration</p>
                  <p className='text-2xl font-semibold text-gray-900'>
                    {callHistoryData?.calls?.length > 0
                      ? formatDuration(
                          callHistoryData.calls.reduce((sum, call) => sum + (call.duration || 0), 0) /
                            callHistoryData.calls.length
                        )
                      : '0:00'}
                  </p>
                </div>
              </div>
            </div>
            <div className='bg-white rounded-lg shadow-sm p-6'>
              <div className='flex items-center'>
                <ChartBarIcon className='h-8 w-8 text-orange-600' />
                <div className='ml-4'>
                  <p className='text-sm font-medium text-gray-500'>Success Rate</p>
                  <p className='text-2xl font-semibold text-gray-900'>
                    {callHistoryData?.calls?.length > 0
                      ? Math.round(
                          (callHistoryData.calls.filter(c => c.status === 'completed').length /
                            callHistoryData.calls.length) *
                            100
                        )
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className='bg-white rounded-lg shadow-sm p-6 mb-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>Filters</h3>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Search</label>
                <input
                  type='text'
                  placeholder='Search by contact name...'
                  value={callFilters.search}
                  onChange={(e) => setCallFilters({ ...callFilters, search: e.target.value })}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Call Type</label>
                <select
                  value={callFilters.type}
                  onChange={(e) => setCallFilters({ ...callFilters, type: e.target.value })}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                >
                  <option value='all'>All Calls</option>
                  <option value='manual'>Manual</option>
                  <option value='automated'>Automated</option>
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Campaign</label>
                <select
                  value={callFilters.campaign}
                  onChange={(e) => setCallFilters({ ...callFilters, campaign: e.target.value })}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                >
                  <option value='all'>All Campaigns</option>
                  {campaignsData?.campaigns?.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Call History Table */}
          <div className='bg-white rounded-lg shadow-sm overflow-hidden'>
            <div className='px-6 py-4 border-b border-gray-200'>
              <h3 className='text-lg font-semibold text-gray-900'>Call History</h3>
              <p className='text-sm text-gray-500 mt-1'>
                Tip: Click the <EyeIcon className='h-4 w-4 inline' /> View button in the "Conversation" column to see the full chat transcript and AI insights for each call.
              </p>
            </div>
            
            {callHistoryLoading ? (
              <div className='p-8 text-center'>
                <LoadingSpinner />
              </div>
            ) : !callHistoryData?.calls || callHistoryData.calls.length === 0 ? (
              <div className='text-center py-12'>
                <PhoneIcon className='h-12 w-12 text-gray-400 mx-auto mb-4' />
                <p className='text-gray-500'>No call history available</p>
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className='min-w-full divide-y divide-gray-200'>
                  <thead className='bg-gray-50'>
                    <tr>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Contact
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Type
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Campaign
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Duration
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Emotion
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Outcome
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        CSAT
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Date
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Conversation
                      </th>
                    </tr>
                  </thead>
                  <tbody className='bg-white divide-y divide-gray-200'>
                    {callHistoryData.calls.map((call) => (
                      <tr key={call.id} className='hover:bg-gray-50'>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='flex items-center'>
                            <div className='flex-shrink-0 h-10 w-10'>
                              <div className='h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center'>
                                <span className='text-blue-600 font-medium text-sm'>
                                  {call.contact?.firstName?.[0] || 'U'}
                                  {call.contact?.lastName?.[0] || ''}
                                </span>
                              </div>
                            </div>
                            <div className='ml-4'>
                              <div className='text-sm font-medium text-gray-900'>
                                {call.contact?.firstName || call.contactName || 'Unknown'} {call.contact?.lastName || ''}
                              </div>
                              <div className='text-sm text-gray-500'>{call.contact?.phone || call.toPhone}</div>
                            </div>
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          {call.automated ? (
                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800'>
                              🤖 Automated
                            </span>
                          ) : (
                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                              👤 Manual
                            </span>
                          )}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                          {call.campaign?.name || '-'}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                          {call.duration ? formatDuration(call.duration) : '-'}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          {call.emotion && call.emotion !== 'unknown' ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              call.emotion === 'positive' ? 'bg-green-100 text-green-800' :
                              call.emotion === 'interested' ? 'bg-blue-100 text-blue-800' :
                              call.emotion === 'neutral' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {call.emotion}
                            </span>
                          ) : (
                            <span className='text-sm text-gray-400'>Unknown</span>
                          )}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          {call.outcome && call.outcome !== 'no_answer' ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              call.outcome === 'sale' ? 'bg-green-100 text-green-800' :
                              call.outcome === 'interested' ? 'bg-blue-100 text-blue-800' :
                              call.outcome === 'not_interested' ? 'bg-gray-100 text-gray-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {call.outcome.replace('_', ' ')}
                            </span>
                          ) : (
                            <span className='text-sm text-gray-400'>{call.outcome || 'no_answer'}</span>
                          )}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                          {call.csat || '-'}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                          {new Date(call.createdAt).toLocaleDateString()}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                          <button
                            onClick={() => window.location.href = `/call-history/${call.id}`}
                            className='text-blue-600 hover:text-blue-900 inline-flex items-center'
                          >
                            <EyeIcon className='h-4 w-4 mr-1' />
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Helper function to format duration
const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default Dashboard;
