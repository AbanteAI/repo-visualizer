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
  calculateEdgeWidth,
  calculateEdgeColor,
} from '../../utils/visualizationUtils';
import { EXTENSION_COLORS } from '../../utils/extensionColors';
import { createPieChartNodes, isPieChartEnabled } from './RepositoryGraph.helpers';

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

      const link = g
        .append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', d => {
          const linkKey = `${(d.source as any).id || d.source}-${(d.target as any).id || d.target}`;
          const linkMetric = linkMetrics.get(linkKey) ?? {
            semantic_similarity: 0,
            filesystem_proximity: 0,
            code_references: d.type === 'contains' ? 1 : 0,
          };
          return calculateEdgeColor(linkMetric, config, d.type);
        })
        .attr('stroke-opacity', d => (d.type === 'contains' ? 0.8 : 0.4))
        .attr('stroke-width', d => {
          const linkKey = `${(d.source as any).id || d.source}-${(d.target as any).id || d.target}`;
          const linkMetric = linkMetrics.get(linkKey) ?? {
            semantic_similarity: 0,
            filesystem_proximity: 0,
            code_references: d.type === 'contains' ? 1 : 0,
          };
          return calculateEdgeWidth(linkMetric, config, d.type);
        });

      link.append('title').text(d => {
        const sourceName = (d.source as any).name || (d.source as any).id || d.source;
        const targetName = (d.target as any).name || (d.target as any).id || d.target;
        const strength = d.originalStrength || 1;
        const referenceText = strength > 1 ? `${strength} references` : '1 reference';
        return `${sourceName} → ${targetName}\nType: ${d.type}\nReferences: ${referenceText}`;
      });

      const nodeGroups = g
        .append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .style('cursor', 'pointer')
        .call(dragBehavior(simulation));

      const pieChartMode = isPieChartEnabled(config);
      let node: d3.Selection<d3.BaseType, Node, d3.BaseType, unknown>;

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
          .attr('class', 'node')
          .attr('r', d => {
            const metrics = nodeMetrics.get(d.id);
            return metrics ? calculateNodeSize(metrics, config, allNodeMetrics, d.type) : 5;
          })
          .attr('fill', d => {
            const metrics = nodeMetrics.get(d.id);
            return getNodeColor(d, metrics, config, allNodeMetrics, EXTENSION_COLORS);
          })
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .on('mouseover', function (_event, _d) {
            d3.select(this).attr('stroke-width', 3);
          })
          .on('mouseout', function (_event, _d) {
            const isSelected = d3.select(this).attr('stroke') === '#e74c3c';
            d3.select(this).attr('stroke-width', isSelected ? 2 : 1.5);
          })
          .on('click', (event, d) => {
            event.stopPropagation();
            onSelectFile(d.id);
          });
      }

      node.append('title').text(d => `${d.name}\nPath: ${d.path}\nType: ${d.type}`);

      nodeGroups
        .filter(d => hasComponents(d.id))
        .on('dblclick', (event, d) => {
          event.stopPropagation();
          toggleNodeExpansion(d.id);
        });

      nodeGroups
        .filter(d => hasComponents(d.id))
        .append('text')
        .attr('class', 'expand-indicator')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .style('fill', '#fff')
        .style('pointer-events', 'none')
        .text(d => (expandedFiles.has(d.id) ? '-' : '+'));

      const labels = g
        .append('g')
        .selectAll('text')
        .data(nodes)
        .enter()
        .append('text')
        .attr('class', 'label')
        .text(d => d.name)
        .attr('font-size', 10)
        .attr('dx', 12)
        .attr('dy', 4)
        .attr('fill', '#333');

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8])
        .on('zoom', event => {
          g.attr('transform', event.transform);
        });
      svg.call(zoom);
      zoomRef.current = zoom;

      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as any).x)
          .attr('y1', d => (d.source as any).y)
          .attr('x2', d => (d.target as any).x)
          .attr('y2', d => (d.target as any).y);
        nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
        labels.attr('x', d => d.x!).attr('y', d => d.y!);
      });

      function dragBehavior(simulation: d3.Simulation<Node, Link>) {
        function dragstarted(event: any, d: Node) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }
        function dragged(event: any, d: Node) {
          d.fx = event.x;
          d.fy = event.y;
        }
        function dragended(event: any, d: Node) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
        return d3
          .drag<any, Node>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended);
      }

      return () => {
        simulation.stop();
      };
    }, [data, dimensions, expandedFiles, nodeMetrics, linkMetrics, config]);

    useEffect(() => {
      if (!svgRef.current || !simulationRef.current || nodeMetrics.size === 0) return;
      const svg = d3.select(svgRef.current);
      const allNodeMetrics = Array.from(nodeMetrics.values());

      svg
        .selectAll('.node')
        .transition()
        .duration(300)
        .attr('r', d => {
          const metrics = nodeMetrics.get((d as Node).id);
          return metrics ? calculateNodeSize(metrics, config, allNodeMetrics, (d as Node).type) : 5;
        })
        .attr('fill', d => {
          const metrics = nodeMetrics.get((d as Node).id);
          return getNodeColor(d as Node, metrics, config, allNodeMetrics, EXTENSION_COLORS);
        })
        .style('display', d => {
          const metrics = nodeMetrics.get((d as Node).id);
          return metrics && isNodeVisible(metrics, config, allNodeMetrics, (d as Node).type)
            ? ''
            : 'none';
        });

      svg
        .selectAll('line')
        .transition()
        .duration(300)
        .attr('stroke-width', d => {
          const linkKey = `${((d as Link).source as any).id || (d as Link).source}-${
            ((d as Link).target as any).id || (d as Link).target
          }`;
          const linkMetric = linkMetrics.get(linkKey) ?? {
            semantic_similarity: 0,
            filesystem_proximity: 0,
            code_references: (d as Link).type === 'contains' ? 1 : 0,
          };
          return calculateEdgeWidth(linkMetric, config, (d as Link).type);
        })
        .attr('stroke', d => {
          const linkKey = `${((d as Link).source as any).id || (d as Link).source}-${
            ((d as Link).target as any).id || (d as Link).target
          }`;
          const linkMetric = linkMetrics.get(linkKey) ?? {
            semantic_similarity: 0,
            filesystem_proximity: 0,
            code_references: (d as Link).type === 'contains' ? 1 : 0,
          };
          return calculateEdgeColor(linkMetric, config, (d as Link).type);
        })
        .style('display', d => {
          const linkKey = `${((d as Link).source as any).id || (d as Link).source}-${
            ((d as Link).target as any).id || (d as Link).target
          }`;
          const linkMetric = linkMetrics.get(linkKey);
          return linkMetric && isEdgeVisible(linkMetric, config, (d as Link).type) ? '' : 'none';
        });

      const simulation = simulationRef.current;
      if (simulation) {
        const linkForce = simulation.force('link') as d3.ForceLink<Node, Link>;
        if (linkForce) {
          linkForce.strength(d => {
            const linkKey = `${(d.source as any).id}-${(d.target as any).id}`;
            const linkMetric = linkMetrics.get(linkKey);
            return linkMetric ? calculateEdgeStrength(linkMetric, config) : 0;
          });
        }
        simulation.alpha(0.1).restart();
      }
    }, [config, nodeMetrics, linkMetrics]);

    useEffect(() => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      const pieChartMode = isPieChartEnabled(config);
      const nodes = pieChartMode ? svg.selectAll('g.pie-node') : svg.selectAll('circle.node');
      if (nodes.empty()) return;
      if (pieChartMode) {
        nodes.selectAll('.pie-segment').attr('stroke', '#fff').attr('stroke-width', 1);
      } else {
        nodes.attr('stroke', '#fff').attr('stroke-width', 1.5);
      }
      if (selectedFile) {
        const selectedNodes = nodes.filter(function (d) {
          return d && typeof d === 'object' && 'id' in d && d.id === selectedFile;
        });
        if (pieChartMode) {
          selectedNodes.selectAll('.pie-segment').attr('stroke', '#e74c3c').attr('stroke-width', 2);
        } else {
          selectedNodes.attr('stroke', '#e74c3c').attr('stroke-width', 2);
        }
      }
    }, [selectedFile, config, expandedFiles]);

    return (
      <div ref={containerRef} className="w-full h-full bg-gray-50 rounded-lg overflow-hidden">
        <svg ref={svgRef}></svg>
      </div>
    );
  }
);

export default RepositoryGraph;
