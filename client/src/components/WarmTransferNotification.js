import {
    CheckIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    PhoneIcon,
    UserIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import React, { useState } from 'react';
import warmTransferAPI from '../services/warmTransfer';
import LoadingSpinner from './LoadingSpinner';

const WarmTransferNotification = ({ transfer, onAccept, onReject, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await warmTransferAPI.acceptTransfer(transfer.id);
      onAccept(transfer);
    } catch (error) {
      console.error('Error accepting transfer:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await warmTransferAPI.rejectTransfer(transfer.id, rejectReason);
      onReject(transfer);
    } catch (error) {
      console.error('Error rejecting transfer:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getIntentColor = (intentLabel) => {
    switch (intentLabel) {
      case 'demo_request':
        return 'bg-blue-100 text-blue-800';
      case 'pricing_inquiry':
        return 'bg-green-100 text-green-800';
      case 'urgent_need':
        return 'bg-red-100 text-red-800';
      case 'decision_maker':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getIntentIcon = (intentLabel) => {
    switch (intentLabel) {
      case 'demo_request':
        return <PhoneIcon className="h-4 w-4" />;
      case 'pricing_inquiry':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'urgent_need':
        return <ClockIcon className="h-4 w-4" />;
      case 'decision_maker':
        return <UserIcon className="h-4 w-4" />;
      default:
        return <PhoneIcon className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed top-4 right-4 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <PhoneIcon className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Warm Transfer Request</h3>
              <p className="text-xs text-gray-500">From {transfer.fromAgentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Contact Info */}
        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <UserIcon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-900">{transfer.contactName}</span>
          </div>
          <p className="text-sm text-gray-600">{transfer.contactPhone}</p>
          {transfer.contactEmail && (
            <p className="text-sm text-gray-600">{transfer.contactEmail}</p>
          )}
        </div>

        {/* Intent Info */}
        {transfer.intentLabel && (
          <div className="mb-3">
            <div className="flex items-center space-x-2">
              {getIntentIcon(transfer.intentLabel)}
              <span className="text-sm font-medium text-gray-700">Intent Detected:</span>
            </div>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getIntentColor(transfer.intentLabel)}`}>
                {transfer.intentLabel.replace('_', ' ').toUpperCase()}
                {transfer.intentConfidence && (
                  <span className="ml-1">({Math.round(transfer.intentConfidence * 100)}%)</span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Reason */}
        {transfer.reason && (
          <div className="mb-4">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Reason:</span> {transfer.reason}
            </p>
          </div>
        )}

        {/* Reject Form */}
        {showRejectForm && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for rejection (optional)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              rows="2"
              placeholder="Enter reason for rejection..."
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2">
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <CheckIcon className="h-4 w-4 mr-2" />
            )}
            Accept
          </button>

          <button
            onClick={() => setShowRejectForm(!showRejectForm)}
            disabled={isProcessing}
            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <XMarkIcon className="h-4 w-4 mr-2" />
            Reject
          </button>
        </div>

        {/* Reject Submit Button */}
        {showRejectForm && (
          <div className="mt-2">
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <XMarkIcon className="h-4 w-4 mr-2" />
              )}
              Confirm Rejection
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-3 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Requested {new Date(transfer.requestedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WarmTransferNotification;
