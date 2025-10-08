import React from "react";
import {
    PlusIcon,
    PlayIcon,
    PauseIcon,
    ClockIcon
} from "@heroicons/react/24/outline";

const Campaigns = () => {
    const campaigns = [{
            id: 1,
            name: "Q4 Sales Outreach",
            type: "Sales Outreach",
            status: "active",
            features: ["Auto-Retry", "Smart Timing"],
            metrics: {
                totalLeads: 500,
                completed: 234,
                scheduled: 150,
                voicePersona: "professional",
                creditsUsed: 1872
            },
            progress: 45,
            actions: ["play", "pause"]
        },
        {
            id: 2,
            name: "Developer Screening",
            type: "Recruitment Screening",
            status: "active",
            features: ["Auto-Retry"],
            metrics: {
                totalLeads: 150,
                completed: 89,
                scheduled: 45,
                voicePersona: "empathetic",
                creditsUsed: 712
            },
            progress: 60,
            actions: ["play", "pause"]
        }
    ];

    return ( <
            div className = "space-y-6" >
            <
            div className = "flex items-center justify-between" >
            <
            div >
            <
            h1 className = "text-2xl font-bold text-gray-900" > Campaigns < /h1> < /
            div > <
            button className = "flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" >
            <
            PlusIcon className = "h-4 w-4 mr-2" / >
            Create Campaign <
            /button> < /
            div >

            { /* Campaign Cards */ } <
            div className = "grid grid-cols-1 lg:grid-cols-2 gap-6" > {
                campaigns.map((campaign) => ( <
                        div key = { campaign.id }
                        className = "bg-gray-50 rounded-lg p-6 border border-gray-200" >
                        <
                        div className = "flex items-start justify-between mb-4" >
                        <
                        div className = "flex-1" >
                        <
                        h3 className = "text-lg font-semibold text-gray-900 mb-2" > { campaign.name } < /h3> <
                        div className = "flex flex-wrap gap-2 mb-3" >
                        <
                        span className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800" > { campaign.type } <
                        /span> <
                        span className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800" > { campaign.status } <
                        /span> {
                        campaign.features.map((feature, index) => ( <
                            span key = { index }
                            className = { `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            feature === 'Auto-Retry'
                                                ? 'bg-purple-100 text-purple-800'
                                                : 'bg-orange-100 text-orange-800'
                                        }` } > { feature } <
                            /span>
                        ))
                    } <
                    /div> < /
                    div > <
                    div className = "flex items-center space-x-2" >
                    <
                    button className = "p-2 text-green-600 hover:bg-green-100 rounded-lg" >
                    <
                    PlayIcon className = "h-5 w-5" / >
                    <
                    /button> <
                    button className = "p-2 text-orange-600 hover:bg-orange-100 rounded-lg" >
                    <
                    PauseIcon className = "h-5 w-5" / >
                    <
                    /button> < /
                    div > <
                    /div>

                    { /* Metrics Grid */ } <
                    div className = "grid grid-cols-2 gap-4 mb-4" >
                    <
                    div >
                    <
                    p className = "text-sm text-gray-600" > Total Leads < /p> <
                    p className = "text-lg font-semibold text-gray-900" > { campaign.metrics.totalLeads } < /p> < /
                    div > <
                    div >
                    <
                    p className = "text-sm text-gray-600" > Completed < /p> <
                    p className = "text-lg font-semibold text-green-600" > { campaign.metrics.completed } < /p> < /
                    div > <
                    div >
                    <
                    p className = "text-sm text-gray-600" > Scheduled < /p> <
                    p className = "text-lg font-semibold text-blue-600" > { campaign.metrics.scheduled } < /p> < /
                    div > <
                    div >
                    <
                    p className = "text-sm text-gray-600" > Voice Persona < /p> <
                    p className = "text-lg font-semibold text-purple-600" > { campaign.metrics.voicePersona } < /p> < /
                    div > <
                    /div>

                    { /* Progress Bar */ } <
                    div className = "mb-4" >
                    <
                    div className = "flex items-center justify-between text-sm text-gray-600 mb-1" >
                    <
                    span > Progress < /span> <
                    span > { Math.round((campaign.metrics.completed / campaign.metrics.totalLeads) * 100) } % < /span> < /
                    div > <
                    div className = "w-full bg-gray-200 rounded-full h-2" >
                    <
                    div className = "bg-blue-600 h-2 rounded-full"
                    style = {
                        { width: `${campaign.progress}%` }
                    } >
                    <
                    /div> < /
                    div > <
                    /div>

                    { /* Credits Used */ } <
                    div className = "flex items-center justify-between" >
                    <
                    span className = "text-sm text-gray-600" > Credits Used < /span> <
                    span className = "text-sm font-semibold text-orange-600" > { campaign.metrics.creditsUsed } < /span> < /
                    div > <
                    /div>
                ))
        } <
        /div>

    { /* Additional Analytics Sections */ } <
    div className = "grid grid-cols-1 lg:grid-cols-2 gap-6" > { /* Top Objections Handled */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Top Objections Handled < /h3> <
    div className = "space-y-4" > {
            [
                { objection: "Price concerns", frequency: 89, resolved: 76 },
                { objection: "Timing issues", frequency: 67, resolved: 82 },
                { objection: "Feature gaps", frequency: 45, resolved: 68 },
                { objection: "Competitor comparison", frequency: 34, resolved: 71 }
            ].map((item, index) => ( <
                div key = { index }
                className = "space-y-2" >
                <
                div className = "flex items-center justify-between" >
                <
                span className = "text-sm font-medium text-gray-900" > { item.objection } < /span> <
                span className = "text-sm text-gray-600" > { item.frequency }
                times < /span> < /
                div > <
                div className = "flex items-center justify-between" >
                <
                div className = "flex-1 bg-gray-200 rounded-full h-2 mr-4" >
                <
                div className = "bg-blue-600 h-2 rounded-full"
                style = {
                    { width: `${item.resolved}%` }
                } >
                <
                /div> < /
                div > <
                span className = "text-sm font-medium text-blue-600" > { item.resolved } % resolved < /span> < /
                div > <
                /div>
            ))
        } <
        /div> < /
        div >

        { /* Best Time to Call */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4 flex items-center" >
        <
        ClockIcon className = "h-5 w-5 text-purple-600 mr-2" / >
        Best Time to Call(Success Rate) <
        /h3> <
    div className = "space-y-4" > {
            [
                { time: "10:00 AM - 11:00 AM", calls: 142, success: 78 },
                { time: "2:00 PM - 3:00 PM", calls: 189, success: 72 },
                { time: "11:00 AM - 12:00 PM", calls: 156, success: 68 },
                { time: "4:00 PM - 5:00 PM", calls: 98, success: 54 },
                { time: "9:00 AM - 10:00 AM", calls: 67, success: 48 }
            ].map((item, index) => ( <
                div key = { index }
                className = "space-y-2" >
                <
                div className = "flex items-center justify-between" >
                <
                div className = "flex items-center" >
                <
                ClockIcon className = "h-4 w-4 text-gray-400 mr-2" / >
                <
                span className = "text-sm font-medium text-gray-900" > { item.time } < /span> < /
                div > <
                span className = "text-sm text-gray-600" > { item.calls }
                calls < /span> < /
                div > <
                div className = "flex items-center justify-between" >
                <
                div className = "flex-1 bg-gray-200 rounded-full h-2 mr-4" >
                <
                div className = "bg-purple-600 h-2 rounded-full"
                style = {
                    { width: `${item.success}%` }
                } >
                <
                /div> < /
                div > <
                span className = "text-sm font-medium text-purple-600" > { item.success } % < /span> < /
                div > <
                /div>
            ))
        } <
        /div> <
    div className = "mt-4 bg-purple-50 rounded-lg p-3" >
        <
        p className = "text-sm text-purple-800" >
        <
        span className = "font-medium" > AI Insight: < /span> Scheduling calls between 10-11 AM increases success rate by 32% < /
        p > <
        /div> < /
        div > <
        /div> < /
        div >
);
};

export default Campaigns;