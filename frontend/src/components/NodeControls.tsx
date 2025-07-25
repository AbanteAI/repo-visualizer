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
} from '../types/visualization';

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

  const getTotalWeight = () => {
    if (!currentMapping) return 0;
    return Object.values(currentMapping.dataSourceWeights).reduce((sum, weight) => sum + weight, 0);
  };

  const getFeatureIcon = (feature: VisualFeature) => {
    return feature.icon;
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
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Data Sources</h4>
            <span className="text-xs text-gray-500">Total: {getTotalWeight()}%</span>
          </div>

          {/* Active Data Sources */}
          {DATA_SOURCES.filter(ds => {
            const weight = currentMapping?.dataSourceWeights[ds.id] || 0;
            return weight > 0 && (ds.applicableTo === 'both' || ds.applicableTo === 'node');
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
                return weight === 0 && (ds.applicableTo === 'both' || ds.applicableTo === 'node');
              }).map(dataSource => (
                <option key={dataSource.id} value={dataSource.id}>
                  {dataSource.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </FloatingMenu>
  );
};

export default NodeControls;
