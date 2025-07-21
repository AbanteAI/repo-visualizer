import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RepositoryData } from '../types/schema';
import {
  VisualizationConfig,
  VISUAL_FEATURES,
  DATA_SOURCES,
  getFeatureMapping,
  DataSource,
} from '../types/visualization';

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
    // Check if file_type is the primary data source
    const fileTypeWeight = currentMapping?.dataSourceWeights['file_type'] || 0;
    const isFileTypePrimary = fileTypeWeight > 50;

    if (isFileTypePrimary) {
      // Show extension colors
      const extensionColors: Record<string, string> = {
        py: '#3572A5',
        js: '#f7df1e',
        html: '#e34c26',
        css: '#563d7c',
        md: '#083fa1',
        json: '#292929',
        java: '#b07219',
        cpp: '#f34b7d',
        c: '#555555',
        rb: '#701516',
        php: '#4F5D95',
        ts: '#2b7489',
        sh: '#89e051',
        go: '#00ADD8',
        rs: '#dea584',
        swift: '#ffac45',
        kt: '#F18E33',
        scala: '#c22d40',
        pl: '#0298c3',
        lua: '#000080',
        r: '#198CE7',
      };

      const usedExtensions = new Set<string>();
      data.files.forEach(file => {
        if (file.extension) usedExtensions.add(file.extension);
      });

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-xs">Directory</span>
          </div>
          {Array.from(usedExtensions).map(ext => (
            <div key={ext} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: extensionColors[ext] || '#aaaaaa' }}
              ></div>
              <span className="text-xs">.{ext}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="text-xs">Other</span>
          </div>
          {/* Component types */}
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#e67e22' }}></div>
              <span className="text-xs">class</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3498db' }}></div>
              <span className="text-xs">function</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#9b59b6' }}></div>
              <span className="text-xs">method</span>
            </div>
          </div>
        </div>
      );
    } else {
      // Show intensity/gradient legend for continuous data
      return (
        <div className="space-y-3">
          {activeDataSources.map(dataSource => {
            const weight = currentMapping?.dataSourceWeights[dataSource.id] || 0;

            return (
              <div key={dataSource.id} className="space-y-1">
                <div className="text-xs font-medium">
                  {dataSource.name} ({weight}%)
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-3 rounded-sm opacity-30"
                    style={{ backgroundColor: dataSource.color }}
                  ></div>
                  <span className="text-xs text-gray-500">Low</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-3 rounded-sm opacity-70"
                    style={{ backgroundColor: dataSource.color }}
                  ></div>
                  <span className="text-xs text-gray-500">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-3 rounded-sm"
                    style={{ backgroundColor: dataSource.color }}
                  ></div>
                  <span className="text-xs text-gray-500">High</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  };

  const renderSizeLegend = (activeDataSources: DataSource[]) => {
    return (
      <div className="space-y-3">
        {activeDataSources.map(dataSource => {
          const weight = currentMapping?.dataSourceWeights[dataSource.id] || 0;

          return (
            <div key={dataSource.id} className="space-y-2">
              <div className="text-xs font-medium">
                {dataSource.name} ({weight}%)
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="rounded-full border border-gray-300"
                  style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: dataSource.color,
                  }}
                ></div>
                <span className="text-xs text-gray-500">Small</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="rounded-full border border-gray-300"
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: dataSource.color,
                  }}
                ></div>
                <span className="text-xs text-gray-500">Medium</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="rounded-full border border-gray-300"
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: dataSource.color,
                  }}
                ></div>
                <span className="text-xs text-gray-500">Large</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderEdgeLegend = (activeDataSources: DataSource[], featureType: string) => {
    const isWidth = featureType === 'edge_width';

    return (
      <div className="space-y-3">
        {activeDataSources.map(dataSource => {
          const weight = currentMapping?.dataSourceWeights[dataSource.id] || 0;

          return (
            <div key={dataSource.id} className="space-y-2">
              <div className="text-xs font-medium">
                {dataSource.name} ({weight}%)
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="rounded"
                    style={{
                      width: '20px',
                      height: isWidth ? '1px' : '2px',
                      backgroundColor: dataSource.color,
                      opacity: isWidth ? 1 : 0.3,
                    }}
                  ></div>
                  <span className="text-xs text-gray-500">Weak</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="rounded"
                    style={{
                      width: '20px',
                      height: isWidth ? '2px' : '2px',
                      backgroundColor: dataSource.color,
                      opacity: isWidth ? 1 : 0.6,
                    }}
                  ></div>
                  <span className="text-xs text-gray-500">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="rounded"
                    style={{
                      width: '20px',
                      height: isWidth ? '3px' : '2px',
                      backgroundColor: dataSource.color,
                      opacity: 1,
                    }}
                  ></div>
                  <span className="text-xs text-gray-500">Strong</span>
                </div>
              </div>
            </div>
          );
        })}
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
