import React from 'react';

interface ControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  referenceWeight: number;
  filesystemWeight: number;
  onReferenceWeightChange: (weight: number) => void;
  onFilesystemWeightChange: (weight: number) => void;
}

const Controls: React.FC<ControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  onFullscreen,
  isFullscreen,
  referenceWeight,
  filesystemWeight,
  onReferenceWeightChange,
  onFilesystemWeightChange,
}) => {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Zoom Controls */}
      <div className="flex justify-center gap-2">
        <button
          onClick={onZoomIn}
          className="bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Zoom In
        </button>
        <button
          onClick={onZoomOut}
          className="bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Zoom Out
        </button>
        <button
          onClick={onReset}
          className="bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Reset View
        </button>
        <button
          onClick={onFullscreen}
          className="bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {/* Connection Weight Controls */}
      <div className="flex justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Reference Connections</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">0</span>
            <input
              type="range"
              min="0"
              max="100"
              value={referenceWeight}
              onChange={e => onReferenceWeightChange(Number(e.target.value))}
              className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500">100</span>
          </div>
          <span className="text-xs text-gray-600">{referenceWeight}%</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filesystem Connections</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">0</span>
            <input
              type="range"
              min="0"
              max="100"
              value={filesystemWeight}
              onChange={e => onFilesystemWeightChange(Number(e.target.value))}
              className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500">100</span>
          </div>
          <span className="text-xs text-gray-600">{filesystemWeight}%</span>
        </div>
      </div>
    </div>
  );
};

export default Controls;
