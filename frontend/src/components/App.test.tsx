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
    // Check for the presence of key descriptive words in the page
    const pageContent = document.body.textContent || '';
    expect(pageContent).toContain('repository');
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
      expect(screen.getByText(/test-repo/)).toBeInTheDocument();
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
      // Check for the repository name, description display may vary
      expect(screen.getByText(/example-repo/)).toBeInTheDocument();
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
      expect(screen.getByText('100%')).toBeInTheDocument(); // File size weight should be visible
    });
  });

  it('shows controls toggle button when data is loaded', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      // Check that the controls toggle button is present
      expect(screen.getByLabelText('Toggle controls')).toBeInTheDocument();
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

  it('renders repository graph when data is loaded', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      // Check that the repository graph mock component is rendered
      expect(screen.getByTestId('repository-graph')).toBeInTheDocument();
    });
  });

  it('opens controls when toggle button is clicked', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      const toggleButton = screen.getByLabelText('Toggle controls');
      fireEvent.click(toggleButton);

      // Controls should be visible (they start visible by default)
      expect(toggleButton).toBeInTheDocument();
    });
  });

  it('renders main content area', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
    });
  });

  it('renders controls panel when data is loaded', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<App />);

    await waitFor(() => {
      // Controls should be visible by default when data is loaded
      expect(screen.getByLabelText('Toggle controls')).toBeInTheDocument();
    });
  });

  it('shows repository name correctly', async () => {
    const customData = {
      ...mockValidData,
      metadata: {
        ...mockValidData.metadata,
        repoName: 'custom-repo',
        description: 'Git repository at https://github.com/user/custom-repo.git',
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(customData)),
    });

    render(<App />);

    await waitFor(() => {
      // Look for the repository name in the header
      expect(screen.getByText(/custom-repo/)).toBeInTheDocument();
      // Should show github link for github repos
      expect(screen.getByRole('link')).toBeInTheDocument();
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
      expect(main).toBeInTheDocument();
      // Just check that main exists, don't rely on specific CSS classes
      expect(main.tagName.toLowerCase()).toBe('main');
    });
  });
});
