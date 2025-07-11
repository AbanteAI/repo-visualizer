import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as d3 from 'd3';
import { RepositoryData } from '../../types/schema';

interface RepositoryGraphProps {
  data: RepositoryData;
  onSelectFile: (fileId: string | null) => void;
  selectedFile: string | null;
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
}

const RepositoryGraph = forwardRef<RepositoryGraphHandle, RepositoryGraphProps>(
  ({ data, onSelectFile, selectedFile }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

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

    useEffect(() => {
      if (!svgRef.current || !containerRef.current || !data) return;

      // Clear any existing visualization
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      // Set up dimensions
      const width = containerRef.current.clientWidth;
      const height = 600; // Fixed height, could be made responsive

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

      // Extract links from relationships, but only for visible nodes
      const nodeIds = new Set(nodes.map(n => n.id));
      const links: Link[] = data.relationships
        .filter(rel => nodeIds.has(rel.source) && nodeIds.has(rel.target))
        .map(rel => ({
          source: rel.source,
          target: rel.target,
          type: rel.type,
        }));

      // Create a force simulation
      const simulation = d3
        .forceSimulation<Node>(nodes)
        .force(
          'link',
          d3
            .forceLink<Node, Link>(links)
            .id(d => d.id)
            .distance(100)
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
        .attr('stroke', '#95a5a6')
        .attr('stroke-opacity', 0.4)
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

      // Helper function to check if a file has components
      function hasComponents(fileId: string): boolean {
        const file = data.files.find(f => f.id === fileId);
        return file ? file.components && file.components.length > 0 : false;
      }

      // Function to toggle node expansion
      function toggleNodeExpansion(fileId: string) {
        setExpandedFiles(prev => {
          const next = new Set(prev);
          if (next.has(fileId)) {
            next.delete(fileId);
          } else {
            next.add(fileId);
          }
          return next;
        });
      }

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

      // Clean up on unmount
      return () => {
        if (simulationRef.current) {
          simulationRef.current.stop();
        }
        // Clean up event listeners
        svg.on('.zoom', null);
        svg.on('click', null);
      };
    }, [data, onSelectFile, selectedFile, expandedFiles]);

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
    }, [selectedFile, data]);

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

      // Components are smaller than files
      if (node.type === 'class' || node.type === 'function' || node.type === 'method') {
        return 6;
      }

      // Scale file size to a reasonable radius
      const minRadius = 5;
      const maxRadius = 15;
      const baseRadius = node.size ? Math.sqrt(node.size) / 15 : minRadius;

      return Math.max(minRadius, Math.min(maxRadius, baseRadius));
    };

    const getLinkWidth = (link: Link) => {
      switch (link.type) {
        case 'import':
        case 'call':
        case 'calls':
          return 2;
        case 'contains':
          return 1;
        default:
          return 1.5;
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
      <div ref={containerRef} className="w-full h-[600px] relative">
        <svg ref={svgRef} className="w-full h-full bg-white"></svg>
      </div>
    );
  }
);

export default RepositoryGraph;
