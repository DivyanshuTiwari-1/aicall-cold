import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  PhoneIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { callsAPI } from '../services/calls';
import LoadingSpinner from './LoadingSpinner';

const CallConversationModal = ({ call, isOpen, onClose }) => {
  // Fetch call details
  const { data: callData, isLoading: callLoading } = useQuery({
    queryKey: ['call-details', call?.id],
    queryFn: () => callsAPI.getCall(call.id),
    enabled: !!call && isOpen,
  });

  // Fetch conversation
  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: ['call-conversation', call?.id],
    queryFn: () => callsAPI.getCallConversation(call.id),
    enabled: !!call && isOpen,
  });

  if (!isOpen || !call) return null;

  const callDetails = callData?.call || {};
  const conversation = conversationData?.conversationHistory || [];
  const hasTranscript = callDetails.transcript || conversation.length > 0;

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Parse raw transcript into messages
  const parseTranscript = (transcript) => {
    if (!transcript) return [];

    const lines = transcript.split('\n').filter(line => line.trim());
    const messages = [];

    lines.forEach(line => {
      if (line.startsWith('Customer:') || line.startsWith('User:')) {
        messages.push({
          speaker: 'customer',
          message: line.replace(/^(Customer:|User:)\s*/, ''),
          timestamp: null
        });
      } else if (line.startsWith('AI:') || line.startsWith('Agent:')) {
        messages.push({
          speaker: 'ai',
          message: line.replace(/^(AI:|Agent:)\s*/, ''),
          timestamp: null
        });
      } else if (line.trim()) {
        // If no prefix, assume it's continuation of previous message
        if (messages.length > 0) {
          messages[messages.length - 1].message += ' ' + line;
        }
      }
    });

    return messages;
  };

  const displayMessages = conversation.length > 0
    ? conversation
    : parseTranscript(callDetails.transcript);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                  <PhoneIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Call Conversation
                  </h3>
                  <p className="text-sm text-blue-100">
                    {call.contactName || 'Unknown Contact'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-blue-100 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white px-6 py-4">
            {callLoading || conversationLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Call Info Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b">
                  <div className="flex items-center space-x-2">
                    <ClockIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatDuration(callDetails.duration)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Outcome</p>
                    <p className="text-sm font-semibold text-gray-900 capitalize">
                      {callDetails.outcome || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Emotion</p>
                    <p className="text-sm font-semibold text-gray-900 capitalize">
                      {callDetails.emotion || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">CSAT Score</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {callDetails.csatScore ? `${callDetails.csatScore}/5` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Conversation */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-600" />
                    <h4 className="text-sm font-semibold text-gray-900">Conversation</h4>
                  </div>

                  {!hasTranscript ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">No conversation transcript available</p>
                      <p className="text-xs text-gray-500 mt-1">
                        The transcript may not have been saved or the call didn't connect
                      </p>
                    </div>
                  ) : displayMessages.length > 0 ? (
                    /* Chat-style conversation */
                    <div className="space-y-4 max-h-96 overflow-y-auto bg-gray-50 rounded-lg p-4">
                      {displayMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex ${msg.speaker === 'customer' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`flex items-start space-x-2 max-w-md ${
                              msg.speaker === 'customer' ? 'flex-row-reverse space-x-reverse' : ''
                            }`}
                          >
                            {/* Avatar */}
                            <div
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                msg.speaker === 'customer'
                                  ? 'bg-blue-600'
                                  : 'bg-green-600'
                              }`}
                            >
                              {msg.speaker === 'customer' ? (
                                <UserIcon className="h-4 w-4 text-white" />
                              ) : (
                                <span className="text-xs font-bold text-white">AI</span>
                              )}
                            </div>

                            {/* Message bubble */}
                            <div
                              className={`px-4 py-2 rounded-lg ${
                                msg.speaker === 'customer'
                                  ? 'bg-blue-600 text-white rounded-tr-none'
                                  : 'bg-white border border-gray-200 text-gray-900 rounded-tl-none'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {msg.message || msg.user_input || msg.ai_response}
                              </p>
                              {msg.timestamp && (
                                <p
                                  className={`text-xs mt-1 ${
                                    msg.speaker === 'customer'
                                      ? 'text-blue-100'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  {formatTimestamp(msg.timestamp)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Raw transcript fallback */
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                        {callDetails.transcript}
                      </pre>
                    </div>
                  )}
                </div>

                {/* AI Insights */}
                {callDetails.aiInsights && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">AI Insights</h4>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <pre className="text-sm text-purple-900 whitespace-pre-wrap">
                        {typeof callDetails.aiInsights === 'string'
                          ? callDetails.aiInsights
                          : JSON.stringify(callDetails.aiInsights, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {callDetails.notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-gray-800">{callDetails.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
            <div className="text-xs text-gray-500">
              Call Date: {callDetails.createdAt ? new Date(callDetails.createdAt).toLocaleString() : 'N/A'}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallConversationModal;
