import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from 'react';
import * as d3 from 'd3';
import { RepositoryData } from '../../types/schema';
import { VisualizationConfig } from '../../types/visualization';
import {
  NodeData,
  LinkData,
  ComputedNodeMetrics,
  ComputedLinkMetrics,
  computeNodeMetrics,
  computeLinkMetrics,
  calculateNodeSize,
  calculateEdgeStrength,
  getNodeColor,
  isNodeVisible,
  isEdgeVisible,
  calculatePieChartData,
  isPieChartEnabled,
} from '../../utils/visualizationUtils';
import { EXTENSION_COLORS } from '../../utils/extensionColors';

interface RepositoryGraphProps {
  data: RepositoryData;
  onSelectFile: (fileId: string | null) => void;
  selectedFile: string | null;
  config: VisualizationConfig;
}

export interface RepositoryGraphHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

interface Node extends d3.SimulationNodeDatum, NodeData {}

interface Link extends d3.SimulationLinkDatum<Node>, LinkData {
  source: string | Node;
  target: string | Node;
}

// Helper function to create pie chart nodes
const createPieChartNodes = (
  nodeGroups: d3.Selection<d3.BaseType, NodeData, d3.BaseType, unknown>,
  nodeMetrics: Map<string, ComputedNodeMetrics>,
  config: VisualizationConfig | undefined,
  allNodeMetrics: ComputedNodeMetrics[],
  extensionColors: Record<string, string>,
  onSelectFile: (fileId: string | null) => void
): d3.Selection<d3.BaseType, NodeData, d3.BaseType, unknown> => {
  // Create a group for each pie chart
  const pieGroups = nodeGroups.append('g').attr('class', 'pie-node');

  pieGroups.each(function (d) {
    const group = d3.select(this);
    const metrics = nodeMetrics.get(d.id);

    if (!metrics) {
      // Fallback to regular circle if no metrics
      group
        .append('circle')
        .attr('r', 5)
        .attr('fill', '#ccc')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
      return;
    }

    const radius = calculateNodeSize(metrics, config, allNodeMetrics, d.type);
    const pieData = calculatePieChartData(metrics, config);

    if (!pieData || (pieData.covered === 0 && pieData.uncovered === 0)) {
      // No coverage data available, show regular circle
      group
        .append('circle')
        .attr('r', radius)
        .attr('fill', getNodeColor(d, metrics, config, allNodeMetrics, extensionColors))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
      return;
    }

    // Create pie generator
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

    // Add pie chart segments
    group
      .selectAll('.pie-segment')
      .data(pieChartData)
      .enter()
      .append('path')
      .attr('class', 'pie-segment')
      .attr('d', arc)
      .attr('fill', (_, i) => {
        if (i === 0) {
          // Covered portion - use green
          return '#22c55e';
        } else {
          // Uncovered portion - use the node's regular color or red
          return getNodeColor(d, metrics, config, allNodeMetrics, extensionColors);
        }
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);
  });

  // Add event handlers to the pie groups
  pieGroups
    .style('cursor', 'pointer')
    .on('mouseover', function () {
      d3.select(this).selectAll('.pie-segment').attr('stroke-width', 2);
    })
    .on('mouseout', function () {
      d3.select(this).selectAll('.pie-segment').attr('stroke-width', 1);
    })
    .on('click', (event, d) => {
      event.stopPropagation();
      onSelectFile(d.id);
    });

  return pieGroups;
};

const RepositoryGraph = forwardRef<RepositoryGraphHandle, RepositoryGraphProps>(
  ({ data, onSelectFile, selectedFile, config }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const [nodeMetrics, setNodeMetrics] = useState<Map<string, ComputedNodeMetrics>>(new Map());
    const [linkMetrics, setLinkMetrics] = useState<Map<string, ComputedLinkMetrics>>(new Map());

    // Function to toggle node expansion
    const toggleNodeExpansion = useCallback((fileId: string) => {
      setExpandedFiles(prev => {
        const next = new Set(prev);
        if (next.has(fileId)) {
          next.delete(fileId);
        } else {
          next.add(fileId);
        }
        return next;
      });
    }, []);

    // Helper function to check if a file has components
    const hasComponents = useCallback(
      (fileId: string): boolean => {
        const file = data.files.find(f => f.id === fileId);
        return file ? file.components && file.components.length > 0 : false;
      },
      [data.files]
    );

    // Expose methods to parent components
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (!svgRef.current || !zoomRef.current) return;
        const svg = d3.select(svgRef.current);
        const currentTransform = d3.zoomTransform(svg.node()!);
        svg
          .transition()
          .duration(250)
          .call(
            zoomRef.current.transform,
            d3.zoomIdentity
              .translate(currentTransform.x, currentTransform.y)
              .scale(currentTransform.k * 1.2)
          );
      },
      zoomOut: () => {
        if (!svgRef.current || !zoomRef.current) return;
        const svg = d3.select(svgRef.current);
        const currentTransform = d3.zoomTransform(svg.node()!);
        svg
          .transition()
          .duration(250)
          .call(
            zoomRef.current.transform,
            d3.zoomIdentity
              .translate(currentTransform.x, currentTransform.y)
              .scale(currentTransform.k / 1.2)
          );
      },
      resetView: () => {
        if (!svgRef.current || !zoomRef.current) return;
        const svg = d3.select(svgRef.current);
        svg.transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
      },
    }));

    // Effect to handle container size changes using ResizeObserver
    useEffect(() => {
      let resizeTimeout: NodeJS.Timeout;

      const handleResize = () => {
        if (containerRef.current) {
          const newWidth = containerRef.current.clientWidth;
          const viewportHeight = window.innerHeight;
          const header = document.querySelector('header');
          const repoInfo = document.querySelector('.max-w-7xl');
          const controls = document.querySelector('.border-t');
          const headerHeight = header ? header.offsetHeight : 0;
          const repoInfoHeight = repoInfo ? repoInfo.offsetHeight : 0;
          const controlsHeight = controls ? controls.offsetHeight : 0;
          const availableHeight =
            viewportHeight - headerHeight - repoInfoHeight - controlsHeight - 16;
          const newHeight = Math.max(availableHeight, 400);

          setDimensions(prev => {
            const widthChanged = Math.abs(prev.width - newWidth) > 2;
            const heightChanged = Math.abs(prev.height - newHeight) > 2;
            if (widthChanged || heightChanged) {
              return { width: newWidth, height: newHeight };
            }
            return prev;
          });
        }
      };

      const debouncedResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 100);
      };

      handleResize();

      if (containerRef.current && window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(debouncedResize);
        resizeObserver.observe(containerRef.current);
        return () => {
          clearTimeout(resizeTimeout);
          resizeObserver.disconnect();
        };
      } else {
        window.addEventListener('resize', debouncedResize);
        return () => {
          clearTimeout(resizeTimeout);
          window.removeEventListener('resize', debouncedResize);
        };
      }
    }, []);

    // Effect to handle dimension changes
    useEffect(() => {
      if (
        !svgRef.current ||
        !simulationRef.current ||
        dimensions.width === 0 ||
        dimensions.height === 0
      )
        return;
      const svg = d3.select(svgRef.current);
      const simulation = simulationRef.current;
      const { width, height } = dimensions;
      svg.attr('width', width).attr('height', height).attr('viewBox', [0, 0, width, height]);
      const centerForce = simulation.force('center') as d3.ForceCenter<Node>;
      if (centerForce) {
        centerForce.x(width / 2).y(height / 2);
      }
      simulation.alpha(0.05).restart();
    }, [dimensions]);

    // Compute metrics when data changes
    useEffect(() => {
      if (!data) return;
      setNodeMetrics(computeNodeMetrics(data));
      setLinkMetrics(computeLinkMetrics(data));
    }, [data]);

    // Main drawing effect
    useEffect(() => {
      if (
        !svgRef.current ||
        !containerRef.current ||
        !data ||
        dimensions.width === 0 ||
        dimensions.height === 0 ||
        nodeMetrics.size === 0
      )
        return;

      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      const { width, height } = dimensions;
      svg.attr('width', width).attr('height', height).attr('viewBox', [0, 0, width, height]);

      const g = svg.append('g');

      const allNodes: Node[] = [];
      data.files.forEach(file => {
        if (file.type === 'file' || file.type === 'directory') {
          allNodes.push({ ...file, expanded: expandedFiles.has(file.id) });
          if (expandedFiles.has(file.id) && file.components) {
            file.components.forEach(component => {
              allNodes.push({
                ...component,
                path: file.path,
                parentId: file.id,
                depth: file.depth + 1,
                size: 0,
              });
            });
          }
        }
      });

      const allNodeMetrics = Array.from(nodeMetrics.values());
      const nodes = allNodes.filter(node => {
        const metrics = nodeMetrics.get(node.id);
        return metrics ? isNodeVisible(metrics, config, allNodeMetrics, node.type) : true;
      });
      const nodeIds = new Set(nodes.map(n => n.id));

      const createLinks = () => {
        const baseLinks = data.relationships
          .filter(rel => nodeIds.has(rel.source) && nodeIds.has(rel.target))
          .map(rel => {
            const linkKey = `${rel.source}-${rel.target}`;
            const linkMetric = linkMetrics.get(linkKey);
            const edgeStrength = linkMetric ? calculateEdgeStrength(linkMetric, config) : 0;
            return { ...rel, weight: edgeStrength };
          })
          .filter(link => {
            if (link.weight <= 0) return false;
            const linkKey = `${link.source}-${link.target}`;
            const linkMetric = linkMetrics.get(linkKey);
            return linkMetric ? isEdgeVisible(linkMetric, config, link.type) : false;
          });

        const dynamicLinks: Link[] = [];
        nodes.forEach(node => {
          if (node.parentId && nodeIds.has(node.parentId)) {
            const containsMetric: ComputedLinkMetrics = {
              semantic_similarity: 0,
              filesystem_proximity: 0,
              code_references: 1,
            };
            const edgeStrength = calculateEdgeStrength(containsMetric, config);
            dynamicLinks.push({
              source: node.parentId,
              target: node.id,
              type: 'contains',
              weight: edgeStrength,
              originalStrength: 1,
            });
          }
        });
        return [...baseLinks, ...dynamicLinks];
      };
      const links = createLinks();

      const simulation = d3
        .forceSimulation<Node>(nodes)
        .force(
          'link',
          d3
            .forceLink<Node, Link>(links)
            .id(d => d.id)
            .distance(d => {
              const baseDistance = 100;
              const weight = d.weight || 0;
              const strength = d.originalStrength || 1;
              if (d.type === 'filesystem_proximity')
                return baseDistance * (1 - weight * 0.5) * (1 / strength);
              if (d.type === 'semantic_similarity')
                return baseDistance * (1 - weight * 0.4) * (1 / strength);
              if (d.type === 'contains') return 50;
              return baseDistance * (1 - weight * 0.3);
            })
            .strength(d => {
              const baseStrength = 1;
              const weight = d.weight || 0;
              const strength = d.originalStrength || 1;
              if (d.type === 'contains') return 2;
              return baseStrength * weight * strength;
            })
        )
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force(
          'collision',
          d3.forceCollide<Node>().radius(d => {
            const metrics = nodeMetrics.get(d.id);
            return (metrics ? calculateNodeSize(metrics, config, allNodeMetrics, d.type) : 5) + 5;
          })
        );
      simulationRef.current = simulation;

      const allLinkElements: d3.Selection<SVGLineElement, Link, SVGGElement, unknown>[] = [];
      (config.skeletons || []).forEach(skeleton => {
        if (!skeleton.enabled) return;
        const skeletonLinks = links.filter(link => skeleton.relationshipTypes.includes(link.type));
        if (skeletonLinks.length === 0) return;

        const linkGroup = g.append('g').attr('class', `skeleton-${skeleton.id}`);
        const linkSelection = linkGroup
          .selectAll('line')
          .data(skeletonLinks)
          .enter()
          .append('line')
          .attr('stroke', skeleton.color)
          .attr('stroke-opacity', skeleton.opacity)
          .attr('stroke-width', d => {
            const linkKey = `${(d.source as any).id || d.source}-${(d.target as any).id || d.target}`;
            const linkMetric = linkMetrics.get(linkKey);
            if (d.type === 'contains') return 3;
            if (!linkMetric) return 1;
            if (skeleton.id === 'code_references')
              return 1.5 + (linkMetric.code_references || 0) * 1.5;
            if (skeleton.id === 'semantic_similarity')
              return 1 + (linkMetric.semantic_similarity || 0) * 2;
            if (skeleton.id === 'filesystem_proximity')
              return 1 + (linkMetric.filesystem_proximity || 0) * 1.5;
            return 1.5;
          });

        linkSelection.append('title').text(d => {
          const sourceName = (d.source as any).name || (d.source as any).id || d.source;
          const targetName = (d.target as any).name || (d.target as any).id || d.target;
          const strength = d.originalStrength || 1;
          const referenceText = strength > 1 ? `${strength} references` : '1 reference';
          return `${sourceName} → ${targetName}\nType: ${d.type}\nReferences: ${referenceText}`;
        });
        allLinkElements.push(linkSelection);
      });

      const nodeGroups = g
        .append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .style('cursor', 'pointer');

      const pieChartMode = isPieChartEnabled(config);
      let node: d3.Selection<d3.BaseType, NodeData, d3.BaseType, unknown>;
      if (pieChartMode) {
        node = createPieChartNodes(
          nodeGroups,
          nodeMetrics,
          config,
          allNodeMetrics,
          EXTENSION_COLORS,
          onSelectFile
        );
      } else {
        node = nodeGroups
          .append('circle')
          .attr('r', d => {
            const metrics = nodeMetrics.get(d.id);
            return metrics ? calculateNodeSize(metrics, config, allNodeMetrics, d.type) : 5;
          })
          .attr('fill', d => {
            const metrics = nodeMetrics.get(d.id);
            return getNodeColor(d, metrics, config, allNodeMetrics, EXTENSION_COLORS);
          })
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5);
      }

      nodeGroups.append('title').text(d => d.path);
      nodeGroups.on('click', (event, d) => {
        event.stopPropagation();
        if (hasComponents(d.id)) {
          toggleNodeExpansion(d.id);
        } else {
          onSelectFile(d.id);
        }
      });

      const label = g
        .append('g')
        .attr('class', 'labels')
        .selectAll('text')
        .data(nodes)
        .enter()
        .append('text')
        .attr('class', 'node-label')
        .attr('font-size', 10)
        .attr('fill', '#333')
        .text(d => d.name);

      const dragBehavior = (simulation: d3.Simulation<Node, Link>) =>
        d3
          .drag<any, Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          });
      nodeGroups.call(dragBehavior(simulation));

      simulation.on('tick', () => {
        allLinkElements.forEach(linkSelection => {
          linkSelection
            .attr('x1', d => (d.source as any).x)
            .attr('y1', d => (d.source as any).y)
            .attr('x2', d => (d.target as any).x)
            .attr('y2', d => (d.target as any).y);
        });
        nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
        label.attr('x', d => d.x! + 10).attr('y', d => d.y! + 4);
      });

      const zoomBehavior = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 10])
        .on('zoom', event => {
          g.attr('transform', event.transform);
        });
      svg.call(zoomBehavior);
      zoomRef.current = zoomBehavior;

      const updateSelectionHighlight = () => {
        nodeGroups
          .selectAll('circle, .pie-node')
          .transition()
          .duration(200)
          .attr('stroke', d => (d.id === selectedFile ? '#3b82f6' : '#fff'))
          .attr('stroke-width', d => (d.id === selectedFile ? 3 : 1.5));
      };
      updateSelectionHighlight();

      return () => {
        simulation.stop();
      };
    }, [
      data,
      dimensions,
      config,
      expandedFiles,
      nodeMetrics,
      linkMetrics,
      onSelectFile,
      selectedFile,
      hasComponents,
      toggleNodeExpansion,
    ]);

    // Effect for selection highlight only
    useEffect(() => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      svg
        .selectAll('g.nodes g')
        .selectAll('circle, .pie-node')
        .transition()
        .duration(200)
        .attr('stroke', d => ((d as Node).id === selectedFile ? '#3b82f6' : '#fff'))
        .attr('stroke-width', d => ((d as Node).id === selectedFile ? 3 : 1.5));
    }, [selectedFile]);

    return (
      <div ref={containerRef} className="w-full h-full relative overflow-hidden">
        <svg ref={svgRef}></svg>
      </div>
    );
  }
);

export default RepositoryGraph;
