import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  VisualizationConfig,
  VisualFeature,
  VISUAL_FEATURES,
  DATA_SOURCES,
  getFeatureMapping,
  updateFeatureMapping,
  updateDirectoryInclusion,
} from '../types/visualization';

interface UnifiedVisualizationControlsProps {
  config: VisualizationConfig;
  onConfigChange: (config: VisualizationConfig) => void;
  onClose: () => void;
}

const UnifiedVisualizationControls: React.FC<UnifiedVisualizationControlsProps> = ({
  config,
  onConfigChange,
  onClose,
}) => {
  const [selectedFeature, setSelectedFeature] = useState<string>(VISUAL_FEATURES[0].id);
  const [position, setPosition] = useState({ x: 0, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, elementX: 0, elementY: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  const selectedFeatureData = VISUAL_FEATURES.find(f => f.id === selectedFeature);
  const currentMapping = getFeatureMapping(config, selectedFeature);

  // Initialize position to upper right corner
  useEffect(() => {
    const initializePosition = () => {
      if (controlsRef.current) {
        const parent = controlsRef.current.parentElement;
        if (parent) {
          const parentWidth = parent.offsetWidth;
          const controlsWidth = controlsRef.current.offsetWidth || 380;

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

    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'LABEL' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'OPTION' ||
      target.closest('input, label, button, select')
    ) {
      return;
    }

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

      const deltaX = e.clientX - dragStart.mouseX;
      const deltaY = e.clientY - dragStart.mouseY;

      const newX = dragStart.elementX + deltaX;
      const newY = dragStart.elementY + deltaY;

      const maxX = Math.max(0, parent.offsetWidth - controlsRef.current.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - controlsRef.current.offsetHeight - 40);

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

  const handleWeightChange = (dataSourceId: string, weight: number) => {
    const newConfig = updateFeatureMapping(config, selectedFeature, dataSourceId, weight);
    onConfigChange(newConfig);
  };

  const handleFeatureSelect = (featureId: string) => {
    setSelectedFeature(featureId);
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
    const iconMap: Record<string, string> = {
      node_size: '●',
      node_color: '🎨',
      edge_strength: '━',
      edge_width: '═',
    };
    return iconMap[feature.id] || '●';
  };

  return (
    <div
      ref={controlsRef}
      className="absolute transition-all duration-200 draggable-controls"
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: isInitialized ? position.x : 'calc(100% - 380px)',
        top: isInitialized ? position.y : '20px',
        width: '360px',
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
      {/* Close button */}
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
        <h3 className="text-xl font-bold text-gray-900 border-b-2 border-indigo-500 pb-1">
          Visualization Controls
        </h3>
      </div>

      {/* Feature Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Graph Feature</label>
        <select
          value={selectedFeature}
          onChange={e => handleFeatureSelect(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          style={{ cursor: 'pointer' }}
        >
          {VISUAL_FEATURES.map(feature => (
            <option key={feature.id} value={feature.id}>
              {getFeatureIcon(feature)} {feature.name}
            </option>
          ))}
        </select>
        {selectedFeatureData && (
          <p className="text-xs text-gray-500 mt-1">{selectedFeatureData.description}</p>
        )}
      </div>

      {/* Directory Inclusion Toggle - only for node features */}
      {selectedFeatureData?.category === 'node' && (
        <div className="mb-6 p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">Include Directories</label>
              <p className="text-xs text-gray-500 mt-1">
                Whether directories should participate in this visual feature or use default values
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
          {!currentMapping?.includeDirectories && (
            <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              ⚠️ Directories will use default values to prevent crowding out files
            </div>
          )}
        </div>
      )}

      {/* Data Source Weights */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">Data Sources</h4>
          <span className="text-xs text-gray-500">Total: {getTotalWeight()}%</span>
        </div>

        {/* Active Data Sources */}
        {DATA_SOURCES.filter(ds => {
          const weight = currentMapping?.dataSourceWeights[ds.id] || 0;
          return weight > 0;
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
              return weight === 0;
            }).map(dataSource => (
              <option key={dataSource.id} value={dataSource.id}>
                {dataSource.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reset button */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            // Reset to default weights for this feature
            const defaultFeature = VISUAL_FEATURES.find(f => f.id === selectedFeature);
            if (defaultFeature) {
              const resetWeights: Record<string, number> = {};
              DATA_SOURCES.forEach(ds => {
                resetWeights[ds.id] = defaultFeature.defaultDataSources.includes(ds.id)
                  ? ds.defaultWeight
                  : 0;
              });

              // Get default directory inclusion based on feature type
              const defaultIncludeDirectories = (() => {
                // Set sensible defaults based on feature type
                switch (selectedFeature) {
                  case 'node_size':
                  case 'node_color':
                    return false; // Exclude directories by default to prevent crowding
                  default:
                    return true;
                }
              })();

              const newConfig = {
                ...config,
                mappings: config.mappings.map(mapping =>
                  mapping.featureId === selectedFeature
                    ? {
                        ...mapping,
                        dataSourceWeights: resetWeights,
                        includeDirectories: defaultIncludeDirectories,
                      }
                    : mapping
                ),
              };
              onConfigChange(newConfig);
            }
          }}
          className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors duration-200"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default UnifiedVisualizationControls;
