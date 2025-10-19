import {
    ChartBarIcon,
    CheckCircleIcon,
    CpuChipIcon,
    ExclamationTriangleIcon,
    EyeIcon,
    FunnelIcon,
    HeartIcon
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import EmotionHeatmap from '../components/EmotionHeatmap';
import EmotionJourney from '../components/EmotionJourney';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { aiIntelligenceAPI } from '../services/aiIntelligence';

const AIIntelligence = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addListener, isConnected } = useWebSocket();
  const [selectedCall, setSelectedCall] = useState(null);
  const [showCallAnalysis, setShowCallAnalysis] = useState(false);
  const [showEmotionJourney, setShowEmotionJourney] = useState(false);
  const [selectedEmotionData, setSelectedEmotionData] = useState(null);
  const [filters, setFilters] = useState({
    dateRange: '7d',
    emotion: '',
    intent: '',
    startDate: '',
    endDate: '',
  });

  // Fetch emotion analytics
  const { data: emotionData, isLoading: emotionLoading } = useQuery({
    queryKey: ['emotion-analytics'],
    queryFn: () => aiIntelligenceAPI.getEmotionAnalytics(filters),
    refetchInterval: 60000,
  });

  // Fetch intent analytics
  const { data: intentData, isLoading: intentLoading } = useQuery({
    queryKey: ['intent-analytics'],
    queryFn: () => aiIntelligenceAPI.getIntentAnalytics(filters),
    refetchInterval: 60000,
  });

  // Fetch recent call analyses
  const { data: recentAnalyses, isLoading: analysesLoading } = useQuery({
    queryKey: ['recent-analyses'],
    queryFn: () => aiIntelligenceAPI.getRecentAnalyses(filters),
    refetchInterval: 30000,
  });

  // Fetch call analysis details
  const { data: callAnalysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['call-analysis', selectedCall?.id],
    queryFn: () => aiIntelligenceAPI.getCallAnalysis(selectedCall.id),
    enabled: !!selectedCall && showCallAnalysis,
  });

  // Fetch emotion heatmap data
  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['emotion-heatmap', filters.startDate, filters.endDate],
    queryFn: () => aiIntelligenceAPI.getEmotionHeatmap(filters.startDate, filters.endDate),
    refetchInterval: 300000, // 5 minutes
  });

  // Fetch enhanced emotion analytics with volatility trends
  const { data: enhancedEmotionData, isLoading: enhancedEmotionLoading } = useQuery({
    queryKey: ['emotion-analytics-enhanced', filters],
    queryFn: () => aiIntelligenceAPI.getEnhancedEmotionAnalytics(filters),
    refetchInterval: 60000,
  });

  // Fetch agent empathy scores
  const { data: empathyData, isLoading: empathyLoading } = useQuery({
    queryKey: ['agent-empathy-scores', filters],
    queryFn: () => aiIntelligenceAPI.getAgentEmpathyScores(filters),
    refetchInterval: 300000, // 5 minutes
  });

  // Add manual tag mutation
  const addTagMutation = useMutation({
    mutationFn: ({ callId, tag }) => aiIntelligenceAPI.addManualTag(callId, tag),
    onSuccess: () => {
      toast.success('Tag added successfully');
      queryClient.invalidateQueries({ queryKey: ['recent-analyses'] });
      queryClient.invalidateQueries({ queryKey: ['call-analysis', selectedCall?.id] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add tag');
    },
  });

  // Add highlight mutation
  const addHighlightMutation = useMutation({
    mutationFn: ({ callId, highlight }) => aiIntelligenceAPI.addHighlight(callId, highlight),
    onSuccess: () => {
      toast.success('Highlight added successfully');
      queryClient.invalidateQueries({ queryKey: ['recent-analyses'] });
      queryClient.invalidateQueries({ queryKey: ['call-analysis', selectedCall?.id] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add highlight');
    },
  });

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!isConnected || !user?.organizationId) return;

    const handleAnalysisComplete = (data) => {
      // Refresh analyses when new analysis is complete
      queryClient.invalidateQueries({ queryKey: ['recent-analyses'] });
      queryClient.invalidateQueries({ queryKey: ['emotion-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['intent-analytics'] });
    };

    addListener('analysis_complete', handleAnalysisComplete);

    return () => {
      // Cleanup listeners when component unmounts
    };
  }, [isConnected, user?.organizationId, addListener, queryClient]);

  const handleViewAnalysis = (call) => {
    setSelectedCall(call);
    setShowCallAnalysis(true);
  };

  const handleViewEmotionJourney = (call) => {
    setSelectedCall(call);
    setShowEmotionJourney(true);
  };

  const handleEmotionSelect = (emotionData) => {
    setSelectedEmotionData(emotionData);
  };

  const handleAddTag = (callId, tag) => {
    addTagMutation.mutate({ callId, tag });
  };

  const handleAddHighlight = (callId, highlight) => {
    addHighlightMutation.mutate({ callId, highlight });
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

  const getIntentColor = (intent) => {
    switch (intent) {
      case 'interested':
        return 'bg-green-100 text-green-800';
      case 'not_interested':
        return 'bg-red-100 text-red-800';
      case 'callback':
        return 'bg-yellow-100 text-yellow-800';
      case 'objection':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const emotions = emotionData?.emotions || [];
  const intents = intentData?.intents || [];
  const analyses = recentAnalyses?.analyses || [];
  const enhancedEmotions = enhancedEmotionData?.analytics?.emotions || [];
  const volatilityTrends = enhancedEmotionData?.analytics?.volatilityTrends || [];
  const conversionCorrelation = enhancedEmotionData?.analytics?.conversionCorrelation || [];
  const empathyScores = empathyData?.empathyScores || [];

  if (emotionLoading || intentLoading || analysesLoading || enhancedEmotionLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Intelligence & Analytics</h1>
          <p className="text-gray-600">AI-powered insights and analysis for your calls</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Emotion</label>
            <select
              value={filters.emotion}
              onChange={(e) => setFilters({ ...filters, emotion: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Emotions</option>
              <option value="interested">Interested</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="confused">Confused</option>
              <option value="frustrated">Frustrated</option>
            </select>
            </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Intent</label>
            <select
              value={filters.intent}
              onChange={(e) => setFilters({ ...filters, intent: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Intents</option>
              <option value="interested">Interested</option>
              <option value="not_interested">Not Interested</option>
              <option value="callback">Callback</option>
              <option value="objection">Objection</option>
            </select>
          </div>
        </div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CpuChipIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Analyses</dt>
                  <dd className="text-lg font-medium text-gray-900">{analyses.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Avg Confidence</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {analyses.length > 0
                      ? Math.round(analyses.reduce((sum, a) => sum + (a.confidence || 0), 0) / analyses.length)
                      : 0}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Objections</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {analyses.reduce((sum, a) => sum + (a.objections?.length || 0), 0)}
                  </dd>
                </dl>
      </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Highlights</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {analyses.reduce((sum, a) => sum + (a.highlights?.length || 0), 0)}
                  </dd>
                </dl>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Emotion Heatmap */}
      <EmotionHeatmap
        startDate={filters.startDate}
        endDate={filters.endDate}
        onEmotionSelect={handleEmotionSelect}
      />

      {/* Agent Empathy Scores */}
      {empathyScores.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <HeartIcon className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900">Agent Empathy Scores</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {empathyScores.map((agent, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{agent.agentName}</h4>
                  <span className="text-sm text-gray-500">{agent.totalCalls} calls</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Empathy Score:</span>
                    <span className="font-medium">{(agent.averageScore * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Improvement Rate:</span>
                    <span className="font-medium">{(agent.improvementRate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${agent.averageScore * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Emotion Analytics */}
      {enhancedEmotions.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Enhanced Emotion Analytics</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Emotion Volatility Trends */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Emotion Volatility Trends</h4>
              <div className="space-y-2">
                {volatilityTrends.slice(0, 7).map((trend, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{new Date(trend.date).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(trend.avg_volatility * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {(trend.avg_volatility * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Conversion Correlation */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Conversion by Emotion</h4>
              <div className="space-y-2">
                {conversionCorrelation.slice(0, 5).map((correlation, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {correlation.emotion_dominant}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${Math.min(correlation.conversion_rate, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {correlation.conversion_rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emotion Distribution */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Emotion Distribution</h3>
        {emotions.length === 0 ? (
          <div className="text-center py-8">
            <CpuChipIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No emotion data</h3>
            <p className="mt-1 text-sm text-gray-500">
              Emotion analysis will appear here once calls are analyzed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {emotions.map((emotion, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{emotion.emotion}</span>
                <div className="flex items-center space-x-4 flex-1 mx-4">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getEmotionColor(emotion.emotion).split(' ')[0]}`}
                      style={{ width: `${emotion.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-20 text-right">
                    {emotion.count} calls ({emotion.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Intent Distribution */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Distribution</h3>
        {intents.length === 0 ? (
          <div className="text-center py-8">
            <FunnelIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No intent data</h3>
            <p className="mt-1 text-sm text-gray-500">
              Intent analysis will appear here once calls are analyzed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {intents.map((intent, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{intent.intent}</span>
                <div className="flex items-center space-x-4 flex-1 mx-4">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getIntentColor(intent.intent).split(' ')[0]}`}
                      style={{ width: `${intent.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-20 text-right">
                    {intent.count} calls ({intent.percentage}%)
                  </span>
                </div>
            </div>
            ))}
          </div>
        )}
            </div>

      {/* Recent Call Analyses */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Call Analyses</h3>
        {analyses.length === 0 ? (
          <div className="text-center py-8">
            <EyeIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No analyses yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Call analyses will appear here once calls are completed and analyzed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.map((analysis) => (
              <div key={analysis.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-sm font-medium text-gray-900">
                        {analysis.contact?.firstName} {analysis.contact?.lastName}
                      </h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEmotionColor(analysis.emotion)}`}>
                        {analysis.emotion}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getIntentColor(analysis.intent)}`}>
                        {analysis.intent}
                      </span>
                      <span className="text-xs text-gray-500">
                        {analysis.confidence}% confidence
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {analysis.transcript?.substring(0, 100)}...
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>{analysis.objections?.length || 0} objections</span>
                      <span>{analysis.highlights?.length || 0} highlights</span>
                      <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewAnalysis(analysis)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View Analysis"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleViewEmotionJourney(analysis)}
                      className="text-purple-600 hover:text-purple-900"
                      title="View Emotion Journey"
                    >
                      <HeartIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
            </div>
            ))}
          </div>
        )}
      </div>

      {/* Call Analysis Modal */}
      {showCallAnalysis && selectedCall && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowCallAnalysis(false)}
            />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    AI Analysis - {selectedCall.contact?.firstName} {selectedCall.contact?.lastName}
                  </h3>
                  <button
                    onClick={() => setShowCallAnalysis(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {analysisLoading ? (
                  <div className="text-center py-8">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Analysis Summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Emotion Analysis</h4>
                        <div className="space-y-2 text-sm">
                          <div><span className="font-medium">Emotion:</span> {callAnalysis?.emotion || '-'}</div>
                          <div><span className="font-medium">Confidence:</span> {callAnalysis?.confidence ? `${callAnalysis.confidence}%` : '-'}</div>
                          <div><span className="font-medium">Sentiment:</span> {callAnalysis?.sentiment || '-'}</div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Intent Analysis</h4>
                        <div className="space-y-2 text-sm">
                          <div><span className="font-medium">Intent:</span> {callAnalysis?.intent || '-'}</div>
                          <div><span className="font-medium">Confidence:</span> {callAnalysis?.intentConfidence ? `${callAnalysis.intentConfidence}%` : '-'}</div>
                          <div><span className="font-medium">Outcome:</span> {callAnalysis?.outcome || '-'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Transcript */}
                    {callAnalysis?.transcript && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Transcript</h4>
                        <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{callAnalysis.transcript}</p>
                        </div>
                      </div>
                    )}

                    {/* Highlights */}
                    {callAnalysis?.highlights && callAnalysis.highlights.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Key Highlights</h4>
                        <div className="space-y-2">
                          {callAnalysis.highlights.map((highlight, index) => (
                            <div key={index} className="bg-blue-50 p-3 rounded-lg">
                              <p className="text-sm text-blue-800">{highlight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Objections */}
                    {callAnalysis?.objections && callAnalysis.objections.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Objections Detected</h4>
                        <div className="space-y-2">
                          {callAnalysis.objections.map((objection, index) => (
                            <div key={index} className="bg-red-50 p-3 rounded-lg">
                              <p className="text-sm text-red-800">{objection}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {callAnalysis?.tags && callAnalysis.tags.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-2">
                          {callAnalysis.tags.map((tag, index) => (
                            <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Tag/Highlight */}
                    <div className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Add Tag</label>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder="Enter tag..."
                              className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddTag(selectedCall.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Add Highlight</label>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder="Enter highlight..."
                              className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddHighlight(selectedCall.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emotion Journey Modal */}
      {showEmotionJourney && selectedCall && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowEmotionJourney(false)}
            />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Emotion Journey - {selectedCall.contact?.firstName} {selectedCall.contact?.lastName}
                  </h3>
                  <button
                    onClick={() => setShowEmotionJourney(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <EmotionJourney
                  callId={selectedCall.id}
                  onEmotionSelect={handleEmotionSelect}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIIntelligence;
