import React from "react";
import {
  MegaphoneIcon,
  TrendingUpIcon,
  TrendingDownIcon,
} from "@heroicons/react/24/outline";

const CampaignPerformance = ({ campaigns }) => {
  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-8">
        <MegaphoneIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500"> No campaigns yet </p>{" "}
        <p className="text-sm text-gray-400">
          {" "}
          Create your first campaign to see performance{" "}
        </p>{" "}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {" "}
      {campaigns.map((campaign) => (
        <div
          key={campaign.id}
          className="border border-gray-200 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900"> {campaign.name} </h4>{" "}
            <span className="text-sm text-gray-500">
              {" "}
              {campaign.totalCalls}
              calls{" "}
            </span>{" "}
          </div>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="text-center">
              <p className="text-lg font-semibold text-green-600">
                {" "}
                {campaign.scheduledCalls}{" "}
              </p>{" "}
              <p className="text-xs text-gray-500"> Scheduled </p>{" "}
            </div>{" "}
            <div className="text-center">
              <p className="text-lg font-semibold text-blue-600">
                {" "}
                {campaign.interestedCalls}{" "}
              </p>{" "}
              <p className="text-xs text-gray-500"> Interested </p>{" "}
            </div>{" "}
            <div className="text-center">
              <p className="text-lg font-semibold text-purple-600">
                {" "}
                {campaign.conversionRate} %{" "}
              </p>{" "}
              <p className="text-xs text-gray-500"> Conversion </p>{" "}
            </div>{" "}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {" "}
              {parseFloat(campaign.conversionRate) > 20 ? (
                <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
              )}{" "}
              <span className="text-sm text-gray-600">
                Avg: {Math.round(campaign.avgDuration)}s{" "}
              </span>{" "}
            </div>{" "}
            <span className="text-sm font-medium text-gray-900">
              $ {parseFloat(campaign.totalCost).toFixed(2)}{" "}
            </span>{" "}
          </div>{" "}
        </div>
      ))}{" "}
    </div>
  );
};

export default CampaignPerformance;
