import React, { useState } from 'react';
import { useQuery } from 'react-query';
import {
    ChartBarIcon,
    TrendingUpIcon,
    TrendingDownIcon,
    PhoneIcon,
    UsersIcon,
    CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { api } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';

const Analytics = () => {
    const [dateRange, setDateRange] = useState('7d');
    const [selectedCampaign, setSelectedCampaign] = useState('');

    const { data: analytics, isLoading, error } = useQuery(
        ['analytics', { start_date: getStartDate(dateRange), end_date: new Date().toISOString() }],
        () => api.get('/analytics/dashboard', {
            params: {
                start_date: getStartDate(dateRange),
                end_date: new Date().toISOString()
            }
        }).then(res => res.data)
    );

    const { data: roiData } = useQuery(
        ['roi', { start_date: getStartDate(dateRange), end_date: new Date().toISOString() }],
        () => api.get('/analytics/roi', {
            params: {
                start_date: getStartDate(dateRange),
                end_date: new Date().toISOString()
            }
        }).then(res => res.data)
    );

    function getStartDate(range) {
        const now = new Date();
        switch (range) {
            case '7d':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            case '30d':
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            case '90d':
                return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
            default:
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        }
    }

    // Mock data for charts (in production, this would come from the API)
    const callTrendData = [
        { date: '2024-01-01', calls: 45, conversions: 12 },
        { date: '2024-01-02', calls: 52, conversions: 15 },
        { date: '2024-01-03', calls: 38, conversions: 8 },
        { date: '2024-01-04', calls: 61, conversions: 18 },
        { date: '2024-01-05', calls: 47, conversions: 14 },
        { date: '2024-01-06', calls: 55, conversions: 16 },
        { date: '2024-01-07', calls: 43, conversions: 11 }
    ];

    const outcomeData = [
        { name: 'Scheduled', value: 45, color: '#10B981' },
        { name: 'Interested', value: 32, color: '#3B82F6' },
        { name: 'Not Interested', value: 28, color: '#EF4444' },
        { name: 'Callback', value: 15, color: '#F59E0B' },
        { name: 'Voicemail', value: 20, color: '#8B5CF6' }
    ];

    const emotionData = [
        { emotion: 'Positive', count: 65 },
        { emotion: 'Neutral', count: 45 },
        { emotion: 'Negative', count: 20 },
        { emotion: 'Frustrated', count: 10 }
    ];

    if (isLoading) return <LoadingSpinner / > ;
    if (error) return <div className = "text-center py-12" > < p className = "text-red-600" > Failed to load analytics < /p></div > ;

    return ( <
        div className = "space-y-6" > { /* Header */ } <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        h1 className = "text-2xl font-bold text-gray-900" > Analytics < /h1> <
        p className = "text-gray-600" > Comprehensive insights into your calling performance < /p> < /
        div > <
        div className = "flex items-center space-x-4" >
        <
        select value = { dateRange }
        onChange = {
            (e) => setDateRange(e.target.value)
        }
        className = "input-field w-32" >
        <
        option value = "7d" > Last 7 days < /option> <
        option value = "30d" > Last 30 days < /option> <
        option value = "90d" > Last 90 days < /option> < /
        select > <
        /div> < /
        div >

        { /* Key Metrics */ } <
        div className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" >
        <
        div className = "card" >
        <
        div className = "flex items-center" >
        <
        div className = "p-3 rounded-lg bg-blue-50 text-blue-600" >
        <
        PhoneIcon className = "h-6 w-6" / >
        <
        /div> <
        div className = "ml-4" >
        <
        p className = "text-sm font-medium text-gray-500" > Total Calls < /p> <
        p className = "text-2xl font-semibold text-gray-900" > { analytics ? .analytics ? .overview ? .totalCalls || 0 } < /p> <
        p className = "text-sm text-green-600 flex items-center" >
        <
        TrendingUpIcon className = "h-4 w-4 mr-1" / >
        +12 % from last period <
        /p> < /
        div > <
        /div> < /
        div >

        <
        div className = "card" >
        <
        div className = "flex items-center" >
        <
        div className = "p-3 rounded-lg bg-green-50 text-green-600" >
        <
        TrendingUpIcon className = "h-6 w-6" / >
        <
        /div> <
        div className = "ml-4" >
        <
        p className = "text-sm font-medium text-gray-500" > Conversion Rate < /p> <
        p className = "text-2xl font-semibold text-gray-900" > { analytics ? .analytics ? .overview ? .conversionRate || 0 } % < /p> <
        p className = "text-sm text-green-600 flex items-center" >
        <
        TrendingUpIcon className = "h-4 w-4 mr-1" / >
        +3.2 % from last period <
        /p> < /
        div > <
        /div> < /
        div >

        <
        div className = "card" >
        <
        div className = "flex items-center" >
        <
        div className = "p-3 rounded-lg bg-purple-50 text-purple-600" >
        <
        UsersIcon className = "h-6 w-6" / >
        <
        /div> <
        div className = "ml-4" >
        <
        p className = "text-sm font-medium text-gray-500" > Active Campaigns < /p> <
        p className = "text-2xl font-semibold text-gray-900" > { analytics ? .analytics ? .overview ? .totalCampaigns || 0 } < /p> <
        p className = "text-sm text-gray-600" > { analytics ? .analytics ? .overview ? .totalContacts || 0 }
        contacts < /p> < /
        div > <
        /div> < /
        div >

        <
        div className = "card" >
        <
        div className = "flex items-center" >
        <
        div className = "p-3 rounded-lg bg-orange-50 text-orange-600" >
        <
        CurrencyDollarIcon className = "h-6 w-6" / >
        <
        /div> <
        div className = "ml-4" >
        <
        p className = "text-sm font-medium text-gray-500" > Total Cost < /p> <
        p className = "text-2xl font-semibold text-gray-900" > $ { analytics ? .analytics ? .overview ? .totalCost ? .toFixed(2) || '0.00' } < /p> <
        p className = "text-sm text-gray-600" > $ { roiData ? .roi ? .costPerCall ? .toFixed(2) || '0.00' }
        per call < /p> < /
        div > <
        /div> < /
        div > <
        /div>

        { /* Charts */ } <
        div className = "grid grid-cols-1 lg:grid-cols-2 gap-6" > { /* Call Trends */ } <
        div className = "card" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Call Trends < /h3> <
        ResponsiveContainer width = "100%"
        height = { 300 } >
        <
        LineChart data = { callTrendData } >
        <
        CartesianGrid strokeDasharray = "3 3" / >
        <
        XAxis dataKey = "date" / >
        <
        YAxis / >
        <
        Tooltip / >
        <
        Line type = "monotone"
        dataKey = "calls"
        stroke = "#3B82F6"
        strokeWidth = { 2 }
        /> <
        Line type = "monotone"
        dataKey = "conversions"
        stroke = "#10B981"
        strokeWidth = { 2 }
        /> < /
        LineChart > <
        /ResponsiveContainer> < /
        div >

        { /* Call Outcomes */ } <
        div className = "card" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Call Outcomes < /h3> <
        ResponsiveContainer width = "100%"
        height = { 300 } >
        <
        PieChart >
        <
        Pie data = { outcomeData }
        cx = "50%"
        cy = "50%"
        labelLine = { false }
        label = {
            ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
        }
        outerRadius = { 80 }
        fill = "#8884d8"
        dataKey = "value" > {
            outcomeData.map((entry, index) => ( <
                Cell key = { `cell-${index}` }
                fill = { entry.color }
                />
            ))
        } <
        /Pie> <
        Tooltip / >
        <
        /PieChart> < /
        ResponsiveContainer > <
        /div> < /
        div >

        { /* Emotion Analysis */ } <
        div className = "grid grid-cols-1 lg:grid-cols-2 gap-6" >
        <
        div className = "card" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Emotion Analysis < /h3> <
        ResponsiveContainer width = "100%"
        height = { 300 } >
        <
        BarChart data = { emotionData } >
        <
        CartesianGrid strokeDasharray = "3 3" / >
        <
        XAxis dataKey = "emotion" / >
        <
        YAxis / >
        <
        Tooltip / >
        <
        Bar dataKey = "count"
        fill = "#8B5CF6" / >
        <
        /BarChart> < /
        ResponsiveContainer > <
        /div>

        { /* ROI Analysis */ } <
        div className = "card" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > ROI Analysis < /h3> <
        div className = "space-y-4" >
        <
        div className = "flex justify-between items-center p-4 bg-gray-50 rounded-lg" >
        <
        span className = "text-sm font-medium text-gray-700" > Cost per Call < /span> <
        span className = "text-lg font-semibold text-gray-900" > $ { roiData ? .roi ? .costPerCall ? .toFixed(2) || '0.00' } < /span> < /
        div > <
        div className = "flex justify-between items-center p-4 bg-gray-50 rounded-lg" >
        <
        span className = "text-sm font-medium text-gray-700" > Cost per Conversion < /span> <
        span className = "text-lg font-semibold text-gray-900" > $ { roiData ? .roi ? .costPerConversion ? .toFixed(2) || '0.00' } < /span> < /
        div > <
        div className = "flex justify-between items-center p-4 bg-gray-50 rounded-lg" >
        <
        span className = "text-sm font-medium text-gray-700" > ROI < /span> <
        span className = "text-lg font-semibold text-green-600" > { roiData ? .roi ? .roi || '0' } % < /span> < /
        div > <
        div className = "flex justify-between items-center p-4 bg-gray-50 rounded-lg" >
        <
        span className = "text-sm font-medium text-gray-700" > Average Duration < /span> <
        span className = "text-lg font-semibold text-gray-900" > { Math.round(roiData ? .roi ? .avgDuration || 0) }
        s < /span> < /
        div > <
        /div> < /
        div > <
        /div>

        { /* Campaign Performance Table */ } <
        div className = "card" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Campaign Performance < /h3> <
        div className = "overflow-x-auto" >
        <
        table className = "min-w-full divide-y divide-gray-200" >
        <
        thead className = "bg-gray-50" >
        <
        tr >
        <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Campaign < /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Calls < /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Conversions < /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Rate < /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Cost < /th> < /
        tr > <
        /thead> <
        tbody className = "bg-white divide-y divide-gray-200" > {
            analytics ? .analytics ? .campaignPerformance ? .map((campaign) => ( <
                tr key = { campaign.id } >
                <
                td className = "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" > { campaign.name } < /td> <
                td className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900" > { campaign.totalCalls } < /td> <
                td className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900" > { campaign.scheduledCalls + campaign.interestedCalls } < /td> <
                td className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900" > { campaign.conversionRate } % < /td> <
                td className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900" >
                $ { campaign.totalCost.toFixed(2) } <
                /td> < /
                tr >
            ))
        } <
        /tbody> < /
        table > <
        /div> < /
        div > <
        /div>
    );
};

export default Analytics;