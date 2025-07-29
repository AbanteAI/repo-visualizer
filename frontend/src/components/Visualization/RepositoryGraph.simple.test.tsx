import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { mockRepositoryData } from '../../test/mockData';
import RepositoryGraph from './RepositoryGraph';
import { DEFAULT_CONFIG } from '../../types/visualization';

// Mock d3 completely to avoid complex interactions
vi.mock('d3', () => {
  const mockObj = {
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    attr: vi.fn().mockReturnThis(),
    style: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    append: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
    call: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    data: vi.fn().mockReturnThis(),
    enter: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    empty: vi.fn().mockReturnValue(false),
    node: vi.fn().mockReturnValue({}),
    transition: vi.fn().mockReturnThis(),
    duration: vi.fn().mockReturnThis(),
    force: vi.fn().mockReturnThis(),
    nodes: vi.fn().mockReturnValue([]),
    links: vi.fn().mockReturnThis(),
    distance: vi.fn().mockReturnThis(),
    strength: vi.fn().mockReturnThis(),
    id: vi.fn().mockReturnThis(),
    alpha: vi.fn().mockReturnThis(),
    alphaTarget: vi.fn().mockReturnThis(),
    restart: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    x: vi.fn().mockReturnThis(),
    y: vi.fn().mockReturnThis(),
    radius: vi.fn().mockReturnThis(),
    scaleExtent: vi.fn().mockReturnThis(),
    transform: vi.fn().mockReturnThis(),
    translate: vi.fn().mockReturnThis(),
    scale: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    each: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn().mockReturnValue(mockObj),
    selectAll: vi.fn().mockReturnValue(mockObj),
    forceSimulation: vi.fn().mockReturnValue(mockObj),
    forceLink: vi.fn().mockReturnValue(mockObj),
    forceManyBody: vi.fn().mockReturnValue(mockObj),
    forceCenter: vi.fn().mockReturnValue(mockObj),
    forceCollide: vi.fn().mockReturnValue(mockObj),
    zoom: vi.fn().mockReturnValue(mockObj),
    zoomTransform: vi.fn().mockReturnValue({ x: 0, y: 0, k: 1 }),
    zoomIdentity: mockObj,
    drag: vi.fn().mockReturnValue(mockObj),
    mean: vi.fn().mockReturnValue(0),
  };
});

describe('RepositoryGraph Simple Tests', () => {
  const defaultProps = {
    data: mockRepositoryData,
    onSelectFile: vi.fn(),
    selectedFile: null,
    config: DEFAULT_CONFIG,
  };

  // Mock DOM properties
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: 800,
  });

  it('renders without crashing', () => {
    expect(() => {
      render(<RepositoryGraph {...defaultProps} />);
    }).not.toThrow();
  });

  it('creates an SVG element', () => {
    render(<RepositoryGraph {...defaultProps} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies correct container classes', () => {
    render(<RepositoryGraph {...defaultProps} />);
    const container = document.querySelector('svg')?.parentElement;
    expect(container).toHaveClass('w-full', 'h-full', 'bg-gray-50', 'rounded-lg', 'overflow-hidden');
  });

  it('handles prop changes', () => {
    const { rerender } = render(<RepositoryGraph {...defaultProps} />);
    expect(() => {
      rerender(<RepositoryGraph {...defaultProps} selectedFile="file1" />);
    }).not.toThrow();
  });

  it('handles different data', () => {
    const simpleData = {
      ...mockRepositoryData,
      files: [
        {
          id: 'file1',
          name: 'test.js',
          path: 'test.js',
          type: 'file' as const,
          extension: 'js',
          size: 100,
          depth: 0,
        },
      ],
      relationships: [],
    };

    expect(() => {
      render(<RepositoryGraph {...defaultProps} data={simpleData} />);
    }).not.toThrow();
  });

  it('handles empty data', () => {
    const emptyData = {
      ...mockRepositoryData,
      files: [],
      relationships: [],
    };

    expect(() => {
      render(<RepositoryGraph {...defaultProps} data={emptyData} />);
    }).not.toThrow();
  });

  it('handles unmount', () => {
    const { unmount } = render(<RepositoryGraph {...defaultProps} />);
    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
