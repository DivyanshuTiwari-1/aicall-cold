import React, { useState } from "react";
import {
    BookOpenIcon,
    CloudArrowUpIcon,
    ExclamationTriangleIcon,
    Cog6ToothIcon
} from "@heroicons/react/24/outline";

const KnowledgeBase = () => {
    const [faqs] = useState([{
            id: 1,
            category: "Product",
            confidence: 95,
            used: 234,
            question: "What is your pricing?",
            answer: "Our pricing starts at $99/month for the basic plan.",
            progress: 95
        },
        {
            id: 2,
            category: "Company",
            confidence: 98,
            used: 189,
            question: "Where are you located?",
            answer: "We have offices in Mumbai and San Francisco.",
            progress: 98
        },
        {
            id: 3,
            category: "Support",
            confidence: 92,
            used: 156,
            question: "What is your support hours?",
            answer: "We provide 24/7 support via email and chat.",
            progress: 92
        }
    ]);

    return ( <
        div className = "space-y-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        h1 className = "text-2xl font-bold text-gray-900" > Knowledge Base < /h1> <
        /div> <
        button className = "flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" >
        <
        CloudArrowUpIcon className = "h-4 w-4 mr-2" / >
        Upload FAQs <
        /button> <
        /div>

        { /* AI Hallucination Guard */ } <
        div className = "bg-blue-50 border border-blue-200 rounded-lg p-6" >
        <
        div className = "flex items-start" >
        <
        ExclamationTriangleIcon className = "h-6 w-6 text-blue-600 mr-3 mt-1" / >
        <
        div >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-2" > AI Hallucination Guard < /h3> <
        p className = "text-gray-700" >
        When the AI 's confidence is below 60%, it will automatically say: "I'
        ll get a colleague to share exact details - can I schedule a quick callback ? " <
        /p> <
        /div> <
        /div> <
        /div>

        { /* FAQ Cards */ } <
        div className = "space-y-4" > {
            faqs.map((faq) => ( <
                div key = { faq.id }
                className = "bg-white rounded-lg shadow-sm p-6" >
                <
                div className = "flex items-start justify-between mb-4" >
                <
                div className = "flex items-center space-x-4" >
                <
                span className = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800" > { faq.category } <
                /span> <
                div className = "text-sm text-gray-600" >
                <
                span className = "font-medium" > Confidence: { faq.confidence } % < /span> <
                span className = "mx-2" > • < /span> <
                span > Used { faq.used }
                times < /span> <
                /div> <
                /div> <
                button className = "p-2 text-gray-400 hover:text-gray-600" >
                <
                Cog6ToothIcon className = "h-5 w-5" / >
                <
                /button> <
                /div>

                <
                div className = "mb-4" >
                <
                h3 className = "text-lg font-semibold text-gray-900 mb-2" > { faq.question } < /h3> <
                p className = "text-gray-700" > { faq.answer } < /p> <
                /div>

                <
                div className = "flex items-center justify-between" >
                <
                div className = "flex-1 bg-gray-200 rounded-full h-2 mr-4" >
                <
                div className = "bg-green-500 h-2 rounded-full"
                style = {
                    { width: `${faq.progress}%` } } >
                < /div> <
                /div> <
                span className = "text-sm text-gray-600" > { faq.progress } % < /span> <
                /div> <
                /div>
            ))
        } <
        /div> <
        /div>
    );
};

export default KnowledgeBase;