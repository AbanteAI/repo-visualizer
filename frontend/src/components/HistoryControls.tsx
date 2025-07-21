import React, { useState, useEffect, useCallback } from 'react';
import { RepositoryData } from '../types/schema';

interface HistoryControlsProps {
  data: RepositoryData;
  currentTimelineIndex: number;
  onTimelineChange: (index: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onBranchChange?: (branch: string) => void;
  isPlaying?: boolean;
  animationSpeed?: number;
  onSpeedChange?: (speed: number) => void;
}

export const HistoryControls: React.FC<HistoryControlsProps> = ({
  data,
  currentTimelineIndex,
  onTimelineChange,
  onPlay,
  onPause,
  onBranchChange,
  isPlaying = false,
  animationSpeed = 1000,
  onSpeedChange,
}) => {
  const timelinePoints = data.history?.timelinePoints || [];
  const branches = data.metadata.branches || [];
  const currentBranch = data.metadata.analyzedBranch || 'main';

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't trigger shortcuts when typing in inputs
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isPlaying) {
            onPause();
          } else {
            onPlay();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentTimelineIndex > 0) {
            onTimelineChange(currentTimelineIndex - 1);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentTimelineIndex < timelinePoints.length - 1) {
            onTimelineChange(currentTimelineIndex + 1);
          }
          break;
        case 'Home':
          e.preventDefault();
          onTimelineChange(0);
          break;
        case 'End':
          e.preventDefault();
          onTimelineChange(timelinePoints.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, currentTimelineIndex, timelinePoints.length, onPlay, onPause, onTimelineChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value);
    onTimelineChange(newIndex);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSpeedChange) {
      const speed = parseInt(e.target.value);
      onSpeedChange(speed);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  const formatCommitId = (commitId: string) => {
    return commitId.substring(0, 8);
  };

  if (!timelinePoints.length) {
    return (
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="text-center text-gray-500">
          No history data available. Re-run the analyzer with history sampling to enable timeline
          features.
        </div>
      </div>
    );
  }

  const currentPoint = timelinePoints[currentTimelineIndex];
  const progress =
    timelinePoints.length > 1 ? (currentTimelineIndex / (timelinePoints.length - 1)) * 100 : 0;

  return (
    <div className="bg-white border-t border-gray-200 p-4 space-y-4">
      {/* Branch Selection */}
      {branches.length > 1 && onBranchChange && (
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Branch:</label>
          <select
            value={currentBranch}
            onChange={e => onBranchChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            {branches.map(branch => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Timeline Slider */}
      <div className="space-y-2">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onTimelineChange(Math.max(0, currentTimelineIndex - 1))}
            disabled={currentTimelineIndex === 0}
            className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300"
            title="Previous commit (←)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <button
            onClick={isPlaying ? onPause : onPlay}
            className="p-2 text-blue-600 hover:text-blue-800"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          <button
            onClick={() =>
              onTimelineChange(Math.min(timelinePoints.length - 1, currentTimelineIndex + 1))
            }
            disabled={currentTimelineIndex === timelinePoints.length - 1}
            className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300"
            title="Next commit (→)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <div className="flex-1 px-4">
            <div className="relative">
              <input
                type="range"
                min="0"
                max={Math.max(0, timelinePoints.length - 1)}
                value={currentTimelineIndex}
                onChange={handleSliderChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div
                className="absolute top-0 left-0 h-2 bg-blue-600 rounded-lg pointer-events-none"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>
                {timelinePoints.length > 0 ? formatDate(timelinePoints[0].state.timestamp) : ''}
              </span>
              <span>
                {timelinePoints.length > 0
                  ? formatDate(timelinePoints[timelinePoints.length - 1].state.timestamp)
                  : ''}
              </span>
            </div>
          </div>

          {/* Speed Control */}
          {onSpeedChange && (
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Speed:</label>
              <input
                type="range"
                min="100"
                max="3000"
                step="100"
                value={animationSpeed}
                onChange={handleSpeedChange}
                className="w-16"
              />
              <span className="text-xs text-gray-500 w-8">
                {Math.round((1000 / animationSpeed) * 10) / 10}x
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Current Commit Info */}
      {currentPoint && (
        <div className="flex items-center justify-between text-sm bg-gray-50 rounded p-3">
          <div className="flex-1">
            <div className="font-medium text-gray-900">
              {formatCommitId(currentPoint.commitId)} - {currentPoint.state.message}
            </div>
            <div className="text-gray-600">
              {currentPoint.state.author} • {formatDate(currentPoint.state.timestamp)} •
              {currentTimelineIndex + 1} of {timelinePoints.length}
            </div>
          </div>

          {/* File Lifecycle Indicators */}
          <div className="flex items-center space-x-3 text-xs">
            {currentPoint.snapshot.fileLifecycle.added.length > 0 && (
              <span className="text-green-600 flex items-center">
                <span className="w-2 h-2 bg-green-600 rounded-full mr-1"></span>+
                {currentPoint.snapshot.fileLifecycle.added.length}
              </span>
            )}
            {currentPoint.snapshot.fileLifecycle.removed.length > 0 && (
              <span className="text-red-600 flex items-center">
                <span className="w-2 h-2 bg-red-600 rounded-full mr-1"></span>-
                {currentPoint.snapshot.fileLifecycle.removed.length}
              </span>
            )}
            {currentPoint.snapshot.fileLifecycle.renamed.length > 0 && (
              <span className="text-blue-600 flex items-center">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-1"></span>~
                {currentPoint.snapshot.fileLifecycle.renamed.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* History Range Info */}
      {data.metadata.historyRange && (
        <div className="text-xs text-gray-500 text-center">
          Showing {data.metadata.historyRange.sampledCommits} of{' '}
          {data.metadata.historyRange.totalCommits} commits
        </div>
      )}
    </div>
  );
};

export default HistoryControls;
