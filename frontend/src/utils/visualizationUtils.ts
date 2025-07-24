import { RepositoryData } from '../types/schema';
import { VisualizationConfig, getFeatureMapping, DATA_SOURCES } from '../types/visualization';
import { NODE_COLORS } from './extensionColors';

export interface NodeData {
  id: string;
  name: string;
  path: string;
  type: string;
  extension?: string | null;
  size: number;
  depth: number;
  expanded?: boolean;
  parentId?: string;
  x?: number;
  y?: number;
}

export interface LinkData {
  source: string;
  target: string;
  type: string;
  weight?: number;
  originalStrength?: number;
}

export interface ComputedNodeMetrics {
  file_type: string;
  file_size: number;
  commit_count: number;
  recency: number;
  identifiers: number;
  references: number;
  test_coverage_ratio?: number;
}

export interface ComputedLinkMetrics {
  semantic_similarity: number;
  filesystem_proximity: number;
  code_references: number;
}

// Compute metrics for all nodes from repository data
export const computeNodeMetrics = (data: RepositoryData): Map<string, ComputedNodeMetrics> => {
  const metrics = new Map<string, ComputedNodeMetrics>();

  // Calculate incoming references count
  const incomingReferences = new Map<string, number>();
  data.relationships.forEach(rel => {
    const count = incomingReferences.get(rel.target) || 0;
    incomingReferences.set(rel.target, count + 1);
  });

  // Process each file and directory
  data.files.forEach(file => {
    const fileMetrics = file.metrics || {};

    // Calculate recency score (0-1, where 1 is most recent)
    let recencyScore = 0;
    if (fileMetrics.lastCommitDaysAgo !== undefined) {
      // Convert days ago to a score (fresher = higher score)
      const daysAgo = fileMetrics.lastCommitDaysAgo;
      recencyScore = Math.max(0, 1 - daysAgo / 365); // Normalize to 0-1 over a year
    }

    // For directories, use 'directory' as the file_type for categorical coloring
    const fileType = file.type === 'directory' ? 'directory' : file.extension || 'unknown';

    metrics.set(file.id, {
      file_type: fileType,
      file_size: file.size || 0,
      commit_count: fileMetrics.commitCount || 0,
      recency: recencyScore,
      identifiers: fileMetrics.topLevelIdentifiers || 0,
      references: incomingReferences.get(file.id) || 0,
      test_coverage_ratio: fileMetrics.testCoverageRatio,
    });

    // Add metrics for components (classes, functions, methods) - only for files, not directories
    if (file.type === 'file' && file.components) {
      file.components.forEach(component => {
        metrics.set(component.id, {
          file_type: component.type, // Use component type as the categorical value
          file_size: file.size || 0, // Use parent file size
          commit_count: fileMetrics.commitCount || 0,
          recency: recencyScore,
          identifiers: fileMetrics.topLevelIdentifiers || 0,
          references: incomingReferences.get(component.id) || 0,
          test_coverage_ratio: fileMetrics.testCoverageRatio,
        });
      });
    }
  });

  return metrics;
};

// Compute metrics for all links from repository data
export const computeLinkMetrics = (data: RepositoryData): Map<string, ComputedLinkMetrics> => {
  const metrics = new Map<string, ComputedLinkMetrics>();

  data.relationships.forEach(rel => {
    const linkKey = `${rel.source}-${rel.target}`;
    const strength = rel.strength || 1;

    const linkMetrics: ComputedLinkMetrics = {
      semantic_similarity: rel.type === 'semantic_similarity' ? strength : 0,
      filesystem_proximity: rel.type === 'filesystem_proximity' ? strength : 0,
      code_references:
        rel.type === 'import' || rel.type === 'call' || rel.type === 'contains' ? strength : 0,
    };

    metrics.set(linkKey, linkMetrics);
  });

  return metrics;
};

