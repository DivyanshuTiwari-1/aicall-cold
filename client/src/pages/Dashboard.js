import React from "react";
import { useQuery } from "react-query";
import {
    PhoneIcon,
    UsersIcon,
    MegaphoneIcon,
    ChartBarIcon,
    ArrowTrendingUpIcon,
    ClockIcon,
} from "@heroicons/react/24/outline";
import api from "../utils/api";
import LoadingSpinner from "../components/LoadingSpinner";
import StatCard from "../components/StatCard";
import RecentCalls from "../components/RecentCalls";
import CampaignPerformance from "../components/CampaignPerformance";

const Dashboard = () => {
    const {
        data: analytics,
        isLoading,
        error,
    } = useQuery(
        "dashboard-analytics",
        () => api.get("/analytics/dashboard").then(res => res.data),
        {
            refetchInterval: 30000, // Refetch every 30 seconds
        }
    );

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-red-600"> Failed to load dashboard data </p>{" "}
            </div>
        );
    }

    const { overview, recentCalls, campaignPerformance } = analytics.analytics;

    return (
        <div className="space-y-6">
            {" "}
            {/* Header */}{" "}
            <div>
                <h1 className="text-2xl font-bold text-gray-900"> Dashboard </h1>{" "}
                <p className="text-gray-600">
                    {" "}
                    Welcome back!Here 's what' s happening with your campaigns.{" "}
                </p>{" "}
            </div>{" "}
            {/* Stats Grid */}{" "}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Calls"
                    value={overview.totalCalls}
                    icon={PhoneIcon}
                    color="blue"
                    change={`+${overview.completedCalls} completed`}
                />{" "}
                <StatCard
                    title="Conversion Rate"
                    value={`${overview.conversionRate}%`}
                    icon={ArrowTrendingUpIcon}
                    color="green"
                    change={`${overview.scheduledCalls + overview.interestedCalls} converted`}
                />{" "}
                <StatCard
                    title="Active Campaigns"
                    value={overview.totalCampaigns}
                    icon={MegaphoneIcon}
                    color="purple"
                    change={`${overview.totalContacts} contacts`}
                />{" "}
                <StatCard
                    title="Avg Duration"
                    value={`${Math.round(overview.avgDuration)}s`}
                    icon={ClockIcon}
                    color="orange"
                    change="per call"
                />
            </div>{" "}
            {/* Charts and Tables */}{" "}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {" "}
                {/* Recent Calls */}{" "}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900"> Recent Calls </h3>{" "}
                        <button className="text-sm text-blue-600 hover:text-blue-700">
                            View all{" "}
                        </button>{" "}
                    </div>{" "}
                    <RecentCalls calls={recentCalls} />{" "}
                </div>{" "}
                {/* Campaign Performance */}{" "}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                            {" "}
                            Campaign Performance{" "}
                        </h3>{" "}
                        <button className="text-sm text-blue-600 hover:text-blue-700">
                            View all{" "}
                        </button>{" "}
                    </div>{" "}
                    <CampaignPerformance campaigns={campaignPerformance} />{" "}
                </div>{" "}
            </div>{" "}
            {/* Quick Actions */}{" "}
            <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4"> Quick Actions </h3>{" "}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <MegaphoneIcon className="h-6 w-6 text-blue-600 mr-3" />
                        <div className="text-left">
                            <p className="font-medium text-gray-900"> Create Campaign </p>{" "}
                            <p className="text-sm text-gray-500">
                                {" "}
                                Start a new calling campaign{" "}
                            </p>{" "}
                        </div>{" "}
                    </button>{" "}
                    <button className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <UsersIcon className="h-6 w-6 text-green-600 mr-3" />
                        <div className="text-left">
                            <p className="font-medium text-gray-900"> Import Contacts </p>{" "}
                            <p className="text-sm text-gray-500"> Upload contact lists </p>{" "}
                        </div>{" "}
                    </button>{" "}
                    <button className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <ChartBarIcon className="h-6 w-6 text-purple-600 mr-3" />
                        <div className="text-left">
                            <p className="font-medium text-gray-900"> View Analytics </p>{" "}
                            <p className="text-sm text-gray-500">
                                {" "}
                                Detailed performance reports{" "}
                            </p>{" "}
                        </div>{" "}
                    </button>{" "}
                </div>{" "}
            </div>{" "}
        </div>
    );
};

export default Dashboard;
