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
    const originalNodesRef = useRef<Node[]>([]);
    const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
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

    // Effect for initializing the simulation and SVG structure
    useEffect(() => {
      if (
        !svgRef.current ||
        !containerRef.current ||
        dimensions.width === 0 ||
        dimensions.height === 0
      ) {
        return;
      }

      if (simulationRef.current) {
        return; // Already initialized
      }

      const svg = d3.select(svgRef.current);
      const { width, height } = dimensions;

      svg.selectAll('*').remove();
      const g = svg.append('g');
      g.append('g').attr('class', 'links');
      g.append('g').attr('class', 'nodes');

      const simulation = d3
        .forceSimulation<Node>()
        .force(
          'link',
          d3.forceLink<Node, Link>().id(d => d.id)
        )
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide<Node>());

      simulationRef.current = simulation;

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8])
        .on('zoom', event => {
          g.attr('transform', event.transform);
          g.selectAll('.node text').style('display', event.transform.k > 1.5 ? 'block' : 'none');
        });

      svg.call(zoom);
      zoomRef.current = zoom;

      const ticked = () => {
        g.selectAll<SVGLineElement, Link>('.link')
          .attr('x1', d => (d.source as Node).x!)
          .attr('y1', d => (d.source as Node).y!)
          .attr('x2', d => (d.target as Node).x!)
          .attr('y2', d => (d.target as Node).y!);

        g.selectAll<SVGGElement, Node>('.node').attr('transform', d => `translate(${d.x},${d.y})`);
      };
      simulation.on('tick', ticked);
    }, [dimensions]);

    // Effect for updating the visualization with new data
    useEffect(() => {
      if (!simulationRef.current || !data || nodeMetrics.size === 0) {
        return;
      }

      const simulation = simulationRef.current;
      const svg = d3.select(svgRef.current);
      const g = svg.select<SVGGElement>('g');

      // Extract nodes from files and their components, preserving positions
      const allNodes: Node[] = [];
      const existingPositions = nodePositionsRef.current;

      // Add file and directory nodes
      data.files.forEach(file => {
        if (file.type === 'file' || file.type === 'directory') {
          const pos = existingPositions.get(file.id);
          allNodes.push({
            id: file.id,
            name: file.name,
            path: file.path,
            type: file.type,
            extension: file.extension,
            size: file.size,
            depth: file.depth,
            expanded: expandedFiles.has(file.id),
            x: pos?.x ?? dimensions.width / 2,
            y: pos?.y ?? dimensions.height / 2,
          });

          // Add component nodes only if file is expanded
          if (expandedFiles.has(file.id) && file.components) {
            file.components.forEach(component => {
              const parentPos = existingPositions.get(file.id);
              const pos = existingPositions.get(component.id);
              allNodes.push({
                ...component,
                path: file.path,
                parentId: file.id,
                depth: file.depth + 1,
                size: 0,
                x: pos?.x ?? parentPos?.x ?? dimensions.width / 2,
                y: pos?.y ?? parentPos?.y ?? dimensions.height / 2,
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
      originalNodesRef.current = nodes;
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

      simulation.nodes(nodes);
      const linkForce = simulation.force<d3.ForceLink<Node, Link>>('link');
      if (linkForce) {
        linkForce.links(links).strength(d => {
          const linkMetric = linkMetrics.get(`${(d.source as Node).id}-${(d.target as Node).id}`);
          return linkMetric ? calculateEdgeStrength(linkMetric, config) : 0;
        });
      }
      const collisionForce = simulation.force<d3.ForceCollide<Node>>('collision');
      if (collisionForce) {
        collisionForce.radius(d => {
          const metrics = nodeMetrics.get(d.id);
          return (metrics ? calculateNodeSize(metrics, config, allNodeMetrics, d.type) : 5) + 5;
        });
      }

      const link = g
        .select('.links')
        .selectAll('line')
        .data(links, d => `${(d.source as Node).id}-${(d.target as Node).id}`)
        .join(
          enter => enter.append('line').attr('stroke-opacity', 0),
          update => update,
          exit => exit.transition().duration(300).attr('stroke-opacity', 0).remove()
        );

      link
        .attr('class', 'link')
        .transition()
        .duration(300)
        .attr('stroke-opacity', 0.6)
        .attr('stroke', '#999');

      const node = g
        .select('.nodes')
        .selectAll('g')
        .data(nodes, d => d.id)
        .join(
          enter => {
            const g = enter.append('g').attr('transform', 'scale(0)');
            g.append('circle');
            g.append('text');
            g.call(
              d3
                .drag<SVGGElement, Node>()
                .on('start', (event, d) => {
                  if (!event.active) simulation.alphaTarget(0.1).restart();
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
                }) as any
            );
            g.on('click', (event, d) => {
              event.stopPropagation();
              onSelectFile(d.id);
            });
            return g;
          },
          update => update,
          exit => exit.transition().duration(300).attr('transform', 'scale(0)').remove()
        );

      node.transition().duration(300).attr('transform', 'scale(1)');

      node
        .select('circle')
        .attr('r', d => {
          const metrics = nodeMetrics.get(d.id);
          return metrics ? calculateNodeSize(metrics, config, allNodeMetrics, d.type) : 5;
        })
        .attr('fill', d => {
          const metrics = nodeMetrics.get(d.id);
          return metrics
            ? getNodeColor(d, metrics, config, allNodeMetrics, EXTENSION_COLORS)
            : '#ccc';
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);

      node
        .select('text')
        .text(d => d.name)
        .attr('x', 12)
        .attr('y', 4)
        .style('font-size', '12px')
        .style('fill', '#333')
        .style('pointer-events', 'none');

      for (let i = 0; i < 100; ++i) {
        simulation.tick();
      }

      simulation.alpha(0.1).restart();
    }, [data, nodeMetrics, linkMetrics, expandedFiles, config, onSelectFile, dimensions]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (simulationRef.current) {
          simulationRef.current.stop();
        }
      };
    }, []);

    return (
      <div ref={containerRef} className="w-full h-full">
        <svg ref={svgRef} className="w-full h-full"></svg>
      </div>
    );
  }
);

export default RepositoryGraph;
