import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as d3 from 'd3';
import { RepositoryData, File, Component } from '../../types/schema';

interface RepositoryGraphProps {
  data: RepositoryData;
  onSelectFile: (fileId: string) => void;
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
  parent?: string; // Parent ID for components and files within directories
  isComponent?: boolean; // If true, this is a component inside a file
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
    
    // State to track expanded nodes
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    
    // Extension colors mapping
    const extensionColors: Record<string, string> = {
      'py': '#3572A5',    // Python
      'js': '#f7df1e',    // JavaScript
      'html': '#e34c26',  // HTML
      'css': '#563d7c',   // CSS
      'md': '#083fa1',    // Markdown
      'json': '#292929',  // JSON
      'java': '#b07219',  // Java
      'cpp': '#f34b7d',   // C++
      'c': '#555555',     // C
      'rb': '#701516',    // Ruby
      'php': '#4F5D95',   // PHP
      'ts': '#2b7489',    // TypeScript
      'sh': '#89e051',    // Shell
      'go': '#00ADD8',    // Go
      'rs': '#dea584',    // Rust
      'swift': '#ffac45', // Swift
      'kt': '#F18E33',    // Kotlin
      'scala': '#c22d40', // Scala
      'pl': '#0298c3',    // Perl
      'lua': '#000080',   // Lua
      'r': '#198CE7',     // R
    };

    // Component type colors
    const componentColors: Record<string, string> = {
      'class': '#e67e22',     // Orange
      'function': '#3498db',  // Blue
      'method': '#9b59b6',    // Purple
      'variable': '#2ecc71',  // Green
      'default': '#f1c40f'    // Yellow (for other component types)
    };

