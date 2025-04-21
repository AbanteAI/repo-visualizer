import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { RepositoryData, File } from '../../types/schema';

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
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    
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

    // Function to stabilize simulation
    const stabilizeSimulation = () => {
      if (!simulationRef.current) return;
      
      // Run the simulation for a few ticks to stabilize it
      for (let i = 0; i < 100; i++) {
        simulationRef.current.tick();
      }
      
      // Then stop it moving
      simulationRef.current.alpha(0).stop();
    };
    
    useEffect(() => {
      if (!svgRef.current || !containerRef.current || !data) return;

      // Clear any existing visualization
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      // Set up dimensions
      const getContainerDimensions = () => {
        const container = containerRef.current;
        if (!container) return { width: 800, height: 600 };
        return {
          width: container.clientWidth,
          height: container.clientHeight
        };
      };

      const { width, height } = getContainerDimensions();

      // Update SVG dimensions
      svg
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height]);

      // Create a group for the graph
      const g = svg.append('g');

      // Extract nodes from files
      const nodes: Node[] = data.files.map(file => ({
        id: file.id,
        name: file.name,
        path: file.path,
        type: file.type,
        extension: file.extension,
        size: file.size,
        depth: file.depth,
      }));

      // Extract links from relationships
      const links: Link[] = data.relationships.map(rel => ({
        source: rel.source,
        target: rel.target,
        type: rel.type,
      }));

      // Create a force simulation
      const simulation = d3.forceSimulation<Node>(nodes)
        .force('link', d3.forceLink<Node, Link>(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide<Node>().radius(d => getNodeRadius(d) + 5))
        .alpha(1)  // Start with a high alpha
        .alphaDecay(0.02); // Faster decay for quicker initial stabilization

      // Save simulation to ref for potential future interactions
      simulationRef.current = simulation;
      
      // Make sure we stabilize after initial layout
      simulation.on('end', () => {
        // Fix positions of all nodes once initial layout is done
        nodes.forEach(node => {
          if (node.x && node.y) {
            node.fx = node.x;
            node.fy = node.y;
          }
        });
      });

      // Create links
      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', '#95a5a6')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', d => getLinkWidth(d));

      // Create nodes
      const node = g.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => getNodeColor(d, extensionColors))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this)
            .attr('stroke', '#e74c3c')
            .attr('stroke-width', 3);
        })
        .on('mouseout', function(event, d) {
          if (d.id !== selectedFile) {
            d3.select(this)
              .attr('stroke', '#fff')
              .attr('stroke-width', 1.5);
          }
        })
        .on('click', (event, d) => {
          event.stopPropagation();
          
          // Ensure all nodes are fixed at their current positions to prevent unwanted movement
          nodes.forEach(node => {
            if (node.x && node.y) {
              node.fx = node.x;
              node.fy = node.y;
            }
          });
          
          // Select the node without causing movement
          onSelectFile(d.id);
          
          // Make sure simulation is stopped
          if (simulationRef.current) {
            simulationRef.current.alpha(0).stop();
          }
        })
        .call(dragBehavior(simulation));

      // Highlight selected file
      if (selectedFile) {
        node.filter(d => d.id === selectedFile)
          .attr('stroke-width', 3)
          .attr('stroke', '#e74c3c');
          
        // Fix position of selected node to prevent movement
        const selectedNode = nodes.find(n => n.id === selectedFile);
        if (selectedNode && selectedNode.x && selectedNode.y) {
          selectedNode.fx = selectedNode.x;
          selectedNode.fy = selectedNode.y;
        }
      }

      // Add node labels
      const label = g.append('g')
        .selectAll('text')
        .data(nodes)
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

        label
          .attr('x', d => d.x || 0)
          .attr('y', d => d.y || 0);
      });

      // Create legend
      createLegend(svg, width, data, extensionColors);

      // Set up resize observer to handle container size changes
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      
      // Keep track of previous dimensions to avoid unnecessary updates
      let prevWidth = width;
      let prevHeight = height;
      
      resizeObserverRef.current = new ResizeObserver(() => {
        if (!containerRef.current || !svgRef.current) return;
        
        const { width: newWidth, height: newHeight } = getContainerDimensions();
        
        // Only update if dimensions have actually changed significantly
        // This prevents resize feedback loops
        if (Math.abs(newWidth - prevWidth) > 5 || Math.abs(newHeight - prevHeight) > 5) {
          prevWidth = newWidth;
          prevHeight = newHeight;
          
          // Update SVG dimensions
          svg
            .attr('width', newWidth)
            .attr('height', newHeight)
            .attr('viewBox', [0, 0, newWidth, newHeight]);
          
          // Update force simulation center
          if (simulationRef.current) {
            simulationRef.current
              .force('center', d3.forceCenter(newWidth / 2, newHeight / 2))
              .alpha(0.1) // Lower alpha for gentler transitions
              .restart();
          }
        }
      });
      
      if (containerRef.current) {
        resizeObserverRef.current.observe(containerRef.current);
      }

      // Clean up on unmount
      return () => {
        if (simulationRef.current) {
          simulationRef.current.stop();
        }
        
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }
      };
    }, [data, onSelectFile, selectedFile]);

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
          // Keep node fixed in place after dragging to prevent random movement
          // d.fx = null;
          // d.fy = null;
        });
    };

    // Helper functions
    const getNodeRadius = (node: Node) => {
      if (node.type === 'directory') {
        return 10; // Fixed size for directories
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

    const getNodeColor = (node: Node, colors: Record<string, string>) => {
      // Directories have a different color
      if (node.type === 'directory') {
        return '#7f8c8d';
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
        if (colors[ext]) {
          legendGroup.append('circle')
            .attr('cx', 10 + Math.floor(index / 10) * 100)
            .attr('cy', 10 + (index % 10) * 20)
            .attr('r', 6)
            .attr('fill', colors[ext]);

          legendGroup.append('text')
            .attr('x', 20 + Math.floor(index / 10) * 100)
            .attr('y', 14 + (index % 10) * 20)
            .text(`.${ext}`)
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
      <div ref={containerRef} className="w-full h-[600px] max-h-[80vh] relative">
        <svg ref={svgRef} className="w-full h-full bg-white"></svg>
      </div>
    );
  }
);

export default RepositoryGraph;
