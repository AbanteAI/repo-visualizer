import React, { useState, useRef, useEffect, useCallback } from 'react';

interface DraggableControlsProps {
  referenceWeight: number;
  filesystemWeight: number;
  semanticWeight: number;
  onReferenceWeightChange: (weight: number) => void;
  onFilesystemWeightChange: (weight: number) => void;
  onSemanticWeightChange: (weight: number) => void;
}

const DraggableControls: React.FC<DraggableControlsProps> = ({
  referenceWeight,
  filesystemWeight,
  semanticWeight,
  onReferenceWeightChange,
  onFilesystemWeightChange,
  onSemanticWeightChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Initialize position to upper right corner
  useEffect(() => {
    if (!isInitialized && controlsRef.current) {
      const parent = controlsRef.current.parentElement;
      if (parent) {
        const parentWidth = parent.offsetWidth;
        const controlsWidth = controlsRef.current.offsetWidth;
        setPosition({
          x: parentWidth - controlsWidth - 20,
          y: 20,
        });
        setIsInitialized(true);
      }
    }
  }, [isInitialized]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!controlsRef.current) return;

    const rect = controlsRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !controlsRef.current) return;

      const parentRect = controlsRef.current.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const newX = e.clientX - parentRect.left - dragOffset.x;
      const newY = e.clientY - parentRect.top - dragOffset.y;

      // Keep within bounds
      const maxX = parentRect.width - controlsRef.current.offsetWidth;
      const maxY = parentRect.height - controlsRef.current.offsetHeight;

      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    },
    [isDragging, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Clamp position when container resizes
  const clampPosition = useCallback(() => {
    if (!controlsRef.current || !isInitialized) return;

    const parent = controlsRef.current.parentElement;
    if (!parent) return;

    const parentWidth = parent.offsetWidth;
    const parentHeight = parent.offsetHeight;
    const controlsWidth = controlsRef.current.offsetWidth;
    const controlsHeight = controlsRef.current.offsetHeight;

    const maxX = parentWidth - controlsWidth;
    const maxY = parentHeight - controlsHeight;

    setPosition(prev => ({
      x: Math.max(0, Math.min(maxX, prev.x)),
      y: Math.max(0, Math.min(maxY, prev.y)),
    }));
  }, [isInitialized]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      clampPosition();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={controlsRef}
      className="absolute z-50 bg-white rounded-lg shadow-lg border transition-all duration-200 draggable-controls"
      style={{
        left: position.x,
        top: position.y,
        minWidth: '280px',
        pointerEvents: 'auto',
      }}
    >
      {/* Header - Only this area is draggable */}
      <div
        className={`flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm font-medium text-gray-700 ml-2">Connection Weights</span>
        </div>
        <button
          onClick={e => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
          aria-label={isExpanded ? 'Collapse controls' : 'Expand controls'}
        >
          <svg
            className={`w-4 h-4 text-gray-600 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expandable Content */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 space-y-4">
          {/* Reference Connections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Reference</label>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
                  {referenceWeight}%
                </span>
              </div>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={referenceWeight}
                onChange={e => onReferenceWeightChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-blue"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${referenceWeight}%, #e5e7eb ${referenceWeight}%, #e5e7eb 100%)`,
                }}
                aria-label="Reference connections weight"
              />
            </div>
          </div>

          {/* Filesystem Connections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Filesystem</label>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
                  {filesystemWeight}%
                </span>
              </div>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={filesystemWeight}
                onChange={e => onFilesystemWeightChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-red"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${filesystemWeight}%, #e5e7eb ${filesystemWeight}%, #e5e7eb 100%)`,
                }}
                aria-label="Filesystem connections weight"
              />
            </div>
          </div>

          {/* Semantic Connections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Semantic</label>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
                  {semanticWeight}%
                </span>
              </div>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={semanticWeight}
                onChange={e => onSemanticWeightChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-green"
                style={{
                  background: `linear-gradient(to right, #22c55e 0%, #22c55e ${semanticWeight}%, #e5e7eb ${semanticWeight}%, #e5e7eb 100%)`,
                }}
                aria-label="Semantic connections weight"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Collapsed State Indicator */}
      {!isExpanded && (
        <div className="p-3 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>{referenceWeight}%</span>
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>{filesystemWeight}%</span>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>{semanticWeight}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraggableControls;
