import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FileUpload from './FileUpload';
import { RepositoryData } from '../types/schema';

// Mock fetch globally
global.fetch = vi.fn();

describe('FileUpload', () => {
  const mockOnDataLoaded = vi.fn();
  const mockOnLoadExample = vi.fn();

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

  it('renders upload interface correctly', () => {
    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    expect(screen.getByText('Load Repository Data')).toBeInTheDocument();
    expect(screen.getByText('Upload from Computer')).toBeInTheDocument();
    expect(screen.getByText('Select from Server')).toBeInTheDocument();
    expect(screen.getByText('Choose File')).toBeInTheDocument();
    expect(screen.getByText('Visualize Repository')).toBeInTheDocument();
    expect(screen.getByText('Load Example Data')).toBeInTheDocument();
  });

  it('fetches server files on component mount', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });

    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/repo_data.json');
    });
  });

  it('handles file selection', () => {
    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    const fileInput = screen.getByLabelText('Choose File');
    const file = new File(['{}'], 'test.json', { type: 'application/json' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('test.json')).toBeInTheDocument();
  });

  it('handles server file selection', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });

    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'repo_data.json' } });

      expect(screen.getByText('Selected: repo_data.json')).toBeInTheDocument();
    });
  });

  it('processes uploaded file correctly', async () => {
    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    const fileInput = screen.getByLabelText('Choose File');
    const file = new File([JSON.stringify(mockValidData)], 'test.json', {
      type: 'application/json',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const visualizeButton = screen.getByText('Visualize Repository');
    fireEvent.click(visualizeButton);

    await waitFor(() => {
      expect(mockOnDataLoaded).toHaveBeenCalledWith(mockValidData);
    });
  });

  it('processes server file correctly', async () => {
    // Mock the server file fetch - component makes two calls: one for checking file existence, one for fetching content
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockValidData)),
    });

    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'repo_data.json' } });
    });

    const visualizeButton = screen.getByText('Visualize Repository');
    fireEvent.click(visualizeButton);

    await waitFor(() => {
      expect(mockOnDataLoaded).toHaveBeenCalledWith(mockValidData);
    });
  });

  it('shows error for invalid JSON', async () => {
    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    const fileInput = screen.getByLabelText('Choose File');
    const file = new File(['invalid json'], 'test.json', {
      type: 'application/json',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const visualizeButton = screen.getByText('Visualize Repository');
    fireEvent.click(visualizeButton);

    await waitFor(() => {
      expect(screen.getByText(/Error processing file/)).toBeInTheDocument();
    });
  });

  it('shows error for invalid data format', async () => {
    const invalidData = {
      metadata: { repoName: 'test' },
      // Missing files and relationships arrays
    };

    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    const fileInput = screen.getByLabelText('Choose File');
    const file = new File([JSON.stringify(invalidData)], 'test.json', {
      type: 'application/json',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const visualizeButton = screen.getByText('Visualize Repository');
    fireEvent.click(visualizeButton);

    await waitFor(() => {
      expect(screen.getByText(/Invalid repository data format/)).toBeInTheDocument();
    });
  });

  it('shows error when no file is selected', async () => {
    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    const visualizeButton = screen.getByText('Visualize Repository');
    fireEvent.click(visualizeButton);

    await waitFor(() => {
      expect(screen.getByText('Please select a file first')).toBeInTheDocument();
    });
  });

  it('shows loading state during processing', async () => {
    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    const fileInput = screen.getByLabelText('Choose File');
    const file = new File([JSON.stringify(mockValidData)], 'test.json', {
      type: 'application/json',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const visualizeButton = screen.getByText('Visualize Repository');
    fireEvent.click(visualizeButton);

    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(visualizeButton).toBeDisabled();
  });

  it('calls onLoadExample when example button is clicked', () => {
    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    const exampleButton = screen.getByText('Load Example Data');
    fireEvent.click(exampleButton);

    expect(mockOnLoadExample).toHaveBeenCalledTimes(1);
  });

  it('clears selections when switching between upload types', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });

    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    // Select a file
    const fileInput = screen.getByLabelText('Choose File');
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('test.json')).toBeInTheDocument();

    // Then select a server file
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'repo_data.json' } });
    });

    // Local file selection should be cleared, server file should be selected
    expect(screen.getByText('Selected: repo_data.json')).toBeInTheDocument();

    // Check that the local file section shows "No file selected"
    const uploadSection = screen.getByText('Upload from Computer').closest('div');
    expect(uploadSection).toHaveTextContent('No file selected');
  });

  it('handles server fetch errors gracefully', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    // Should still render without crashing
    expect(screen.getByText('Load Repository Data')).toBeInTheDocument();
  });

  it('handles server file fetch errors', async () => {
    // Mock the initial file list fetch to succeed, but the actual file fetch to fail
    (global.fetch as any).mockImplementation(url => {
      if (url === '/repo_data.json' && (global.fetch as any).mock.calls.length > 1) {
        // Second call (actual file fetch) - return error
        return Promise.resolve({
          ok: false,
          statusText: 'Not Found',
        });
      }
      // First call (file existence check) - return success
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('{}'),
      });
    });

    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'repo_data.json' } });
    });

    const visualizeButton = screen.getByText('Visualize Repository');
    fireEvent.click(visualizeButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Error processing file.*Failed to fetch server file/)
      ).toBeInTheDocument();
    });
  });

  it('disables visualize button when no file is selected', () => {
    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    const visualizeButton = screen.getByText('Visualize Repository');
    expect(visualizeButton).toBeDisabled();
  });

  it('enables visualize button when file is selected', () => {
    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    const fileInput = screen.getByLabelText('Choose File');
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const visualizeButton = screen.getByText('Visualize Repository');
    expect(visualizeButton).not.toBeDisabled();
  });

  it('shows correct server file options', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });

    render(<FileUpload onDataLoaded={mockOnDataLoaded} onLoadExample={mockOnLoadExample} />);

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      const options = select.querySelectorAll('option');

      expect(options).toHaveLength(2); // "Select a file..." + "repo_data.json"
      expect(options[0]).toHaveTextContent('Select a file...');
      expect(options[1]).toHaveTextContent('repo_data.json');
    });
  });
});
