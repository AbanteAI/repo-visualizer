import React from 'react';
import { useDraggable } from '../hooks/useDraggable';

interface FloatingNodeSizingProps {
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
  onClose: () => void;
}

const FloatingNodeSizing: React.FC<FloatingNodeSizingProps> = ({
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
  onClose,
}) => {
  const { position, isDragging, isInitialized, controlsRef, handleMouseDown } = useDraggable({
    initialPosition: { x: 320, y: 20 },
    width: 300,
  });

  return (
    <div
      ref={controlsRef}
      className="absolute transition-all duration-200 draggable-controls"
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: isInitialized ? position.x : '320px',
        top: isInitialized ? position.y : '20px',
        width: '300px',
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
        <h3 className="text-xl font-bold text-gray-900 border-b-2 border-purple-500 pb-1">
          Node Sizing
        </h3>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* File Size */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-600">File Size</label>
            <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
              {fileSizeWeight}%
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={fileSizeWeight}
              onChange={e => onFileSizeWeightChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${fileSizeWeight}%, #e5e7eb ${fileSizeWeight}%, #e5e7eb 100%)`,
              }}
              aria-label="File size weight"
            />
          </div>
        </div>

        {/* Commit Count */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-600">Commit Count</label>
            <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
              {commitCountWeight}%
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={commitCountWeight}
              onChange={e => onCommitCountWeightChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${commitCountWeight}%, #e5e7eb ${commitCountWeight}%, #e5e7eb 100%)`,
              }}
              aria-label="Commit count weight"
            />
          </div>
        </div>

        {/* Recency */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-600">Recency</label>
            <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
              {recencyWeight}%
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={recencyWeight}
              onChange={e => onRecencyWeightChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${recencyWeight}%, #e5e7eb ${recencyWeight}%, #e5e7eb 100%)`,
              }}
              aria-label="Recency weight"
            />
          </div>
        </div>

        {/* Identifiers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-600">Identifiers</label>
            <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
              {identifiersWeight}%
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={identifiersWeight}
              onChange={e => onIdentifiersWeightChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${identifiersWeight}%, #e5e7eb ${identifiersWeight}%, #e5e7eb 100%)`,
              }}
              aria-label="Identifiers weight"
            />
          </div>
        </div>

        {/* Incoming References */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-600">Incoming Refs</label>
            <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
              {referencesWeight}%
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={referencesWeight}
              onChange={e => onReferencesWeightChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${referencesWeight}%, #e5e7eb ${referencesWeight}%, #e5e7eb 100%)`,
              }}
              aria-label="References weight"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingNodeSizing;
