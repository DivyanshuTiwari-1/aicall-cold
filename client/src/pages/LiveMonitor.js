import React from "react";
import {
    PhoneIcon,
    ChartBarIcon,
    UserIcon,
    PlayIcon,
    PauseIcon,
    StopIcon,
    ExclamationTriangleIcon,
    CalendarIcon
} from "@heroicons/react/24/outline";

const LiveMonitor = () => {
    const liveCalls = [{
            id: "call-1",
            contact: "Alice Johnson",
            campaign: "Q4 Sales Outreach",
            status: "active",
            duration: "0:45",
            emotion: "neutral",
            sentiment: "positive",
            intent: "product_inquiry",
            transcriptSnippet: "Agent: ...and how can I help you today? Alice: I'm interested in your new software features."
        },
        {
            id: "call-2",
            contact: "Bob Smith",
            campaign: "Developer Screening",
            status: "active",
            duration: "1:23",
            emotion: "interested",
            sentiment: "positive",
            intent: "scheduling",
            transcriptSnippet: "Agent: What's your experience with React? Bob: I've been using it for 3 years..."
        }
    ];

    return ( <
        div className = "space-y-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        h1 className = "text-2xl font-bold text-gray-900" > Live Call Monitor < /h1> <
        p className = "text-gray-600" > Monitor active calls in real - time and gain instant insights < /p> < /
        div > <
        div className = "flex items-center space-x-2" >
        <
        div className = "flex items-center text-red-600" >
        <
        div className = "w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" > < /div> <
        span className = "text-sm font-medium" > Live < /span> < /
        div > <
        /div> < /
        div >

        { /* Action Buttons */ } <
        div className = "flex items-center space-x-4" >
        <
        button className = "flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700" >
        <
        svg className = "h-4 w-4 mr-2"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path fillRule = "evenodd"
        d = "M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z"
        clipRule = "evenodd" / >
        <
        /svg>
        Whisper Mode <
        /button> <
        button className = "flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700" >
        <
        PhoneIcon className = "h-4 w-4 mr-2" / >
        Join Call <
        /button> <
        button className = "flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" >
        <
        StopIcon className = "h-4 w-4 mr-2" / >
        End <
        /button> < /
        div >

        { /* Live Transcript */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Live Transcript < /h3> <
        div className = "space-y-4 max-h-96 overflow-y-auto" >
        <
        div className = "flex justify-start" >
        <
        div className = "bg-gray-100 rounded-lg p-3 max-w-xs" >
        <
        div className = "flex items-center justify-between mb-1" >
        <
        span className = "text-xs text-gray-500" > AI < /span> <
        span className = "text-xs text-gray-500" > 14: 30: 05 < /span> < /
        div > <
        p className = "text-sm text-gray-900" > Hi Rahul, this is an automated call from TechCorp about our cloud solutions.Do you consent to
        continue ? < /p> <
        div className = "mt-1" >
        <
        span className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" >
        professional <
        /span> < /
        div > <
        /div> < /
        div >

        <
        div className = "flex justify-end" >
        <
        div className = "bg-green-100 rounded-lg p-3 max-w-xs" >
        <
        div className = "flex items-center justify-between mb-1" >
        <
        span className = "text-xs text-gray-500" > Contact < /span> <
        span className = "text-xs text-gray-500" > 14 : 30: 12 < /span> < /
        div > <
        p className = "text-sm text-gray-900" > Yes, go ahead. < /p> <
        div className = "mt-1" >
        <
        span className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800" >
        neutral <
        /span> < /
        div > <
        /div> < /
        div >

        <
        div className = "flex justify-start" >
        <
        div className = "bg-gray-100 rounded-lg p-3 max-w-xs" >
        <
        div className = "flex items-center justify-between mb-1" >
        <
        span className = "text-xs text-gray-500" > AI < /span> <
        span className = "text-xs text-gray-500" > 14: 30: 14 < /span> < /
        div > <
        p className = "text-sm text-gray-900" > Great!Are you the right person to discuss cloud infrastructure
        for your company ? < /p> <
        div className = "mt-1" >
        <
        span className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" >
        warm <
        /span> < /
        div > <
        /div> < /
        div >

        <
        div className = "flex justify-end" >
        <
        div className = "bg-green-100 rounded-lg p-3 max-w-xs" >
        <
        div className = "flex items-center justify-between mb-1" >
        <
        span className = "text-xs text-gray-500" > Contact < /span> <
        span className = "text-xs text-gray-500" > 14 : 30: 20 < /span> < /
        div > <
        p className = "text-sm text-gray-900" > Yes, I handle our IT infrastructure.We 're currently using Competitor X.</p> <
        div className = "mt-1" >
        <
        span className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" >
        interested <
        /span> < /
        div > <
        /div> < /
        div > <
        /div> < /
        div >

        { /* Pop-up Objection Handler */ } <
        div className = "bg-orange-50 border border-orange-200 rounded-lg p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4 flex items-center" >
        <
        svg className = "h-5 w-5 text-orange-600 mr-2"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path fillRule = "evenodd"
        d = "M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
        clipRule = "evenodd" / >
        <
        /svg>
        Pop - up Objection Handler <
        /h3>

        <
        div className = "bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4" >
        <
        div className = "flex items-center" >
        <
        ExclamationTriangleIcon className = "h-5 w-5 text-yellow-600 mr-2" / >
        <
        span className = "font-medium text-yellow-800" > Competitor X mentioned < /span> < /
        div > <
        /div>

        <
        div className = "mb-4" >
        <
        p className = "text-sm font-medium text-gray-900 mb-2" > Suggested Response: < /p> <
        p className = "text-sm text-gray-700 mb-2" >
        "Our solution offers 40% better performance with 30% lower costs. Would you like to see a side-by-side comparison?" <
        /p> <
        div className = "flex items-center justify-between" >
        <
        span className = "text-sm text-gray-600" > Confidence: 92 % < /span> < /
        div > <
        /div>

        <
        div className = "flex space-x-3" >
        <
        button className = "px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700" >
        Use This Response <
        /button> <
        button className = "px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg" >
        Modify <
        /button> < /
        div > <
        /div>

        { /* AI Analysis Cards */ } <
        div className = "grid grid-cols-1 lg:grid-cols-2 gap-6" > { /* AI Agent Notes */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4 flex items-center" >
        <
        svg className = "h-5 w-5 mr-2"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path fillRule = "evenodd"
        d = "M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule = "evenodd" / >
        <
        /svg>
        AI Agent Notes(Live) <
        /h3> <
        div className = "bg-blue-50 rounded-lg p-4" >
        <
        div className = "flex items-center justify-between mb-2" >
        <
        span className = "text-sm text-gray-600" > 14: 30: 22 < /span> <
        svg className = "h-4 w-4 text-blue-600"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path d = "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" / >
        <
        /svg> < /
        div > <
        p className = "text-sm text-gray-900" > AI detected high intent - competitor comparison opportunity < /p> < /
        div > <
        /div>

        { /* Call Information */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Call Information < /h3> <
        div className = "space-y-3" >
        <
        div className = "flex justify-between" >
        <
        span className = "text-sm text-gray-600" > Contact: < /span> <
        span className = "text-sm font-medium text-gray-900" > Rahul Sharma < /span> < /
        div > <
        div className = "flex justify-between" >
        <
        span className = "text-sm text-gray-600" > Campaign: < /span> <
        span className = "text-sm font-medium text-gray-900" > Q4 Sales Outreach < /span> < /
        div > <
        div className = "flex justify-between" >
        <
        span className = "text-sm text-gray-600" > Duration: < /span> <
        span className = "text-sm font-medium text-gray-900" > 2 m 42 s < /span> < /
        div > <
        /div> < /
        div >

        { /* Real-time Emotion Detection */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Real - time Emotion Detection < /h3> <
        div className = "text-center" >
        <
        div className = "relative w-32 h-32 mx-auto mb-4" >
        <
        svg className = "w-32 h-32 transform -rotate-90"
        viewBox = "0 0 100 100" >
        <
        circle cx = "50"
        cy = "50"
        r = "45"
        stroke = "#e5e7eb"
        strokeWidth = "8"
        fill = "none" /
        >
        <
        circle cx = "50"
        cy = "50"
        r = "45"
        stroke = "#10b981"
        strokeWidth = "8"
        fill = "none"
        strokeDasharray = { `${2 * Math.PI * 45 * 0.82} ${2 * Math.PI * 45}` }
        strokeLinecap = "round" /
        >
        <
        /svg> <
        div className = "absolute inset-0 flex items-center justify-center" >
        <
        div className = "text-center" >
        <
        div className = "text-2xl font-bold text-gray-900" > 82 % < /div> <
        div className = "text-sm text-gray-600" > Interested < /div> < /
        div > <
        /div> < /
        div > <
        div className = "w-full bg-gray-200 rounded-full h-2 mb-2" >
        <
        div className = "bg-green-500 h-2 rounded-full"
        style = {
            { width: '82%' }
        } > < /div> < /
        div > <
        p className = "text-sm text-gray-600" > AI adjusting tone to match interest < /p> < /
        div > <
        /div>

        { /* Intent Detection */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Intent Detection < /h3> <
        div >
        <
        p className = "text-sm font-medium text-gray-900 mb-2" > Purchase Intent < /p> <
        div className = "flex items-center justify-between mb-2" >
        <
        div className = "flex-1 bg-gray-200 rounded-full h-2 mr-4" >
        <
        div className = "bg-blue-600 h-2 rounded-full"
        style = {
            { width: '82%' }
        } > < /div> < /
        div > <
        span className = "text-sm font-medium text-gray-900" > 82 % < /span> < /
        div > <
        div className = "bg-yellow-50 border border-yellow-200 rounded-lg p-3" >
        <
        div className = "flex items-center" >
        <
        svg className = "h-4 w-4 text-yellow-600 mr-2"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path fillRule = "evenodd"
        d = "M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
        clipRule = "evenodd" / >
        <
        /svg> <
        span className = "text-sm text-yellow-800 font-medium" > High intent detected - Ready
        for handoff < /span> < /
        div > <
        /div> < /
        div > <
        /div> < /
        div >

        { /* Competitive Intel and Quick Actions */ } <
        div className = "grid grid-cols-1 lg:grid-cols-2 gap-6" > { /* Competitive Intel */ } <
        div className = "bg-white rounded-lg shadow-sm p-6 border border-pink-200" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4 flex items-center" >
        <
        svg className = "h-5 w-5 mr-2 text-pink-600"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path fillRule = "evenodd"
        d = "M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule = "evenodd" / >
        <
        /svg>
        Competitive Intel <
        /h3>

        <
        div className = "bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4" >
        <
        div className = "flex items-center" >
        <
        ExclamationTriangleIcon className = "h-5 w-5 text-yellow-600 mr-2" / >
        <
        span className = "font-medium text-yellow-800" > Competitor Mentioned: Competitor X < /span> < /
        div > <
        /div>

        <
        div className = "space-y-2 mb-4" >
        <
        p className = "text-sm text-gray-700" > •Their pricing: $199 / month < /p> <
        p className = "text-sm text-gray-700" > •Our advantage: 40 % faster performance < /p> <
        p className = "text-sm text-gray-700" > •Common pain point: Poor support < /p> < /
        div >

        <
        button className = "w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" >
        View Full Battle Card <
        /button> < /
        div >

        { /* Quick Actions */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Quick Actions < /h3> <
        div className = "space-y-3" >
        <
        button className = "w-full flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50" >
        <
        CalendarIcon className = "h-5 w-5 text-gray-600 mr-3" / >
        <
        span className = "text-sm text-gray-700" > Schedule Meeting < /span> < /
        button > <
        button className = "w-full flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50" >
        <
        svg className = "h-5 w-5 text-gray-600 mr-3"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path fillRule = "evenodd"
        d = "M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule = "evenodd" / >
        <
        /svg> <
        span className = "text-sm text-gray-700" > Add Note < /span> < /
        button > <
        button className = "w-full flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50" >
        <
        svg className = "h-5 w-5 text-gray-600 mr-3"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path fillRule = "evenodd"
        d = "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule = "evenodd" / >
        <
        /svg> <
        span className = "text-sm text-gray-700" > Flag
        for Review < /span> < /
        button > <
        /div> < /
        div > <
        /div> < /
        div >
    );
};

export default LiveMonitor;