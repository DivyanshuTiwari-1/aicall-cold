import {
  ChartBarIcon,
  ClockIcon,
  PhoneIcon,
  PlayIcon,
  PlusIcon,
  StopIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import CreateCampaignModal from '../components/CreateCampaignModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { callsAPI } from '../services/calls';
import campaignsAPI from '../services/campaigns';
import phoneNumbersAPI from '../services/phoneNumbers';

const Campaigns = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { isConnected, addListener } = useWebSocket();
    const [queueStatuses, setQueueStatuses] = React.useState({});
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPhoneSelector, setShowPhoneSelector] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState(null);

    // Fetch campaigns
    const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
        queryKey: ['campaigns'],
        queryFn: () => campaignsAPI.getCampaigns(),
        refetchInterval: 30000,
    });

    // Fetch campaign stats
    const { data: statsData } = useQuery({
        queryKey: ['campaign-stats'],
        queryFn: () => callsAPI.getCampaignStats(),
        refetchInterval: 60000,
    });

    // Fetch available phone numbers
    const { data: phoneNumbersData } = useQuery({
        queryKey: ['available-phone-numbers'],
        queryFn: () => phoneNumbersAPI.getAvailableNumbers(),
    });

    // Start automated calls mutation
    const startAutomatedCallsMutation = useMutation({
        mutationFn: ({ campaignId, phoneNumberId }) => callsAPI.startAutomatedCalls(campaignId, phoneNumberId),
        onSuccess: () => {
            toast.success('Automated calls started successfully');
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
            setShowPhoneSelector(false);
            setSelectedCampaign(null);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to start automated calls');
        },
    });

    // Stop automated calls mutation
    const stopAutomatedCallsMutation = useMutation({
        mutationFn: (campaignId) => callsAPI.stopAutomatedCalls(campaignId),
        onSuccess: () => {
            toast.success('Automated calls stopped successfully');
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to stop automated calls');
        },
    });

    // WebSocket listeners for real-time queue updates
    useEffect(() => {
        if (!isConnected || !user?.organizationId) return;

        const handleQueueStatusUpdate = (data) => {
            console.log('📊 [CAMPAIGNS] Queue status update:', data);

            // Update local queue status state
            setQueueStatuses(prev => ({
                ...prev,
                [data.campaignId]: data.status
            }));

            // Refresh campaigns data
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
        };

        const handleCallStarted = (data) => {
            console.log('📞 [CAMPAIGNS] Call started:', data);
            queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
        };

        const handleCallEnded = (data) => {
            console.log('✅ [CAMPAIGNS] Call ended:', data);
            queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
        };

        addListener('queue_status_update', handleQueueStatusUpdate);
        addListener('call_started', handleCallStarted);
        addListener('call_ended', handleCallEnded);

        return () => {
            // Cleanup handled by useWebSocket
        };
    }, [isConnected, user?.organizationId, addListener, queryClient]);

    // Fetch initial queue statuses for active campaigns on mount
    useEffect(() => {
        const fetchQueueStatuses = async () => {
            if (!campaigns || campaigns.length === 0) return;

            const activeCampaigns = campaigns.filter(c => c.automatedCallsActive);

            for (const campaign of activeCampaigns) {
                try {
                    const statusData = await callsAPI.getQueueStatus(campaign.id);
                    if (statusData?.status) {
                        setQueueStatuses(prev => ({
                            ...prev,
                            [campaign.id]: statusData.status
                        }));
                    }
                } catch (error) {
                    console.error(`Failed to fetch queue status for campaign ${campaign.id}:`, error);
                }
            }
        };

        fetchQueueStatuses();
    }, [campaigns]);

    const handleStartAutomatedCalls = (campaignId) => {
        setSelectedCampaign(campaignId);
        setShowPhoneSelector(true);
    };

    const confirmStartQueue = (phoneNumberId) => {
        if (!phoneNumberId) {
            toast.error('Please select a phone number');
            return;
        }
        startAutomatedCallsMutation.mutate({
            campaignId: selectedCampaign,
            phoneNumberId
        });
    };

    const handleStopAutomatedCalls = (campaignId) => {
        stopAutomatedCallsMutation.mutate(campaignId);
    };

    const campaigns = campaignsData?.campaigns || [];
    const stats = statsData?.stats || {};

    if (campaignsLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
                    <p className="text-gray-600">Manage your calling campaigns and automated call queues</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Create Campaign
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <ChartBarIcon className="h-6 w-6 text-gray-400" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Campaigns</dt>
                                    <dd className="text-lg font-medium text-gray-900">{stats.totalCampaigns || 0}</dd>
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
                                    <dt className="text-sm font-medium text-gray-500 truncate">Active Calls</dt>
                                    <dd className="text-lg font-medium text-gray-900">{stats.activeCalls || 0}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <UserGroupIcon className="h-6 w-6 text-gray-400" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Contacts</dt>
                                    <dd className="text-lg font-medium text-gray-900">{stats.totalContacts || 0}</dd>
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
                                    <dt className="text-sm font-medium text-gray-500 truncate">Queued Calls</dt>
                                    <dd className="text-lg font-medium text-gray-900">{stats.queuedCalls || 0}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Campaigns Table */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Your Campaigns</h3>
                    {campaigns.length === 0 ? (
                        <div className="text-center py-12">
                            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No campaigns</h3>
                            <p className="mt-1 text-sm text-gray-500">Get started by creating a new campaign.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Campaign
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Type
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Contacts
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Calls Made
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {campaigns.map((campaign) => {
                                        const queueStatus = queueStatuses[campaign.id];
                                        const hasActiveQueue = campaign.automatedCallsActive && queueStatus;

                                        return (
                                            <React.Fragment key={campaign.id}>
                                                <tr className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                                                            <div className="text-sm text-gray-500">{campaign.description}</div>
                                                            {hasActiveQueue && (
                                                                <div className="mt-2">
                                                                    <div className="flex items-center space-x-2">
                                                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                                            <div
                                                                                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                                                                style={{ width: `${queueStatus.progress || 0}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs font-medium text-gray-700">
                                                                            {queueStatus.progress || 0}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="mt-1 flex items-center space-x-4 text-xs text-gray-600">
                                                                        <span className="flex items-center">
                                                                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                                                                            {queueStatus.processedContacts || 0}/{queueStatus.totalContacts || 0} processed
                                                                        </span>
                                                                        <span className="flex items-center">
                                                                            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                                                                            {queueStatus.successfulCalls || 0} success
                                                                        </span>
                                                                        <span className="flex items-center">
                                                                            <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>
                                                                            {queueStatus.failedCalls || 0} failed
                                                                        </span>
                                                                        <span className="flex items-center">
                                                                            <span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1"></span>
                                                                            {queueStatus.remainingContacts || 0} remaining
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                            {campaign.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                            campaign.status === 'active'
                                                                ? 'bg-green-100 text-green-800'
                                                                : campaign.status === 'paused'
                                                                ? 'bg-yellow-100 text-yellow-800'
                                                                : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                            {campaign.status}
                                                        </span>
                                                        {hasActiveQueue && (
                                                            <div className="mt-1">
                                                                <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 animate-pulse">
                                                                    <span className="w-2 h-2 bg-blue-600 rounded-full mr-1 animate-ping"></span>
                                                                    Queue Running
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {campaign.contactCount || 0}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {campaign.callsMade || 0}
                                                    </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex flex-col space-y-1">
                                                    <div className="flex space-x-2">
                                                        {campaign.automatedCallsActive ? (
                                                            <button
                                                                onClick={() => handleStopAutomatedCalls(campaign.id)}
                                                                disabled={stopAutomatedCallsMutation.isLoading}
                                                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                                            >
                                                                {stopAutomatedCallsMutation.isLoading ? (
                                                                    <LoadingSpinner size="sm" className="mr-1" />
                                                                ) : (
                                                                    <StopIcon className="h-4 w-4 mr-1" />
                                                                )}
                                                                Stop Queue
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleStartAutomatedCalls(campaign.id)}
                                                                disabled={startAutomatedCallsMutation.isLoading || campaign.status !== 'active' || campaign.contactCount === 0}
                                                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                                            >
                                                                {startAutomatedCallsMutation.isLoading ? (
                                                                    <LoadingSpinner size="sm" className="mr-1" />
                                                                ) : (
                                                                    <PlayIcon className="h-4 w-4 mr-1" />
                                                                )}
                                                                Start Queue
                                                            </button>
                                                        )}
                                                    </div>
                                                    {!campaign.automatedCallsActive && (campaign.status !== 'active' || campaign.contactCount === 0) && (
                                                        <p className="text-xs text-gray-500">
                                                            {campaign.status !== 'active' && 'Campaign must be active'}
                                                            {campaign.contactCount === 0 && 'No contacts'}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Campaign Modal */}
            <CreateCampaignModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />

            {/* Phone Number Selector Modal */}
            {showPhoneSelector && (
                <PhoneNumberSelectorModal
                    phoneNumbers={phoneNumbersData?.phoneNumbers || []}
                    onSelect={confirmStartQueue}
                    onClose={() => {
                        setShowPhoneSelector(false);
                        setSelectedCampaign(null);
                    }}
                    isLoading={startAutomatedCallsMutation.isLoading}
                />
            )}
        </div>
    );
};

// Phone Number Selector Modal Component
const PhoneNumberSelectorModal = ({ phoneNumbers, onSelect, onClose, isLoading }) => {
    const [selectedNumber, setSelectedNumber] = useState('');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Select Phone Number
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    Choose which phone number to use for automated calls
                </p>

                {phoneNumbers.length === 0 ? (
                    <div className="text-center py-8">
                        <PhoneIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">No phone numbers available</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Please contact your administrator to assign phone numbers
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                        {phoneNumbers.map((number) => (
                            <label
                                key={number.id}
                                className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                                    selectedNumber === number.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="phoneNumber"
                                    value={number.id}
                                    checked={selectedNumber === number.id}
                                    onChange={(e) => setSelectedNumber(e.target.value)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="ml-3 flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-900">
                                            {number.phone_number}
                                        </span>
                                        {number.provider && (
                                            <span className="text-xs text-gray-500 uppercase">
                                                {number.provider}
                                            </span>
                                        )}
                                    </div>
                                    {number.daily_limit && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            Calls today: {number.calls_made_today || 0} / {number.daily_limit}
                                        </div>
                                    )}
                                    {number.assigned_to && number.first_name && (
                                        <div className="text-xs text-gray-500">
                                            Assigned to: {number.first_name} {number.last_name}
                                        </div>
                                    )}
                                </div>
                            </label>
                        ))}
                    </div>
                )}

                <div className="flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSelect(selectedNumber)}
                        disabled={!selectedNumber || isLoading || phoneNumbers.length === 0}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Starting...' : 'Start Queue'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Campaigns;
