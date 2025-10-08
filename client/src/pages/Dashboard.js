import React from "react";
import { useQuery } from "react-query";
import {
    PhoneIcon,
    CheckCircleIcon,
    CalendarIcon,
    HandThumbUpIcon,
    CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import api from "../utils/api";
import LoadingSpinner from "../components/LoadingSpinner";

const Dashboard = () => {
    const {
        data: analytics,
        isLoading,
        error,
    } = useQuery(
        "dashboard-analytics",
        () => api.get("/analytics/dashboard").then(res => res.data), {
            refetchInterval: 30000, // Refetch every 30 seconds
        }
    );

    if (isLoading) {
        return <LoadingSpinner / > ;
    }

    if (error) {
        return ( <
            div className = "text-center py-12" >
            <
            p className = "text-red-600" > Failed to load dashboard data < /p> <
            /div>
        );
    }

    // Mock data for demonstration - replace with actual analytics data
    const mockData = {
        totalCalls: 1247,
        completed: 823,
        meetings: 156,
        avgCSAT: 4.2,
        roi: 580,
        costPerLead: 3.2,
        creditsUsed: 2584,
        conversionRate: 18.9,
        projectedROI: 580,
        campaigns: [{
                name: "Q4 Sales Outreach",
                progress: 45,
                voice: "professional",
                current: 234,
                total: 500,
                credits: 1872,
                category: "sales"
            },
            {
                name: "Developer Screening",
                progress: 60,
                voice: "empathetic",
                current: 89,
                total: 150,
                credits: 712,
                category: "recruitment"
            }
        ],
        recentCalls: [{
                name: "Rahul Sharma",
                emotion: "interested",
                date: "2025-10-02 14:23",
                status: "scheduled",
                csat: 4.5
            },
            {
                name: "Priya Patel",
                emotion: "positive",
                date: "2025-10-02 14:18",
                status: "fit",
                csat: 4.8
            },
            {
                name: "John Davis",
                emotion: "neutral",
                date: "2025-10-02 14:30",
                status: "connected",
                csat: null
            },
            {
                name: "Sneha Kumar",
                emotion: "confused",
                date: "2025-10-02 14:12",
                status: "not_fit",
                csat: 3.2
            }
        ],
        emotionDistribution: [
            { emotion: "Interested", calls: 345, percentage: 42, color: "bg-green-500" },
            { emotion: "Neutral", calls: 278, percentage: 34, color: "bg-gray-500" },
            { emotion: "Confused", calls: 142, percentage: 17, color: "bg-yellow-500" },
            { emotion: "Frustrated", calls: 58, percentage: 7, color: "bg-red-500" }
        ]
    };

    return ( <
        div className = "space-y-6" > { /* Main Stats Grid */ } <
        div className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6" >
        <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        p className = "text-sm font-medium text-gray-500" > Total Calls < /p> <
        p className = "text-3xl font-bold text-gray-900" > { mockData.totalCalls } < /p> <
        p className = "text-sm text-green-600" > +12 % vs last month < /p> <
        /div> <
        div className = "p-3 bg-blue-50 rounded-lg" >
        <
        PhoneIcon className = "h-6 w-6 text-blue-600" / >
        <
        /div> <
        /div> <
        /div>

        <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        p className = "text-sm font-medium text-gray-500" > Completed < /p> <
        p className = "text-3xl font-bold text-gray-900" > { mockData.completed } < /p> <
        p className = "text-sm text-green-600" > +8 % vs last month < /p> <
        /div> <
        div className = "p-3 bg-green-50 rounded-lg" >
        <
        CheckCircleIcon className = "h-6 w-6 text-green-600" / >
        <
        /div> <
        /div> <
        /div>

        <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        p className = "text-sm font-medium text-gray-500" > Meetings < /p> <
        p className = "text-3xl font-bold text-gray-900" > { mockData.meetings } < /p> <
        p className = "text-sm text-green-600" > +23 % vs last month < /p> <
        /div> <
        div className = "p-3 bg-purple-50 rounded-lg" >
        <
        CalendarIcon className = "h-6 w-6 text-purple-600" / >
        <
        /div> <
        /div> <
        /div>

        <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        p className = "text-sm font-medium text-gray-500" > Avg CSAT < /p> <
        p className = "text-3xl font-bold text-gray-900" > { mockData.avgCSAT }
        /5</p >
        <
        p className = "text-sm text-green-600" > +0.3 vs last month < /p> <
        /div> <
        div className = "p-3 bg-orange-50 rounded-lg" >
        <
        HandThumbUpIcon className = "h-6 w-6 text-orange-600" / >
        <
        /div> <
        /div> <
        /div>

        <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        p className = "text-sm font-medium text-gray-500" > ROI < /p> <
        p className = "text-3xl font-bold text-gray-900" > { mockData.roi } % < /p> <
        p className = "text-sm text-green-600" > +15 % vs last month < /p> <
        /div> <
        div className = "p-3 bg-green-50 rounded-lg" >
        <
        CurrencyDollarIcon className = "h-6 w-6 text-green-600" / >
        <
        /div> <
        /div> <
        /div> <
        /div>

        { /* Cost Per Qualified Lead Section */ } <
        div className = "bg-green-50 rounded-lg p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4 flex items-center" >
        <
        CurrencyDollarIcon className = "h-5 w-5 mr-2" / >
        Cost Per Qualified Lead <
        /h3> <
        div className = "grid grid-cols-1 md:grid-cols-4 gap-6" >
        <
        div >
        <
        p className = "text-sm text-gray-600" > Cost / Lead < /p> <
        p className = "text-2xl font-bold text-green-600" > ₹{ mockData.costPerLead } < /p> <
        /div> <
        div >
        <
        p className = "text-sm text-gray-600" > Credits Used < /p> <
        p className = "text-2xl font-bold text-blue-600" > { mockData.creditsUsed } < /p> <
        /div> <
        div >
        <
        p className = "text-sm text-gray-600" > Conversion Rate < /p> <
        p className = "text-2xl font-bold text-purple-600" > { mockData.conversionRate } % < /p> <
        /div> <
        div >
        <
        p className = "text-sm text-gray-600" > Projected ROI < /p> <
        p className = "text-2xl font-bold text-green-600" > { mockData.projectedROI } % < /p> <
        /div> <
        /div> <
        /div>

        { /* Active Campaigns */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Active Campaigns < /h3> <
        div className = "space-y-4" > {
            mockData.campaigns.map((campaign, index) => ( <
                div key = { index }
                className = "flex items-center justify-between p-4 border border-gray-200 rounded-lg" >
                <
                div className = "flex-1" >
                <
                h4 className = "font-semibold text-gray-900" > { campaign.name } < /h4> <
                div className = "mt-2" >
                <
                div className = "flex items-center justify-between text-sm text-gray-600 mb-1" >
                <
                span > Progress < /span> <
                span > { campaign.current }
                /{campaign.total}</span >
                <
                /div> <
                div className = "w-full bg-gray-200 rounded-full h-2" >
                <
                div className = "bg-blue-600 h-2 rounded-full"
                style = {
                    { width: `${campaign.progress}%` } } >
                < /div> <
                /div> <
                /div> <
                p className = "text-sm text-gray-500 mt-1" > Voice: { campaign.voice } < /p> <
                /div> <
                div className = "text-right" >
                <
                span className = { `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    campaign.category === 'sales'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-green-100 text-green-800'
                                }` } > { campaign.category } <
                /span> <
                p className = "text-sm text-gray-600 mt-1" > Credits: { campaign.credits } < /p> <
                /div> <
                /div>
            ))
        } <
        /div> <
        /div>

        { /* Recent Calls with Emotions */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Recent Calls with Emotions < /h3> <
        div className = "space-y-3" > {
            mockData.recentCalls.map((call, index) => ( <
                div key = { index }
                className = { `flex items-center justify-between p-4 rounded-lg ${
                            call.status === 'scheduled' ? 'bg-green-50' : 'bg-white'
                        }` } >
                <
                div className = "flex items-center space-x-4" >
                <
                div className = { `w-8 h-8 rounded-full flex items-center justify-center ${
                                    call.status === 'scheduled' || call.status === 'fit'
                                        ? 'bg-green-100'
                                        : call.status === 'connected'
                                        ? 'bg-yellow-100'
                                        : 'bg-gray-100'
                                }` } > {
                    call.status === 'scheduled' || call.status === 'fit' ? ( <
                        CheckCircleIcon className = "h-5 w-5 text-green-600" / >
                    ) : call.status === 'connected' ? ( <
                        div className = "w-2 h-2 bg-yellow-500 rounded-full" > < /div>
                    ) : ( <
                        CheckCircleIcon className = "h-5 w-5 text-gray-600" / >
                    )
                } <
                /div> <
                div >
                <
                p className = "font-medium text-gray-900" > { call.name } < /p> <
                p className = "text-sm text-gray-500" > { call.date } < /p> <
                /div> <
                /div> <
                div className = "flex items-center space-x-4" >
                <
                span className = { `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    call.emotion === 'interested'
                                        ? 'bg-green-100 text-green-800'
                                        : call.emotion === 'positive'
                                        ? 'bg-gray-100 text-gray-800'
                                        : call.emotion === 'neutral'
                                        ? 'bg-gray-100 text-gray-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                }` } > { call.emotion } <
                /span> <
                span className = { `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    call.status === 'scheduled' || call.status === 'fit'
                                        ? 'bg-green-100 text-green-800'
                                        : call.status === 'connected'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                                }` } > { call.status } <
                /span> {
                    call.csat && ( <
                        p className = "text-sm text-gray-600" > CSAT: { call.csat }
                        /5</p >
                    )
                } <
                /div> <
                /div>
            ))
        } <
        /div> <
        /div>

        { /* Emotion Distribution */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Emotion Distribution < /h3> <
        div className = "space-y-4" > {
            mockData.emotionDistribution.map((emotion, index) => ( <
                div key = { index }
                className = "flex items-center justify-between" >
                <
                span className = "text-sm font-medium text-gray-700" > { emotion.emotion } < /span> <
                div className = "flex items-center space-x-4 flex-1 mx-4" >
                <
                div className = "flex-1 bg-gray-200 rounded-full h-2" >
                <
                div className = { `h-2 rounded-full ${emotion.color}` }
                style = {
                    { width: `${emotion.percentage}%` } } >
                < /div> <
                /div> <
                span className = "text-sm text-gray-600 w-20 text-right" > { emotion.calls }
                calls({ emotion.percentage } % ) <
                /span> <
                /div> <
                /div>
            ))
        } <
        /div> <
        /div> <
        /div>
    );
};

export default Dashboard;