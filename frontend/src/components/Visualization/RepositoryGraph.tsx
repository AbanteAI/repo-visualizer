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
  calculateEdgeWidth,
  calculateEdgeColor,
  getNodeColor,
  getLinkColor,
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

          // Calculate available height dynamically
          const viewportHeight = window.innerHeight;
          const header = document.querySelector('header');
          const repoInfo = document.querySelector('.max-w-7xl'); // repo info section
          const controls = document.querySelector('.border-t'); // controls section

          const headerHeight = header ? header.offsetHeight : 0;
          const repoInfoHeight = repoInfo ? repoInfo.offsetHeight : 0;
          const controlsHeight = controls ? controls.offsetHeight : 0;

          // Calculate available height for the graph
          const availableHeight =
            viewportHeight - headerHeight - repoInfoHeight - controlsHeight - 16; // 16px for padding
          const newHeight = Math.max(availableHeight, 400); // minimum 400px

          // Only update if dimensions actually changed significantly (avoid micro-changes)
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

      // Set initial dimensions
      handleResize();

      // Use ResizeObserver for better detection of container size changes
      if (containerRef.current && window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(debouncedResize);
        resizeObserver.observe(containerRef.current);

        // Cleanup
        return () => {
          clearTimeout(resizeTimeout);
          resizeObserver.disconnect();
        };
      } else {
        // Fallback to window resize listener
        window.addEventListener('resize', debouncedResize);
        return () => {
          clearTimeout(resizeTimeout);
          window.removeEventListener('resize', debouncedResize);
        };
      }
    }, []);

    // Effect to handle dimension changes - only update simulation if it exists
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
      const width = dimensions.width;
      const height = dimensions.height;

      // Update SVG dimensions - ensure it doesn't expand beyond container
      svg
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .style('max-width', '100%')
        .style('max-height', '100%');

      // Update center force to new dimensions
      const centerForce = simulation.force('center') as d3.ForceCenter<Node>;
      if (centerForce) {
        centerForce.x(width / 2).y(height / 2);
      }

      // Gently restart simulation to adjust to new dimensions (reduce alpha to minimize movement)
      simulation.alpha(0.05).restart();
    }, [dimensions]);

    // Compute metrics when data changes
    useEffect(() => {
      if (!data) return;

      const computeMetrics = async () => {
        const computedNodeMetrics = await computeNodeMetrics(data, config.searchTerm);
        const computedLinkMetrics = computeLinkMetrics(data);

        setNodeMetrics(computedNodeMetrics);
        setLinkMetrics(computedLinkMetrics);
      };

      computeMetrics();
    }, [data, config.searchTerm]);

    // Initial setup effect - runs when data changes
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

      // Clear any existing visualization
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      // Set up dimensions
      const width = dimensions.width;
      const height = dimensions.height;

      // Update SVG dimensions
      svg.attr('width', width).attr('height', height).attr('viewBox', [0, 0, width, height]);

      // Create a group for the graph
      const g = svg.append('g');

      // Extract nodes from files and their components
      const nodes: Node[] = [];

      // Add file and directory nodes
      data.files.forEach(file => {
        // Only add file-level nodes (not components as separate nodes)
        if (file.type === 'file' || file.type === 'directory') {
          nodes.push({
            id: file.id,
            name: file.name,
            path: file.path,
            type: file.type,
            extension: file.extension,
            size: file.size,
            depth: file.depth,
            expanded: expandedFiles.has(file.id),
          });

          // Add component nodes only if file is expanded
          if (expandedFiles.has(file.id) && file.components) {
            file.components.forEach(component => {
              nodes.push({
                id: component.id,
                name: component.name,
                path: file.path,
                type: component.type,
                extension: file.extension,
                size: 0, // Components don't have file size
                depth: file.depth + 1,
                parentId: file.id,
              });

              // Add nested component nodes recursively
              const addNestedComponents = (comp: any, currentDepth: number, parentId: string) => {
                if (comp.components) {
                  comp.components.forEach((nestedComp: any) => {
                    nodes.push({
                      id: nestedComp.id,
                      name: nestedComp.name,
                      path: file.path,
                      type: nestedComp.type,
                      extension: file.extension,
                      size: 0,
                      depth: currentDepth + 1,
                      parentId: parentId,
                    });
                    addNestedComponents(nestedComp, currentDepth + 1, parentId);
                  });
                }
              };
              addNestedComponents(component, file.depth + 1, file.id);
            });
          }
        }
      });

      // Create initial links with current weights, but only for visible nodes
      const nodeIds = new Set(nodes.map(n => n.id));
      const createLinks = () => {
        const baseLinks = data.relationships
          .filter(rel => nodeIds.has(rel.source) && nodeIds.has(rel.target))
          .map(rel => {
            const linkKey = `${rel.source}-${rel.target}`;
            const linkMetric = linkMetrics.get(linkKey);

            if (!linkMetric) {
              return {
                source: rel.source,
                target: rel.target,
                type: rel.type,
                weight: 0,
                originalStrength: rel.strength || 1,
              };
            }

            const edgeStrength = calculateEdgeStrength(linkMetric, config);

            return {
              source: rel.source,
              target: rel.target,
              type: rel.type,
              weight: edgeStrength,
              originalStrength: rel.strength || 1,
            };
          })
          .filter(link => link.weight > 0); // Only include links with non-zero weight

        // Add dynamic "contains" relationships for expanded nodes
        const dynamicLinks: Link[] = [];
        nodes.forEach(node => {
          if (node.parentId && nodeIds.has(node.parentId)) {
            // Create a synthetic link metric for contains relationships
            const containsMetric: ComputedLinkMetrics = {
              semantic_similarity: 0,
              filesystem_proximity: 0,
              code_references: 1, // Contains relationships are code references
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

      // Create a force simulation
      const simulation = d3
        .forceSimulation<Node>(nodes)
        .force(
          'link',
          d3
            .forceLink<Node, Link>(links)
            .id(d => d.id)
            .distance(d => {
              // Adjust distance based on connection type and weight
              const baseDistance = 100;
              const weight = d.weight || 0;
              const strength = d.originalStrength || 1;

              if (d.type === 'filesystem_proximity') {
                // Filesystem connections should be closer
                return baseDistance * (1 - weight * 0.5) * (1 / strength);
              } else if (d.type === 'semantic_similarity') {
                // Semantic connections should be moderately close
                return baseDistance * (1 - weight * 0.4) * (1 / strength);
              } else if (d.type === 'contains') {
                // Containment relationships should be very close for clear hierarchy
                return 50; // Much shorter distance for parent-child relationships
              } else {
                // Reference connections
                return baseDistance * (1 - weight * 0.3);
              }
            })
            .strength(d => {
              // Adjust strength based on weight
              const baseStrength = 1;
              const weight = d.weight || 0;
              const strength = d.originalStrength || 1;

              if (d.type === 'contains') {
                // Strong attraction for parent-child relationships
                return 2; // Stronger force for containment
              }

              return baseStrength * weight * strength;
            })
        )
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force(
          'collision',
          d3.forceCollide<Node>().radius(d => {
            const metrics = nodeMetrics.get(d.id);
            if (!metrics) return 10;
            const allNodeMetrics = Array.from(nodeMetrics.values());
            return calculateNodeSize(metrics, config, allNodeMetrics, d.type) + 5;
          })
        );

      // Save simulation to ref for potential future interactions
      simulationRef.current = simulation;

      // Create links
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

      // Create node groups (to hold both circles and expand/collapse indicators)
      const nodeGroups = g
        .append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .style('cursor', 'pointer')
        .call(dragBehavior(simulation));

      // Get all node metrics for normalization (compute once per render)
      const allNodeMetrics = Array.from(nodeMetrics.values());

      // Check if pie chart mode is enabled
      const pieChartMode = isPieChartEnabled(config);

      let node: d3.Selection<d3.BaseType, NodeData, d3.BaseType, unknown>;

      if (pieChartMode) {
        // Create pie chart nodes
        node = createPieChartNodes(
          nodeGroups,
          nodeMetrics,
          config,
          allNodeMetrics,
          EXTENSION_COLORS,
          onSelectFile
        );
      } else {
        // Create regular circle nodes
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
            // Reset to default hover state, but preserve selection highlighting
            const isSelected = d3.select(this).attr('stroke') === '#e74c3c';
            d3.select(this).attr('stroke-width', isSelected ? 3 : 1.5);
          })
          .on('click', (event, d) => {
            event.stopPropagation();
            onSelectFile(d.id);
          });
      }

      // Add expand/collapse indicators for files with components
      nodeGroups
        .filter(d => d.type === 'file' && hasComponents(d.id))
        .append('text')
        .attr('x', 0)
        .attr('y', -12)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(d => (expandedFiles.has(d.id) ? '−' : '+'))
        .style('pointer-events', 'none');

      // Add click handler for expand/collapse
      nodeGroups
        .filter(d => d.type === 'file' && hasComponents(d.id))
        .on('dblclick', (event, d) => {
          event.stopPropagation();
          toggleNodeExpansion(d.id);
        });

      // Add node labels
      const label = nodeGroups
        .append('text')
        .attr('dx', d => {
          const metrics = nodeMetrics.get(d.id);
          const radius = metrics ? calculateNodeSize(metrics, config, allNodeMetrics, d.type) : 5;
          return radius + 5;
        })
        .attr('dy', 4)
        .text(d => d.name)
        .style('font-size', '10px')
        .style('pointer-events', 'none')
        .style('fill', '#333');

      // Add hover titles to nodes
      nodeGroups.append('title').text(d => d.path);

      // Click on background to clear selection
      svg.on('click', () => {
        onSelectFile(null);
      });

      // Create zoom behavior
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 10])
        .on('zoom', event => {
          g.attr('transform', event.transform);
        });

      // Save zoom to ref for external access
      zoomRef.current = zoom;

      svg.call(zoom);

      // Update positions on each tick
      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as Node).x || 0)
          .attr('y1', d => (d.source as Node).y || 0)
          .attr('x2', d => (d.target as Node).x || 0)
          .attr('y2', d => (d.target as Node).y || 0);

        nodeGroups.attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
      });

      // Legend is now handled by DynamicLegend component

      // Store references for weight updates
      (simulation as any).__linkSelection = link;
      (simulation as any).__nodeSelection = node;
      (simulation as any).__labelSelection = label;

      // Clean up on unmount
      return () => {
        if (simulationRef.current) {
          simulationRef.current.stop();
        }
        // Clean up event listeners
        svg.on('.zoom', null);
        svg.on('click', null);
      };
    }, [
      data,
      dimensions,
      expandedFiles,
      toggleNodeExpansion,
      hasComponents,
      config,
      nodeMetrics,
      linkMetrics,
    ]);

    // Separate effect for handling selection highlighting
    useEffect(() => {
      if (!svgRef.current || !data) return;

      const svg = d3.select(svgRef.current);
      const pieChartMode = isPieChartEnabled(config);

      // Select appropriate node elements based on mode
      const nodes = pieChartMode ? svg.selectAll('g.pie-node') : svg.selectAll('circle.node');

      // Only proceed if nodes exist
      if (nodes.empty()) return;

      // Reset all nodes to default stroke
      if (pieChartMode) {
        nodes.selectAll('.pie-segment').attr('stroke', '#fff').attr('stroke-width', 1);
      } else {
        nodes.attr('stroke', '#fff').attr('stroke-width', 1.5);
      }

      // Highlight selected file
      if (selectedFile) {
        const selectedNodes = nodes.filter(function (d) {
          return d && typeof d === 'object' && 'id' in d && d.id === selectedFile;
        });

        if (pieChartMode) {
          selectedNodes.selectAll('.pie-segment').attr('stroke', '#e74c3c').attr('stroke-width', 2);
        } else {
          selectedNodes.attr('stroke', '#e74c3c').attr('stroke-width', 3);
        }
      }
    }, [selectedFile, data, expandedFiles, config]);

    // Config update effect - runs when visualization config changes
    useEffect(() => {
      if (!simulationRef.current || !data || nodeMetrics.size === 0) return;

      const simulation = simulationRef.current;
      const linkSelection = (simulation as any).__linkSelection;
      const nodeSelection = (simulation as any).__nodeSelection;

      if (!linkSelection || !nodeSelection) return;

      // Get current visible node IDs
      const nodes = simulation.nodes();
      const currentNodeIds = new Set(nodes.map(n => n.id));

      // Recreate links with new weights, but only for visible nodes
      const baseUpdatedLinks = data.relationships
        .filter(rel => currentNodeIds.has(rel.source) && currentNodeIds.has(rel.target))
        .map(rel => {
          const linkKey = `${rel.source}-${rel.target}`;
          const linkMetric = linkMetrics.get(linkKey);

          if (!linkMetric) {
            return {
              source: rel.source,
              target: rel.target,
              type: rel.type,
              weight: 0,
              originalStrength: rel.strength || 1,
            };
          }

          const edgeStrength = calculateEdgeStrength(linkMetric, config);

          return {
            source: rel.source,
            target: rel.target,
            type: rel.type,
            weight: edgeStrength,
            originalStrength: rel.strength || 1,
          };
        })
        .filter(link => link.weight > 0);

      // Add dynamic "contains" relationships for expanded nodes
      const dynamicUpdatedLinks: Link[] = [];
      nodes.forEach(node => {
        if (node.parentId && currentNodeIds.has(node.parentId)) {
          const containsMetric: ComputedLinkMetrics = {
            semantic_similarity: 0,
            filesystem_proximity: 0,
            code_references: 1,
          };

          const edgeStrength = calculateEdgeStrength(containsMetric, config);

          dynamicUpdatedLinks.push({
            source: node.parentId,
            target: node.id,
            type: 'contains',
            weight: edgeStrength,
            originalStrength: 1,
          });
        }
      });

      const updatedLinks = [...baseUpdatedLinks, ...dynamicUpdatedLinks];

      // Update the force simulation with new link data
      const linkForce = simulation.force('link') as d3.ForceLink<Node, Link>;
      linkForce
        .links(updatedLinks)
        .distance(d => {
          const baseDistance = 100;
          const weight = d.weight || 0;
          const strength = d.originalStrength || 1;

          if (d.type === 'filesystem_proximity') {
            return baseDistance * (1 - weight * 0.5) * (1 / strength);
          } else if (d.type === 'semantic_similarity') {
            return baseDistance * (1 - weight * 0.4) * (1 / strength);
          } else if (d.type === 'contains') {
            return 50;
          } else {
            return baseDistance * (1 - weight * 0.3);
          }
        })
        .strength(d => {
          const baseStrength = 1;
          const weight = d.weight || 0;
          const strength = d.originalStrength || 1;

          if (d.type === 'contains') {
            return 2;
          }

          return baseStrength * weight * strength;
        });

      // Update link visual properties with proper enter/update/exit handling
      const newLinkSelection = linkSelection
        .data(
          updatedLinks,
          (d: Link) => `${(d.source as any).id || d.source}-${(d.target as any).id || d.target}`
        )
        .join(
          enter =>
            enter
              .append('line')
              .attr('stroke', (d: Link) => {
                const linkKey = `${(d.source as any).id || d.source}-${(d.target as any).id || d.target}`;
                const linkMetric = linkMetrics.get(linkKey) ?? {
                  semantic_similarity: 0,
                  filesystem_proximity: 0,
                  code_references: d.type === 'contains' ? 1 : 0,
                };
                return calculateEdgeColor(linkMetric, config, d.type);
              })
              .attr('stroke-opacity', (d: Link) => (d.type === 'contains' ? 0.8 : 0.4))
              .attr('stroke-width', (d: Link) => {
                const linkKey = `${(d.source as any).id || d.source}-${(d.target as any).id || d.target}`;
                const linkMetric = linkMetrics.get(linkKey) ?? {
                  semantic_similarity: 0,
                  filesystem_proximity: 0,
                  code_references: d.type === 'contains' ? 1 : 0,
                };
                return calculateEdgeWidth(linkMetric, config, d.type);
              }),
          update =>
            update
              .attr('stroke', (d: Link) => {
                const linkKey = `${(d.source as any).id || d.source}-${(d.target as any).id || d.target}`;
                const linkMetric = linkMetrics.get(linkKey) ?? {
                  semantic_similarity: 0,
                  filesystem_proximity: 0,
                  code_references: d.type === 'contains' ? 1 : 0,
                };
                return calculateEdgeColor(linkMetric, config, d.type);
              })
              .attr('stroke-opacity', (d: Link) => (d.type === 'contains' ? 0.8 : 0.4))
              .attr('stroke-width', (d: Link) => {
                const linkKey = `${(d.source as any).id || d.source}-${(d.target as any).id || d.target}`;
                const linkMetric = linkMetrics.get(linkKey) ?? {
                  semantic_similarity: 0,
                  filesystem_proximity: 0,
                  code_references: d.type === 'contains' ? 1 : 0,
                };
                return calculateEdgeWidth(linkMetric, config, d.type);
              }),
          exit => exit.remove()
        );

      // Store the new selection for future updates
      (simulation as any).__linkSelection = newLinkSelection;

      // Get all node metrics for normalization (compute once)
      const allNodeMetrics = Array.from(nodeMetrics.values());

      // Update node visual properties based on mode
      const pieChartMode = isPieChartEnabled(config);

      if (pieChartMode) {
        // In pie chart mode, nodeSelection refers to the pie groups
        // We need to recreate the pie charts with updated data
        nodeSelection.each(function (d: Node) {
          const group = d3.select(this);
          const metrics = nodeMetrics.get(d.id);

          if (!metrics) return;

          const radius = calculateNodeSize(metrics, config, allNodeMetrics, d.type);
          const pieData = calculatePieChartData(metrics, config);

          // Remove old segments
          group.selectAll('.pie-segment').remove();
          group.selectAll('circle').remove();

          if (!pieData || (pieData.covered === 0 && pieData.uncovered === 0)) {
            // No coverage data, show regular circle
            group
              .append('circle')
              .attr('r', radius)
              .attr('fill', getNodeColor(d, metrics, config, allNodeMetrics, EXTENSION_COLORS))
              .attr('stroke', '#fff')
              .attr('stroke-width', 1.5);
          } else {
            // Recreate pie chart
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
                  return getNodeColor(d, metrics, config, allNodeMetrics, EXTENSION_COLORS);
                }
              })
              .attr('stroke', '#fff')
              .attr('stroke-width', 1);
          }
        });
      } else {
        // Regular circle mode
        nodeSelection
          .attr('r', (d: Node) => {
            const metrics = nodeMetrics.get(d.id);
            return metrics ? calculateNodeSize(metrics, config, allNodeMetrics, d.type) : 5;
          })
          .attr('fill', (d: Node) => {
            const metrics = nodeMetrics.get(d.id);
            return getNodeColor(d, metrics, config, allNodeMetrics, EXTENSION_COLORS);
          });
      }

      // Update label positions to match new node sizes
      const labelSelection = (simulation as any).__labelSelection;
      if (labelSelection) {
        labelSelection.attr('dx', (d: Node) => {
          const metrics = nodeMetrics.get(d.id);
          const radius = metrics ? calculateNodeSize(metrics, config, allNodeMetrics, d.type) : 5;
          return radius + 5;
        });
      }

      // Update collision force with new node sizes
      const collisionForce = simulation.force('collision') as d3.ForceCollide<Node>;
      collisionForce.radius((d: Node) => {
        const metrics = nodeMetrics.get(d.id);
        if (!metrics) return 10;
        return calculateNodeSize(metrics, config, allNodeMetrics, d.type) + 5;
      });

      // Don't update center force during config changes - preserve current zoom/pan
      // The center force should remain at the original center (width/2, height/2)

      // Restart simulation with gentle animation
      simulation.alpha(0.1).restart();
    }, [config, data, nodeMetrics, linkMetrics]);

    // Create a drag behavior
    const dragBehavior = (simulation: d3.Simulation<Node, Link>) => {
      return d3
        .drag<SVGGElement, Node>()
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
    };

    return (
      <div
        ref={containerRef}
        className="w-full h-full relative overflow-hidden"
        style={{ flex: 1, minHeight: '400px' }}
      >
        <svg ref={svgRef} className="w-full h-full bg-white" style={{ display: 'block' }}></svg>
      </div>
    );
  }
);

export default RepositoryGraph;
