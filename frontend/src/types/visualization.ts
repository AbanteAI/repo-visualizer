/**
 * Types and configurations for the flexible visualization system
 */

export interface DataSource {
  id: string;
  name: string;
  description: string;
  color: string;
  defaultWeight: number;
  category: 'file' | 'relationship' | 'git' | 'semantic';
  dataType: 'continuous' | 'categorical';
  applicableTo: 'node' | 'edge' | 'both';
}

export interface VisualFeature {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'node' | 'edge';
  defaultDataSources: string[];
}

export interface FeatureMapping {
  featureId: string;
  dataSourceWeights: Record<string, number>; // dataSourceId -> weight (0-100)
}

export interface VisualizationConfig {
  mappings: FeatureMapping[];
}

// Available data sources
export const DATA_SOURCES: DataSource[] = [
  {
    id: 'file_type',
    name: 'File Type',
    description: 'File extension/type for categorical coloring',
    color: '#6b7280',
    defaultWeight: 100,
    category: 'file',
    dataType: 'categorical',
    applicableTo: 'node',
  },
  {
    id: 'file_size',
    name: 'File Size',
    description: 'Size of the file in bytes',
    color: '#8b5cf6',
    defaultWeight: 100,
    category: 'file',
    dataType: 'continuous',
    applicableTo: 'node',
  },
  {
    id: 'commit_count',
    name: 'Commit Count',
    description: 'Number of commits affecting this file',
    color: '#f59e0b',
    defaultWeight: 0,
    category: 'git',
    dataType: 'continuous',
    applicableTo: 'node',
  },
  {
    id: 'recency',
    name: 'Recency',
    description: 'How recently the file was modified',
    color: '#06b6d4',
    defaultWeight: 0,
    category: 'git',
    dataType: 'continuous',
    applicableTo: 'node',
  },
  {
    id: 'identifiers',
    name: 'Identifiers',
    description: 'Number of top-level identifiers in the file',
    color: '#ec4899',
    defaultWeight: 0,
    category: 'file',
    dataType: 'continuous',
    applicableTo: 'node',
  },
  {
    id: 'references',
    name: 'Incoming References',
    description: 'Number of incoming references to this file',
    color: '#10b981',
    defaultWeight: 0,
    category: 'relationship',
    dataType: 'continuous',
    applicableTo: 'node',
  },
  {
    id: 'semantic_similarity',
    name: 'Semantic Similarity',
    description: 'Semantic similarity between files',
    color: '#22c55e',
    defaultWeight: 30,
    category: 'semantic',
    dataType: 'continuous',
    applicableTo: 'edge',
  },
  {
    id: 'filesystem_proximity',
    name: 'Filesystem Proximity',
    description: 'How close files are in the filesystem',
    color: '#ef4444',
    defaultWeight: 30,
    category: 'file',
    dataType: 'continuous',
    applicableTo: 'edge',
  },
  {
    id: 'code_references',
    name: 'Code References',
    description: 'Direct code references like imports and calls',
    color: '#3b82f6',
    defaultWeight: 70,
    category: 'relationship',
    dataType: 'continuous',
    applicableTo: 'edge',
  },
  {
    id: 'test_coverage_ratio',
    name: 'Test Coverage Ratio',
    description: 'Percentage of code covered by tests',
    color: '#16a34a',
    defaultWeight: 0,
    category: 'file',
    dataType: 'continuous',
    applicableTo: 'node',
  },
];

