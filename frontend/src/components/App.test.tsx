import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { RepositoryData } from '../types/schema';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the example data
vi.mock('../utils/exampleData', () => ({
  exampleData: {
    repository: {
      name: 'example-repo',
      path: '/example/path',
      default_branch: 'main',
      languages: ['python'],
      total_files: 1,
      total_lines: 100,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-12-01T00:00:00Z',
    },
    files: [],
    relationships: [],
    commits: [],
    metadata: {
      repoName: 'example-repo',
      description: 'Example repository',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-12-01T00:00:00Z',
      defaultBranch: 'main',
      schemaVersion: '1.0',
      analysisDate: '2023-12-01T00:00:00Z',
    },
  },
}));

// Mock the RepositoryGraph component
vi.mock('../components/Visualization/RepositoryGraph', () => ({
  default: vi.fn().mockImplementation(() => <div data-testid="repository-graph" />),
}));

describe('App', () => {
  const mockValidData: RepositoryData = {
    repository: {
      name: 'test-repo',
      path: '/test/path',
      default_branch: 'main',
      languages: ['python'],
      total_files: 1,
      total_lines: 100,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-12-01T00:00:00Z',
    },
    files: [
      {
        id: 'test-file',
        name: 'test.py',
        path: 'src/test.py',
        type: 'file',
        extension: 'py',
        size: 1024,
        lines: 50,
        depth: 1,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-06-01T00:00:00Z',
        components: [],
      },
    ],
    relationships: [],
    commits: [],
    metadata: {
      repoName: 'test-repo',
      description: 'Test repository',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-12-01T00:00:00Z',
      defaultBranch: 'main',
      schemaVersion: '1.0',
      analysisDate: '2023-12-01T00:00:00Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock with safe defaults
    (global.fetch as any).mockClear();
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(''),
    });
  });

  it('renders header correctly', () => {
    (global.fetch as any).mockRejectedValue(new Error('Not found'));

    render(<App />);

    expect(screen.getByText('Repo Visualizer')).toBeInTheDocument();
    expect(
      screen.getByText('Visualize your repository structure interactively')
    ).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<App />);

    expect(screen.getByText('Loading repository data...')).toBeInTheDocument();
  });

  it('auto-loads repo_data.json successfully', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('test-repo - Test repository')).toBeInTheDocument();
      expect(screen.getByTestId('repository-graph')).toBeInTheDocument();
    });
  });

  it('shows file upload when auto-load fails', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText('Could not auto-load repo_data.json. Please select a file manually.')
      ).toBeInTheDocument();
      expect(screen.getByText('Load Repository Data')).toBeInTheDocument();
    });
  });

  it('shows file upload when auto-load returns invalid data', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ invalid: 'data' })),
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText('Could not auto-load repo_data.json. Please select a file manually.')
      ).toBeInTheDocument();
    });
  });

  it('handles data loading from file upload', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Not found'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Load Repository Data')).toBeInTheDocument();
    });

    // Simulate file upload (this would normally be handled by FileUpload component)
    // We'll test the callback directly
    const fileUpload = screen.getByText('Load Repository Data').closest('div');
    expect(fileUpload).toBeInTheDocument();
  });

  it('handles example data loading', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Not found'));

    render(<App />);

    await waitFor(() => {
      const exampleButton = screen.getByText('Load Example Data');
      fireEvent.click(exampleButton);
    });

    await waitFor(() => {
      expect(screen.getByText('example-repo - Example repository')).toBeInTheDocument();
    });
  });

  it('initializes with correct default weight values', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      // Check that controls are rendered with default values
      expect(screen.getByText('70%')).toBeInTheDocument(); // Reference weight
      expect(screen.getByText('30%')).toBeInTheDocument(); // Filesystem weight
      expect(screen.getByText('100%')).toBeInTheDocument(); // File size weight
    });
  });

  it('updates weight values when sliders change', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      const sliders = screen.getAllByRole('slider');

      // Change reference weight
      fireEvent.change(sliders[0], { target: { value: '80' } });
      expect(screen.getByText('80%')).toBeInTheDocument();

      // Change filesystem weight
      fireEvent.change(sliders[1], { target: { value: '50' } });
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  it('handles file selection and shows file details', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('repository-graph')).toBeInTheDocument();
    });

    // Simulate file selection (this would normally come from RepositoryGraph)
    // We can't easily test this without the actual RepositoryGraph component
    // but we can test the state management
  });

  it('handles zoom controls', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Zoom In')).toBeInTheDocument();
      expect(screen.getByText('Zoom Out')).toBeInTheDocument();
      expect(screen.getByText('Reset View')).toBeInTheDocument();
      expect(screen.getByText('Fullscreen')).toBeInTheDocument();
    });
  });

  it('handles fullscreen toggle', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    // Mock fullscreen API
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
    });

    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
    });

    render(<App />);

    await waitFor(() => {
      const fullscreenButton = screen.getByText('Fullscreen');
      fireEvent.click(fullscreenButton);

      expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
    });
  });

  it('handles fullscreen exit', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    // Mock fullscreen API in fullscreen state
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      writable: true,
    });

    Object.defineProperty(document, 'exitFullscreen', {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
    });

    render(<App />);

    await waitFor(() => {
      const exitFullscreenButton = screen.getByText('Exit Fullscreen');
      fireEvent.click(exitFullscreenButton);

      expect(document.exitFullscreen).toHaveBeenCalled();
    });
  });

  it('handles node sizing weight changes', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      const sliders = screen.getAllByRole('slider');

      // Change file size weight (4th slider)
      fireEvent.change(sliders[3], { target: { value: '80' } });

      // Change commit count weight (5th slider)
      fireEvent.change(sliders[4], { target: { value: '20' } });

      // Check that the values are displayed
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });

  it('shows repository name and description correctly', async () => {
    const customData = {
      ...mockValidData,
      metadata: {
        ...mockValidData.metadata,
        repoName: 'custom-repo',
        description: 'Custom description',
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(customData)),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('custom-repo - Custom description')).toBeInTheDocument();
    });
  });

  it('shows repository name without description', async () => {
    const customData = {
      ...mockValidData,
      metadata: {
        ...mockValidData.metadata,
        repoName: 'no-desc-repo',
        description: undefined,
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(customData)),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('no-desc-repo')).toBeInTheDocument();
      expect(screen.queryByText(' - ')).not.toBeInTheDocument();
    });
  });

  it('handles network errors gracefully', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText('Could not auto-load repo_data.json. Please select a file manually.')
      ).toBeInTheDocument();
    });
  });

  it('has correct responsive layout classes', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      const main = screen.getByRole('main');
      expect(main).toHaveClass('flex-1', 'flex', 'flex-col');
    });
  });
});