    // Expose methods to parent components
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (!svgRef.current || !zoomRef.current) return;
        const svg = d3.select(svgRef.current);
        const currentTransform = d3.zoomTransform(svg.node()!);
        svg.transition()
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
        svg.transition()
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
        svg.transition()
          .duration(750)
          .call(
            zoomRef.current.transform,
            d3.zoomIdentity
          );
      }
    }));

    // Helper function to handle node expansion/collapse
    const toggleExpand = (nodeId: string) => {
      setExpandedNodes(prevExpanded => {
        const newExpanded = new Set(prevExpanded);
        if (newExpanded.has(nodeId)) {
          newExpanded.delete(nodeId);
        } else {
          newExpanded.add(nodeId);
        }
        return newExpanded;
      });
    };

    // Helper to check if a file is visible based on its parent directory's state
    const isNodeVisible = (node: Node, visibleNodes: Node[]): boolean => {
      // If it's a root level file/directory or component in an expanded file, it's visible
      if (!node.parent || (node.isComponent && expandedNodes.has(node.parent))) {
        return true;
      }
      
      // If it's a file in a directory, check if the directory is expanded
      const parentNode = visibleNodes.find(n => n.id === node.parent);
      if (parentNode && expandedNodes.has(parentNode.id)) {
        return true;
      }
      
      return false;
    };

    // Helper function to recursively extract all components from a file
    const extractComponents = (file: File): Node[] => {
      const results: Node[] = [];
      
      const processComponent = (component: Component, parentId: string): void => {
        const componentNode: Node = {
          id: component.id,
          name: component.name,
          path: `${parentId}/${component.name}`,
          type: component.type,
          size: component.metrics?.linesOfCode || (component.lineEnd - component.lineStart),
          depth: 0, // Will be ignored for components
          parent: parentId,
          isComponent: true
        };
        
        results.push(componentNode);
        
        // Process nested components
        component.components.forEach(childComponent => {
          processComponent(childComponent, component.id);
        });
      };
      
      // Process all top-level components in the file
      file.components.forEach(component => {
        processComponent(component, file.id);
      });
      
      return results;
    };

    // Create component relationships
    const createComponentRelationships = (components: Node[]): Link[] => {
      const links: Link[] = [];
      
      components.forEach(component => {
        if (component.parent) {
          links.push({
            source: component.parent,
            target: component.id,
            type: 'contains'
          });
        }
      });
      
      return links;
    };

    // Helper function to assign parent directories to files
    const assignParentDirectories = (files: File[]): Record<string, string> => {
      const parentMap: Record<string, string> = {};
      
      // Build a map of directories
      const dirMap: Record<string, File> = {};
      files.filter(f => f.type === 'directory').forEach(dir => {
        dirMap[dir.path] = dir;
      });
      
      // Assign parents to files
      files.filter(f => f.type === 'file').forEach(file => {
        const pathParts = file.path.split('/');
        if (pathParts.length > 1) {
          const dirPath = pathParts.slice(0, -1).join('/');
          if (dirMap[dirPath]) {
            parentMap[file.id] = dirMap[dirPath].id;
          }
        }
      });
      
      return parentMap;
    };

    useEffect(() => {
      if (!svgRef.current || !containerRef.current || !data) return;

      // Clear any existing visualization
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      // Set up dimensions
      const width = containerRef.current.clientWidth;
      const height = 600; // Fixed height, could be made responsive

      // Update SVG dimensions
      svg
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height]);

      // Create a group for the graph
      const g = svg.append('g');
      
      // Get parent directory mapping
      const parentDirectories = assignParentDirectories(data.files);

      // Extract all nodes (files, directories, and components)
      const allFileNodes: Node[] = data.files.map(file => ({
        id: file.id,
        name: file.name,
        path: file.path,
        type: file.type,
        extension: file.extension,
        size: file.size,
        depth: file.depth,
        parent: parentDirectories[file.id]
      }));
      
      // Extract all component nodes
      const allComponentNodes: Node[] = data.files
        .filter(file => file.type === 'file')
        .flatMap(file => extractComponents(file));

      // Extract all base relationships from the data
      const baseLinks: Link[] = data.relationships.map(rel => ({
        source: rel.source,
        target: rel.target,
        type: rel.type,
      }));
      
      // Extract component relationships
      const componentLinks: Link[] = createComponentRelationships(allComponentNodes);
      
      // All possible links
      const allLinks = [...baseLinks, ...componentLinks];
      
      // Filter nodes based on expansion state
      const visibleNodes = [...allFileNodes, ...allComponentNodes].filter(node => {
        // Always show directories
        if (node.type === 'directory') return true;
        
        // Check if node should be visible
        return isNodeVisible(node, allFileNodes);
      });
      
      // Filter links to only include those connecting visible nodes
      const visibleNodeIds = new Set(visibleNodes.map(node => node.id));
      const visibleLinks = allLinks.filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
      });

      // Create a force simulation
      const simulation = d3.forceSimulation<Node>(visibleNodes)
        .force('link', d3.forceLink<Node, Link>(visibleLinks).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide<Node>().radius(d => getNodeRadius(d) + 5));

      // Save simulation to ref for potential future interactions
      simulationRef.current = simulation;

      // Create links
      const link = g.append('g')
        .selectAll('line')
        .data(visibleLinks)
        .enter()
        .append('line')
        .attr('stroke', '#95a5a6')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', d => getLinkWidth(d));

      // Create nodes
      const node = g.append('g')
        .selectAll('circle')
        .data(visibleNodes)
        .enter()
        .append('circle')
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => getNodeColor(d, extensionColors, componentColors))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('stroke-width', 3);
        })
        .on('mouseout', function(event, d) {
          d3.select(this)
            .attr('stroke-width', d.id === selectedFile ? 3 : 1.5);
        })
        .on('click', (event, d) => {
          event.stopPropagation();
          onSelectFile(d.id);
        })
        .on('dblclick', (event, d) => {
          event.stopPropagation();
          toggleExpand(d.id);
        })
        .call(dragBehavior(simulation));

      // Highlight selected file
      if (selectedFile) {
        node.filter(d => d.id === selectedFile)
          .attr('stroke-width', 3)
          .attr('stroke', '#e74c3c');
      }

      // Add + or - indicators for expandable nodes
      node.filter(d => 
          (d.type === 'directory') || 
          (d.type === 'file' && data.files.find(f => f.id === d.id)?.components.length > 0)
        )
        .each(function(d) {
          const isExpanded = expandedNodes.has(d.id);
          const nodeSelection = d3.select(this);
          const radius = getNodeRadius(d);
          
          // Add a small indicator
          g.append('text')
            .attr('class', 'expansion-indicator')
            .attr('x', d.x || 0)
            .attr('y', d.y || 0)
            .attr('dx', -3)
            .attr('dy', 3)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .style('fill', '#fff')
            .style('pointer-events', 'none')
            .text(isExpanded ? '-' : '+');
        });

      // Add node labels
      const label = g.append('g')
        .selectAll('text')
        .data(visibleNodes)
        .enter()
        .append('text')
        .attr('dx', d => getNodeRadius(d) + 5)
        .attr('dy', 4)
        .text(d => d.name)
        .style('font-size', '10px')
        .style('pointer-events', 'none')
        .style('fill', '#333');

      // Add hover titles to nodes
      node.append('title')
        .text(d => d.path);

      // Click on background to clear selection
      svg.on('click', () => {
        onSelectFile('');
      });

      // Create zoom behavior
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 10])
        .on('zoom', (event) => {
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

        node
          .attr('cx', d => d.x || 0)
          .attr('cy', d => d.y || 0);

        // Update expansion indicators
        g.selectAll('.expansion-indicator')
          .data(visibleNodes.filter(d => 
            (d.type === 'directory') || 
            (d.type === 'file' && data.files.find(f => f.id === d.id)?.components.length > 0)
          ))
          .attr('x', d => d.x || 0)
          .attr('y', d => d.y || 0)
          .text(d => expandedNodes.has(d.id) ? '-' : '+');

        label
          .attr('x', d => d.x || 0)
          .attr('y', d => d.y || 0);
      });

      // Create legend
      createLegend(svg, width, data, extensionColors, componentColors);

      // Clean up on unmount
      return () => {
        if (simulationRef.current) {
          simulationRef.current.stop();
        }
      };
    }, [data, onSelectFile, selectedFile, expandedNodes]);

    // Create a drag behavior
    const dragBehavior = (simulation: d3.Simulation<Node, Link>) => {
      return d3.drag<SVGCircleElement, Node>()
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
      
      if (node.isComponent) {
        return 6; // Fixed size for components
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
          return 2;
        case 'contains':
          return 1;
        default:
          return 1.5;
      }
    };

    const getNodeColor = (
      node: Node, 
      fileColors: Record<string, string>,
      compColors: Record<string, string>
    ) => {
      // Directories have a different color
      if (node.type === 'directory') {
        return '#7f8c8d';
      }
      
      // Component nodes use the component color scheme
      if (node.isComponent) {
        return compColors[node.type] || compColors.default;
      }
      
      // Files are colored by extension
      if (node.extension && fileColors[node.extension]) {
        return fileColors[node.extension];
      }
      
      // Default color for unknown file types
      return '#aaaaaa';
    };

    const createLegend = (
      svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      width: number,
      data: RepositoryData,
      fileColors: Record<string, string>,
      compColors: Record<string, string>
    ) => {
      // Only show extensions that were actually in the data
      const usedExtensions = new Set<string>();
      data.files.forEach(file => {
        if (file.extension) {
          usedExtensions.add(file.extension);
        }
      });

      // Collect component types
      const usedComponentTypes = new Set<string>();
      data.files
        .filter(file => file.type === 'file')
        .forEach(file => {
          const processComponent = (component: Component) => {
            usedComponentTypes.add(component.type);
            component.components.forEach(processComponent);
          };
          file.components.forEach(processComponent);
        });

      const legendGroup = svg.append('g')
        .attr('transform', `translate(20, 20)`);

      // Add directory type
      legendGroup.append('circle')
        .attr('cx', 10)
        .attr('cy', 10)
        .attr('r', 6)
        .attr('fill', '#7f8c8d');

      legendGroup.append('text')
        .attr('x', 20)
        .attr('y', 14)
        .text('Directory')
        .style('font-size', '12px')
        .style('fill', '#333');

      // Add file types
      let index = 1;
      for (const ext of usedExtensions) {
        if (fileColors[ext]) {
          legendGroup.append('circle')
            .attr('cx', 10 + Math.floor(index / 10) * 100)
            .attr('cy', 10 + (index % 10) * 20)
            .attr('r', 6)
            .attr('fill', fileColors[ext]);

          legendGroup.append('text')
            .attr('x', 20 + Math.floor(index / 10) * 100)
            .attr('y', 14 + (index % 10) * 20)
            .text(`.${ext}`)
            .style('font-size', '12px')
            .style('fill', '#333');

          index++;
        }
      }

      // Add component types
      for (const type of usedComponentTypes) {
        if (compColors[type]) {
          legendGroup.append('circle')
            .attr('cx', 10 + Math.floor(index / 10) * 100)
            .attr('cy', 10 + (index % 10) * 20)
            .attr('r', 6)
            .attr('fill', compColors[type]);

          legendGroup.append('text')
            .attr('x', 20 + Math.floor(index / 10) * 100)
            .attr('y', 14 + (index % 10) * 20)
            .text(type)
            .style('font-size', '12px')
            .style('fill', '#333');

          index++;
        }
      }

      // Add "Other" type
      legendGroup.append('circle')
        .attr('cx', 10 + Math.floor(index / 10) * 100)
        .attr('cy', 10 + (index % 10) * 20)
        .attr('r', 6)
        .attr('fill', '#aaaaaa');

      legendGroup.append('text')
        .attr('x', 20 + Math.floor(index / 10) * 100)
        .attr('y', 14 + (index % 10) * 20)
        .text('Other')
        .style('font-size', '12px')
        .style('fill', '#333');
    };

    return (
      <div ref={containerRef} className="w-full h-[600px] relative">
        <svg ref={svgRef} className="w-full h-full bg-white"></svg>
        <div className="absolute bottom-4 left-4 text-xs text-gray-500">
          Double-click on a file or directory to expand/collapse it
        </div>
      </div>
    );
  }
);

export default RepositoryGraph;
