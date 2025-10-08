import React from "react";
import { Bars3Icon, Cog6ToothIcon } from "@heroicons/react/24/outline";

const Header = ({ onMenuClick }) => {
    return ( <
        header className = "bg-white shadow-sm border-b border-gray-200" >
        <
        div className = "flex items-center justify-between h-16 px-6" >
        <
        div className = "flex items-center" >
        <
        button onClick = { onMenuClick }
        className = "lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100" >
        <
        Bars3Icon className = "h-6 w-6" / >
        <
        /button>

        { /* Logo and Brand */ } <
        div className = "flex items-center ml-4" >
        <
        div className = "flex items-center" >
        <
        div className = "w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3" >
        <
        svg className = "w-5 h-5 text-white"
        fill = "currentColor"
        viewBox = "0 0 20 20" >
        <
        path d = "M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" / >
        <
        /svg> <
        /div> <
        div >
        <
        h1 className = "text-xl font-bold text-gray-900" > AI Dialer Pro < /h1> <
        p className = "text-sm text-gray-500" > Emotion - Aware Voice Intelligence < /p> <
        /div> <
        /div> <
        /div> <
        /div>

        { /* Status Metrics */ } <
        div className = "flex items-center space-x-6" >
        <
        div className = "text-right" >
        <
        p className = "text-sm text-gray-500" > Credits Remaining < /p> <
        p className = "text-lg font-semibold text-blue-600" > 8, 450 < /p> <
        /div> <
        div className = "text-right" >
        <
        p className = "text-sm text-gray-500" > Avg CSAT < /p> <
        p className = "text-lg font-semibold text-green-600" > 4.2 / 5.0 < /p> <
        /div> <
        button className = "p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100" >
        <
        Cog6ToothIcon className = "h-6 w-6" / >
        <
        /button> <
        /div> <
        /div> <
        /header>
    );
};

export default Header;