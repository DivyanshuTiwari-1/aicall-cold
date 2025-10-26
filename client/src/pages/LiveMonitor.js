import {
    ChartBarIcon,
    CheckCircleIcon,
    ClockIcon,
    CurrencyDollarIcon,
    PauseIcon,
    PhoneIcon,
    PlayIcon,
    StopIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import KnowledgeSuggestions from '../components/KnowledgeSuggestions';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import analyticsAPI from '../services/analytics';
import { callsAPI } from '../services/calls';
import { conversationAPI } from '../services/conversation';

const LiveMonitor = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  const [selectedCall, setSelectedCall] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(true);

  // Fetch live calls initially
  const { data: liveCallsData, isLoading, error, refetch } = useQuery({
    queryKey: ['live-calls'],
    queryFn: () => analyticsAPI.getLiveCalls(),
    refetchInterval: false, // Disabled polling - using WebSocket now
    enabled: true,
  });

  // Fetch call details with conversation
  const { data: callDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['call-details', selectedCall?.id],
    queryFn: () => callsAPI.getCallDetails(selectedCall.id),
    enabled: !!selectedCall,
  });

  // Fetch conversation context with polling for active automated calls
  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: ['conversation', selectedCall?.id],
    queryFn: () => conversationAPI.getConversationContext(selectedCall.id),
    enabled: !!selectedCall,
    refetchInterval: (selectedCall?.automated && selectedCall?.status === 'in_progress') ? 5000 : false,
  });

  // Update call status mutation
  const updateCallStatusMutation = useMutation({
    mutationFn: ({ callId, status }) => callsAPI.updateCallStatus(callId, { status }),
    onSuccess: () => {
      toast.success('Call status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['live-calls'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update call status');
    },
  });

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.organizationId) return;

    const handleCallUpdate = (data) => {
      console.log('📞 Call status update:', data);
      // Refresh live calls when call status changes
      refetch();
    };

    const handleCallStart = (data) => {
      console.log('✅ Call started:', data);
      // Refresh live calls when new call starts
      refetch();
      toast.success(`New AI call started to ${data.contactName || data.phoneNumber}`);
    };

    const handleCallEnd = (data) => {
      console.log('📴 Call ended:', data);
      // Refresh live calls when call ends
      refetch();

      // If the selected call ended, update conversation one last time
      if (selectedCall?.id === data.callId) {
        queryClient.invalidateQueries({ queryKey: ['conversation', data.callId] });
      }
    };

    const handleConversationTurn = (data) => {
      console.log('💬 Conversation turn:', data);

      // If this is for the selected call, update conversation in real-time
      if (selectedCall?.id === data.callId) {
        setConversationHistory(prev => {
          const newHistory = [...prev];

          // Add customer message if present
          if (data.userInput) {
            newHistory.push({
              type: 'user',
              message: data.userInput,
              content: data.userInput,
              timestamp: data.timestamp,
              turn: data.turn,
              emotion: data.emotion
            });
          }

          // Add AI response if present
          if (data.aiResponse) {
            newHistory.push({
              type: 'ai',
              message: data.aiResponse,
              content: data.aiResponse,
              timestamp: data.timestamp,
              turn: data.turn,
              confidence: data.confidence,
              emotion: data.emotion,
              intent: data.intent
            });
          }

          return newHistory;
        });
      }

      // Always refresh live calls to update conversation preview
      refetch();
    };

    // Subscribe to organization updates
    addListener('call_status_update', handleCallUpdate);
    addListener('call_started', handleCallStart);
    addListener('call_ended', handleCallEnd);
    addListener('conversation_turn', handleConversationTurn);

    // Subscribe to organization WebSocket channel
    if (user?.organizationId) {
      const ws = require('../services/websocket').default;
      ws.subscribeToOrganizationUpdates(user.organizationId);
    }

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.organizationId, addListener, queryClient, selectedCall, refetch]);

  // Load conversation history when call is selected
  useEffect(() => {
    if (selectedCall && conversationData) {
      const history = conversationData.history || [];
      // Transform to format expected by CallDetails component
      const formattedHistory = [];

      history.forEach(turn => {
        // Add user message if exists
        if (turn.user_input) {
          formattedHistory.push({
            type: 'user',
            message: turn.user_input,
            content: turn.user_input,
            timestamp: turn.timestamp,
            turn: turn.turn,
            emotion: turn.emotion
          });
        }
        // Add AI response if exists
        if (turn.ai_response) {
          formattedHistory.push({
            type: 'ai',
            message: turn.ai_response,
            content: turn.ai_response,
            timestamp: turn.timestamp,
            turn: turn.turn,
            confidence: turn.confidence,
            emotion: turn.emotion,
            intent: turn.intent
          });
        }
      });

      setConversationHistory(formattedHistory);
    }
  }, [selectedCall, conversationData]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (conversationHistory.length > 0) {
      const container = document.getElementById('conversation-container');
      if (container) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 100);
      }
    }
  }, [conversationHistory]);

  const handleCallAction = (callId, action) => {
    updateCallStatusMutation.mutate({ callId, status: action });
  };

  const handleSendMessage = async (message) => {
    if (!selectedCall) return;

    try {
      const response = await conversationAPI.processConversation({
        call_id: selectedCall.id,
        user_input: message,
        context: {
          conversation_history: conversationHistory,
          call_duration: selectedCall.duration,
          emotion: selectedCall.emotion,
        },
      });

      setConversationHistory(prev => [
        ...prev,
        { type: 'user', message, timestamp: new Date().toISOString() },
        { type: 'ai', message: response.answer, timestamp: new Date().toISOString() },
      ]);

      if (response.should_fallback) {
        toast.warning('AI suggests human handover');
      }
    } catch (error) {
      console.error('Error processing conversation:', error);
      toast.error('Failed to process conversation');
    }
  };

  const getEmotionColor = (emotion) => {
    switch (emotion) {
      case 'interested':
        return 'bg-green-100 text-green-800';
      case 'positive':
        return 'bg-blue-100 text-blue-800';
      case 'neutral':
        return 'bg-gray-100 text-gray-800';
      case 'confused':
        return 'bg-yellow-100 text-yellow-800';
      case 'frustrated':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const liveCalls = liveCallsData?.liveCalls || [];

  if (isLoading) return <LoadingSpinner />;
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load live calls data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Monitor</h1>
          <p className="text-gray-600">Monitor active calls in real-time</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
            isMonitoring
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isMonitoring ? 'bg-green-500' : 'bg-red-500'
            }`} />
            {isMonitoring ? 'Monitoring' : 'Paused'}
          </div>
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            className={`flex items-center px-4 py-2 rounded-lg ${
              isMonitoring
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isMonitoring ? (
              <>
                <PauseIcon className="h-4 w-4 mr-2" />
                Stop Monitoring
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4 mr-2" />
                Start Monitoring
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Active Calls */}
        <MetricCard
          icon={<PhoneIcon className="h-8 w-8 text-blue-600" />}
          title="Active Calls"
          value={liveCalls.length}
          subtitle={`${liveCalls.filter(c => c.automated).length} Auto | ${liveCalls.filter(c => !c.automated).length} Manual`}
        />

        {/* Automated Calls */}
        <MetricCard
          icon={<span className="text-3xl">🤖</span>}
          title="AI Calls"
          value={liveCalls.filter(c => c.automated).length}
          subtitle="Automated"
        />

        {/* Average Duration */}
        <MetricCard
          icon={<ClockIcon className="h-8 w-8 text-green-600" />}
          title="Avg Duration"
          value={
            liveCalls.length > 0
              ? formatDuration(
                  Math.floor(liveCalls.reduce((acc, c) => acc + (c.duration || 0), 0) / liveCalls.length)
                )
              : '0:00'
          }
        />

        {/* Total Cost */}
        <MetricCard
          icon={<CurrencyDollarIcon className="h-8 w-8 text-purple-600" />}
          title="Total Cost"
          value={`$${liveCalls.reduce((acc, c) => acc + parseFloat(c.cost || 0), 0).toFixed(3)}`}
        />

        {/* Success Rate */}
        <MetricCard
          icon={<ChartBarIcon className="h-8 w-8 text-orange-600" />}
          title="Positive Rate"
          value={`${
            liveCalls.length > 0
              ? Math.round(
                  (liveCalls.filter(c => c.emotion === 'interested' || c.emotion === 'positive').length / liveCalls.length) * 100
                )
              : 0
          }%`}
        />
      </div>

      {/* Main Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Active Calls */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <PhoneIcon className="h-5 w-5 text-green-500 mr-2" />
            Active Calls
          </h3>

          {liveCalls.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {liveCalls.map((call) => (
                <div
                  key={call.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedCall?.id === call.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedCall(call)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        call.automated ? 'bg-purple-100' : 'bg-green-100'
                      }`}>
                        <PhoneIcon className={`h-5 w-5 ${
                          call.automated ? 'text-purple-600' : 'text-green-600'
                        }`} />
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900">
                            {call.contact?.firstName} {call.contact?.lastName}
                          </p>
                          {call.automated && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              🤖 AUTO
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{call.contact?.phone}</p>
                        {call.campaign && (
                          <p className="text-xs text-gray-400">{call.campaign.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        call.status === 'in_progress' ? 'bg-green-100 text-green-800' :
                        call.status === 'initiated' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {call.status}
                      </div>
                      {call.emotion && (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEmotionColor(
                            call.emotion
                          )}`}
                        >
                          {call.emotion}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-gray-700">{formatDuration(call.duration)}</span>
                    </div>
                  </div>

                  {/* Conversation preview for automated calls */}
                  {call.automated && call.conversation && (
                    <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-purple-700">
                          Latest: {call.conversation.turnCount ? `${call.conversation.turnCount} turns` : 'Starting...'}
                        </span>
                        {call.conversation.lastEmotion && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getEmotionColor(call.conversation.lastEmotion)}`}>
                            {call.conversation.lastEmotion}
                          </span>
                        )}
                      </div>
                      {call.conversation.lastMessage && (
                        <p className="text-xs text-gray-600 truncate">
                          {call.conversation.lastMessage.substring(0, 80)}...
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {!call.automated && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCallAction(call.id, 'completed');
                            }}
                            className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                            disabled={updateCallStatusMutation.isLoading}
                          >
                            <CheckCircleIcon className="h-4 w-4 mr-1" /> Complete
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCallAction(call.id, 'cancelled');
                            }}
                            className="flex items-center px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                            disabled={updateCallStatusMutation.isLoading}
                          >
                            <StopIcon className="h-4 w-4 mr-1" /> Cancel
                          </button>
                        </>
                      )}
                      {call.automated && (
                        <div className="flex items-center space-x-2">
                          <span className="flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                          </span>
                          <span className="text-xs text-purple-600 font-medium italic">
                            AI in conversation...
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {call.automated ? 'Type' : 'Agent'}
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {call.automated ? (
                          <span className="text-purple-600 font-semibold">AI Agent</span>
                        ) : (
                          <>{call.agent?.firstName} {call.agent?.lastName}</>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Call Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Details</h3>
          {selectedCall ? (
            <>
              <CallDetails
                call={selectedCall}
                callDetails={callDetails}
                conversationHistory={conversationHistory}
                getEmotionColor={getEmotionColor}
                formatDuration={formatDuration}
                handleSendMessage={handleSendMessage}
                isLoading={detailsLoading || conversationLoading}
              />

              {/* Knowledge Suggestions */}
              <div className="mt-6">
                <KnowledgeSuggestions
                  callId={selectedCall.id}
                  transcript={conversationHistory.map(msg => msg.content).join(' ')}
                />
              </div>
            </>
          ) : (
            <EmptyState message="Select a call to view details" />
          )}
        </div>
      </div>
    </div>
  );
};

/* --- Reusable Components --- */

const MetricCard = ({ icon, title, value, subtitle }) => (
  <div className='bg-white rounded-lg shadow-sm p-6'>
    <div className='flex items-center'>
      <div className='flex-shrink-0'>{icon}</div>
      <div className='ml-4'>
        <p className='text-sm font-medium text-gray-500'>{title}</p>
        <p className='text-2xl font-semibold text-gray-900'>{value}</p>
        {subtitle && <p className='text-xs text-gray-400 mt-1'>{subtitle}</p>}
      </div>
    </div>
  </div>
);

const LoadingState = () => (
  <div className='text-center py-8'>
    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto' />
    <p className='mt-2 text-gray-600'>Loading calls...</p>
  </div>
);

const EmptyState = ({ message = 'No active calls' }) => (
  <div className='text-center py-8'>
    <PhoneIcon className='h-12 w-12 text-gray-400 mx-auto mb-4' />
    <p className='text-gray-600'>{message}</p>
  </div>
);

const CallDetails = ({
  call,
  callDetails,
  conversationHistory,
  getEmotionColor,
  formatDuration,
  handleSendMessage,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {call.contact?.firstName} {call.contact?.lastName}
          </p>
          <p className="text-sm text-gray-500">{call.contact?.phone}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Duration</p>
          <p className="text-lg font-semibold text-gray-900">{formatDuration(call.duration)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Status</p>
          <p className="text-sm font-medium text-gray-900">
            {call.status ? call.status.replace('_', ' ').toUpperCase() : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Campaign</p>
          <p className="text-sm font-medium text-gray-900">
            {call.campaign?.name || 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Agent</p>
          <p className="text-sm font-medium text-gray-900">
            {call.agent?.firstName} {call.agent?.lastName}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">SIP Extension</p>
          <p className="text-sm font-medium text-gray-900">
            {call.agent?.sipExtension || 'N/A'}
          </p>
        </div>
      </div>

      {call.emotion && (
        <div>
          <p className="text-sm text-gray-500">Emotion</p>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEmotionColor(
              call.emotion
            )}`}
          >
            {call.emotion}
          </span>
        </div>
      )}

      {/* AI Analysis */}
      {callDetails?.aiAnalysis && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">AI Analysis</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Intent:</span> {callDetails.aiAnalysis.intent || 'N/A'}
            </div>
            <div>
              <span className="font-medium">Confidence:</span> {callDetails.aiAnalysis.confidence || 0}%
            </div>
            <div>
              <span className="font-medium">Sentiment:</span> {callDetails.aiAnalysis.sentiment || 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Conversation */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-500">Conversation</p>
          {call.automated && call.status === 'in_progress' && conversationHistory.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs text-green-600 font-medium">Live</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {conversationHistory.length} turns
              </span>
            </div>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto space-y-3" id="conversation-container">
          {conversationHistory.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              {call.automated && call.status === 'in_progress' ? (
                <>
                  <div className="animate-pulse mb-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full mx-auto"></div>
                  </div>
                  <p>Waiting for conversation to start...</p>
                </>
              ) : (
                <p>No conversation history available</p>
              )}
            </div>
          ) : (
            conversationHistory.map((m, i) => {
              const isLatest = i === conversationHistory.length - 1;
              return (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm relative ${
                    m.type === 'user'
                      ? 'bg-blue-50 border border-blue-200 ml-4'
                      : 'bg-purple-50 border border-purple-200 mr-4'
                  } ${isLatest ? 'ring-2 ring-offset-1 ' + (m.type === 'user' ? 'ring-blue-300' : 'ring-purple-300') : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${
                      m.type === 'user' ? 'text-blue-700' : 'text-purple-700'
                    }`}>
                      {m.type === 'user' ? '👤 Customer' : '🤖 AI Agent'}
                      {m.turn && <span className="ml-1 text-gray-400">#{m.turn}</span>}
                    </span>
                    {isLatest && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className={m.type === 'user' ? 'text-blue-900' : 'text-purple-900'}>
                    {m.message}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </p>
                    <div className="flex items-center space-x-1">
                      {m.emotion && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getEmotionColor(m.emotion)}`}>
                          {m.emotion}
                        </span>
                      )}
                      {m.confidence && (
                        <span className="text-xs text-gray-500">
                          {Math.round(m.confidence * 100)}% confident
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="pt-4 border-t">
        <p className="text-sm text-gray-500 mb-2">Quick Actions</p>
        <div className="flex space-x-2">
          <ActionButton
            color="gray"
            text="Repeat"
            onClick={() => handleSendMessage('Can you repeat that?')}
          />
          <ActionButton
            color="orange"
            text="Handover"
            onClick={() => handleSendMessage('Let me transfer you to a human representative')}
          />
          <ActionButton
            color="green"
            text="Close"
            onClick={() => handleSendMessage('Thank you for your time')}
          />
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({ color, text, onClick }) => {
  const colors = {
    gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    orange: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
    green: 'bg-green-100 text-green-700 hover:bg-green-200',
  };
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded transition-colors ${colors[color]}`}
    >
      {text}
    </button>
  );
};

export default LiveMonitor;
