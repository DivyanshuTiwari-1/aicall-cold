import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../services/api';
import ErrorDisplay from './ErrorDisplay';
import LoadingSpinner from './LoadingSpinner';

const EmotionJourney = ({ callId, onEmotionSelect }) => {
  const [selectedTurn, setSelectedTurn] = useState(null);
  const [showIntensity, setShowIntensity] = useState(true);
  const [showConfidence, setShowConfidence] = useState(false);

  // Fetch emotion journey data
  const { data: emotionJourney, isLoading, error, refetch } = useQuery({
    queryKey: ['emotion-journey', callId],
    queryFn: async () => {
      const response = await api.get(`/ai-intelligence/emotion-journey/${callId}`);
      return response.data.emotionJourney;
    },
    enabled: !!callId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000 // 5 minutes
  }); 

  // Transform data for charts
  const transformDataForChart = () => {
    if (!emotionJourney) return [];

    return emotionJourney.map((turn, index) => ({
      ...turn,
      index,
      intensityValue: turn.intensity * 100, // Scale for better visualization
      confidenceValue: turn.confidence * 100,
      emotionValue: getEmotionNumericValue(turn.emotion),
      displayTime: formatTime(turn.timestamp)
    }));
  };

  const getEmotionNumericValue = (emotion) => {
    const emotionValues = {
      'negative': 0,
      'frustrated': 1,
      'confused': 2,
      'neutral': 3,
      'curious': 4,
      'positive': 5,
      'excited': 6
    };
    return emotionValues[emotion] || 3;
  };

  const getEmotionColor = (emotion) => {
    const colors = {
      positive: '#10B981',
      negative: '#EF4444',
      neutral: '#6B7280',
      curious: '#3B82F6',
      confused: '#F59E0B',
      frustrated: '#DC2626',
      excited: '#8B5CF6'
    };
    return colors[emotion] || '#6B7280';
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleTurnClick = (turn) => {
    setSelectedTurn(turn);
    if (onEmotionSelect) {
      onEmotionSelect(turn);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">
            Turn {data.index + 1} - {data.displayTime}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Speaker:</span> {data.speaker}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Emotion:</span>
            <span
              className="ml-1 px-2 py-1 rounded text-xs text-white"
              style={{ backgroundColor: getEmotionColor(data.emotion) }}
            >
              {data.emotion}
            </span>
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Intensity:</span> {(data.intensity * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Confidence:</span> {(data.confidence * 100).toFixed(1)}%
          </p>
          {data.textSnippet && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                <span className="font-medium">Text:</span> {data.textSnippet}
              </p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-64">
        <ErrorDisplay
          error={error}
          onRetry={refetch}
          title="Failed to load emotion journey"
        />
      </div>
    );
  }

  if (!emotionJourney || emotionJourney.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No emotion data available</p>
          <p className="text-sm">This call doesn't have detailed emotion tracking yet.</p>
        </div>
      </div>
    );
  }

  const chartData = transformDataForChart();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Emotion Journey</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showIntensity}
                onChange={(e) => setShowIntensity(e.target.checked)}
                className="rounded border-gray-300"
              />
              Show Intensity
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showConfidence}
                onChange={(e) => setShowConfidence(e.target.checked)}
                className="rounded border-gray-300"
              />
              Show Confidence
            </label>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Track how emotions change throughout the call. Click on data points to view details.
        </p>
      </div>

      {/* Emotion Timeline Chart */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 mb-3">Emotion Progression</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} onClick={handleTurnClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `Turn ${value + 1}`}
              />
              <YAxis
                domain={[0, 6]}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const emotions = ['Negative', 'Frustrated', 'Confused', 'Neutral', 'Curious', 'Positive', 'Excited'];
                  return emotions[value] || '';
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="emotionValue"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={getEmotionColor(payload.emotion)}
                      stroke="#fff"
                      strokeWidth={2}
                      className="cursor-pointer hover:r-6 transition-all"
                    />
                  );
                }}
                activeDot={{ r: 6, fill: '#3B82F6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Intensity and Confidence Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {showIntensity && (
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Emotion Intensity</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="index" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [`${value.toFixed(1)}%`, 'Intensity']}
                    labelFormatter={(value) => `Turn ${value + 1}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="intensityValue"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={{ fill: '#F59E0B', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {showConfidence && (
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Analysis Confidence</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="index" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [`${value.toFixed(1)}%`, 'Confidence']}
                    labelFormatter={(value) => `Turn ${value + 1}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="confidenceValue"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ fill: '#8B5CF6', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Turn Details */}
      {selectedTurn && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Turn Details</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Turn:</span>
              <span className="ml-2 font-medium">{selectedTurn.index + 1}</span>
            </div>
            <div>
              <span className="text-gray-600">Time:</span>
              <span className="ml-2 font-medium">{selectedTurn.displayTime}</span>
            </div>
            <div>
              <span className="text-gray-600">Speaker:</span>
              <span className="ml-2 font-medium capitalize">{selectedTurn.speaker}</span>
            </div>
            <div>
              <span className="text-gray-600">Emotion:</span>
              <span
                className="ml-2 px-2 py-1 rounded text-xs text-white font-medium"
                style={{ backgroundColor: getEmotionColor(selectedTurn.emotion) }}
              >
                {selectedTurn.emotion}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Intensity:</span>
              <span className="ml-2 font-medium">{(selectedTurn.intensity * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-600">Confidence:</span>
              <span className="ml-2 font-medium">{(selectedTurn.confidence * 100).toFixed(1)}%</span>
            </div>
          </div>
          {selectedTurn.textSnippet && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <span className="text-gray-600 text-sm">Text Snippet:</span>
              <p className="mt-1 text-sm text-gray-800 bg-white p-2 rounded border">
                {selectedTurn.textSnippet}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Emotion Legend */}
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Emotion Legend</h4>
        <div className="flex flex-wrap gap-3">
          {['positive', 'negative', 'neutral', 'curious', 'confused', 'frustrated', 'excited'].map(emotion => (
            <div key={emotion} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: getEmotionColor(emotion) }}
              />
              <span className="text-xs font-medium capitalize">{emotion}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmotionJourney;
