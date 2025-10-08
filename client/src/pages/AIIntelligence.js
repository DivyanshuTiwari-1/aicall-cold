import React from "react";
import {
    CpuChipIcon,
    ChartBarIcon,
    LightBulbIcon,
    CheckCircleIcon,
    ArrowRightIcon,
    ClockIcon
} from "@heroicons/react/24/outline";

const AIIntelligence = () => {
    const optimizations = [{
        id: 1,
        name: "recruitment_v2",
        confidence: 91,
        recommendation: "Reduce technical jargon in first 30 seconds. Use simpler language.",
        current: 22.1,
        predicted: 28.7,
        improvement: 6.6
    }];

    const patterns = [{
            pattern: "No-answer → Retry in 2h",
            success: "+34% success",
            color: "text-green-600"
        },
        {
            pattern: "Voicemail → Retry in 24h",
            success: "+28% success",
            color: "text-green-600"
        },
        {
            pattern: "Busy → Retry in 30min",
            success: "+42% success",
            color: "text-green-600"
        }
    ];

    return ( <
        div className = "space-y-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        h1 className = "text-2xl font-bold text-gray-900" > AI Intelligence & Optimization < /h1> <
        p className = "text-gray-600" > AI - powered insights and optimizations
        for your campaigns < /p> < /
        div > <
        /div>

        { /* Feature Cards */ } <
        div className = "grid grid-cols-1 md:grid-cols-3 gap-6" >
        <
        div className = "bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6" >
        <
        div className = "flex items-center mb-4" >
        <
        div className = "p-3 bg-blue-600 rounded-lg mr-4" >
        <
        svg className = "h-6 w-6 text-white"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path fillRule = "evenodd"
        d = "M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
        clipRule = "evenodd" / >
        <
        /svg> < /
        div > <
        h3 className = "text-lg font-semibold text-gray-900" > Voicemail Detection < /h3> < /
        div > <
        p className = "text-sm text-gray-700" > ML automatically detects voicemails, skips bad numbers, and optimizes call timing < /p> < /
        div >

        <
        div className = "bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6" >
        <
        div className = "flex items-center mb-4" >
        <
        div className = "p-3 bg-purple-600 rounded-lg mr-4" >
        <
        ClockIcon className = "h-6 w-6 text-white" / >
        <
        /div> <
        h3 className = "text-lg font-semibold text-gray-900" > Best Time Prediction < /h3> < /
        div > <
        p className = "text-sm text-gray-700" > AI predicts optimal calling time per contact based on historical success patterns < /p> < /
        div >

        <
        div className = "bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6" >
        <
        div className = "flex items-center mb-4" >
        <
        div className = "p-3 bg-green-600 rounded-lg mr-4" >
        <
        svg className = "h-6 w-6 text-white"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path d = "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" / >
        <
        /svg> < /
        div > <
        h3 className = "text-lg font-semibold text-gray-900" > Auto - Retry Logic < /h3> < /
        div > <
        p className = "text-sm text-gray-700" > Smart retry based on outcome: no - answer(2 h), voicemail(24 h), busy(30 min) < /p> < /
        div > <
        /div>

        { /* Script Optimization Recommendations */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4 flex items-center" >
        <
        LightBulbIcon className = "h-5 w-5 text-yellow-600 mr-2" / >
        Script Optimization Recommendations <
        /h3>

        <
        div className = "bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4" >
        <
        div className = "flex items-start justify-between mb-2" >
        <
        div >
        <
        p className = "text-sm font-medium text-yellow-800" > Script: sales_v1 < /p> <
        p className = "text-sm text-yellow-800" > Confidence: 88 % < /p> < /
        div > <
        /div> <
        p className = "text-sm text-yellow-900 mb-3" >
        Add urgency trigger in opening: 'Limited spots available this quarter' <
        /p> <
        div className = "flex items-center justify-between" >
        <
        div className = "flex items-center space-x-4" >
        <
        span className = "text-sm text-gray-600" > Current 18.5 % < /span> <
        ArrowRightIcon className = "h-4 w-4 text-gray-400" / >
        <
        span className = "text-sm text-green-600 font-medium" > Predicted 24.3 % < /span> < /
        div > <
        div className = "flex space-x-2" >
        <
        button className = "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm" >
        Apply Optimization <
        /button> <
        button className = "px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm" >
        A / B Test <
        /button> < /
        div > <
        /div> < /
        div > <
        /div>

        { /* Top Objections Handled */ } <
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

        { /* Conversion Funnel */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Conversion Funnel < /h3> <
        div className = "space-y-4" >
        <
        div className = "flex items-center justify-between" >
        <
        span className = "text-sm font-medium text-gray-700" > Total Attempts < /span> <
        div className = "flex items-center flex-1 mx-4" >
        <
        div className = "w-full bg-blue-500 rounded-full h-2" > < /div> < /
        div > <
        span className = "text-sm text-gray-600 w-20 text-right" > 1247(100 % ) < /span> < /
        div >

        <
        div className = "flex items-center justify-between" >
        <
        span className = "text-sm font-medium text-gray-700" > Connected < /span> <
        div className = "flex items-center flex-1 mx-4" >
        <
        div className = "w-2/3 bg-green-500 rounded-full h-2" > < /div> <
        div className = "w-1/3 bg-gray-200 rounded-full h-2" > < /div> < /
        div > <
        span className = "text-sm text-gray-600 w-20 text-right" > 823(66 % ) < /span> < /
        div >

        <
        div className = "flex items-center justify-between" >
        <
        span className = "text-sm font-medium text-gray-700" > Engaged < /span> <
        div className = "flex items-center flex-1 mx-4" >
        <
        div className = "w-1/3 bg-purple-500 rounded-full h-2" > < /div> <
        div className = "w-2/3 bg-gray-200 rounded-full h-2" > < /div> < /
        div > <
        span className = "text-sm text-gray-600 w-20 text-right" > 456(37 % ) < /span> < /
        div >

        <
        div className = "flex items-center justify-between" >
        <
        span className = "text-sm font-medium text-gray-700" > Qualified < /span> <
        div className = "flex items-center flex-1 mx-4" >
        <
        div className = "w-1/5 bg-orange-500 rounded-full h-2" > < /div> <
        div className = "w-4/5 bg-gray-200 rounded-full h-2" > < /div> < /
        div > <
        span className = "text-sm text-gray-600 w-20 text-right" > 234(19 % ) < /span> < /
        div >

        <
        div className = "flex items-center justify-between" >
        <
        span className = "text-sm font-medium text-gray-700" > Converted < /span> <
        div className = "flex items-center flex-1 mx-4" >
        <
        div className = "w-1/8 bg-red-500 rounded-full h-2" > < /div> <
        div className = "w-7/8 bg-gray-200 rounded-full h-2" > < /div> < /
        div > <
        span className = "text-sm text-gray-600 w-20 text-right" > 156(13 % ) < /span> < /
        div > <
        /div> < /
        div > <
        /div>
    );
};

export default AIIntelligence;