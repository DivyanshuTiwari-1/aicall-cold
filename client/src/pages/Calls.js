import React from "react";
import { useQuery } from "react-query";
import { ArrowDownTrayIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import api from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";

const Calls = () => {
  const { data: calls, isLoading, error } = useQuery("calls", () =>
    api.get("/calls").then((res) => res.data)
  );

  if (isLoading) return <LoadingSpinner />;

  if (error)
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load calls data</p>
      </div>
    );

  // Mock data for demonstration - replace with actual calls data
  const mockCalls = [
    {
      id: 1,
      contact: { firstName: "Rahul", lastName: "Sharma", phone: "+91-98xxx-XXXXX" },
      campaign: "Q4 Sales Outreach",
      emotion: "interested",
      outcome: "scheduled",
      score: 85,
      bestTime: "10:00 AM - 11:00 AM",
      csat: 4.5,
    },
    {
      id: 2,
      contact: { firstName: "Priya", lastName: "Patel", phone: "+91-97xxx-XXXXX" },
      campaign: "Developer Screening",
      emotion: "positive",
      outcome: "fit",
      score: 78,
      bestTime: "2:00 PM - 3:00 PM",
      csat: 4.8,
    },
    {
      id: 3,
      contact: { firstName: "John", lastName: "Davis", phone: "+1-555-xxx-XXXX" },
      campaign: "Q4 Sales Outreach",
      emotion: "neutral",
      outcome: "connected",
      score: 62,
      bestTime: "N/A",
      csat: null,
    },
    {
      id: 4,
      contact: { firstName: "Sneha", lastName: "Kumar", phone: "+91-96xxx-XXXXX" },
      campaign: "Developer Screening",
      emotion: "confused",
      outcome: "not_fit",
      score: 32,
      bestTime: "11:00 AM - 12:00 PM",
      csat: 3.2,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call History</h1>
        </div>
        <button className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Export
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search by contact name..."
          />
        </div>
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
          <option>All Outcomes</option>
          <option>Scheduled</option>
          <option>Fit</option>
          <option>Connected</option>
          <option>Not Fit</option>
        </select>
      </div>

      {/* Call History Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CONTACT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CAMPAIGN
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EMOTION
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  OUTCOME
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SCORE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  BEST TIME
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CSAT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockCalls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {call.contact.firstName} {call.contact.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{call.contact.phone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{call.campaign}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        call.outcome === "scheduled" || call.outcome === "fit"
                          ? "bg-green-100 text-green-800"
                          : call.outcome === "connected"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {call.outcome}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={call.score >= 70 ? "text-blue-600" : "text-green-600"}>
                      {call.score}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{call.bestTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {call.csat ? (
                      <div className="flex items-center">
                        <svg
                          className="h-4 w-4 text-orange-500 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-orange-600 font-medium">{call.csat}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900">View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Calls;
