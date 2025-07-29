import * as d3 from 'd3';
import {
  ComputedNodeMetrics,
  NodeData,
  calculateNodeSize,
  getNodeColor,
} from '../../utils/visualizationUtils';
import { VisualizationConfig } from '../../types/visualization';

export const isPieChartEnabled = (config: VisualizationConfig): boolean => {
  const mapping = config.mappings.find(m => m.featureId === 'pie_chart_ratio');
  return mapping ? Object.values(mapping.dataSourceWeights).some(w => w > 0) : false;
};

export const calculatePieChartData = (
  metrics: ComputedNodeMetrics,
  config: VisualizationConfig
): { covered: number; uncovered: number } | null => {
  const mapping = config.mappings.find(m => m.featureId === 'pie_chart_ratio');
  if (!mapping) return null;

  const totalWeightedValue = Object.entries(mapping.dataSourceWeights).reduce(
    (acc, [dataSourceId, weight]) => {
      if (weight > 0 && typeof (metrics as any)[dataSourceId] === 'number') {
        return acc + ((metrics as any)[dataSourceId] * weight) / 100;
      }
      return acc;
    },
    0
  );

  const totalWeight = Object.values(mapping.dataSourceWeights).reduce((acc, w) => acc + w, 0) / 100;
  const ratio = totalWeight > 0 ? totalWeightedValue / totalWeight : 0;

  return {
    covered: ratio,
    uncovered: 1 - ratio,
  };
};

export const createPieChartNodes = (
  nodeGroups: d3.Selection<d3.BaseType, NodeData, d3.BaseType, unknown>,
  nodeMetrics: Map<string, ComputedNodeMetrics>,
  config: VisualizationConfig,
  allNodeMetrics: ComputedNodeMetrics[],
  extensionColors: Record<string, string>,
  onSelectFile: (fileId: string | null) => void
) => {
  const pieNodeGroups = nodeGroups
    .append('g')
    .attr('class', 'pie-node')
    .on('click', (event, d) => {
      event.stopPropagation();
      onSelectFile(d.id);
    });

  pieNodeGroups.each(function (d) {
    const group = d3.select(this);
    const metrics = nodeMetrics.get(d.id);
    if (!metrics) return;

    const radius = calculateNodeSize(metrics, config, allNodeMetrics, d.type);
    const pieData = calculatePieChartData(metrics, config);

    if (!pieData || (pieData.covered === 0 && pieData.uncovered === 0)) {
      group
        .append('circle')
        .attr('r', radius)
        .attr('fill', getNodeColor(d, metrics, config, allNodeMetrics, extensionColors))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
    } else {
      const pie = d3
        .pie<{ label: string; value: number }>()
        .value(d => d.value)
        .sort(null);
      const arc = d3
        .arc<d3.PieArcDatum<{ label: string; value: number }>>()
        .innerRadius(0)
        .outerRadius(radius);

      const pieChartData = pie([
        { label: 'covered', value: pieData.covered },
        { label: 'uncovered', value: pieData.uncovered },
      ]);

      group
        .selectAll('.pie-segment')
        .data(pieChartData)
        .enter()
        .append('path')
        .attr('class', 'pie-segment')
        .attr('d', arc)
        .attr('fill', (_, i) => {
          if (i === 0) {
            return '#22c55e'; // Covered portion - green
          } else {
            return getNodeColor(d, metrics, config, allNodeMetrics, extensionColors);
          }
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);
    }
  });

  return pieNodeGroups;
};
