import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RepositoryData } from '../types/schema';

interface FloatingHistoryControlsProps {
  data: RepositoryData;
  currentTimelineIndex: number;
  onTimelineChange: (index: number) => void;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  animationSpeed: number;
  onSpeedChange: (speed: number) => void;
  onBranchChange?: (branch: string) => void;
  currentBranch: string;
  onClose: () => void;
}

const FloatingHistoryControls: React.FC<FloatingHistoryControlsProps> = ({
  data,
  currentTimelineIndex,
  onTimelineChange,
  isPlaying,
  onPlay,
  onPause,
  animationSpeed,
  onSpeedChange,
  onBranchChange,
  currentBranch,
  onClose,
}) => {
  const [position, setPosition] = useState({ x: 20, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const timelinePoints = data.history?.timelinePoints || [];
  const branches = data.metadata.branches || [];

  // Handle mouse events for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    },
    [isDragging, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Set up global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle when the floating panel is visible
      switch (e.code) {
        case 'Space':
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
    const newSpeed = parseInt(e.target.value);
    onSpeedChange(newSpeed);
  };

  if (timelinePoints.length === 0) {
    return null;
  }

  const currentPoint = timelinePoints[currentTimelineIndex];
  const progress =
    timelinePoints.length > 1 ? (currentTimelineIndex / (timelinePoints.length - 1)) * 100 : 0;

  return (
    <div
      ref={panelRef}
      className="fixed bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: '320px',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b pb-2">
        <h3 className="text-sm font-semibold text-gray-700">History Controls</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 font-bold text-lg leading-none"
          style={{ cursor: 'pointer' }}
          onMouseDown={e => e.stopPropagation()}
        >
          ×
        </button>
      </div>

      {/* Branch Selection */}
      {branches.length > 1 && onBranchChange && (
        <div className="flex items-center space-x-2 mb-4" onMouseDown={e => e.stopPropagation()}>
          <label className="text-sm font-medium text-gray-700">Branch:</label>
          <select
            value={currentBranch}
            onChange={e => onBranchChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 flex-1"
          >
            {branches.map(branch => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Playback Controls */}
      <div className="flex items-center justify-center space-x-3 mb-4">
        <button
          onClick={() => onTimelineChange(Math.max(0, currentTimelineIndex - 1))}
          disabled={currentTimelineIndex === 0}
          className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300 font-bold text-lg border rounded"
          title="Previous commit (←)"
          onMouseDown={e => e.stopPropagation()}
        >
          ←
        </button>

        <button
          onClick={isPlaying ? onPause : onPlay}
          className="p-2 text-blue-600 hover:text-blue-800 font-bold text-lg border rounded"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          onMouseDown={e => e.stopPropagation()}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          onClick={() =>
            onTimelineChange(Math.min(timelinePoints.length - 1, currentTimelineIndex + 1))
          }
          disabled={currentTimelineIndex === timelinePoints.length - 1}
          className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300 font-bold text-lg border rounded"
          title="Next commit (→)"
          onMouseDown={e => e.stopPropagation()}
        >
          →
        </button>
      </div>

      {/* Timeline Scrubber */}
      <div className="mb-4" onMouseDown={e => e.stopPropagation()}>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>
            Timeline ({currentTimelineIndex + 1} of {timelinePoints.length})
          </span>
          <span>{currentPoint?.date ? new Date(currentPoint.date).toLocaleDateString() : ''}</span>
        </div>
        <div className="relative">
          <input
            type="range"
            min={0}
            max={timelinePoints.length - 1}
            value={currentTimelineIndex}
            onChange={handleSliderChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div
            className="absolute top-0 left-0 h-2 bg-blue-600 rounded-lg pointer-events-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Animation Speed Control */}
      <div className="mb-4" onMouseDown={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Speed</span>
          <span className="text-xs text-gray-500">{(1000 / animationSpeed).toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="100"
          max="10000"
          step="100"
          value={animationSpeed}
          onChange={handleSpeedChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Current Commit Info */}
      <div className="text-xs text-gray-600 space-y-1">
        <div>
          <strong>Commit:</strong> {currentPoint?.commitId.substring(0, 8)}
        </div>
        <div>
          <strong>Date:</strong>{' '}
          {currentPoint?.date ? new Date(currentPoint.date).toLocaleString() : 'Unknown'}
        </div>
        <div>
          <strong>Message:</strong> {currentPoint?.message || 'No message'}
        </div>
        {currentPoint?.snapshot?.fileLifecycle && (
          <div className="text-green-600">
            <strong>Changes:</strong>{' '}
            {currentPoint.snapshot.fileLifecycle.added.length > 0 &&
              `+${currentPoint.snapshot.fileLifecycle.added.length} `}
            {currentPoint.snapshot.fileLifecycle.removed.length > 0 &&
              `-${currentPoint.snapshot.fileLifecycle.removed.length} `}
            {currentPoint.snapshot.fileLifecycle.renamed.length > 0 &&
              `~${currentPoint.snapshot.fileLifecycle.renamed.length} `}
          </div>
        )}
      </div>

      {/* Keyboard shortcuts info */}
      <div className="text-xs text-gray-400 mt-2 pt-2 border-t">
        <strong>Shortcuts:</strong> Space (play/pause), ←→ (navigate), Home/End
      </div>
    </div>
  );
};

export default FloatingHistoryControls;
