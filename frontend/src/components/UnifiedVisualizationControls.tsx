import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  VisualizationConfig,
  VisualFeature,
  VISUAL_FEATURES,
  DATA_SOURCES,
  getFeatureMapping,
  updateFeatureMapping,
  updateSkeletonConfig,
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
  const [selectedNodeFeature, setSelectedNodeFeature] = useState<string>(
    VISUAL_FEATURES.find(f => f.category === 'node')?.id || VISUAL_FEATURES[0].id
  );
  const [selectedEdgeFeature, setSelectedEdgeFeature] = useState<string>(
    VISUAL_FEATURES.find(f => f.category === 'edge')?.id || VISUAL_FEATURES[0].id
  );
  const [selectedDataSource, setSelectedDataSource] = useState<string>(DATA_SOURCES[0].id);
  const [isTransposed, setIsTransposed] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<'node' | 'edge'>('node');
  const [position, setPosition] = useState({ x: 0, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, elementX: 0, elementY: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  const nodeFeatures = VISUAL_FEATURES.filter(f => f.category === 'node');
  const edgeFeatures = VISUAL_FEATURES.filter(f => f.category === 'edge');

  const selectedFeature = activeSection === 'node' ? selectedNodeFeature : selectedEdgeFeature;
  const selectedFeatureData = VISUAL_FEATURES.find(f => f.id === selectedFeature);
  const selectedDataSourceData = DATA_SOURCES.find(ds => ds.id === selectedDataSource);
  const currentMapping = getFeatureMapping(config, selectedFeature);

  // Helper functions for transposed view
  const getDataSourceFeatures = (dataSourceId: string) => {
    return VISUAL_FEATURES.filter(feature => {
      const mapping = getFeatureMapping(config, feature.id);
      return mapping && (mapping.dataSourceWeights[dataSourceId] || 0) > 0;
    });
  };

  const getDataSourceWeight = (featureId: string, dataSourceId: string) => {
    const mapping = getFeatureMapping(config, featureId);
    return mapping?.dataSourceWeights[dataSourceId] || 0;
  };

  const handleTransposedWeightChange = (
    featureId: string,
    dataSourceId: string,
    weight: number
  ) => {
    const newConfig = updateFeatureMapping(config, featureId, dataSourceId, weight);
    onConfigChange(newConfig);
  };

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

  const handleNodeFeatureSelect = (featureId: string) => {
    setSelectedNodeFeature(featureId);
    setActiveSection('node');
  };

  const handleEdgeFeatureSelect = (featureId: string) => {
    setSelectedEdgeFeature(featureId);
    setActiveSection('edge');
  };

  const getTotalWeight = () => {
    if (!currentMapping) return 0;
    return Object.values(currentMapping.dataSourceWeights).reduce((sum, weight) => sum + weight, 0);
  };

  const getFeatureIcon = (feature: VisualFeature) => {
    return feature.icon;
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

      {/* Relationship Skeletons */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          🔗 Relationship Skeletons
        </h4>
        <p className="text-xs text-gray-600 mb-4">
          Show different types of connections as separate colored skeletons
        </p>
        <div className="space-y-3">
          {config.skeletons.map(skeleton => (
            <div key={skeleton.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`skeleton-${skeleton.id}`}
                    checked={skeleton.enabled}
                    onChange={e => {
                      const updatedConfig = updateSkeletonConfig(config, skeleton.id, {
                        enabled: e.target.checked,
                      });
                      onConfigChange(updatedConfig);
                    }}
                    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                  />
                  <div
                    className="w-4 h-4 rounded-full ml-2 mr-3"
                    style={{ backgroundColor: skeleton.color }}
                  ></div>
                </div>
                <div className="flex-1">
                  <label
                    htmlFor={`skeleton-${skeleton.id}`}
                    className="text-sm font-medium text-gray-700 cursor-pointer"
                  >
                    {skeleton.name}
                  </label>
                  <p className="text-xs text-gray-500">{skeleton.description}</p>
                </div>
                <div className="text-xs text-gray-500 font-mono min-w-[3rem] text-right">
                  {Math.round(skeleton.opacity * 100)}%
                </div>
              </div>
              {skeleton.enabled && (
                <div className="ml-6 pl-4 border-l-2 border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-600 font-medium">Opacity</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={skeleton.opacity}
                    onChange={e => {
                      const updatedConfig = updateSkeletonConfig(config, skeleton.id, {
                        opacity: parseFloat(e.target.value),
                      });
                      onConfigChange(updatedConfig);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${skeleton.color} 0%, ${skeleton.color} ${skeleton.opacity * 100}%, #e5e7eb ${skeleton.opacity * 100}%, #e5e7eb 100%)`,
                    }}
                    aria-label={`${skeleton.name} opacity`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="mb-6">
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setIsTransposed(false)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              !isTransposed
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Visual First
          </button>
          <button
            onClick={() => setIsTransposed(true)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              isTransposed
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Data First
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {isTransposed
            ? 'Select data source first, then assign to visual features'
            : 'Select visual feature first, then assign data sources'}
        </p>
      </div>

      {!isTransposed ? (
        // Feature-First Mode (Original)
        <>
          {/* Feature Category Tabs */}
          <div className="mb-6">
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg mb-3">
              <button
                onClick={() => setActiveSection('node')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeSection === 'node'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                🟢 Node Features
              </button>
              <button
                onClick={() => setActiveSection('edge')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeSection === 'edge'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                🔗 Edge Features
              </button>
            </div>

            {/* Feature Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {activeSection === 'node' ? 'Node Feature' : 'Edge Feature'}
              </label>
              {activeSection === 'node' ? (
                <select
                  value={selectedNodeFeature}
                  onChange={e => handleNodeFeatureSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  style={{ cursor: 'pointer' }}
                >
                  {nodeFeatures.map(feature => (
                    <option key={feature.id} value={feature.id}>
                      {getFeatureIcon(feature)} {feature.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedEdgeFeature}
                  onChange={e => handleEdgeFeatureSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  style={{ cursor: 'pointer' }}
                >
                  {edgeFeatures.map(feature => (
                    <option key={feature.id} value={feature.id}>
                      {getFeatureIcon(feature)} {feature.name}
                    </option>
                  ))}
                </select>
              )}
              {selectedFeatureData && (
                <p className="text-xs text-gray-500 mt-1">{selectedFeatureData.description}</p>
              )}
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
              const isApplicable = selectedFeatureData
                ? ds.applicableTo === 'both' || ds.applicableTo === selectedFeatureData.category
                : true;
              return weight > 0 && isApplicable;
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
                  const isApplicable = selectedFeatureData
                    ? ds.applicableTo === 'both' || ds.applicableTo === selectedFeatureData.category
                    : true;
                  return weight === 0 && isApplicable;
                }).map(dataSource => (
                  <option key={dataSource.id} value={dataSource.id}>
                    {dataSource.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        // Data-First Mode (Transposed)
        <>
          {/* Data Source Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Source</label>
            <select
              value={selectedDataSource}
              onChange={e => setSelectedDataSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              style={{ cursor: 'pointer' }}
            >
              {DATA_SOURCES.map(dataSource => (
                <option key={dataSource.id} value={dataSource.id}>
                  {dataSource.name}
                </option>
              ))}
            </select>
            {selectedDataSourceData && (
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedDataSourceData.color }}
                ></div>
                <p className="text-xs text-gray-500">{selectedDataSourceData.description}</p>
              </div>
            )}
          </div>

          {/* Node Features Section */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                🟢 Node Features
              </h4>
              <span className="text-xs text-gray-500">
                Active:{' '}
                {
                  getDataSourceFeatures(selectedDataSource).filter(f => f.category === 'node')
                    .length
                }
              </span>
            </div>

            {/* Active Node Features */}
            {nodeFeatures
              .filter(feature => {
                const weight = getDataSourceWeight(feature.id, selectedDataSource);
                const dataSource = selectedDataSourceData;
                const isApplicable = dataSource
                  ? dataSource.applicableTo === 'both' || dataSource.applicableTo === 'node'
                  : true;
                return weight > 0 && isApplicable;
              })
              .map(feature => {
                const weight = getDataSourceWeight(feature.id, selectedDataSource);
                return (
                  <div key={feature.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{getFeatureIcon(feature)}</span>
                        <label className="text-sm font-medium text-gray-600">{feature.name}</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
                          {weight}%
                        </span>
                        <button
                          onClick={() =>
                            handleTransposedWeightChange(feature.id, selectedDataSource, 0)
                          }
                          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          aria-label={`Remove from ${feature.name}`}
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
                        onChange={e =>
                          handleTransposedWeightChange(
                            feature.id,
                            selectedDataSource,
                            Number(e.target.value)
                          )
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${selectedDataSourceData?.color ?? '#6b7280'} 0%, ${selectedDataSourceData?.color ?? '#6b7280'} ${weight}%, #e5e7eb ${weight}%, #e5e7eb 100%)`,
                        }}
                        aria-label={`${feature.name} weight`}
                      />
                    </div>
                    <p className="text-xs text-gray-400 leading-tight">{feature.description}</p>
                  </div>
                );
              })}

            {/* Add Node Feature */}
            <div className="pt-2 border-t border-gray-100">
              <select
                value=""
                onChange={e => {
                  if (e.target.value) {
                    handleTransposedWeightChange(e.target.value, selectedDataSource, 50);
                    e.target.value = '';
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                style={{ cursor: 'pointer' }}
              >
                <option value="">+ Add Node Feature</option>
                {nodeFeatures
                  .filter(feature => {
                    const weight = getDataSourceWeight(feature.id, selectedDataSource);
                    const dataSource = selectedDataSourceData;
                    const isApplicable = dataSource
                      ? dataSource.applicableTo === 'both' || dataSource.applicableTo === 'node'
                      : true;
                    return weight === 0 && isApplicable;
                  })
                  .map(feature => (
                    <option key={feature.id} value={feature.id}>
                      {getFeatureIcon(feature)} {feature.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Edge Features Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                🔗 Edge Features
              </h4>
              <span className="text-xs text-gray-500">
                Active:{' '}
                {
                  getDataSourceFeatures(selectedDataSource).filter(f => f.category === 'edge')
                    .length
                }
              </span>
            </div>

            {/* Active Edge Features */}
            {edgeFeatures
              .filter(feature => {
                const weight = getDataSourceWeight(feature.id, selectedDataSource);
                const dataSource = selectedDataSourceData;
                const isApplicable = dataSource
                  ? dataSource.applicableTo === 'both' || dataSource.applicableTo === 'edge'
                  : true;
                return weight > 0 && isApplicable;
              })
              .map(feature => {
                const weight = getDataSourceWeight(feature.id, selectedDataSource);
                return (
                  <div key={feature.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{getFeatureIcon(feature)}</span>
                        <label className="text-sm font-medium text-gray-600">{feature.name}</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 font-mono min-w-[3rem] text-right">
                          {weight}%
                        </span>
                        <button
                          onClick={() =>
                            handleTransposedWeightChange(feature.id, selectedDataSource, 0)
                          }
                          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          aria-label={`Remove from ${feature.name}`}
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
                        onChange={e =>
                          handleTransposedWeightChange(
                            feature.id,
                            selectedDataSource,
                            Number(e.target.value)
                          )
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${selectedDataSourceData?.color ?? '#6b7280'} 0%, ${selectedDataSourceData?.color ?? '#6b7280'} ${weight}%, #e5e7eb ${weight}%, #e5e7eb 100%)`,
                        }}
                        aria-label={`${feature.name} weight`}
                      />
                    </div>
                    <p className="text-xs text-gray-400 leading-tight">{feature.description}</p>
                  </div>
                );
              })}

            {/* Add Edge Feature */}
            <div className="pt-2 border-t border-gray-100">
              <select
                value=""
                onChange={e => {
                  if (e.target.value) {
                    handleTransposedWeightChange(e.target.value, selectedDataSource, 50);
                    e.target.value = '';
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                style={{ cursor: 'pointer' }}
              >
                <option value="">+ Add Edge Feature</option>
                {edgeFeatures
                  .filter(feature => {
                    const weight = getDataSourceWeight(feature.id, selectedDataSource);
                    const dataSource = selectedDataSourceData;
                    const isApplicable = dataSource
                      ? dataSource.applicableTo === 'both' || dataSource.applicableTo === 'edge'
                      : true;
                    return weight === 0 && isApplicable;
                  })
                  .map(feature => (
                    <option key={feature.id} value={feature.id}>
                      {getFeatureIcon(feature)} {feature.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </>
      )}

      {/* Reset button */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            if (!isTransposed) {
              // Reset to default weights for this feature
              const defaultFeature = VISUAL_FEATURES.find(f => f.id === selectedFeature);
              if (defaultFeature) {
                const resetWeights: Record<string, number> = {};
                DATA_SOURCES.forEach(ds => {
                  resetWeights[ds.id] = defaultFeature.defaultDataSources.includes(ds.id)
                    ? ds.defaultWeight
                    : 0;
                });

                const newConfig = {
                  ...config,
                  mappings: config.mappings.map(mapping =>
                    mapping.featureId === selectedFeature
                      ? { ...mapping, dataSourceWeights: resetWeights }
                      : mapping
                  ),
                };
                onConfigChange(newConfig);
              }
            } else {
              // Reset all features that use this data source
              const newConfig = {
                ...config,
                mappings: config.mappings.map(mapping => {
                  // For each feature, reset this data source to its default weight
                  const feature = VISUAL_FEATURES.find(f => f.id === mapping.featureId);
                  const dataSource = DATA_SOURCES.find(ds => ds.id === selectedDataSource);

                  if (feature && dataSource) {
                    const defaultWeight = feature.defaultDataSources.includes(dataSource.id)
                      ? dataSource.defaultWeight
                      : 0;

                    return {
                      ...mapping,
                      dataSourceWeights: {
                        ...mapping.dataSourceWeights,
                        [selectedDataSource]: defaultWeight,
                      },
                    };
                  }
                  return mapping;
                }),
              };
              onConfigChange(newConfig);
            }
          }}
          className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors duration-200"
        >
          {isTransposed
            ? 'Reset Data Source'
            : `Reset ${activeSection === 'node' ? 'Node' : 'Edge'} Feature`}
        </button>
      </div>
    </div>
  );
};

export default UnifiedVisualizationControls;
