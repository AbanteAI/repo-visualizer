import React from 'react';
import { FeatureMapping, DATA_SOURCES } from '../types/visualization';

interface DataSourceWeightsProps {
  category: 'node' | 'edge';
  currentMapping: FeatureMapping | undefined;
  onWeightChange: (dataSourceId: string, weight: number) => void;
}

const DataSourceWeights: React.FC<DataSourceWeightsProps> = ({
  category,
  currentMapping,
  onWeightChange,
}) => {
  const getTotalWeight = () => {
    if (!currentMapping) return 0;
    return Object.values(currentMapping.dataSourceWeights).reduce((sum, weight) => sum + weight, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">Data Sources</h4>
        <span className="text-xs text-gray-500">Total: {getTotalWeight()}%</span>
      </div>

      {/* Active Data Sources */}
      {DATA_SOURCES.filter(ds => {
        const weight = currentMapping?.dataSourceWeights[ds.id] || 0;
        return weight > 0 && (ds.applicableTo === 'both' || ds.applicableTo === category);
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
                  onClick={() => onWeightChange(dataSource.id, 0)}
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
                onChange={e => onWeightChange(dataSource.id, Number(e.target.value))}
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
              onWeightChange(e.target.value, 50);
              e.target.value = '';
            }
          }}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          style={{ cursor: 'pointer' }}
        >
          <option value="">+ Add Data Source</option>
          {DATA_SOURCES.filter(ds => {
            const weight = currentMapping?.dataSourceWeights[ds.id] || 0;
            return weight === 0 && (ds.applicableTo === 'both' || ds.applicableTo === category);
          }).map(dataSource => (
            <option key={dataSource.id} value={dataSource.id}>
              {dataSource.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default DataSourceWeights;
