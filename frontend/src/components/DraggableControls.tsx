import React from 'react';
import { useDraggable } from '../hooks/useDraggable';

interface DraggableControlsProps {
  referenceWeight: number;
  filesystemWeight: number;
  semanticWeight: number;
  onReferenceWeightChange: (weight: number) => void;
  onFilesystemWeightChange: (weight: number) => void;
  onSemanticWeightChange: (weight: number) => void;
  onClose: () => void;
}

const DraggableControls: React.FC<DraggableControlsProps> = ({
  referenceWeight,
  filesystemWeight,
  semanticWeight,
  onReferenceWeightChange,
  onFilesystemWeightChange,
  onSemanticWeightChange,
  onClose,
}) => {
  const { position, isDragging, isInitialized, controlsRef, handleMouseDown } = useDraggable({
    initialPosition: { x: 'calc(100% - 300px)', y: 20 },
    width: 280,
  });

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
        <h3 className="text-xl font-bold text-gray-900 border-b-2 border-blue-500 pb-1">
          Connection Weights
        </h3>
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
