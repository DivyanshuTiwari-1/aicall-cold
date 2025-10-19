import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import api from '../services/api';
import ErrorDisplay from './ErrorDisplay';
import LoadingSpinner from './LoadingSpinner';

const EmotionHeatmap = ({ startDate, endDate, onEmotionSelect }) => {
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);

  // Fetch emotion heatmap data
  const { data: heatmapData, isLoading, error, refetch } = useQuery({
    queryKey: ['emotion-heatmap', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(`/ai-intelligence/emotion-heatmap?${params}`);
      return response.data.heatmapData;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Transform data for recharts
  const transformDataForChart = () => {
    if (!heatmapData || typeof heatmapData !== 'object') return [];

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const emotions = ['positive', 'negative', 'neutral', 'curious', 'confused', 'frustrated', 'excited'];

    const chartData = [];

    days.forEach((day, dayIndex) => {
      hours.forEach(hour => {
        const dayData = heatmapData[day] || {};
        const hourData = dayData[hour] || {};

        emotions.forEach(emotion => {
          const emotionData = hourData[emotion] || { count: 0, avgIntensity: 0 };

          chartData.push({
            day: dayIndex,
            hour: hour,
            emotion: emotion,
            count: emotionData.count || 0,
            intensity: emotionData.avgIntensity || 0,
            value: emotionData.count || 0, // For heatmap visualization
            x: dayIndex,
            y: hour,
            z: emotionData.count || 0
          });
        });
      });
    });

    return chartData;
  };

  const handleCellClick = (data) => {
    if (data && data.emotion && data.count > 0) {
      setSelectedEmotion(data.emotion);
      setSelectedTimeSlot({ day: data.day, hour: data.hour });

      if (onEmotionSelect && typeof onEmotionSelect === 'function') {
        onEmotionSelect({
          emotion: data.emotion,
          day: data.day,
          hour: data.hour,
          count: data.count,
          intensity: data.intensity
        });
      }
    }
  };

  const getEmotionColor = (emotion) => {
    if (!emotion || typeof emotion !== 'string') return '#6B7280';

    const colors = {
      positive: '#10B981', // green
      negative: '#EF4444', // red
      neutral: '#6B7280', // gray
      curious: '#3B82F6', // blue
      confused: '#F59E0B', // yellow
      frustrated: '#DC2626', // dark red
      excited: '#8B5CF6' // purple
    };
    return colors[emotion] || '#6B7280';
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
          title="Failed to load emotion heatmap"
        />
      </div>
    );
  }

  const chartData = transformDataForChart();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Emotion Heatmap</h3>
        <p className="text-sm text-gray-600">
          Emotion distribution by day of week and hour of day. Click on cells to view details.
        </p>
      </div>

      {/* Emotion Legend */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-4">
          {['positive', 'negative', 'neutral', 'curious', 'confused', 'frustrated', 'excited'].map(emotion => (
            <div key={emotion} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: getEmotionColor(emotion) }}
              />
              <span className="text-sm font-medium capitalize">{emotion}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Hour labels */}
          <div className="flex">
            <div className="w-16 flex-shrink-0"></div>
            {days.map((day, index) => (
              <div key={day} className="flex-1 text-center text-xs font-medium text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Heatmap rows */}
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="flex items-center">
              <div className="w-16 flex-shrink-0 text-xs font-medium text-gray-600 py-1">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {days.map((_, dayIndex) => {
                const cellData = chartData.find(
                  d => d.day === dayIndex && d.hour === hour
                );

                const maxCount = chartData.length > 0 ? Math.max(...chartData.map(d => d.count || 0)) : 1;
                const intensity = cellData && maxCount > 0 ? (cellData.count || 0) / maxCount : 0;

                // Find dominant emotion for this time slot
                const timeSlotData = heatmapData?.[fullDays[dayIndex]]?.[hour] || {};
                const dominantEmotion = Object.keys(timeSlotData).length > 0 ?
                  Object.keys(timeSlotData).reduce((a, b) =>
                    (timeSlotData[a]?.count || 0) > (timeSlotData[b]?.count || 0) ? a : b
                  ) : null;

                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className="flex-1 h-8 border border-gray-200 cursor-pointer hover:border-gray-400 transition-colors"
                    style={{
                      backgroundColor: dominantEmotion && intensity > 0 ?
                        `${getEmotionColor(dominantEmotion)}${Math.floor(intensity * 255).toString(16).padStart(2, '0')}` :
                        '#f9fafb'
                    }}
                    onClick={() => handleCellClick(cellData)}
                    title={`${days[dayIndex]} ${hour.toString().padStart(2, '0')}:00 - ${cellData?.count || 0} calls`}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      {cellData && cellData.count > 0 && (
                        <span className="text-xs font-medium text-white drop-shadow-sm">
                          {cellData.count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Cell Details */}
      {selectedEmotion && selectedTimeSlot && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Selected Time Slot</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Day:</span>
              <span className="ml-2 font-medium">{days[selectedTimeSlot.day] || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-gray-600">Hour:</span>
              <span className="ml-2 font-medium">{selectedTimeSlot.hour?.toString().padStart(2, '0') || '00'}:00</span>
            </div>
            <div>
              <span className="text-gray-600">Emotion:</span>
              <span className="ml-2 font-medium capitalize">{selectedEmotion || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-gray-600">Call Count:</span>
              <span className="ml-2 font-medium">
                {heatmapData?.[fullDays[selectedTimeSlot.day]]?.[selectedTimeSlot.hour]?.[selectedEmotion]?.count || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Intensity Scale */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <span>Intensity:</span>
        <div className="flex items-center gap-1">
          <span>Low</span>
          <div className="w-16 h-3 bg-gradient-to-r from-gray-200 to-blue-500 rounded"></div>
          <span>High</span>
        </div>
      </div>
    </div>
  );
};

export default EmotionHeatmap;
