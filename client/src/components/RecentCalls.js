import React from "react";
import {
  PhoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

const RecentCalls = ({ calls }) => {
  const getStatusIcon = (status, outcome) => {
    if (status === "completed") {
      if (["scheduled", "interested"].includes(outcome)) {
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      } else {
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      }
    }
    return <ClockIcon className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusColor = (status, outcome) => {
    if (status === "completed") {
      if (["scheduled", "interested"].includes(outcome)) {
        return "text-green-600";
      } else {
        return "text-red-600";
      }
    }
    return "text-yellow-600";
  };

  const formatDuration = (duration) => {
    if (!duration) return "0s";
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!calls || calls.length === 0) {
    return (
      <div className="text-center py-8">
        <PhoneIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500"> No recent calls </p>{" "}
        <p className="text-sm text-gray-400">
          {" "}
          Start a campaign to see call activity{" "}
        </p>{" "}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {" "}
      {calls.map((call) => (
        <div
          key={call.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div className="flex items-center space-x-3">
            {" "}
            {getStatusIcon(call.status, call.outcome)}{" "}
            <div>
              <p className="font-medium text-gray-900"> {call.contactName} </p>{" "}
              <p className="text-sm text-gray-500"> {call.company} </p>{" "}
            </div>{" "}
          </div>{" "}
          <div className="text-right">
            <p
              className={`text-sm font-medium ${getStatusColor(call.status, call.outcome)}`}
            >
              {" "}
              {call.outcome || call.status}{" "}
            </p>{" "}
            <p className="text-xs text-gray-500">
              {" "}
              {formatDuration(call.duration)}• {formatDate(call.createdAt)}{" "}
            </p>{" "}
          </div>{" "}
        </div>
      ))}{" "}
    </div>
  );
};

export default RecentCalls;