// Calculate weighted value for a visual feature (for numerical data)
export const calculateWeightedValue = (
  metrics: Record<string, unknown>,
  config: VisualizationConfig,
  featureId: string
): number => {
  const mapping = getFeatureMapping(config, featureId);
  if (!mapping) return 0;

  let totalWeightedValue = 0;
  let totalWeight = 0;

  Object.entries(mapping.dataSourceWeights).forEach(([dataSourceId, weight]) => {
    if (weight > 0 && typeof metrics[dataSourceId] === 'number') {
      totalWeightedValue += ((metrics[dataSourceId] as number) * weight) / 100;
      totalWeight += weight / 100;
    }
  });

  return totalWeight > 0 ? totalWeightedValue / totalWeight : 0;
};

// Determine if a color mapping is categorical or continuous
export const isColorMappingCategorical = (config: VisualizationConfig): boolean => {
  const mapping = getFeatureMapping(config, 'node_color');
  if (!mapping) return true; // Default to categorical

  // Check if any active data source is categorical
  return Object.entries(mapping.dataSourceWeights).some(([dataSourceId, weight]) => {
    if (weight > 0) {
      const dataSource = DATA_SOURCES.find(ds => ds.id === dataSourceId);
      return dataSource && dataSource.dataType === 'categorical';
    }
    return false;
  });
};

// Generate categorical colors distributed across the color wheel
export const generateCategoricalColors = (categories: string[]): Record<string, string> => {
  const colors: Record<string, string> = {};
  const hueStep = 360 / categories.length;

  categories.forEach((category, index) => {
    const hue = (index * hueStep) % 360;
    colors[category] = `hsl(${hue}, 65%, 50%)`;
  });

  return colors;
};

// Calculate categorical value for a visual feature
export const calculateCategoricalValue = (
  metrics: ComputedNodeMetrics,
  config: VisualizationConfig,
  featureId: string
): string => {
  const mapping = getFeatureMapping(config, featureId);
  if (!mapping) return 'unknown';

  // Find the first active categorical data source
  for (const [dataSourceId, weight] of Object.entries(mapping.dataSourceWeights)) {
    if (weight > 0) {
      const dataSource = DATA_SOURCES.find(ds => ds.id === dataSourceId);
      if (dataSource && dataSource.dataType === 'categorical') {
        return (metrics as Record<string, string>)[dataSourceId] || 'unknown';
      }
    }
  }

  return 'unknown';
};

// Normalize values to a 0-1 range
export const normalizeValues = (values: number[]): number[] => {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) return values.map(() => 0.5);

  return values.map(v => (v - min) / range);
};

// Calculate node size based on weighted metrics
export const calculateNodeSize = (
  nodeMetrics: ComputedNodeMetrics,
  config: VisualizationConfig,
  allNodeMetrics: ComputedNodeMetrics[],
  nodeType: string
): number => {
  if (nodeType === 'class' || nodeType === 'function' || nodeType === 'method') {
    return 6;
  }

  // Check if directories should participate in size calculations
  const sizeMapping = getFeatureMapping(config, 'node_size');
  const includeDirectoriesInSize = sizeMapping?.includeDirectories ?? true;

  // If directories are excluded, give them a default size
  if (nodeType === 'directory' && !includeDirectoriesInSize) {
    return 12; // Fixed reasonable size for directories when excluded
  }

  // Calculate weighted values for all nodes
  const allWeightedValues = allNodeMetrics.map(m => calculateWeightedValue(m, config, 'node_size'));

  // Filter values for normalization if directories are excluded
  let valuesForNormalization = allWeightedValues;
  let metricsForLookup = allNodeMetrics;

  if (!includeDirectoriesInSize) {
    // Filter out directory metrics and their corresponding weighted values
    const filteredData = allNodeMetrics
      .map((metric, index) => ({ metric, value: allWeightedValues[index], index }))
      .filter(item => item.metric.file_type !== 'directory');

    valuesForNormalization = filteredData.map(item => item.value);
    metricsForLookup = filteredData.map(item => item.metric);
  }

  const normalizedValues = normalizeValues(valuesForNormalization);
  const nodeIndex = metricsForLookup.indexOf(nodeMetrics);
  const normalizedValue = nodeIndex >= 0 ? normalizedValues[nodeIndex] || 0 : 0;

  // Directories get a larger size range to make them more prominent
  if (nodeType === 'directory') {
    const minRadius = 8;
    const maxRadius = 20;
    return minRadius + normalizedValue * (maxRadius - minRadius);
  }

  const minRadius = 5;
  const maxRadius = 15;

  return minRadius + normalizedValue * (maxRadius - minRadius);
};

