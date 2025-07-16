import React from 'react';

export type SearchMode = 'exact' | 'semantic';

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
  searchQuery: string;
  searchMode: SearchMode;
  onSearchQueryChange: (query: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onClearSearch: () => void;
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
  searchQuery,
  searchMode,
  onSearchQueryChange,
  onSearchModeChange,
  onClearSearch,
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
    <div className="flex flex-col gap-4 p-4">
      {/* Search Controls */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-center gap-2">
          <div className="flex flex-col gap-1">
            <input
              type="text"
              placeholder="Search files, components, and content..."
              value={searchQuery}
              onChange={e => onSearchQueryChange(e.target.value)}
              className="w-80 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="searchMode"
                  value="exact"
                  checked={searchMode === 'exact'}
                  onChange={() => onSearchModeChange('exact')}
                  className="text-blue-600"
                />
                <span className="text-xs text-gray-600">Exact/Boolean</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="searchMode"
                  value="semantic"
                  checked={searchMode === 'semantic'}
                  onChange={() => onSearchModeChange('semantic')}
                  className="text-blue-600"
                />
                <span className="text-xs text-gray-600">Semantic</span>
              </label>
              {searchQuery && (
                <button
                  onClick={onClearSearch}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 text-center">
          {searchMode === 'exact'
            ? 'Use quotes for exact phrases, AND/OR for boolean logic'
            : 'Semantic search (placeholder - uses fuzzy matching)'}
        </div>
      </div>

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

        <div className="flex flex-col items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Semantic Connections</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">0</span>
            <input
              type="range"
              min="0"
              max="100"
              value={semanticWeight}
              onChange={e => onSemanticWeightChange(Number(e.target.value))}
              className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500">100</span>
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
