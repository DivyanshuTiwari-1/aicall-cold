import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  PhoneIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import React, { useState } from "react";
import { useQuery } from "react-query";
import {
  Bar,
  BarChart,
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
  YAxis,
} from "recharts";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";

const Analytics = () => {
  const [dateRange, setDateRange] = useState("7d");

  const {
    data: analytics,
    isLoading,
    error,
  } = useQuery(
    ["analytics", dateRange],
    () =>
      api
        .get(`/analytics/dashboard?range=${dateRange}`)
        .then((res) => res.data),
    { refetchInterval: 30000 }
  );

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error loading analytics</div>;

  // Sample data for charts
  const callTrendsData = [
    { date: "2024-01-01", calls: 45, conversions: 12 },
    { date: "2024-01-02", calls: 52, conversions: 15 },
    { date: "2024-01-03", calls: 38, conversions: 8 },
    { date: "2024-01-04", calls: 61, conversions: 18 },
    { date: "2024-01-05", calls: 47, conversions: 11 },
    { date: "2024-01-06", calls: 55, conversions: 16 },
    { date: "2024-01-07", calls: 42, conversions: 9 },
  ];

  const campaignPerformanceData = [
    { name: "Q4 Sales", calls: 120, conversions: 24, conversionRate: 20 },
    { name: "Recruitment", calls: 85, conversions: 12, conversionRate: 14 },
    { name: "Follow-up", calls: 65, conversions: 18, conversionRate: 28 },
  ];

  const outcomeData = [
    { name: "Interested", value: 45, color: "#10B981" },
    { name: "Not Interested", value: 30, color: "#EF4444" },
    { name: "Callback", value: 15, color: "#F59E0B" },
    { name: "No Answer", value: 10, color: "#6B7280" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex space-x-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input-field border rounded-md p-2"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Calls */}
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <PhoneIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Calls</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.overview?.totalCalls || 0}
              </p>
              <p className="text-sm text-green-600 flex items-center">
                <ArrowTrendingUpIcon className="h-4 w-4 mr-1" /> +12% from last period
              </p>
            </div>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-50 text-green-600">
              <ArrowTrendingUpIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Conversion Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.overview?.conversionRate || 0}%
              </p>
              <p className="text-sm text-green-600 flex items-center">
                <ArrowTrendingUpIcon className="h-4 w-4 mr-1" /> +3.2% from last period
              </p>
            </div>
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
              <UsersIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Campaigns</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.overview?.totalCampaigns || 0}
              </p>
              <p className="text-sm text-gray-600">3 running</p>
            </div>
          </div>
        </div>

        {/* Cost per Lead */}
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-50 text-yellow-600">
              <CurrencyDollarIcon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Cost per Lead</p>
              <p className="text-2xl font-semibold text-gray-900">$2.45</p>
              <p className="text-sm text-green-600 flex items-center">
                <ArrowTrendingDownIcon className="h-4 w-4 mr-1" /> -15% from last period
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Trends */}
        <div className="card">
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

        {/* Campaign Performance */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={campaignPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="calls" fill="#3B82F6" />
              <Bar dataKey="conversions" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Call Outcomes & Top Scripts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Outcomes */}
        <div className="card">
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

        {/* Top Performing Scripts */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Scripts</h3>
          <div className="space-y-4">
            {[
              { name: "Sales Opening", rate: 24, change: "+5.2%", color: "green" },
              { name: "Objection Handler", rate: 18, change: "+2.1%", color: "green" },
              { name: "Closing Script", rate: 31, change: "-1.3%", color: "red" },
            ].map((script) => (
              <div
                key={script.name}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{script.name}</p>
                  <p className="text-sm text-gray-600">Conversion Rate: {script.rate}%</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium text-${script.color}-600`}>{script.change}</p>
                  <p className="text-xs text-gray-500">vs last week</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
