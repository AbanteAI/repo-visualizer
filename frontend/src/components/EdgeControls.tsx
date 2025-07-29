import React, { useState } from 'react';
import FloatingMenu from './FloatingMenu';
import {
  VisualizationConfig,
  VisualFeature,
  VISUAL_FEATURES,
  DATA_SOURCES,
  getFeatureMapping,
  updateFeatureMapping,
  updateGlobalThreshold,
} from '../types/visualization';
import DataSourceWeights from './DataSourceWeights';

interface EdgeControlsProps {
  config: VisualizationConfig;
  onConfigChange: (config: VisualizationConfig) => void;
  onClose: () => void;
}

const EdgeControls: React.FC<EdgeControlsProps> = ({ config, onConfigChange, onClose }) => {
  const [selectedFeature, setSelectedFeature] = useState<string>(
    VISUAL_FEATURES.find(f => f.category === 'edge')?.id || VISUAL_FEATURES[0].id
  );

  const edgeFeatures = VISUAL_FEATURES.filter(f => f.category === 'edge');
  const selectedFeatureData = VISUAL_FEATURES.find(f => f.id === selectedFeature);
  const currentMapping = getFeatureMapping(config, selectedFeature);

  const handleWeightChange = (dataSourceId: string, weight: number) => {
    const newConfig = updateFeatureMapping(config, selectedFeature, dataSourceId, weight);
    onConfigChange(newConfig);
  };

  return (
    <FloatingMenu
      title="Edge Controls"
      titleColor="blue-500"
      initialPosition={{ x: typeof window !== 'undefined' ? window.innerWidth - 760 : 20, y: 20 }}
      initialSize={{ width: 360, height: 500 }}
      minSize={{ width: 320, height: 300 }}
      maxSize={{ width: 500, height: 700 }}
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
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
          />
        </svg>
      }
    >
      <div className="space-y-6">
        {/* Feature Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Edge Feature</label>
          <select
            value={selectedFeature}
            onChange={e => setSelectedFeature(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            style={{ cursor: 'pointer' }}
          >
            {edgeFeatures.map(feature => (
              <option key={feature.id} value={feature.id}>
                {feature.name}
              </option>
            ))}
          </select>
          {selectedFeatureData && (
            <p className="text-xs text-gray-500 mt-1">{selectedFeatureData.description}</p>
          )}
        </div>

        {/* Data Source Weights */}
        <DataSourceWeights
          category="edge"
          currentMapping={currentMapping}
          onWeightChange={handleWeightChange}
        />
        {/* Threshold Slider */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Edge Visibility Threshold
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.edgeThreshold || 0}
            onChange={e =>
              onConfigChange(updateGlobalThreshold(config, 'edge', Number(e.target.value)))
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

export default EdgeControls;
