import React, { useState, useEffect, useCallback } from 'react';
import { History, TimelinePoint } from '../types/schema';

interface TimelineControlsProps {
  history: History | null;
  currentTimelineIndex: number;
  onTimelineChange: (index: number) => void;
  onPlay: () => void;
  onPause: () => void;
  isPlaying: boolean;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}

const TimelineControls: React.FC<TimelineControlsProps> = ({
  history,
  currentTimelineIndex,
  onTimelineChange,
  onPlay,
  onPause,
  isPlaying,
  playbackSpeed,
  onSpeedChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  if (!history || history.timelinePoints.length === 0) {
    return (
      <div className="bg-gray-100 border-t border-gray-200 p-4">
        <div className="text-center text-gray-500">
          No historical data available
        </div>
      </div>
    );
  }

  const timelinePoints = history.timelinePoints;
  const currentPoint = timelinePoints[currentTimelineIndex];

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(event.target.value);
    onTimelineChange(newIndex);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatCommitMessage = (message: string) => {
    return message.length > 50 ? message.substring(0, 50) + '...' : message;
  };

  const goToFirst = () => onTimelineChange(0);
  const goToPrevious = () => onTimelineChange(Math.max(0, currentTimelineIndex - 1));
  const goToNext = () => onTimelineChange(Math.min(timelinePoints.length - 1, currentTimelineIndex + 1));
  const goToLast = () => onTimelineChange(timelinePoints.length - 1);

  const speedOptions = [0.25, 0.5, 1, 2, 4, 8];

  return (
    <div className="bg-white border-t border-gray-200 p-4 space-y-4">
      {/* Timeline Info */}
      <div className="text-center">
        <div className="text-sm font-medium text-gray-900">
          {currentPoint && (
            <>
              Commit {currentTimelineIndex + 1} of {timelinePoints.length}
              {currentPoint.state?.timestamp && (
                <span className="text-gray-500 ml-2">
                  ({formatDate(currentPoint.state.timestamp)})
                </span>
              )}
            </>
          )}
        </div>
        {currentPoint?.state?.message && (
          <div className="text-xs text-gray-600 mt-1">
            {formatCommitMessage(currentPoint.state.message)}
          </div>
        )}
        {currentPoint?.state?.author && (
          <div className="text-xs text-gray-500">
            by {currentPoint.state.author}
          </div>
        )}
      </div>

      {/* Timeline Slider */}
      <div className="relative">
        <input
          type="range"
          min="0"
          max={timelinePoints.length - 1}
          value={currentTimelineIndex}
          onChange={handleSliderChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
              (currentTimelineIndex / (timelinePoints.length - 1)) * 100
            }%, #e5e7eb ${(currentTimelineIndex / (timelinePoints.length - 1)) * 100}%, #e5e7eb 100%)`,
          }}
        />
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center space-x-2">
        {/* Navigation */}
        <button
          onClick={goToFirst}
          disabled={currentTimelineIndex === 0}
          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          title="First commit"
        >
          ⏮
        </button>
        
        <button
          onClick={goToPrevious}
          disabled={currentTimelineIndex === 0}
          className="px-2 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous commit"
        >
          ⏪
        </button>

        {/* Play/Pause */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          title={isPlaying ? 'Pause animation' : 'Play animation'}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>

        <button
          onClick={goToNext}
          disabled={currentTimelineIndex === timelinePoints.length - 1}
          className="px-2 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next commit"
        >
          ⏩
        </button>
        
        <button
          onClick={goToLast}
          disabled={currentTimelineIndex === timelinePoints.length - 1}
          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Last commit"
        >
          ⏭
        </button>

        {/* Speed Control */}
        <div className="flex items-center space-x-2 ml-4">
          <span className="text-xs text-gray-600">Speed:</span>
          <select
            value={playbackSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="text-xs border border-gray-300 rounded px-1 py-1"
          >
            {speedOptions.map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Info */}
      <div className="text-center text-xs text-gray-500">
        Commit: {currentPoint?.commitId?.substring(0, 8) || 'Unknown'}
        {currentPoint?.snapshot && (
          <span className="ml-4">
            Files: {currentPoint.snapshot.files?.length || 0} | 
            Relationships: {currentPoint.snapshot.relationships?.length || 0}
          </span>
        )}
      </div>
    </div>
  );
};

export default TimelineControls;
