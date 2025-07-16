import React from 'react';

interface ControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  referenceWeight: number;
  filesystemWeight: number;
  semanticWeight: number;
  onReferenceWeightChange: (weight: number) => void;
  onFilesystemWeightChange: (weight: number) => void;
  onSemanticWeightChange: (weight: number) => void;
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
}

const Controls: React.FC<ControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  onFullscreen,
  isFullscreen,
  referenceWeight,
  filesystemWeight,
  semanticWeight,
  onReferenceWeightChange,
  onFilesystemWeightChange,
  onSemanticWeightChange,
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

      {/* Connection Weight Controls */}
      <div className="flex justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <label className="text-xs font-medium text-gray-700">Reference</label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 w-4">0</span>
            <input
              type="range"
              min="0"
              max="100"
              value={referenceWeight}
              onChange={e => onReferenceWeightChange(Number(e.target.value))}
              className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500 w-6">100</span>
          </div>
          <span className="text-xs text-gray-600">{referenceWeight}%</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <label className="text-xs font-medium text-gray-700">Filesystem</label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 w-4">0</span>
            <input
              type="range"
              min="0"
              max="100"
              value={filesystemWeight}
              onChange={e => onFilesystemWeightChange(Number(e.target.value))}
              className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500 w-6">100</span>
          </div>
          <span className="text-xs text-gray-600">{filesystemWeight}%</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <label className="text-xs font-medium text-gray-700">Semantic</label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 w-4">0</span>
            <input
              type="range"
              min="0"
              max="100"
              value={semanticWeight}
              onChange={e => onSemanticWeightChange(Number(e.target.value))}
              className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500 w-6">100</span>
          </div>
          <span className="text-xs text-gray-600">{semanticWeight}%</span>
        </div>
      </div>

      {/* Node Sizing Controls */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3 text-center">Node Sizing Factors</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-2">
            <label className="text-xs font-medium text-gray-700">File Size</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={fileSizeWeight}
                onChange={e => onFileSizeWeightChange(Number(e.target.value))}
                className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500">100</span>
            </div>
            <span className="text-xs text-gray-600">{fileSizeWeight}%</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <label className="text-xs font-medium text-gray-700">Commit Count</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={commitCountWeight}
                onChange={e => onCommitCountWeightChange(Number(e.target.value))}
                className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500">100</span>
            </div>
            <span className="text-xs text-gray-600">{commitCountWeight}%</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <label className="text-xs font-medium text-gray-700">Recency</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={recencyWeight}
                onChange={e => onRecencyWeightChange(Number(e.target.value))}
                className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500">100</span>
            </div>
            <span className="text-xs text-gray-600">{recencyWeight}%</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <label className="text-xs font-medium text-gray-700">Identifiers</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={identifiersWeight}
                onChange={e => onIdentifiersWeightChange(Number(e.target.value))}
                className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-500">100</span>
            </div>
            <span className="text-xs text-gray-600">{identifiersWeight}%</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <label className="text-xs font-medium text-gray-700">Incoming Refs</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="100"
                value={referencesWeight}
                onChange={e => onReferencesWeightChange(Number(e.target.value))}
                className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