// Available visual features
export const VISUAL_FEATURES: VisualFeature[] = [
  {
    id: 'node_size',
    name: 'Node Size',
    description: 'Size of the nodes in the graph',
    icon: '●',
    category: 'node',
    defaultDataSources: ['file_size'],
  },
  {
    id: 'node_color',
    name: 'Node Color',
    description: 'Color intensity of the nodes',
    icon: '🎨',
    category: 'node',
    defaultDataSources: ['file_type'],
  },
  {
    id: 'edge_strength',
    name: 'Edge Strength',
    description: 'Strength of connections between nodes',
    icon: '━',
    category: 'edge',
    defaultDataSources: ['code_references', 'semantic_similarity', 'filesystem_proximity'],
  },
  {
    id: 'edge_width',
    name: 'Edge Width',
    description: 'Width of the edges',
    icon: '═',
    category: 'edge',
    defaultDataSources: ['code_references'],
  },
  {
    id: 'pie_chart_ratio',
    name: 'Pie Chart Ratio',
    description: 'Display nodes as pie charts showing data ratios',
    icon: '◐',
    category: 'node',
    defaultDataSources: ['test_coverage_ratio'],
  },
  {
    id: 'edge_color',
    name: 'Edge Color',
    description: 'Color of the edges',
    icon: '🌈',
    category: 'edge',
    defaultDataSources: ['code_references'],
  },
];

// Default configuration
export const DEFAULT_CONFIG: VisualizationConfig = {
  mappings: [
    {
      featureId: 'node_size',
      dataSourceWeights: {
        file_type: 0,
        file_size: 100,
        commit_count: 0,
        recency: 0,
        identifiers: 0,
        references: 0,
        semantic_similarity: 0,
        filesystem_proximity: 0,
        code_references: 0,
        test_coverage_ratio: 0,
      },
    },
    {
      featureId: 'node_color',
      dataSourceWeights: {
        file_type: 100,
        file_size: 0,
        commit_count: 0,
        recency: 0,
        identifiers: 0,
        references: 0,
        semantic_similarity: 0,
        filesystem_proximity: 0,
        code_references: 0,
        test_coverage_ratio: 0,
      },
    },
    {
      featureId: 'edge_strength',
      dataSourceWeights: {
        file_type: 0,
        file_size: 0,
        commit_count: 0,
        recency: 0,
        identifiers: 0,
        references: 0,
        semantic_similarity: 30,
        filesystem_proximity: 30,
        code_references: 70,
        test_coverage_ratio: 0,
      },
    },
    {
      featureId: 'edge_width',
      dataSourceWeights: {
        file_type: 0,
        file_size: 0,
        commit_count: 0,
        recency: 0,
        identifiers: 0,
        references: 0,
        semantic_similarity: 0,
        filesystem_proximity: 0,
        code_references: 100,
        test_coverage_ratio: 0,
      },
    },
    {
      featureId: 'pie_chart_ratio',
      dataSourceWeights: {
        file_type: 0,
        file_size: 0,
        commit_count: 0,
        recency: 0,
        identifiers: 0,
        references: 0,
        semantic_similarity: 0,
        filesystem_proximity: 0,
        code_references: 0,
        test_coverage_ratio: 100,
      },
    },
    {
      featureId: 'edge_color',
      dataSourceWeights: {
        file_type: 0,
        file_size: 0,
        commit_count: 0,
        recency: 0,
        identifiers: 0,
        references: 0,
        semantic_similarity: 0,
        filesystem_proximity: 0,
        code_references: 100,
      },
    },
  ],
};

// Helper functions
export const getDataSourceById = (id: string): DataSource | undefined => {
  return DATA_SOURCES.find(ds => ds.id === id);
};

export const getVisualFeatureById = (id: string): VisualFeature | undefined => {
  return VISUAL_FEATURES.find(vf => vf.id === id);
};

export const getFeatureMapping = (
  config: VisualizationConfig | undefined,
  featureId: string
): FeatureMapping | undefined => {
  if (!config) return undefined;
  return config.mappings.find(m => m.featureId === featureId);
};

export const updateFeatureMapping = (
  config: VisualizationConfig,
  featureId: string,
  dataSourceId: string,
  weight: number
): VisualizationConfig => {
  const newMappings = config.mappings.map(mapping => {
    if (mapping.featureId === featureId) {
      return {
        ...mapping,
        dataSourceWeights: {
          ...mapping.dataSourceWeights,
          [dataSourceId]: weight,
        },
      };
    }
    return mapping;
  });

  return {
    ...config,
    mappings: newMappings,
  };
};
