import React from 'react';
import FloatingMenu from './FloatingMenu';

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
  return (
    <FloatingMenu
      title="Connection Weights"
      titleColor="blue-500"
      initialPosition={{ x: typeof window !== 'undefined' ? window.innerWidth - 300 : 100, y: 20 }}
      initialSize={{ width: 280, height: 350 }}
      minSize={{ width: 250, height: 300 }}
      onClose={onClose}
    >
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
    </FloatingMenu>
  );
};

export default DraggableControls;
