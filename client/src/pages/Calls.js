import {
  CheckCircleIcon,
  PhoneIcon,
  PlayIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";
import React, { useState } from "react";
import { useQuery } from "react-query";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../utils/api";

const Calls = () => {
  const [statusFilter, setStatusFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");

  const { data, isLoading, error } = useQuery(
    ["calls", { status: statusFilter, outcome: outcomeFilter }],
    () =>
      api
        .get("/calls", {
          params: { status: statusFilter, outcome: outcomeFilter },
        })
        .then((res) => res.data)
  );

  const calls = data?.calls || [];

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case "in_progress":
        return <PlayIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <PhoneIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "busy":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDuration = (duration) => {
    if (!duration) return "0s";
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleString();

  if (isLoading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load calls</p>
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Call History</h1>
        <p className="text-gray-600">View and manage all call records</p>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field sm:w-48"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="in_progress">In Progress</option>
            <option value="busy">Busy</option>
            <option value="no_answer">No Answer</option>
          </select>

          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="input-field sm:w-48"
          >
            <option value="">All Outcomes</option>
            <option value="scheduled">Scheduled</option>
            <option value="interested">Interested</option>
            <option value="not_interested">Not Interested</option>
            <option value="callback">Callback</option>
            <option value="voicemail">Voicemail</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {calls.length === 0 ? (
          <div className="text-center py-12">
            <PhoneIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No calls yet
            </h3>
            <p className="text-gray-500">
              Start a campaign to begin making calls
            </p>
          </div>
        ) : (
          calls.map((call) => (
            <div key={call.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(call.status)}
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {call.contactName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {call.company} • {call.phone}
                    </p>
                    <p className="text-xs text-gray-400">{call.campaignName}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      call.status
                    )}`}
                  >
                    {call.status.replace("_", " ")}
                  </span>

                  {call.outcome && (
                    <span className="ml-2 text-sm text-gray-600">
                      {call.outcome}
                    </span>
                  )}

                  <p className="text-sm text-gray-500 mt-1">
                    {formatDuration(call.duration)} •{" "}
                    {formatDate(call.createdAt)}
                  </p>
                </div>
              </div>

              {call.transcript && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{call.transcript}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Calls;
