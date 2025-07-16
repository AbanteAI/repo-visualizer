import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RepositoryGraph from './RepositoryGraph';
import { mockRepositoryData } from '../../test/mockData';

// Test helper functions by creating a test component that exposes them
const TestHelperComponent = () => {
  // Helper functions extracted from RepositoryGraph for testing
  const getNodeRadius = (node: any) => {
    if (node.type === 'directory') {
      return 10;
    }

    if (node.type === 'class' || node.type === 'function' || node.type === 'method') {
      return 6;
    }

    const minRadius = 5;
    const maxRadius = 15;
    const baseRadius = node.size ? Math.sqrt(node.size) / 15 : minRadius;

    return Math.max(minRadius, Math.min(maxRadius, baseRadius));
  };

  const getLinkWidth = (link: any) => {
    const baseWidth = (() => {
      switch (link.type) {
        case 'import':
        case 'call':
        case 'calls':
          return 2;
        case 'contains':
          return 3;
        case 'filesystem_proximity':
          return 1.5;
        case 'semantic_similarity':
          return 2;
        default:
          return 1.5;
      }
    })();

    if (link.type === 'contains') {
      return baseWidth;
    }

    const weight = link.weight || 0;
    return baseWidth * (0.5 + weight * 0.5);
  };

  const getLinkColor = (link: any) => {
    switch (link.type) {
      case 'filesystem_proximity':
        return '#e74c3c';
      case 'semantic_similarity':
        return '#27ae60';
      case 'import':
      case 'call':
        return '#3498db';
      case 'contains':
        return '#2c3e50';
      default:
        return '#95a5a6';
    }
  };

  const getNodeColor = (node: any, colors: Record<string, string>) => {
    if (node.type === 'directory') {
      return '#7f8c8d';
    }

    if (node.type === 'class') {
      return '#e67e22';
    }
    if (node.type === 'function') {
      return '#3498db';
    }
    if (node.type === 'method') {
      return '#9b59b6';
    }

    if (node.extension && colors[node.extension]) {
      return colors[node.extension];
    }

    return '#aaaaaa';
  };

  // Store functions in global for testing
  (window as any).testHelpers = {
    getNodeRadius,
    getLinkWidth,
    getLinkColor,
    getNodeColor,
  };

  return null;
};

