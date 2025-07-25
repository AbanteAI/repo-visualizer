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

  const getTotalWeight = () => {
    if (!currentMapping) return 0;
    return Object.values(currentMapping.dataSourceWeights).reduce((sum, weight) => sum + weight, 0);
  };

  const getFeatureIcon = (feature: VisualFeature) => {
    return feature.icon;
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
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Data Sources</h4>
            <span className="text-xs text-gray-500">Total: {getTotalWeight()}%</span>
          </div>

          {/* Active Data Sources */}
          {DATA_SOURCES.filter(ds => {
            const weight = currentMapping?.dataSourceWeights[ds.id] || 0;
            return weight > 0 && (ds.applicableTo === 'both' || ds.applicableTo === 'edge');
          }).map(dataSource => {
            const weight = currentMapping?.dataSourceWeights[dataSource.id] || 0;
            return (
              <div key={dataSource.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: dataSource.color }}
                    ></div>
                    <label className="text-sm font-medium text-gray-600">{dataSource.name}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
                      {weight}%
                    </span>
                    <button
                      onClick={() => handleWeightChange(dataSource.id, 0)}
                      className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label={`Remove ${dataSource.name}`}
                    >
                      <span className="text-xs font-bold">×</span>
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weight}
                    onChange={e => handleWeightChange(dataSource.id, Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${dataSource.color} 0%, ${dataSource.color} ${weight}%, #e5e7eb ${weight}%, #e5e7eb 100%)`,
                    }}
                    aria-label={`${dataSource.name} weight`}
                  />
                </div>
                <p className="text-xs text-gray-400 leading-tight">{dataSource.description}</p>
              </div>
            );
          })}

          {/* Add Data Source */}
          <div className="pt-2 border-t border-gray-100">
            <select
              value=""
              onChange={e => {
                if (e.target.value) {
                  handleWeightChange(e.target.value, 50);
                  e.target.value = '';
                }
              }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              style={{ cursor: 'pointer' }}
            >
              <option value="">+ Add Data Source</option>
              {DATA_SOURCES.filter(ds => {
                const weight = currentMapping?.dataSourceWeights[ds.id] || 0;
                return weight === 0 && (ds.applicableTo === 'both' || ds.applicableTo === 'edge');
              }).map(dataSource => (
                <option key={dataSource.id} value={dataSource.id}>
                  {dataSource.name}
                </option>
              ))}
            </select>
          </div>
        </div>
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
