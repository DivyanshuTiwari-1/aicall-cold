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
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import CreateCampaignModal from '../components/CreateCampaignModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { callsAPI } from '../services/calls';
import campaignsAPI from '../services/campaigns';

const Campaigns = () => {
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);

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


    // Start automated calls mutation
    const startAutomatedCallsMutation = useMutation({
        mutationFn: (campaignId) => callsAPI.startAutomatedCalls(campaignId),
        onSuccess: () => {
            toast.success('Automated calls started successfully');
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
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


    const handleStartAutomatedCalls = (campaignId) => {
        startAutomatedCallsMutation.mutate(campaignId);
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
                                    {campaigns.map((campaign) => (
                                        <tr key={campaign.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                                                    <div className="text-sm text-gray-500">{campaign.description}</div>
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
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {campaign.contactCount || 0}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {campaign.callsMade || 0}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex space-x-2">
                                                    {campaign.automatedCallsActive ? (
                                                        <button
                                                            onClick={() => handleStopAutomatedCalls(campaign.id)}
                                                            disabled={stopAutomatedCallsMutation.isLoading}
                                                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
                                                        >
                                                            {stopAutomatedCallsMutation.isLoading ? (
                                                                <LoadingSpinner size="sm" className="mr-1" />
                                                            ) : (
                                                                <StopIcon className="h-4 w-4 mr-1" />
                                                            )}
                                                            Stop
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartAutomatedCalls(campaign.id)}
                                                            disabled={startAutomatedCallsMutation.isLoading || campaign.status !== 'active'}
                                                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
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
                                            </td>
                                        </tr>
                                    ))}
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
        </div>
    );
};

export default Campaigns;
