import {
    CalendarIcon,
    CheckCircleIcon,
    CurrencyDollarIcon,
    HandThumbUpIcon,
    PhoneIcon,
} from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import analyticsAPI from '../services/analytics';

const Dashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();

  const {
    data: analytics,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => analyticsAPI.getDashboard('7d'),
    refetchInterval: 30000, // Refetch every 30 seconds
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
    };

    addListener('call_status_update', handleCallUpdate);
    addListener('agent_status_change', handleAgentUpdate);
    addListener('organization_update', handleOrganizationUpdate);

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.organizationId, addListener, queryClient]);

  if (isLoading) return <LoadingSpinner />;
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

  return (
    <div className='space-y-6'>
      {/* Main Stats Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6'>
        {[
          {
            label: 'Total Calls',
            value: data.totalCalls,
            change: '+12% vs last month',
            icon: <PhoneIcon className='h-6 w-6 text-blue-600' />,
            bg: 'bg-blue-50',
          },
          {
            label: 'Completed',
            value: data.completed,
            change: '+8% vs last month',
            icon: <CheckCircleIcon className='h-6 w-6 text-green-600' />,
            bg: 'bg-green-50',
          },
          {
            label: 'Meetings',
            value: data.meetings,
            change: '+23% vs last month',
            icon: <CalendarIcon className='h-6 w-6 text-purple-600' />,
            bg: 'bg-purple-50',
          },
          {
            label: 'Avg CSAT',
            value: `${data.avgCSAT}/5`,
            change: '+0.3 vs last month',
            icon: <HandThumbUpIcon className='h-6 w-6 text-orange-600' />,
            bg: 'bg-orange-50',
          },
          {
            label: 'ROI',
            value: `${data.roi}%`,
            change: '+15% vs last month',
            icon: <CurrencyDollarIcon className='h-6 w-6 text-green-600' />,
            bg: 'bg-green-50',
          },
        ].map((stat, idx) => (
          <div key={idx} className={`bg-white rounded-lg shadow-sm p-6`}>
            <div className='flex items-center justify-between mb-2'>
              <div className='flex flex-col'>
                <p className='text-sm font-medium text-gray-500'>{stat.label}</p>
                <p className='text-3xl font-bold text-gray-900'>{stat.value}</p>
                <p className='text-sm text-green-600'>{stat.change}</p>
              </div>
              <div className={`p-3 ${stat.bg} rounded-lg`}>{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Cost Per Qualified Lead */}
      <div className='bg-green-50 rounded-lg p-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
          <CurrencyDollarIcon className='h-5 w-5 mr-2' /> Cost Per Qualified Lead
        </h3>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
          {[
            { label: 'Cost / Lead', value: `₹${data.costPerLead}`, color: 'text-green-600' },
            { label: 'Credits Used', value: data.creditsUsed, color: 'text-blue-600' },
            {
              label: 'Conversion Rate',
              value: `${data.conversionRate}%`,
              color: 'text-purple-600',
            },
            { label: 'Projected ROI', value: `${data.projectedROI}%`, color: 'text-green-600' },
          ].map((item, idx) => (
            <div key={idx}>
              <p className='text-sm text-gray-600'>{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Campaigns */}
      <div className='bg-white rounded-lg shadow-sm p-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4'>Active Campaigns</h3>
        <div className='space-y-4'>
          {data.campaigns.map((campaign, idx) => (
            <div
              key={idx}
              className='flex items-center justify-between p-4 border border-gray-200 rounded-lg'
            >
              <div className='flex-1'>
                <h4 className='font-semibold text-gray-900'>{campaign.name}</h4>
                <div className='mt-2'>
                  <div className='flex items-center justify-between text-sm text-gray-600 mb-1'>
                    <span>Progress</span>
                    <span>
                      {campaign.current}/{campaign.total}
                    </span>
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-2'>
                    <div
                      className='bg-blue-600 h-2 rounded-full'
                      style={{ width: `${campaign.progress}%` }}
                    ></div>
                  </div>
                </div>
                <p className='text-sm text-gray-500 mt-1'>Voice: {campaign.voice}</p>
              </div>
              <div className='text-right'>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    campaign.category === 'sales'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {campaign.category}
                </span>
                <p className='text-sm text-gray-600 mt-1'>Credits: {campaign.credits}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Calls with Emotions */}
      <div className='bg-white rounded-lg shadow-sm p-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4'>Recent Calls with Emotions</h3>
        <div className='space-y-3'>
          {data.recentCalls.map((call, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-4 rounded-lg ${
                call.status === 'scheduled' ? 'bg-green-50' : 'bg-white'
              }`}
            >
              <div className='flex items-center space-x-4'>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    call.status === 'scheduled' || call.status === 'fit'
                      ? 'bg-green-100'
                      : call.status === 'connected'
                        ? 'bg-yellow-100'
                        : 'bg-gray-100'
                  }`}
                >
                  {call.status === 'scheduled' || call.status === 'fit' ? (
                    <CheckCircleIcon className='h-5 w-5 text-green-600' />
                  ) : call.status === 'connected' ? (
                    <div className='w-2 h-2 bg-yellow-500 rounded-full'></div>
                  ) : (
                    <CheckCircleIcon className='h-5 w-5 text-gray-600' />
                  )}
                </div>
                <div>
                  <p className='font-medium text-gray-900'>{call.name}</p>
                  <p className='text-sm text-gray-500'>{call.date}</p>
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
                    call.status === 'scheduled' || call.status === 'fit'
                      ? 'bg-green-100 text-green-800'
                      : call.status === 'connected'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {call.status}
                </span>
                {call.csat && <p className='text-sm text-gray-600'>CSAT: {call.csat}/5</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state for campaigns */}
      {data.campaigns.length === 0 && (
        <div className='bg-white rounded-lg shadow-sm p-6 text-center'>
          <h3 className='text-lg font-semibold text-gray-900 mb-2'>No Active Campaigns</h3>
          <p className='text-gray-500'>Create your first campaign to get started</p>
        </div>
      )}

      {/* Empty state for recent calls */}
      {data.recentCalls.length === 0 && (
        <div className='bg-white rounded-lg shadow-sm p-6 text-center'>
          <h3 className='text-lg font-semibold text-gray-900 mb-2'>No Recent Calls</h3>
          <p className='text-gray-500'>Calls will appear here once you start making them</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
