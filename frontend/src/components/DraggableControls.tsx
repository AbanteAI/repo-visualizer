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
  const [position, setPosition] = useState({ x: 0, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, elementX: 0, elementY: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Initialize position to upper right corner
  useEffect(() => {
    const initializePosition = () => {
      if (controlsRef.current) {
        const parent = controlsRef.current.parentElement;
        if (parent) {
          const parentWidth = parent.offsetWidth;
          const controlsWidth = controlsRef.current.offsetWidth || 320;

          setPosition({
            x: Math.max(0, parentWidth - controlsWidth - 20),
            y: 20,
          });
          setIsInitialized(true);
        }
      }
    };

    if (!isInitialized) {
      initializePosition();
      if (!isInitialized) {
        setTimeout(initializePosition, 100);
      }
    }
  }, [isInitialized]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!controlsRef.current) return;

    // Don't start dragging if clicking on input elements or their labels
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'LABEL' ||
      target.closest('input, label')
    ) {
      return;
    }

    // Store initial positions
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: position.x,
      elementY: position.y,
    });
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !controlsRef.current) return;

      const parent = controlsRef.current.parentElement;
      if (!parent) return;

      // Calculate how much the mouse has moved since drag started
      const deltaX = e.clientX - dragStart.mouseX;
      const deltaY = e.clientY - dragStart.mouseY;

      // Calculate new position
      const newX = dragStart.elementX + deltaX;
      const newY = dragStart.elementY + deltaY;

      // Keep within bounds - use window dimensions for better movement freedom
      const maxX = Math.max(0, parent.offsetWidth - controlsRef.current.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - controlsRef.current.offsetHeight - 40); // 40px buffer from bottom

      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle window resize to keep panel visible
  useEffect(() => {
    const handleResize = () => {
      if (controlsRef.current && isInitialized) {
        const parent = controlsRef.current.parentElement;
        if (parent) {
          const maxX = Math.max(0, parent.offsetWidth - controlsRef.current.offsetWidth);
          const maxY = Math.max(0, window.innerHeight - controlsRef.current.offsetHeight - 40);

          setPosition(prev => ({
            x: Math.max(0, Math.min(maxX, prev.x)),
            y: Math.max(0, Math.min(maxY, prev.y)),
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInitialized]);

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
      className="absolute transition-all duration-200 draggable-controls"
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: isInitialized ? position.x : 'calc(100% - 300px)',
        top: isInitialized ? position.y : '20px',
        width: '280px',
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <span className="text-base font-semibold text-gray-800">Connection Weights</span>
      </div>

      {/* Controls */}
      <div className="space-y-5">
        {/* Reference Connections */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-600">Reference</label>
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
            <label className="text-sm font-medium text-gray-600">Filesystem</label>
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
            <label className="text-sm font-medium text-gray-600">Semantic</label>
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
  );
};

export default DraggableControls;
