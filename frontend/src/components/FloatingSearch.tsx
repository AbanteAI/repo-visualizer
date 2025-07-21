import React from 'react';
import { useDraggable } from '../hooks/useDraggable';

type SearchMode = 'exact' | 'semantic';

interface FloatingSearchProps {
  searchQuery: string;
  searchMode: SearchMode;
  onSearchQueryChange: (query: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onClearSearch: () => void;
  onClose: () => void;
}

const FloatingSearch: React.FC<FloatingSearchProps> = ({
  searchQuery,
  searchMode,
  onSearchQueryChange,
  onSearchModeChange,
  onClearSearch,
  onClose,
}) => {
  const { position, isDragging, isInitialized, controlsRef, handleMouseDown } = useDraggable({
    initialPosition: { x: 640, y: 20 },
    width: 340,
  });

  return (
    <div
      ref={controlsRef}
      className="absolute transition-all duration-200 draggable-controls"
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: isInitialized ? position.x : '640px',
        top: isInitialized ? position.y : '20px',
        width: '340px',
        pointerEvents: 'auto',
        transform: 'translate3d(0, 0, 0)',
        zIndex: 1000,
        userSelect: 'none',
        backgroundColor: 'white',
        border: '2px solid #e5e7eb',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        cursor: isDragging ? 'grabbing' : 'grab',
        padding: '20px',
      }}
    >
      {/* Close button positioned absolutely in top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-red-50 border border-gray-200 text-gray-400 hover:text-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
        style={{ cursor: 'pointer' }}
        aria-label="Close"
      >
        <span className="text-lg font-bold">×</span>
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pr-12">
        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <h3 className="text-xl font-bold text-gray-900 border-b-2 border-blue-500 pb-1">Search</h3>
      </div>

      {/* Search Controls */}
      <div className="space-y-4">
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search files, components, and content..."
            value={searchQuery}
            onChange={e => onSearchQueryChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="searchMode"
                  value="exact"
                  checked={searchMode === 'exact'}
                  onChange={e => onSearchModeChange(e.target.value as SearchMode)}
                  className="text-blue-600"
                />
                <span className="text-gray-700">Exact/Boolean</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="searchMode"
                  value="semantic"
                  checked={searchMode === 'semantic'}
                  onChange={e => onSearchModeChange(e.target.value as SearchMode)}
                  className="text-blue-600"
                />
                <span className="text-gray-700">Semantic</span>
              </label>
            </div>

            {searchQuery && (
              <button
                onClick={onClearSearch}
                className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500 leading-relaxed">
          {searchMode === 'exact'
            ? 'Use quotes for exact phrases, AND/OR for boolean logic'
            : 'Semantic search (placeholder - uses fuzzy matching)'}
        </div>
      </div>
    </div>
  );
};

export default FloatingSearch;
