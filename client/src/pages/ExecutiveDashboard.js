import React from "react";
import {
  ArrowDownTrayIcon,
  CurrencyDollarIcon,
  ChartPieIcon,
  ChartBarIcon,
  HandThumbUpIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

const ExecutiveDashboard = () => {
  const metrics = [
    {
      title: "Total Revenue Impact",
      value: "₹12.4L",
      description: "From qualified leads",
      change: "+34%",
      changeColor: "text-green-600",
      icon: CurrencyDollarIcon,
      iconColor: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Cost Efficiency",
      value: "₹3.2",
      description: "Per qualified lead",
      change: "-18%",
      changeColor: "text-blue-600",
      icon: ChartPieIcon,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Campaign ROI",
      value: "580%",
      description: "Average return",
      change: "+12%",
      changeColor: "text-purple-600",
      icon: ChartBarIcon,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Customer Satisfaction",
      value: "4.2/5",
      description: "Avg CSAT score",
      change: "+0.4",
      changeColor: "text-orange-600",
      icon: HandThumbUpIcon,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  const conversionFunnel = [
    { stage: "Total Attempts", value: 1247, percentage: 100, color: "bg-blue-500" },
    { stage: "Connected", value: 823, percentage: 66, color: "bg-green-500" },
    { stage: "Engaged", value: 456, percentage: 37, color: "bg-purple-500" },
    { stage: "Qualified", value: 234, percentage: 19, color: "bg-orange-500" },
    { stage: "Converted", value: 156, percentage: 13, color: "bg-red-500" },
  ];

  const recentCalls = [
    {
      name: "Rahul Sharma",
      emotion: "interested",
      date: "2025-10-02 14:23",
      status: "scheduled",
      csat: 4.5,
      bgColor: "bg-green-50",
    },
    {
      name: "Priya Patel",
      emotion: "positive",
      date: "2025-10-02 14:18",
      status: "fit",
      csat: 4.8,
      bgColor: "bg-white",
    },
    {
      name: "John Davis",
      emotion: "neutral",
      date: "2025-10-02 14:30",
      status: "connected",
      csat: null,
      bgColor: "bg-white",
    },
    {
      name: "Sneha Kumar",
      emotion: "confused",
      date: "2025-10-02 14:12",
      status: "not_fit",
      csat: 3.2,
      bgColor: "bg-white",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Export Report
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div key={idx} className={`${metric.bgColor} rounded-lg p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-white">
                  <Icon className={`h-6 w-6 ${metric.iconColor}`} />
                </div>
                <span className={`text-sm font-medium ${metric.changeColor}`}>{metric.change}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{metric.title}</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">{metric.value}</p>
              <p className="text-sm text-gray-600">{metric.description}</p>
            </div>
          );
        })}
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
        <div className="space-y-4">
          {conversionFunnel.map((stage, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 w-32">{stage.stage}</span>
              <div className="flex items-center flex-1 mx-4">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${stage.color}`} style={{ width: `${stage.percentage}%` }}></div>
                </div>
              </div>
              <span className="text-sm text-gray-600 w-20 text-right">
                {stage.value} ({stage.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Calls with Emotions</h3>
          <div className="space-y-3">
            {recentCalls.map((call, idx) => (
              <div key={idx} className={`flex items-center justify-between p-4 rounded-lg ${call.bgColor}`}>
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      call.status === "scheduled" || call.status === "fit"
                        ? "bg-green-100"
                        : call.status === "connected"
                        ? "bg-yellow-100"
                        : "bg-gray-100"
                    }`}
                  >
                    {call.status === "scheduled" || call.status === "fit" ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : call.status === "connected" ? (
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{call.name}</p>
                    <p className="text-sm text-gray-500">{call.date}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      call.emotion === "interested"
                        ? "bg-green-100 text-green-800"
                        : call.emotion === "positive"
                        ? "bg-gray-100 text-gray-800"
                        : call.emotion === "neutral"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {call.emotion}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      call.status === "scheduled" || call.status === "fit"
                        ? "bg-green-100 text-green-800"
                        : call.status === "connected"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {call.status}
                  </span>
                  {call.csat && (
                    <p className="text-sm text-gray-600">
                      CSAT: {call.csat}/5
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost Per Qualified Lead */}
      <div className="bg-green-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <CurrencyDollarIcon className="h-5 w-5 mr-2" />
          Cost Per Qualified Lead
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600">Cost / Lead</p>
            <p className="text-2xl font-bold text-green-600">₹3.2</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Credits Used</p>
            <p className="text-2xl font-bold text-blue-600">2,584</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Conversion Rate</p>
            <p className="text-2xl font-bold text-purple-600">18.9%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Projected ROI</p>
            <p className="text-2xl font-bold text-green-600">580%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
