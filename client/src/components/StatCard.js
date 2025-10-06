import React from "react";

const StatCard = ({ title, value, icon: Icon, color, change }) => {
    const colorClasses = {
        blue: "text-blue-600 bg-blue-50",
        green: "text-green-600 bg-green-50",
        purple: "text-purple-600 bg-purple-50",
        orange: "text-orange-600 bg-orange-50",
        red: "text-red-600 bg-red-50",
    };

    return (
        <div className="card">
            <div className="flex items-center">
                <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="h-6 w-6" />
                </div>{" "}
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500"> {title} </p>{" "}
                    <p className="text-2xl font-semibold text-gray-900"> {value} </p>{" "}
                    {change && <p className="text-sm text-gray-600"> {change} </p>}{" "}
                </div>{" "}
            </div>{" "}
        </div>
    );
};

export default StatCard;