// Calculate node color intensity based on weighted metrics
export const calculateNodeColorIntensity = (
  nodeMetrics: ComputedNodeMetrics,
  config: VisualizationConfig,
  allNodeMetrics: ComputedNodeMetrics[]
): number => {
  // Check if directories should participate in color calculations
  const colorMapping = getFeatureMapping(config, 'node_color');
  const includeDirectoriesInColor = colorMapping?.includeDirectories ?? true;

  // Calculate weighted values for all nodes
  const allWeightedValues = allNodeMetrics.map(m =>
    calculateWeightedValue(m, config, 'node_color')
  );

  // Filter values for normalization if directories are excluded
  let valuesForNormalization = allWeightedValues;
  let metricsForLookup = allNodeMetrics;

  if (!includeDirectoriesInColor) {
    // Filter out directory metrics and their corresponding weighted values
    const filteredData = allNodeMetrics
      .map((metric, index) => ({ metric, value: allWeightedValues[index], index }))
      .filter(item => item.metric.file_type !== 'directory');

    valuesForNormalization = filteredData.map(item => item.value);
    metricsForLookup = filteredData.map(item => item.metric);
  }

  const normalizedValues = normalizeValues(valuesForNormalization);
  const nodeIndex = metricsForLookup.indexOf(nodeMetrics);

  return nodeIndex >= 0 ? normalizedValues[nodeIndex] || 0 : 0;
};

// Calculate edge strength based on weighted metrics
export const calculateEdgeStrength = (
  linkMetrics: ComputedLinkMetrics,
  config: VisualizationConfig
): number => {
  const weightedValue = calculateWeightedValue(linkMetrics, config, 'edge_strength');

  // Convert to a strength value (0-2 range)
  return Math.max(0, Math.min(2, weightedValue * 2));
};

// Calculate edge width based on weighted metrics
export const calculateEdgeWidth = (
  linkMetrics: ComputedLinkMetrics,
  config: VisualizationConfig,
  linkType: string
): number => {
  const baseWidth = (() => {
    switch (linkType) {
      case 'import':
      case 'call':
      case 'calls':
        return 2;
      case 'contains':
        return 3;
      case 'filesystem_proximity':
        return 1.5;
      case 'semantic_similarity':
        return 2;
      default:
        return 1.5;
    }
  })();

  if (linkType === 'contains') {
    return baseWidth;
  }

  const weightedValue = calculateWeightedValue(linkMetrics, config, 'edge_width');

  // Scale width based on weighted value
  return baseWidth * (0.5 + weightedValue * 0.5);
};

