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
  isNodeVisible,
  isEdgeVisible,
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

const RepositoryGraph = forwardRef<RepositoryGraphHandle, RepositoryGraphProps>(
  ({ data, onSelectFile, selectedFile, config }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const originalNodesRef = useRef<Node[]>([]);
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

      const computedNodeMetrics = computeNodeMetrics(data);
      const computedLinkMetrics = computeLinkMetrics(data);

      setNodeMetrics(computedNodeMetrics);
      setLinkMetrics(computedLinkMetrics);
    }, [data]);

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
      const allNodes: Node[] = [];

      // Add file and directory nodes
      data.files.forEach(file => {
        // Only add file-level nodes (not components as separate nodes)
        if (file.type === 'file' || file.type === 'directory') {
          allNodes.push({
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
              allNodes.push({
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
                    allNodes.push({
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

      // Get all node metrics for threshold calculations
      const allNodeMetrics = Array.from(nodeMetrics.values());

      // Use all nodes initially - thresholding will be applied in config update effect
      const nodes = allNodes;

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
          .filter(link => {
            // Apply both existing weight check and new threshold check
            if (link.weight <= 0) return false;

            const linkKey = `${link.source}-${link.target}`;
            const linkMetric = linkMetrics.get(linkKey);
            if (!linkMetric) return false;

            return isEdgeVisible(linkMetric, config, link.type);
          });

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

      // Store original nodes for threshold filtering
      originalNodesRef.current = nodes;

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

      // Add tooltips to edges showing reference counts
      link.append('title').text(d => {
        const sourceName = (d.source as any).name || (d.source as any).id || d.source;
        const targetName = (d.target as any).name || (d.target as any).id || d.target;
        const strength = d.originalStrength || 1;
        const referenceText = strength > 1 ? `${strength} references` : '1 reference';

        return `${sourceName} → ${targetName}\nType: ${d.type}\nReferences: ${referenceText}`;
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

      // Create regular circle nodes
      const node = nodeGroups
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
          d3.select(this).attr('stroke-width', isSelected ? 2 : 1.5);
        })
        .on('click', (event, d) => {
          event.stopPropagation();
          onSelectFile(d.id);
        });

      // Add tooltips to nodes
      node.append('title').text(d => `${d.name}\nPath: ${d.path}\nType: ${d.type}`);

      // Add expand/collapse indicators for expandable nodes
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

      // Add labels to nodes
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

      // Set up zoom behavior
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8])
        .on('zoom', event => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      zoomRef.current = zoom;

      // Ticking function for the simulation
      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as any).x)
          .attr('y1', d => (d.source as any).y)
          .attr('x2', d => (d.target as any).x)
          .attr('y2', d => (d.target as any).y);

        nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);

        labels.attr('x', d => d.x!).attr('y', d => d.y!);
      });

      // Drag behavior for nodes
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

      // Cleanup function
      return () => {
        simulation.stop();
      };
    }, [data, dimensions, expandedFiles, nodeMetrics, linkMetrics, config]);

    // Effect to update node/link styles when config changes
    useEffect(() => {
      if (!svgRef.current || !simulationRef.current || nodeMetrics.size === 0) return;

      const svg = d3.select(svgRef.current);
      const allNodeMetrics = Array.from(nodeMetrics.values());

      // Update node visibility, size, and color
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

      // Update link visibility, width, and color
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

      // Update simulation forces if needed
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

    // Effect to highlight selected file
    useEffect(() => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);

      // Reset all nodes to default style first
      svg.selectAll('.node').attr('stroke', '#fff').attr('stroke-width', 1.5);

      if (selectedFile) {
        svg
          .selectAll('.node')
          .filter(d => (d as Node).id === selectedFile)
          .attr('stroke', '#e74c3c') // Highlight color
          .attr('stroke-width', 2);
      }
    }, [selectedFile]);

    return (
      <div ref={containerRef} className="w-full h-full bg-gray-50 rounded-lg overflow-hidden">
        <svg ref={svgRef}></svg>
      </div>
    );
  }
);

export default RepositoryGraph;