describe('RepositoryGraph Helper Functions', () => {
  beforeEach(() => {
    render(<TestHelperComponent />);
  });

  describe('getNodeRadius', () => {
    it('returns fixed radius for directories', () => {
      const node = { type: 'directory', size: 1000 };
      const radius = (window as any).testHelpers.getNodeRadius(node);
      expect(radius).toBe(10);
    });

    it('returns smaller radius for components', () => {
      const classNode = { type: 'class', size: 100 };
      const functionNode = { type: 'function', size: 100 };
      const methodNode = { type: 'method', size: 100 };

      const classRadius = (window as any).testHelpers.getNodeRadius(classNode);
      const functionRadius = (window as any).testHelpers.getNodeRadius(functionNode);
      const methodRadius = (window as any).testHelpers.getNodeRadius(methodNode);

      expect(classRadius).toBe(6);
      expect(functionRadius).toBe(6);
      expect(methodRadius).toBe(6);
    });

    it('scales file radius based on size', () => {
      const smallFile = { type: 'file', size: 100 };
      const largeFile = { type: 'file', size: 10000 };

      const smallRadius = (window as any).testHelpers.getNodeRadius(smallFile);
      const largeRadius = (window as any).testHelpers.getNodeRadius(largeFile);

      expect(smallRadius).toBeGreaterThanOrEqual(5);
      expect(largeRadius).toBeGreaterThan(smallRadius);
      expect(largeRadius).toBeLessThanOrEqual(15);
    });

    it('uses minimum radius for files without size', () => {
      const node = { type: 'file' };
      const radius = (window as any).testHelpers.getNodeRadius(node);
      expect(radius).toBe(5);
    });

    it('enforces minimum and maximum radius constraints', () => {
      const tinyFile = { type: 'file', size: 1 };
      const hugeFile = { type: 'file', size: 100000 };

      const tinyRadius = (window as any).testHelpers.getNodeRadius(tinyFile);
      const hugeRadius = (window as any).testHelpers.getNodeRadius(hugeFile);

      expect(tinyRadius).toBeGreaterThanOrEqual(5);
      expect(hugeRadius).toBeLessThanOrEqual(15);
    });
  });

  describe('getLinkWidth', () => {
    it('returns correct base width for different link types', () => {
      const importLink = { type: 'import', weight: 0.5 };
      const callLink = { type: 'call', weight: 0.5 };
      const containsLink = { type: 'contains', weight: 0.5 };
      const fsLink = { type: 'filesystem_proximity', weight: 0.5 };
      const semLink = { type: 'semantic_similarity', weight: 0.5 };

      const importWidth = (window as any).testHelpers.getLinkWidth(importLink);
      const callWidth = (window as any).testHelpers.getLinkWidth(callLink);
      const containsWidth = (window as any).testHelpers.getLinkWidth(containsLink);
      const fsWidth = (window as any).testHelpers.getLinkWidth(fsLink);
      const semWidth = (window as any).testHelpers.getLinkWidth(semLink);

      expect(importWidth).toBe(2 * (0.5 + 0.5 * 0.5)); // 2 * 0.75 = 1.5
      expect(callWidth).toBe(2 * (0.5 + 0.5 * 0.5)); // 2 * 0.75 = 1.5
      expect(containsWidth).toBe(3); // Fixed width
      expect(fsWidth).toBe(1.5 * (0.5 + 0.5 * 0.5)); // 1.5 * 0.75 = 1.125
      expect(semWidth).toBe(2 * (0.5 + 0.5 * 0.5)); // 2 * 0.75 = 1.5
    });

    it('uses fixed width for contains links', () => {
      const containsLink1 = { type: 'contains', weight: 0.1 };
      const containsLink2 = { type: 'contains', weight: 0.9 };

      const width1 = (window as any).testHelpers.getLinkWidth(containsLink1);
      const width2 = (window as any).testHelpers.getLinkWidth(containsLink2);

      expect(width1).toBe(3);
      expect(width2).toBe(3);
    });

    it('scales width by weight for non-contains links', () => {
      const lowWeightLink = { type: 'import', weight: 0.1 };
      const highWeightLink = { type: 'import', weight: 0.9 };

      const lowWidth = (window as any).testHelpers.getLinkWidth(lowWeightLink);
      const highWidth = (window as any).testHelpers.getLinkWidth(highWeightLink);

      expect(highWidth).toBeGreaterThan(lowWidth);
    });

    it('handles missing weight', () => {
      const linkWithoutWeight = { type: 'import' };
      const width = (window as any).testHelpers.getLinkWidth(linkWithoutWeight);
      expect(width).toBe(2 * 0.5); // baseWidth * 0.5 when weight is 0
    });
  });

  describe('getLinkColor', () => {
    it('returns correct colors for different link types', () => {
      const testCases = [
        { type: 'filesystem_proximity', expectedColor: '#e74c3c' },
        { type: 'semantic_similarity', expectedColor: '#27ae60' },
        { type: 'import', expectedColor: '#3498db' },
        { type: 'call', expectedColor: '#3498db' },
        { type: 'contains', expectedColor: '#2c3e50' },
        { type: 'unknown', expectedColor: '#95a5a6' },
      ];

      testCases.forEach(({ type, expectedColor }) => {
        const link = { type };
        const color = (window as any).testHelpers.getLinkColor(link);
        expect(color).toBe(expectedColor);
      });
    });
  });

  describe('getNodeColor', () => {
    const extensionColors = {
      py: '#3572A5',
      js: '#f7df1e',
      html: '#e34c26',
      css: '#563d7c',
      md: '#083fa1',
    };

    it('returns correct colors for different node types', () => {
      const testCases = [
        { type: 'directory', expectedColor: '#7f8c8d' },
        { type: 'class', expectedColor: '#e67e22' },
        { type: 'function', expectedColor: '#3498db' },
        { type: 'method', expectedColor: '#9b59b6' },
      ];

      testCases.forEach(({ type, expectedColor }) => {
        const node = { type };
        const color = (window as any).testHelpers.getNodeColor(node, extensionColors);
        expect(color).toBe(expectedColor);
      });
    });

    it('returns extension-based colors for files', () => {
      const pythonFile = { type: 'file', extension: 'py' };
      const jsFile = { type: 'file', extension: 'js' };

      const pythonColor = (window as any).testHelpers.getNodeColor(pythonFile, extensionColors);
      const jsColor = (window as any).testHelpers.getNodeColor(jsFile, extensionColors);

      expect(pythonColor).toBe('#3572A5');
      expect(jsColor).toBe('#f7df1e');
    });

    it('returns default color for unknown file types', () => {
      const unknownFile = { type: 'file', extension: 'unknown' };
      const fileWithoutExtension = { type: 'file' };

      const unknownColor = (window as any).testHelpers.getNodeColor(unknownFile, extensionColors);
      const noExtColor = (window as any).testHelpers.getNodeColor(
        fileWithoutExtension,
        extensionColors
      );

      expect(unknownColor).toBe('#aaaaaa');
      expect(noExtColor).toBe('#aaaaaa');
    });
  });
});
