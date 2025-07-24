import React from 'react';
import FloatingMenu from './FloatingMenu';

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
  return (
    <FloatingMenu
      title="Node Sizing"
      titleColor="purple-500"
      initialPosition={{ x: 320, y: 20 }}
      initialSize={{ width: 300, height: 450 }}
      minSize={{ width: 280, height: 350 }}
      onClose={onClose}
    >
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
    </FloatingMenu>
  );
};

export default FloatingNodeSizing;
