import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SearchMode } from '../App';

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
  const [position, setPosition] = useState({ x: 640, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, elementX: 0, elementY: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Initialize position to upper left (offset from other menus)
  useEffect(() => {
    const initializePosition = () => {
      if (controlsRef.current) {
        setPosition({
          x: 640, // Offset from node sizing menu
          y: 20,
        });
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      initializePosition();
      if (!isInitialized) {
        setTimeout(initializePosition, 100);
      }
    }
  }, [isInitialized]);

  // Handle mouse down on the draggable header
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: position.x,
      elementY: position.y,
    });
  }, [position]);

  // Handle mouse move when dragging
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStart.mouseX;
      const deltaY = e.clientY - dragStart.mouseY;

      const newX = dragStart.elementX + deltaX;
      const newY = dragStart.elementY + deltaY;

      // Constrain to viewport
      const maxX = window.innerWidth - 340; // Menu width
      const maxY = window.innerHeight - 400; // Menu height

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    },
    [isDragging, dragStart]
  );

  // Handle mouse up
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

  return (
    <div
      ref={controlsRef}
      className="fixed bg-white border-2 border-gray-200 rounded-2xl shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '340px',
        transform: 'translate3d(0, 0, 0)',
        zIndex: 1000,
        userSelect: 'none',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        cursor: isDragging ? 'grabbing' : 'grab',
        padding: '20px',
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between mb-5"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-base font-semibold text-gray-800">Search</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close search"
        >
          <span className="text-gray-500 hover:text-gray-700">×</span>
        </button>
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
