import React from 'react';
import { TimelinePoint } from '../types/schema';

interface ControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  // Node sizing controls
  fileSizeWeight: number;
  commitCountWeight: number;
  recencyWeight: number;
  identifiersWeight: number;
  referencesWeight: number;
  onFileSizeWeightChange: (weight: number) => void;
  onCommitCountWeightChange: (weight: number) => void;
  onRecencyWeightChange: (weight: number) => void;
  onIdentifiersWeightChange: (weight: number) => void;
  onReferencesWeightChange: (weight: number) => void;
  // Timeline controls
  timelinePoints: TimelinePoint[];
  currentTimelineIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTimelineChange: (index: number) => void;
  onPlayPause: () => void;
  onPlaybackSpeedChange: (speed: number) => void;
  timelineInfo: any;
}

const Controls: React.FC<ControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  onFullscreen,
  isFullscreen,
  // Node sizing controls
  fileSizeWeight,
  commitCountWeight,
  recencyWeight,
  identifiersWeight,
  referencesWeight,
  onFileSizeWeightChange,
  onCommitCountWeightChange,
  onRecencyWeightChange,
  onIdentifiersWeightChange,
  onReferencesWeightChange,
  // Timeline controls
  timelinePoints,
  currentTimelineIndex,
  isPlaying,
  playbackSpeed,
  onTimelineChange,
  onPlayPause,
  onPlaybackSpeedChange,
  timelineInfo,
}) => {
  return (
    <div className="flex flex-col gap-2 p-2">
      {/* Zoom Controls */}
      <div className="flex justify-center gap-2">
        <button
          onClick={onZoomIn}
          className="bg-blue-600 text-white py-1 px-2 rounded text-xs hover:bg-blue-700 transition-colors"
        >
          Zoom In
        </button>
        <button
          onClick={onZoomOut}
          className="bg-blue-600 text-white py-1 px-2 rounded text-xs hover:bg-blue-700 transition-colors"
        >
          Zoom Out
        </button>
        <button
          onClick={onReset}
          className="bg-blue-600 text-white py-1 px-2 rounded text-xs hover:bg-blue-700 transition-colors"
        >
          Reset View
        </button>
        <button
          onClick={onFullscreen}
          className="bg-blue-600 text-white py-1 px-2 rounded text-xs hover:bg-blue-700 transition-colors"
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {/* Timeline Controls */}
      {timelinePoints.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 text-center">Repository Timeline</h3>

          {/* Play Controls */}
          <div className="flex justify-center gap-2 items-center">
            <button
              onClick={onPlayPause}
              className="bg-green-600 text-white py-1 px-3 rounded text-sm hover:bg-green-700 transition-colors"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <select
              value={playbackSpeed}
              onChange={e => onPlaybackSpeedChange(Number(e.target.value))}
              className="bg-gray-100 border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
            </select>

            <button
              onClick={() => onTimelineChange(-1)}
              disabled={currentTimelineIndex === -1}
              className="bg-gray-600 text-white py-1 px-3 rounded text-sm hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Current
            </button>
          </div>

          {/* Timeline Scrubber */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">First</span>
            <input
              type="range"
              min={0}
              max={timelinePoints.length - 1}
              value={currentTimelineIndex === -1 ? timelinePoints.length - 1 : currentTimelineIndex}
              onChange={e => onTimelineChange(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500">Latest</span>
          </div>

          {/* Timeline Info */}
          <div className="text-center text-xs text-gray-600">
            {currentTimelineIndex === -1 ? (
              <span>Current State</span>
            ) : timelineInfo ? (
              <div className="flex flex-col gap-1">
                <span>
                  Commit {currentTimelineIndex + 1} of {timelinePoints.length}
                </span>
                <span className="font-mono text-xs">
                  {timelineInfo.message?.substring(0, 50)}
                  {timelineInfo.message?.length > 50 ? '...' : ''}
                </span>
                <span className="text-gray-500">
                  {timelineInfo.author} • {new Date(timelineInfo.timestamp).toLocaleDateString()}
                </span>
              </div>
            ) : (
              <span>
                Timeline point {currentTimelineIndex + 1} of {timelinePoints.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Node Sizing Controls */}
      <div className="border-t pt-2">
        <h3 className="text-xs font-medium text-gray-700 mb-2 text-center">Node Sizing Factors</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1">
            <label className="text-xs font-medium text-gray-700">File Size</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={fileSizeWeight}
                onChange={e => onFileSizeWeightChange(Number(e.target.value))}
                className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500">100</span>
            </div>
            <span className="text-xs text-gray-600">{fileSizeWeight}%</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <label className="text-xs font-medium text-gray-700">Commit Count</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={commitCountWeight}
                onChange={e => onCommitCountWeightChange(Number(e.target.value))}
                className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500">100</span>
            </div>
            <span className="text-xs text-gray-600">{commitCountWeight}%</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <label className="text-xs font-medium text-gray-700">Recency</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={recencyWeight}
                onChange={e => onRecencyWeightChange(Number(e.target.value))}
                className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500">100</span>
            </div>
            <span className="text-xs text-gray-600">{recencyWeight}%</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <label className="text-xs font-medium text-gray-700">Identifiers</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={identifiersWeight}
                onChange={e => onIdentifiersWeightChange(Number(e.target.value))}
                className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500">100</span>
            </div>
            <span className="text-xs text-gray-600">{identifiersWeight}%</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <label className="text-xs font-medium text-gray-700">Incoming Refs</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={referencesWeight}
                onChange={e => onReferencesWeightChange(Number(e.target.value))}
                className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500">100</span>
            </div>
            <span className="text-xs text-gray-600">{referencesWeight}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;