// Get node color based on configuration
export const getNodeColor = (
  node: NodeData,
  nodeMetrics: ComputedNodeMetrics | undefined,
  config: VisualizationConfig,
  allNodeMetrics: ComputedNodeMetrics[],
  extensionColors: Record<string, string>
): string => {
  // Special handling for non-file nodes
  if (node.type === 'class') {
    return NODE_COLORS.CLASS;
  } else if (node.type === 'function') {
    return NODE_COLORS.FUNCTION;
  } else if (node.type === 'method') {
    return NODE_COLORS.METHOD;
  }

  // Check if directories should participate in color calculations
  const colorMapping = getFeatureMapping(config, 'node_color');
  const includeDirectoriesInColor = colorMapping?.includeDirectories ?? true;

  // If directories are excluded from color mapping, use default gray
  if (node.type === 'directory' && !includeDirectoriesInColor) {
    return '#7f8c8d'; // Default gray for directories when excluded
  }

  if (!nodeMetrics) {
    // Fallback colors for nodes without metrics
    if (node.type === 'directory') {
      return NODE_COLORS.DIRECTORY;
    }
    return extensionColors[node.extension || 'unknown'] || NODE_COLORS.UNKNOWN;
  }

  const isCategorical = isColorMappingCategorical(config);

  if (isCategorical) {
    // Categorical coloring
    const categoryValue = calculateCategoricalValue(nodeMetrics, config, 'node_color');

    // If file_type is active, use extension colors for files, special handling for directories
    if (colorMapping?.dataSourceWeights.file_type > 0) {
      if (node.type === 'directory') {
        return NODE_COLORS.DIRECTORY; // Keep directories gray when using file type coloring
      }
      return extensionColors[node.extension || 'unknown'] || NODE_COLORS.UNKNOWN;
    }

    // For other categorical data, generate distributed colors (including directories if enabled)
    const allCategories = [
      ...new Set(allNodeMetrics.map(m => calculateCategoricalValue(m, config, 'node_color'))),
    ];
    const categoricalColors = generateCategoricalColors(allCategories);
    return categoricalColors[categoryValue] || NODE_COLORS.UNKNOWN;
  } else {
    // Continuous coloring (blue to red gradient) - includes directories if enabled
    const intensity = calculateNodeColorIntensity(nodeMetrics, config, allNodeMetrics);

    // Blue to red gradient
    const red = Math.round(255 * intensity);
    const blue = Math.round(255 * (1 - intensity));
    const green = Math.round(128 * (1 - Math.abs(intensity - 0.5) * 2)); // Peak at middle

    return `rgb(${red}, ${green}, ${blue})`;
  }
};

// Calculate edge color based on weighted metrics
export const calculateEdgeColor = (
  linkMetrics: ComputedLinkMetrics,
  config: VisualizationConfig,
  linkType: string
): string => {
  const weightedValue = calculateWeightedValue(linkMetrics, config, 'edge_color');

  // If no configuration is set, fall back to type-based colors
  if (weightedValue === 0) {
    return getLinkColor(linkType);
  }

  // Create a color gradient based on weighted value (blue to red)
  const red = Math.round(255 * weightedValue);
  const blue = Math.round(255 * (1 - weightedValue));
  const green = Math.round(128 * (1 - Math.abs(weightedValue - 0.5) * 2));

  return `rgb(${red}, ${green}, ${blue})`;
};

// Helper function to get link color based on type (fallback)
export const getLinkColor = (linkType: string): string => {
  switch (linkType) {
    case 'filesystem_proximity':
      return '#e74c3c';
    case 'semantic_similarity':
      return '#27ae60';
    case 'import':
    case 'call':
      return '#3498db';
    case 'contains':
      return '#2c3e50';
    default:
      return '#95a5a6';
  }
};

// Calculate pie chart data for a node based on weighted metrics
export const calculatePieChartData = (
  nodeMetrics: ComputedNodeMetrics,
  config: VisualizationConfig | undefined
): { covered: number; uncovered: number } | null => {
  if (!config) return null;

  const mapping = getFeatureMapping(config, 'pie_chart_ratio');
  if (!mapping) return null;

  // Check if pie chart ratio feature is active
  const totalWeight = Object.values(mapping.dataSourceWeights).reduce(
    (sum, weight) => sum + weight,
    0
  );
  if (totalWeight === 0) return null;

  // Check if coverage data is actually available
  if (nodeMetrics.test_coverage_ratio === undefined || nodeMetrics.test_coverage_ratio === null) {
    return null; // No coverage data available, don't show pie chart
  }

  // Calculate the coverage ratio
  const coverageRatio = calculateWeightedValue(nodeMetrics, config, 'pie_chart_ratio');

  // Ensure coverage ratio is between 0 and 1
  const normalizedCoverage = Math.max(0, Math.min(1, coverageRatio));

  return {
    covered: normalizedCoverage,
    uncovered: 1 - normalizedCoverage,
  };
};

// Check if pie chart rendering is enabled for a node
export const isPieChartEnabled = (config: VisualizationConfig | undefined): boolean => {
  if (!config) return false;

  const mapping = getFeatureMapping(config, 'pie_chart_ratio');
  if (!mapping) return false;

  const totalWeight = Object.values(mapping.dataSourceWeights).reduce(
    (sum, weight) => sum + weight,
    0
  );
  return totalWeight > 0;
};
