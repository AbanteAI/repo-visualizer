import { RepositoryData } from '../types/schema';
import { VisualizationConfig, getFeatureMapping } from '../types/visualization';

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
  file_size: number;
  commit_count: number;
  recency: number;
  identifiers: number;
  references: number;
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

  // Process each file
  data.files.forEach(file => {
    const fileMetrics = file.metrics || {};

    // Calculate recency score (0-1, where 1 is most recent)
    let recencyScore = 0;
    if (fileMetrics.lastCommitDaysAgo !== undefined) {
      // Convert days ago to a score (fresher = higher score)
      const daysAgo = fileMetrics.lastCommitDaysAgo;
      recencyScore = Math.max(0, 1 - daysAgo / 365); // Normalize to 0-1 over a year
    }

    metrics.set(file.id, {
      file_size: file.size || 0,
      commit_count: fileMetrics.commitCount || 0,
      recency: recencyScore,
      identifiers: fileMetrics.topLevelIdentifiers || 0,
      references: incomingReferences.get(file.id) || 0,
    });
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

// Calculate weighted value for a visual feature
export const calculateWeightedValue = (
  metrics: Record<string, number>,
  config: VisualizationConfig,
  featureId: string
): number => {
  const mapping = getFeatureMapping(config, featureId);
  if (!mapping) return 0;

  let totalWeightedValue = 0;
  let totalWeight = 0;

  Object.entries(mapping.dataSourceWeights).forEach(([dataSourceId, weight]) => {
    if (weight > 0 && metrics[dataSourceId] !== undefined) {
      totalWeightedValue += (metrics[dataSourceId] * weight) / 100;
      totalWeight += weight / 100;
    }
  });

  return totalWeight > 0 ? totalWeightedValue / totalWeight : 0;
};

// Normalize values to a 0-1 range
export const normalizeValues = (values: number[]): number[] => {
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
  if (nodeType === 'directory') {
    return 10;
  }

  if (nodeType === 'class' || nodeType === 'function' || nodeType === 'method') {
    return 6;
  }

  // Normalize across all nodes
  const allWeightedValues = allNodeMetrics.map(m => calculateWeightedValue(m, config, 'node_size'));
  const normalizedValues = normalizeValues(allWeightedValues);
  const nodeIndex = allNodeMetrics.indexOf(nodeMetrics);
  const normalizedValue = normalizedValues[nodeIndex] || 0;

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
  // Normalize across all nodes
  const allWeightedValues = allNodeMetrics.map(m =>
    calculateWeightedValue(m, config, 'node_color')
  );
  const normalizedValues = normalizeValues(allWeightedValues);
  const nodeIndex = allNodeMetrics.indexOf(nodeMetrics);

  return normalizedValues[nodeIndex] || 0;
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

// Get node color with intensity overlay
export const getNodeColorWithIntensity = (
  node: NodeData,
  extensionColors: Record<string, string>,
  intensity: number
): string => {
  let baseColor = '#aaaaaa';

  if (node.type === 'directory') {
    baseColor = '#7f8c8d';
  } else if (node.type === 'class') {
    baseColor = '#e67e22';
  } else if (node.type === 'function') {
    baseColor = '#3498db';
  } else if (node.type === 'method') {
    baseColor = '#9b59b6';
  } else if (node.extension && extensionColors[node.extension]) {
    baseColor = extensionColors[node.extension];
  }

  // If no intensity mapping is active, return base color
  if (intensity === 0) {
    return baseColor;
  }

  // Apply intensity as opacity or color variation
  const intensityHex = Math.round(intensity * 255)
    .toString(16)
    .padStart(2, '0');
  return baseColor + intensityHex;
};

// Helper function to get link color based on type
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
