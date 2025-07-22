import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RepositoryData } from '../types/schema';
import {
  VisualizationConfig,
  VISUAL_FEATURES,
  DATA_SOURCES,
  getFeatureMapping,
  DataSource,
} from '../types/visualization';
import {
  computeNodeMetrics,
  isColorMappingCategorical,
  calculateCategoricalValue,
  generateCategoricalColors,
} from '../utils/visualizationUtils';
import { EXTENSION_COLORS, NODE_COLORS } from '../utils/extensionColors';

interface DynamicLegendProps {
  data: RepositoryData;
  config: VisualizationConfig;
  onClose: () => void;
}

const DynamicLegend: React.FC<DynamicLegendProps> = ({ data, config, onClose }) => {
  const [selectedFeature, setSelectedFeature] = useState<string>('node_color');
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, elementX: 0, elementY: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);

  // Initialize position to upper left corner
  useEffect(() => {
    const initializePosition = () => {
      if (legendRef.current) {
        setPosition({ x: 20, y: 80 }); // Below the controls button
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      initializePosition();
    }
  }, [isInitialized]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!legendRef.current) return;

    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'OPTION' ||
      target.closest('button, select')
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
      if (!isDragging || !legendRef.current) return;

      const deltaX = e.clientX - dragStart.mouseX;
      const deltaY = e.clientY - dragStart.mouseY;

      const newX = dragStart.elementX + deltaX;
      const newY = dragStart.elementY + deltaY;

      const maxX = Math.max(0, window.innerWidth - legendRef.current.offsetWidth - 20);
      const maxY = Math.max(0, window.innerHeight - legendRef.current.offsetHeight - 40);

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
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const selectedFeatureData = VISUAL_FEATURES.find(f => f.id === selectedFeature);
  const currentMapping = getFeatureMapping(config, selectedFeature);

  // Compute node metrics for accurate color calculation
  const nodeMetrics = computeNodeMetrics(data);
  const allNodeMetrics = Array.from(nodeMetrics.values());

  const renderLegendContent = () => {
    if (!selectedFeatureData || !currentMapping) return null;

    const activeDataSources = DATA_SOURCES.filter(
      ds => (currentMapping.dataSourceWeights[ds.id] || 0) > 0
    );

    if (activeDataSources.length === 0) {
      return (
        <div className="text-sm text-gray-500 text-center py-4">
          No data sources active for {selectedFeatureData.name.toLowerCase()}
        </div>
      );
    }

    switch (selectedFeature) {
      case 'node_color':
        return renderColorLegend(activeDataSources);
      case 'node_size':
        return renderSizeLegend(activeDataSources);
      case 'edge_strength':
      case 'edge_width':
        return renderEdgeLegend(activeDataSources, selectedFeature);
      default:
        return null;
    }
  };

  const renderColorLegend = (activeDataSources: DataSource[]) => {
    const isCategorical = isColorMappingCategorical(config);

    if (isCategorical) {
      // Check if file_type is active
      const fileTypeWeight = currentMapping?.dataSourceWeights['file_type'] || 0;

      if (fileTypeWeight > 0) {
        // Show extension colors

        const usedExtensions = new Set<string>();
        data.files.forEach(file => {
          if (file.extension) usedExtensions.add(file.extension);
        });

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                style={{
                  backgroundColor: NODE_COLORS.DIRECTORY,
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              ></div>
              <span className="text-xs">Directory</span>
            </div>
            {Array.from(usedExtensions).map(ext => (
              <div key={ext} className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: EXTENSION_COLORS[ext] || NODE_COLORS.UNKNOWN,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                ></div>
                <span className="text-xs">.{ext}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div
                style={{
                  backgroundColor: NODE_COLORS.UNKNOWN,
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              ></div>
              <span className="text-xs">Other</span>
            </div>
            {/* Component types */}
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: NODE_COLORS.CLASS,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                ></div>
                <span className="text-xs">class</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: NODE_COLORS.FUNCTION,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                ></div>
                <span className="text-xs">function</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: NODE_COLORS.METHOD,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                ></div>
                <span className="text-xs">method</span>
              </div>
            </div>
          </div>
        );
      } else {
        // Other categorical data sources - use generated categorical colors
        const allCategories = [
          ...new Set(allNodeMetrics.map(m => calculateCategoricalValue(m, config, 'node_color'))),
        ];
        const categoricalColors = generateCategoricalColors(allCategories);

        return (
          <div className="space-y-2">
            {allCategories.map(category => (
              <div key={category} className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: categoricalColors[category] || NODE_COLORS.UNKNOWN,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                ></div>
                <span className="text-xs">{category}</span>
              </div>
            ))}
          </div>
        );
      }
    } else {
      // Continuous data - show blue to red gradient
      return (
        <div className="space-y-3">
          <div className="text-xs font-medium mb-2">Intensity Scale</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                style={{
                  backgroundColor: 'rgb(0, 64, 255)',
                  width: '16px',
                  height: '12px',
                  borderRadius: '2px',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              ></div>
              <span className="text-xs text-gray-500">Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                style={{
                  backgroundColor: 'rgb(128, 128, 128)',
                  width: '16px',
                  height: '12px',
                  borderRadius: '2px',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              ></div>
              <span className="text-xs text-gray-500">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                style={{
                  backgroundColor: 'rgb(255, 64, 0)',
                  width: '16px',
                  height: '12px',
                  borderRadius: '2px',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              ></div>
              <span className="text-xs text-gray-500">High</span>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Data sources: {activeDataSources.map(ds => ds.name).join(', ')}
          </div>
        </div>
      );
    }
  };

  const renderSizeLegend = (activeDataSources: DataSource[]) => {
    return (
      <div className="space-y-3">
        <div className="text-xs font-medium mb-2">Size Scale</div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '6px',
                height: '6px',
                backgroundColor: '#4f46e5',
                borderRadius: '50%',
                border: '1px solid #d1d5db',
                display: 'inline-block',
                flexShrink: 0,
              }}
            ></div>
            <span className="text-xs text-gray-500">Small</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: '#4f46e5',
                borderRadius: '50%',
                border: '1px solid #d1d5db',
                display: 'inline-block',
                flexShrink: 0,
              }}
            ></div>
            <span className="text-xs text-gray-500">Medium</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '15px',
                height: '15px',
                backgroundColor: '#4f46e5',
                borderRadius: '50%',
                border: '1px solid #d1d5db',
                display: 'inline-block',
                flexShrink: 0,
              }}
            ></div>
            <span className="text-xs text-gray-500">Large</span>
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Data sources: {activeDataSources.map(ds => ds.name).join(', ')}
        </div>
      </div>
    );
  };

  const renderEdgeLegend = (activeDataSources: DataSource[], featureType: string) => {
    const isWidth = featureType === 'edge_width';
    const title = isWidth ? 'Edge Width Scale' : 'Edge Strength Scale';

    return (
      <div className="space-y-3">
        <div className="text-xs font-medium mb-2">{title}</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="rounded"
              style={{
                width: '24px',
                height: isWidth ? '1px' : '2px',
                backgroundColor: '#64748b',
                opacity: isWidth ? 1 : 0.4,
              }}
            ></div>
            <span className="text-xs text-gray-500">Weak</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="rounded"
              style={{
                width: '24px',
                height: isWidth ? '2px' : '2px',
                backgroundColor: '#64748b',
                opacity: isWidth ? 1 : 0.7,
              }}
            ></div>
            <span className="text-xs text-gray-500">Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="rounded"
              style={{
                width: '24px',
                height: isWidth ? '3px' : '2px',
                backgroundColor: '#64748b',
                opacity: 1,
              }}
            ></div>
            <span className="text-xs text-gray-500">Strong</span>
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Data sources: {activeDataSources.map(ds => ds.name).join(', ')}
        </div>
      </div>
    );
  };

  const getFeatureIcon = (featureId: string) => {
    const iconMap: Record<string, string> = {
      node_size: '●',
      node_color: '🎨',
      edge_strength: '━',
      edge_width: '═',
    };
    return iconMap[featureId] || '●';
  };

  return (
    <div
      ref={legendRef}
      className="absolute transition-all duration-200"
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: isInitialized ? position.x : '20px',
        top: isInitialized ? position.y : '80px',
        width: '200px',
        pointerEvents: 'auto',
        transform: 'translate3d(0, 0, 0)',
        zIndex: 1000,
        userSelect: 'none',
        backgroundColor: 'white',
        border: '2px solid #e5e7eb',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        cursor: isDragging ? 'grabbing' : 'grab',
        padding: '16px',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-white hover:bg-red-50 border border-gray-200 text-gray-400 hover:text-red-500 transition-all duration-200"
        style={{ cursor: 'pointer' }}
        aria-label="Close legend"
      >
        <span className="text-sm font-bold">×</span>
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pr-8">
        <h3 className="text-sm font-bold text-gray-900">Legend</h3>
      </div>

      {/* Feature Selection */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-700 mb-1">Feature</label>
        <select
          value={selectedFeature}
          onChange={e => setSelectedFeature(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          style={{ cursor: 'pointer' }}
        >
          {VISUAL_FEATURES.map(feature => (
            <option key={feature.id} value={feature.id}>
              {getFeatureIcon(feature.id)} {feature.name}
            </option>
          ))}
        </select>
      </div>

      {/* Legend Content */}
      <div className="space-y-2">{renderLegendContent()}</div>
    </div>
  );
};

export default DynamicLegend;
