import React, { useState } from "react";
import {
    ShieldCheckIcon,
    ArrowUpIcon,
    CheckCircleIcon,
    XCircleIcon
} from "@heroicons/react/24/outline";

const Compliance = () => {
    const [dncRecords] = useState([{
        id: 1,
        phone: "+91-98xxx-xxxxx",
        addedDate: "2025-09-28",
        reason: "User requested"
    }]);

    return ( <
        div className = "space-y-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        h1 className = "text-2xl font-bold text-gray-900" > Compliance & DNC Management < /h1> < /
        div > <
        button className = "flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" >
        <
        ArrowUpIcon className = "h-4 w-4 mr-2" / >
        Add to DNC <
        /button> < /
        div >

        { /* Compliance Metrics */ } <
        div className = "grid grid-cols-1 md:grid-cols-3 gap-6" >
        <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        p className = "text-sm font-medium text-gray-500" > Consent Rate < /p> <
        p className = "text-3xl font-bold text-green-600" > 94.2 % < /p> < /
        div > <
        div className = "p-3 bg-green-50 rounded-lg" >
        <
        CheckCircleIcon className = "h-8 w-8 text-green-600" / >
        <
        /div> < /
        div > <
        /div>

        <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        p className = "text-sm font-medium text-gray-500" > DNC List Size < /p> <
        p className = "text-3xl font-bold text-red-600" > 2 < /p> < /
        div > <
        div className = "p-3 bg-red-50 rounded-lg" >
        <
        XCircleIcon className = "h-8 w-8 text-red-600" / >
        <
        /div> < /
        div > <
        /div>

        <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        p className = "text-sm font-medium text-gray-500" > Blocked Calls < /p> <
        p className = "text-3xl font-bold text-orange-600" > 127 < /p> < /
        div > <
        div className = "p-3 bg-orange-50 rounded-lg" >
        <
        ShieldCheckIcon className = "h-8 w-8 text-orange-600" / >
        <
        /div> < /
        div > <
        /div> < /
        div >

        { /* Consent Script Template */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Consent Script Template < /h3> <
        div className = "bg-gray-50 rounded-lg p-4 mb-4" >
        <
        p className = "text-sm text-gray-900 font-mono" >
        "Hi {`{{first_name}}`}, this is an automated call from {`{{company}}`} about {`{{topic}}`}. By continuing, you consent to this automated call. If you do not wish to be contacted, say 'Stop' or 'Remove me'." <
        /p> < /
        div > <
        div className = "flex items-center text-green-600" >
        <
        CheckCircleIcon className = "h-5 w-5 mr-2" / >
        <
        span className = "text-sm font-medium" > GDPR & DPDP Compliant < /span> < /
        div > <
        /div>

        { /* Recent Audit Events */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Recent Audit Events < /h3> <
        div className = "space-y-3" >
        <
        div className = "flex items-center justify-between p-3 bg-gray-50 rounded-lg" >
        <
        div className = "flex items-center" >
        <
        div className = "w-3 h-3 bg-green-500 rounded-full mr-3" > < /div> <
        span className = "text-sm text-gray-900" > Consent logged
        for +91 - 98 xxx - xxxxx < /span> < /
        div > <
        span className = "text-sm text-gray-500" > 2 hours ago < /span> < /
        div > <
        div className = "flex items-center justify-between p-3 bg-gray-50 rounded-lg" >
        <
        div className = "flex items-center" >
        <
        div className = "w-3 h-3 bg-red-500 rounded-full mr-3" > < /div> <
        span className = "text-sm text-gray-900" > Number added to DNC: +1 - 555 - xxx - xxxx < /span> < /
        div > <
        span className = "text-sm text-gray-500" > 5 hours ago < /span> < /
        div > <
        /div> < /
        div >

        { /* Do Not Call Registry */ } <
        div className = "bg-white rounded-lg shadow-sm p-6" >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-4" > Do Not Call(DNC) Registry < /h3> <
        div className = "overflow-x-auto" >
        <
        table className = "min-w-full divide-y divide-gray-200" >
        <
        thead className = "bg-gray-50" >
        <
        tr >
        <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" >
        PHONE NUMBER <
        /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" >
        ADDED DATE <
        /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" >
        REASON <
        /th> <
        th className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" >
        ACTIONS <
        /th> < /
        tr > <
        /thead> <
        tbody className = "bg-white divide-y divide-gray-200" > {
            dncRecords.map((record) => ( <
                tr key = { record.id }
                className = "hover:bg-gray-50" >
                <
                td className = "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" > { record.phone } <
                /td> <
                td className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900" > { record.addedDate } <
                /td> <
                td className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900" > { record.reason } <
                /td> <
                td className = "px-6 py-4 whitespace-nowrap text-sm font-medium" >
                <
                button className = "text-red-600 hover:text-red-900" >
                Remove <
                /button> < /
                td > <
                /tr>
            ))
        } <
        /tbody> < /
        table > <
        /div> < /
        div > <
        /div>
    );
};

export default Compliance;