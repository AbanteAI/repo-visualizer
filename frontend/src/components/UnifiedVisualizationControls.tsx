import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  VisualizationConfig,
  VisualFeature,
  VISUAL_FEATURES,
  DATA_SOURCES,
  getFeatureMapping,
  updateFeatureMapping,
  updateSkeletonConfig,
  updateFeatureThreshold,
  updateGlobalThreshold,
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
  const currentMapping = getFeatureMapping(config, selectedFeature);

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
      if (!isInitialized) setTimeout(initializePosition, 100);
    }
  }, [isInitialized]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!controlsRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, label, button, select')) return;
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: position.x,
      elementY: position.y,
    });
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
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
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

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
    onConfigChange(updateFeatureMapping(config, selectedFeature, dataSourceId, weight));
  };

  const handleThresholdChange = (featureId: string, threshold: number) => {
    onConfigChange(updateFeatureThreshold(config, featureId, threshold));
  };

  const handleGlobalThresholdChange = (type: 'node' | 'edge', threshold: number) => {
    onConfigChange(updateGlobalThreshold(config, type, threshold));
  };

  const handleDirectoryInclusionChange = (includeDirectories: boolean) => {
    onConfigChange(updateDirectoryInclusion(config, selectedFeature, includeDirectories));
  };

  const getTotalWeight = () => {
    if (!currentMapping) return 0;
    return Object.values(currentMapping.dataSourceWeights).reduce((sum, weight) => sum + weight, 0);
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
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-red-50 border border-gray-200 text-gray-400 hover:text-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
        style={{ cursor: 'pointer' }}
        aria-label="Close"
      >
        <span className="text-lg font-bold">×</span>
      </button>

      <div className="flex items-center gap-3 mb-6 pr-12">
        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <h3 className="text-xl font-bold text-gray-900 border-b-2 border-indigo-500 pb-1">
          Visualization Controls
        </h3>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          🔗 Relationship Skeletons
        </h4>
        <p className="text-xs text-gray-600 mb-4">
          Show different types of connections as separate colored skeletons
        </p>
        <div className="space-y-3">
          {(config.skeletons || []).map(skeleton => (
            <div key={skeleton.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`skeleton-${skeleton.id}`}
                    checked={skeleton.enabled}
                    onChange={e => onConfigChange(updateSkeletonConfig(config, skeleton.id, { enabled: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                  />
                  <div className="w-4 h-4 rounded-full ml-2 mr-3" style={{ backgroundColor: skeleton.color }}></div>
                </div>
                <div className="flex-1">
                  <label htmlFor={`skeleton-${skeleton.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
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
                    min="0.1" max="1" step="0.1"
                    value={skeleton.opacity}
                    onChange={e => onConfigChange(updateSkeletonConfig(config, skeleton.id, { opacity: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, ${skeleton.color} 0%, ${skeleton.color} ${skeleton.opacity * 100}%, #e5e7eb ${skeleton.opacity * 100}%, #e5e7eb 100%)` }}
                    aria-label={`${skeleton.name} opacity`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          👁️ Visibility Thresholds
        </h4>
        <p className="text-xs text-gray-600 mb-4">
          Hide nodes or edges that fall below a certain calculated score.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="node-threshold" className="block text-sm font-medium text-gray-700">
              Node Visibility
            </label>
            <input
              type="range"
              id="node-threshold"
              min="0" max="1" step="0.05"
              value={config.nodeThreshold || 0}
              onChange={e => handleGlobalThresholdChange('node', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
            />
            <span className="text-xs text-gray-500">
              Hide nodes with a score below {((config.nodeThreshold || 0) * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <label htmlFor="edge-threshold" className="block text-sm font-medium text-gray-700">
              Edge Visibility
            </label>
            <input
              type="range"
              id="edge-threshold"
              min="0" max="1" step="0.05"
              value={config.edgeThreshold || 0}
              onChange={e => handleGlobalThresholdChange('edge', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
            />
            <span className="text-xs text-gray-500">
              Hide edges with a score below {((config.edgeThreshold || 0) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setIsTransposed(false)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${!isTransposed ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Visual First
          </button>
          <button
            onClick={() => setIsTransposed(true)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${isTransposed ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Data First
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {isTransposed ? 'Select data source first, then assign to visual features' : 'Select visual feature first, then assign data sources'}
        </p>
      </div>

      {!isTransposed ? (
        <>
          <div className="mb-6">
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg mb-3">
              <button
                onClick={() => setActiveSection('node')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeSection === 'node' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
              >
                🟢 Node Features
              </button>
              <button
                onClick={() => setActiveSection('edge')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeSection === 'edge' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
              >
                🔗 Edge Features
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {activeSection === 'node' ? 'Node Feature' : 'Edge Feature'}
              </label>
              <select
                value={selectedFeature}
                onChange={e => activeSection === 'node' ? setSelectedNodeFeature(e.target.value) : setSelectedEdgeFeature(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                style={{ cursor: 'pointer' }}
              >
                {(activeSection === 'node' ? nodeFeatures : edgeFeatures).map(feature => (
                  <option key={feature.id} value={feature.id}>
                    {feature.icon} {feature.name}
                  </option>
                ))}
              </select>
              {selectedFeatureData && <p className="text-xs text-gray-500 mt-1">{selectedFeatureData.description}</p>}
            </div>
          </div>

          {selectedFeatureData?.category === 'node' && (
            <div className="mb-6 p-3 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700">Include Directories</label>
                  <p className="text-xs text-gray-500 mt-1">
                    {currentMapping?.includeDirectories ? 'Directories participate in this visual feature' : 'Directories use default values'}
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
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Data Sources</h4>
              <span className="text-xs text-gray-500">Total: {getTotalWeight()}%</span>
            </div>
            {DATA_SOURCES.filter(ds => ds.applicableTo === 'both' || ds.applicableTo === selectedFeatureData?.category).map(ds => (
              <div key={ds.id}>
                <label htmlFor={`weight-${ds.id}`} className="block text-sm font-medium text-gray-700">
                  {ds.name}
                </label>
                <input
                  type="range"
                  id={`weight-${ds.id}`}
                  min="0" max="100" step="5"
                  value={currentMapping?.dataSourceWeights[ds.id] || 0}
                  onChange={e => handleWeightChange(ds.id, parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div>...</div>
      )}
    </div>
  );
};

export default UnifiedVisualizationControls;
