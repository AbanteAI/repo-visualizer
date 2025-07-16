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

interface RepositoryGraphProps {
  data: RepositoryData;
  onSelectFile: (fileId: string | null) => void;
  selectedFile: string | null;
  referenceWeight: number;
  filesystemWeight: number;
  semanticWeight: number;
  fileSizeWeight: number;
  commitCountWeight: number;
  recencyWeight: number;
  identifiersWeight: number;
  referencesWeight: number;
}

export interface RepositoryGraphHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

interface Node extends d3.SimulationNodeDatum {
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

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  type: string;
  weight?: number;
  originalStrength?: number;
}

const RepositoryGraph = forwardRef<RepositoryGraphHandle, RepositoryGraphProps>(
  (
    {
      data,
      onSelectFile,
      selectedFile,
      referenceWeight,
      filesystemWeight,
      semanticWeight,
      fileSizeWeight,
      commitCountWeight,
      recencyWeight,
      identifiersWeight,
      referencesWeight,
    },
    ref
  ) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

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

    // Extension colors mapping
    const extensionColors: Record<string, string> = {
      py: '#3572A5', // Python
      js: '#f7df1e', // JavaScript
      html: '#e34c26', // HTML
      css: '#563d7c', // CSS
      md: '#083fa1', // Markdown
      json: '#292929', // JSON
      java: '#b07219', // Java
      cpp: '#f34b7d', // C++
      c: '#555555', // C
      rb: '#701516', // Ruby
      php: '#4F5D95', // PHP
      ts: '#2b7489', // TypeScript
      sh: '#89e051', // Shell
      go: '#00ADD8', // Go
      rs: '#dea584', // Rust
      swift: '#ffac45', // Swift
      kt: '#F18E33', // Kotlin
      scala: '#c22d40', // Scala
      pl: '#0298c3', // Perl
      lua: '#000080', // Lua
      r: '#198CE7', // R
    };

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

    // Initial setup effect - runs when data changes
    useEffect(() => {
      if (
        !svgRef.current ||
        !containerRef.current ||
        !data ||
        dimensions.width === 0 ||
        dimensions.height === 0
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
            let weight = 0;

            // Apply weights based on connection type
            if (rel.type === 'filesystem_proximity') {
              weight = filesystemWeight / 100;
            } else if (rel.type === 'semantic_similarity') {
              weight = semanticWeight / 100;
            } else if (rel.type === 'import' || rel.type === 'call' || rel.type === 'contains') {
              weight = referenceWeight / 100;
            } else {
              // Other relationship types get reference weight
              weight = referenceWeight / 100;
            }

            return {
              source: rel.source,
              target: rel.target,
              type: rel.type,
              weight: weight,
              originalStrength: rel.strength || 1,
            };
          })
          .filter(link => link.weight > 0); // Only include links with non-zero weight

        // Add dynamic "contains" relationships for expanded nodes
        const dynamicLinks: Link[] = [];
        nodes.forEach(node => {
          if (node.parentId && nodeIds.has(node.parentId)) {
            dynamicLinks.push({
              source: node.parentId,
              target: node.id,
              type: 'contains',
              weight: referenceWeight / 100,
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
          d3.forceCollide<Node>().radius(d => getNodeRadius(d) + 5)
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
        .attr('stroke', d => getLinkColor(d))
        .attr('stroke-opacity', d => (d.type === 'contains' ? 0.8 : 0.4))
        .attr('stroke-width', d => getLinkWidth(d));

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

      // Create circles for nodes
      const node = nodeGroups
        .append('circle')
        .attr('class', 'node')
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => getNodeColor(d, extensionColors))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .on('mouseover', function (event, d) {
          d3.select(this).attr('stroke-width', 3);
        })
        .on('mouseout', function (event, d) {
          // Reset to default hover state, but preserve selection highlighting
          const isSelected = d3.select(this).attr('stroke') === '#e74c3c';
          d3.select(this).attr('stroke-width', isSelected ? 3 : 1.5);
        })
        .on('click', (event, d) => {
          event.stopPropagation();
          onSelectFile(d.id);
        });

      // Add expand/collapse indicators for files with components
      const expandIcons = nodeGroups
        .filter(d => d.type === 'file' && hasComponents(d.id))
        .append('text')
        .attr('x', 0)
        .attr('y', -12)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(d => (d.expanded ? '−' : '+'))
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
        .attr('dx', d => getNodeRadius(d) + 5)
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

      // Create legend
      createLegend(svg, width, data, extensionColors);

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
    }, [data, dimensions, expandedFiles, toggleNodeExpansion, hasComponents]);

    // Separate effect for handling selection highlighting
    useEffect(() => {
      if (!svgRef.current || !data) return;

      const svg = d3.select(svgRef.current);
      const nodes = svg.selectAll('circle.node');

      // Only proceed if nodes exist
      if (nodes.empty()) return;

      // Reset all nodes to default stroke
      nodes.attr('stroke', '#fff').attr('stroke-width', 1.5);

      // Highlight selected file
      if (selectedFile) {
        nodes
          .filter(function (d) {
            return d && typeof d === 'object' && 'id' in d && d.id === selectedFile;
          })
          .attr('stroke', '#e74c3c')
          .attr('stroke-width', 3);
      }
    }, [selectedFile, data, expandedFiles]);

    // Weight update effect - runs when weights change
    useEffect(() => {
      if (!simulationRef.current || !data) return;

      const simulation = simulationRef.current;
      const linkSelection = (simulation as any).__linkSelection;

      if (!linkSelection) return;

      // Calculate current centroid before changes
      const nodes = simulation.nodes();
      const centroidBefore = {
        x: d3.mean(nodes, d => d.x || 0) || 0,
        y: d3.mean(nodes, d => d.y || 0) || 0,
      };

      // Get current visible node IDs
      const currentNodeIds = new Set(nodes.map(n => n.id));

      // Recreate links with new weights, but only for visible nodes
      const baseUpdatedLinks = data.relationships
        .filter(rel => currentNodeIds.has(rel.source) && currentNodeIds.has(rel.target))
        .map(rel => {
          let weight = 0;

          // Apply weights based on connection type
          if (rel.type === 'filesystem_proximity') {
            weight = filesystemWeight / 100;
          } else if (rel.type === 'semantic_similarity') {
            weight = semanticWeight / 100;
          } else if (rel.type === 'import' || rel.type === 'call' || rel.type === 'contains') {
            weight = referenceWeight / 100;
          } else {
            // Other relationship types get reference weight
            weight = referenceWeight / 100;
          }

          return {
            source: rel.source,
            target: rel.target,
            type: rel.type,
            weight: weight,
            originalStrength: rel.strength || 1,
          };
        })
        .filter(link => link.weight > 0);

      // Add dynamic "contains" relationships for expanded nodes
      const dynamicUpdatedLinks: Link[] = [];
      nodes.forEach(node => {
        if (node.parentId && currentNodeIds.has(node.parentId)) {
          dynamicUpdatedLinks.push({
            source: node.parentId,
            target: node.id,
            type: 'contains',
            weight: referenceWeight / 100,
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
            return 50; // Much shorter distance for parent-child relationships
          } else {
            return baseDistance * (1 - weight * 0.3);
          }
        })
        .strength(d => {
          const baseStrength = 1;
          const weight = d.weight || 0;
          const strength = d.originalStrength || 1;

          if (d.type === 'contains') {
            // Strong attraction for parent-child relationships
            return 2; // Stronger force for containment
          }

          return baseStrength * weight * strength;
        });

      // Update link visual properties
      linkSelection
        .data(updatedLinks)
        .attr('stroke', (d: Link) => getLinkColor(d))
        .attr('stroke-opacity', (d: Link) => (d.type === 'contains' ? 0.8 : 0.4))
        .attr('stroke-width', (d: Link) => getLinkWidth(d));

      // Update center force to maintain current centroid
      const centerForce = simulation.force('center') as d3.ForceCenter<Node>;
      centerForce.x(centroidBefore.x).y(centroidBefore.y);

      // Restart simulation with smooth animation
      simulation.alpha(0.3).restart();
    }, [referenceWeight, filesystemWeight, semanticWeight, data]);

    // Node sizing update effect - runs when sizing weights change
    useEffect(() => {
      if (!simulationRef.current || !data) return;

      const simulation = simulationRef.current;
      const nodeSelection = (simulation as any).__nodeSelection;
      const labelSelection = (simulation as any).__labelSelection;

      if (!nodeSelection) return;

      // Update node radiuses
      nodeSelection.attr('r', (d: Node) => getNodeRadius(d));

      // Update label positions to match new node sizes
      if (labelSelection) {
        labelSelection.attr('dx', (d: Node) => getNodeRadius(d) + 5);
      }

      // Update collision force with new radiuses
      const collisionForce = simulation.force('collision') as d3.ForceCollide<Node>;
      collisionForce.radius((d: Node) => getNodeRadius(d) + 5);

      // Restart simulation with gentle animation
      simulation.alpha(0.1).restart();
    }, [
      fileSizeWeight,
      commitCountWeight,
      recencyWeight,
      identifiersWeight,
      referencesWeight,
      data,
    ]);

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

    // Helper functions
    const getNodeRadius = (node: Node) => {
      if (node.type === 'directory') {
        return 10; // Fixed size for directories
      }

      // Set different size ranges for components vs files
      let minRadius = 5;
      let maxRadius = 25;

      const isComponent =
        node.type === 'class' || node.type === 'function' || node.type === 'method';
      if (isComponent) {
        minRadius = 3;
        maxRadius = 12; // Components are smaller than files
      }

      // Get file data for additional metrics
      // For components, use the parent file's metrics
      let fileData = data.files.find(f => f.id === node.id);
      if (!fileData && isComponent) {
        // Component IDs are like "file.py:ClassName" - extract the file part
        const fileId = node.id.split(':')[0];
        fileData = data.files.find(f => f.id === fileId);
      }

      // Calculate normalized factors (0-1)
      const factors = {
        fileSize: 0,
        commitCount: 0,
        recency: 0,
        identifiers: 0,
        references: 0,
      };

      // File size factor
      let sizeToUse = node.size;
      // Components don't have file size, but we can use their line count as a proxy
      if (isComponent && sizeToUse === 0) {
        // Check if this component has line information
        const component = fileData?.components?.find(c => c.id === node.id);
        if (component && component.lineStart && component.lineEnd) {
          const lineCount = component.lineEnd - component.lineStart + 1;
          // Convert line count to approximate byte size (assume ~50 characters per line)
          sizeToUse = lineCount * 50;
        } else if (fileData) {
          // Fallback to using a fraction of parent file size
          sizeToUse = fileData.size * 0.1; // Components are ~10% of parent file
        }
      }

      if (sizeToUse && sizeToUse > 0) {
        // Square root scale for better distribution across typical file sizes
        // This gives more range to smaller files while still scaling large ones
        factors.fileSize = Math.min(1, Math.sqrt(sizeToUse) / 500); // Normalize for ~250KB max
      }

      if (fileData?.metrics) {
        // Commit count factor
        if (fileData.metrics.commitCount !== undefined) {
          factors.commitCount = Math.min(1, fileData.metrics.commitCount / 50); // Normalize to ~50 commits max
        }

        // Recency factor (invert days ago - more recent = larger)
        if (fileData.metrics.lastCommitDaysAgo !== undefined) {
          const daysAgo = fileData.metrics.lastCommitDaysAgo;
          factors.recency = Math.max(0, 1 - daysAgo / 365); // Normalize to 1 year
        }

        // Top-level identifiers factor
        if (fileData.metrics.topLevelIdentifiers !== undefined) {
          factors.identifiers = Math.min(1, fileData.metrics.topLevelIdentifiers / 20); // Normalize to ~20 identifiers max
        }
      }

      // References factor (count incoming references)
      const incomingRefs = data.relationships.filter(
        rel => rel.target === node.id && rel.type !== 'contains'
      ).length;
      factors.references = Math.min(1, incomingRefs / 10); // Normalize to ~10 references max

      // Apply weights (convert from 0-100 to 0-1)
      const weightedSum =
        (factors.fileSize * fileSizeWeight) / 100 +
        (factors.commitCount * commitCountWeight) / 100 +
        (factors.recency * recencyWeight) / 100 +
        (factors.identifiers * identifiersWeight) / 100 +
        (factors.references * referencesWeight) / 100;

      // Ensure we have some minimum size even if all weights are 0
      const totalWeight =
        (fileSizeWeight +
          commitCountWeight +
          recencyWeight +
          identifiersWeight +
          referencesWeight) /
        100;
      const normalizedSum = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

      // Scale to radius range
      const radius = minRadius + normalizedSum * (maxRadius - minRadius);
      return Math.max(minRadius, Math.min(maxRadius, radius));
    };

    const getLinkWidth = (link: Link) => {
      const baseWidth = (() => {
        switch (link.type) {
          case 'import':
          case 'call':
          case 'calls':
            return 2;
          case 'contains':
            return 3; // Thicker lines for containment to make hierarchy clear
          case 'filesystem_proximity':
            return 1.5;
          case 'semantic_similarity':
            return 2;
          default:
            return 1.5;
        }
      })();

      // Scale width by weight for non-containment links
      if (link.type === 'contains') {
        return baseWidth; // Fixed width for containment to keep hierarchy clear
      }

      const weight = link.weight || 0;
      return baseWidth * (0.5 + weight * 0.5);
    };

    const getLinkColor = (link: Link) => {
      switch (link.type) {
        case 'filesystem_proximity':
          return '#e74c3c'; // Red for filesystem connections
        case 'semantic_similarity':
          return '#27ae60'; // Green for semantic connections
        case 'import':
        case 'call':
          return '#3498db'; // Blue for reference connections
        case 'contains':
          return '#2c3e50'; // Dark blue-gray for containment - more visible
        default:
          return '#95a5a6';
      }
    };

    const getNodeColor = (node: Node, colors: Record<string, string>) => {
      // Directories have a different color
      if (node.type === 'directory') {
        return '#7f8c8d';
      }

      // Components have different colors based on type
      if (node.type === 'class') {
        return '#e67e22';
      }
      if (node.type === 'function') {
        return '#3498db';
      }
      if (node.type === 'method') {
        return '#9b59b6';
      }

      // Files are colored by extension
      if (node.extension && colors[node.extension]) {
        return colors[node.extension];
      }

      // Default color for unknown file types
      return '#aaaaaa';
    };

    const createLegend = (
      svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      width: number,
      data: RepositoryData,
      colors: Record<string, string>
    ) => {
      // Only show extensions that were actually in the data
      const usedExtensions = new Set<string>();
      data.files.forEach(file => {
        if (file.extension) {
          usedExtensions.add(file.extension);
        }
      });

      const legendGroup = svg.append('g').attr('transform', `translate(20, 20)`);

      // Add directory type
      legendGroup
        .append('circle')
        .attr('class', 'legend-item')
        .attr('cx', 10)
        .attr('cy', 10)
        .attr('r', 6)
        .attr('fill', '#7f8c8d');

      legendGroup
        .append('text')
        .attr('x', 20)
        .attr('y', 14)
        .text('Directory')
        .style('font-size', '12px')
        .style('fill', '#333');

      // Add file types
      let index = 1;
      for (const ext of usedExtensions) {
        if (colors[ext]) {
          legendGroup
            .append('circle')
            .attr('class', 'legend-item')
            .attr('cx', 10 + Math.floor(index / 10) * 100)
            .attr('cy', 10 + (index % 10) * 20)
            .attr('r', 6)
            .attr('fill', colors[ext]);

          legendGroup
            .append('text')
            .attr('x', 20 + Math.floor(index / 10) * 100)
            .attr('y', 14 + (index % 10) * 20)
            .text(`.${ext}`)
            .style('font-size', '12px')
            .style('fill', '#333');

          index++;
        }
      }

      // Add "Other" type
      legendGroup
        .append('circle')
        .attr('class', 'legend-item')
        .attr('cx', 10 + Math.floor(index / 10) * 100)
        .attr('cy', 10 + (index % 10) * 20)
        .attr('r', 6)
        .attr('fill', '#aaaaaa');

      legendGroup
        .append('text')
        .attr('x', 20 + Math.floor(index / 10) * 100)
        .attr('y', 14 + (index % 10) * 20)
        .text('Other')
        .style('font-size', '12px')
        .style('fill', '#333');

      // Add component types
      index++;
      const componentTypes = [
        { type: 'class', color: '#e67e22' },
        { type: 'function', color: '#3498db' },
        { type: 'method', color: '#9b59b6' },
      ];

      componentTypes.forEach(({ type, color }) => {
        legendGroup
          .append('circle')
          .attr('cx', 10 + Math.floor(index / 10) * 100)
          .attr('cy', 10 + (index % 10) * 20)
          .attr('r', 6)
          .attr('fill', color);

        legendGroup
          .append('text')
          .attr('x', 20 + Math.floor(index / 10) * 100)
          .attr('y', 14 + (index % 10) * 20)
          .text(type)
          .style('font-size', '12px')
          .style('fill', '#333');

        index++;
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
