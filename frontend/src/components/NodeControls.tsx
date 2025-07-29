import React, { useState } from 'react';
import FloatingMenu from './FloatingMenu';
import {
  VisualizationConfig,
  VisualFeature,
  VISUAL_FEATURES,
  DATA_SOURCES,
  getFeatureMapping,
  updateFeatureMapping,
  updateDirectoryInclusion,
  updateGlobalThreshold,
} from '../types/visualization';
import DataSourceWeights from './DataSourceWeights';

interface NodeControlsProps {
  config: VisualizationConfig;
  onConfigChange: (config: VisualizationConfig) => void;
  onClose: () => void;
}

const NodeControls: React.FC<NodeControlsProps> = ({ config, onConfigChange, onClose }) => {
  const [selectedFeature, setSelectedFeature] = useState<string>(
    VISUAL_FEATURES.find(f => f.category === 'node')?.id || VISUAL_FEATURES[0].id
  );

  const nodeFeatures = VISUAL_FEATURES.filter(f => f.category === 'node');
  const selectedFeatureData = VISUAL_FEATURES.find(f => f.id === selectedFeature);
  const currentMapping = getFeatureMapping(config, selectedFeature);

  const handleWeightChange = (dataSourceId: string, weight: number) => {
    const newConfig = updateFeatureMapping(config, selectedFeature, dataSourceId, weight);
    onConfigChange(newConfig);
  };

  const handleDirectoryInclusionChange = (includeDirectories: boolean) => {
    const newConfig = updateDirectoryInclusion(config, selectedFeature, includeDirectories);
    onConfigChange(newConfig);
  };

  return (
    <FloatingMenu
      title="Node Controls"
      titleColor="green-500"
      initialPosition={{ x: typeof window !== 'undefined' ? window.innerWidth - 380 : 20, y: 20 }}
      initialSize={{ width: 360, height: 600 }}
      minSize={{ width: 320, height: 400 }}
      maxSize={{ width: 500, height: 800 }}
      onClose={onClose}
      className="draggable-controls"
      headerIcon={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25 1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M12 7.5V5.25m0 2.25l-2.25 1.313M3 12.75l2.25-1.313M21 12.75l-2.25-1.313m0 0l-2.25 1.313m2.25-1.313l2.25-1.313m0 0l-2.25-1.313m-9 5.25l2.25-1.313"
          />
        </svg>
      }
    >
      <div className="space-y-6">
        {/* Feature Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Node Feature</label>
          <select
            value={selectedFeature}
            onChange={e => setSelectedFeature(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            style={{ cursor: 'pointer' }}
          >
            {nodeFeatures.map(feature => (
              <option key={feature.id} value={feature.id}>
                {feature.name}
              </option>
            ))}
          </select>
          {selectedFeatureData && (
            <p className="text-xs text-gray-500 mt-1">{selectedFeatureData.description}</p>
          )}
        </div>

        {/* Directory Inclusion Toggle */}
        <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">Include Directories</label>
              <p className="text-xs text-gray-500 mt-1">
                {currentMapping?.includeDirectories
                  ? 'Directories participate in this visual feature'
                  : 'Directories use default values'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={currentMapping?.includeDirectories ?? true}
                onChange={e => handleDirectoryInclusionChange(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* Data Source Weights */}
        <DataSourceWeights
          category="node"
          currentMapping={currentMapping}
          onWeightChange={handleWeightChange}
        />
        {/* Threshold Slider */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Node Visibility Threshold
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.nodeThreshold || 0}
            onChange={e =>
              onConfigChange(updateGlobalThreshold(config, 'node', Number(e.target.value)))
            }
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Show All</span>
            <span>Show Important</span>
          </div>
        </div>
      </div>
    </FloatingMenu>
  );
};

export default NodeControls;
