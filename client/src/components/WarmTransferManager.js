import {
    ArrowPathIcon,
    CheckCircleIcon,
    ClockIcon,
    PhoneIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import warmTransferAPI from '../services/warmTransfer';
import { ErrorAlert as ErrorDisplay } from './ErrorDisplay';
import LoadingSpinner from './LoadingSpinner';

const WarmTransferManager = () => {
  const [showHistory, setShowHistory] = useState(false);
  const queryClient = useQueryClient();
  const { addListener } = useWebSocket();

  // Fetch pending transfers
  const {
    data: pendingData,
    isLoading: pendingLoading,
    error: pendingError,
    refetch: refetchPending
  } = useQuery({
    queryKey: ['warmTransfers', 'pending'],
    queryFn: () => warmTransferAPI.getPendingTransfers(),
    refetchInterval: 30000, // Refetch every 30 seconds (reduced from 5s)
    retry: 1, // Only retry once on failure
    retryDelay: 5000, // Wait 5 seconds before retry
  });

  // Fetch transfer history
  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError
  } = useQuery({
    queryKey: ['warmTransfers', 'history'],
    queryFn: () => warmTransferAPI.getTransferHistory(20, 0),
    enabled: showHistory,
  });

  // Accept transfer mutation
  const acceptMutation = useMutation({
    mutationFn: (transferId) => warmTransferAPI.acceptTransfer(transferId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warmTransfers'] });
    },
  });

  // Reject transfer mutation
  const rejectMutation = useMutation({
    mutationFn: ({ transferId, reason }) => warmTransferAPI.rejectTransfer(transferId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warmTransfers'] });
    },
  });

  // Complete transfer mutation
  const completeMutation = useMutation({
    mutationFn: (transferId) => warmTransferAPI.completeTransfer(transferId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warmTransfers'] });
    },
  });

  const handleAccept = async (transfer) => {
    try {
      await acceptMutation.mutateAsync(transfer.id);
    } catch (error) {
      console.error('Error accepting transfer:', error);
    }
  };

  const handleReject = async (transfer, reason = null) => {
    try {
      await rejectMutation.mutateAsync({ transferId: transfer.id, reason });
    } catch (error) {
      console.error('Error rejecting transfer:', error);
    }
  };

  const handleComplete = async (transfer) => {
    try {
      await completeMutation.mutateAsync(transfer.id);
    } catch (error) {
      console.error('Error completing transfer:', error);
    }
  };

  // WebSocket listeners for real-time updates
  useEffect(() => {
    // Listen for new warm transfer requests
    addListener('warm_transfer_request', (data) => {
      queryClient.invalidateQueries({ queryKey: ['warmTransfers', 'pending'] });
    });

    // Listen for transfer status updates
    addListener('warm_transfer_accepted', (data) => {
      queryClient.invalidateQueries({ queryKey: ['warmTransfers'] });
    });

    addListener('warm_transfer_rejected', (data) => {
      queryClient.invalidateQueries({ queryKey: ['warmTransfers'] });
    });

    addListener('warm_transfer_completed', (data) => {
      queryClient.invalidateQueries({ queryKey: ['warmTransfers'] });
    });
  }, [addListener, queryClient]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-4 w-4" />;
      case 'accepted':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'rejected':
        return <XCircleIcon className="h-4 w-4" />;
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  if (pendingLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <LoadingSpinner size="sm" />
        <span className="ml-2 text-sm text-gray-600">Loading transfers...</span>
      </div>
    );
  }

  if (pendingError) {
    return <ErrorDisplay error={pendingError} />;
  }

  const pendingTransfers = pendingData?.data || [];
  const transferHistory = historyData?.data?.transfers || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Warm Transfers</h2>
          <p className="text-sm text-gray-600">Manage incoming transfer requests</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => refetchPending()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>
      </div>

      {/* Pending Transfers */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-medium text-gray-900">
            Pending Requests ({pendingTransfers.length})
          </h3>
        </div>

        <div className="p-6">
          {pendingTransfers.length === 0 ? (
            <div className="text-center py-8">
              <PhoneIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No pending transfer requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingTransfers.map((transfer) => (
                <div key={transfer.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <PhoneIcon className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {transfer.contactName}
                          </h4>
                          <p className="text-sm text-gray-600">{transfer.contactPhone}</p>
                        </div>
                      </div>

                      <div className="ml-11 space-y-2">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">From:</span> {transfer.fromAgentName}
                        </p>

                        {transfer.reason && (
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Reason:</span> {transfer.reason}
                          </p>
                        )}

                        {transfer.intentLabel && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700">Intent:</span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transfer.intentLabel)}`}>
                              {transfer.intentLabel.replace('_', ' ').toUpperCase()}
                              {transfer.intentConfidence && (
                                <span className="ml-1">({Math.round(transfer.intentConfidence * 100)}%)</span>
                              )}
                            </span>
                          </div>
                        )}

                        <p className="text-xs text-gray-500">
                          Requested {new Date(transfer.requestedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleAccept(transfer)}
                        disabled={acceptMutation.isLoading}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {acceptMutation.isLoading ? (
                          <LoadingSpinner size="sm" className="mr-2" />
                        ) : (
                          <CheckCircleIcon className="h-4 w-4 mr-2" />
                        )}
                        Accept
                      </button>

                      <button
                        onClick={() => handleReject(transfer)}
                        disabled={rejectMutation.isLoading}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        {rejectMutation.isLoading ? (
                          <LoadingSpinner size="sm" className="mr-2" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 mr-2" />
                        )}
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transfer History */}
      {showHistory && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-medium text-gray-900">Transfer History</h3>
          </div>

          <div className="p-6">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-sm text-gray-600">Loading history...</span>
              </div>
            ) : historyError ? (
              <ErrorDisplay error={historyError} />
            ) : transferHistory.length === 0 ? (
              <div className="text-center py-8">
                <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No transfer history</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transferHistory.map((transfer) => (
                  <div key={transfer.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <PhoneIcon className="h-5 w-5 text-gray-600" />
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {transfer.contactName}
                            </h4>
                            <p className="text-sm text-gray-600">{transfer.contactPhone}</p>
                          </div>
                        </div>

                        <div className="ml-11 space-y-1">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">From:</span> {transfer.fromAgentName}
                          </p>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">To:</span> {transfer.toAgentName}
                          </p>

                          {transfer.reason && (
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Reason:</span> {transfer.reason}
                            </p>
                          )}

                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700">Status:</span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transfer.status)}`}>
                              {getStatusIcon(transfer.status)}
                              <span className="ml-1">{transfer.status.toUpperCase()}</span>
                            </span>
                          </div>

                          <p className="text-xs text-gray-500">
                            {new Date(transfer.requestedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {transfer.status === 'accepted' && (
                        <div className="ml-4">
                          <button
                            onClick={() => handleComplete(transfer)}
                            disabled={completeMutation.isLoading}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {completeMutation.isLoading ? (
                              <LoadingSpinner size="sm" className="mr-2" />
                            ) : (
                              <CheckCircleIcon className="h-4 w-4 mr-2" />
                            )}
                            Complete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WarmTransferManager;
