import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileDetails from './FileDetails';
import { RepositoryData } from '../types/schema';

describe('FileDetails', () => {
  const mockData: RepositoryData = {
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
        metrics: {
          linesOfCode: 40,
          commentLines: 8,
          emptyLines: 2,
          complexity: 3.5,
        },
        components: [
          {
            id: 'test-class',
            name: 'TestClass',
            type: 'class',
            line_start: 10,
            line_end: 30,
            components: [
              {
                id: 'test-method',
                name: 'test_method',
                type: 'method',
                line_start: 15,
                line_end: 20,
              },
            ],
          },
          {
            id: 'test-function',
            name: 'test_function',
            type: 'function',
            line_start: 35,
            line_end: 45,
          },
        ],
      },
      {
        id: 'test-dir',
        name: 'utils',
        path: 'src/utils',
        type: 'directory',
        size: 0,
        lines: 0,
        depth: 1,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-06-01T00:00:00Z',
        components: [],
      },
    ],
    relationships: [],
    commits: [],
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file details correctly', () => {
    render(<FileDetails fileId="test-file" data={mockData} onClose={mockOnClose} />);

    expect(screen.getByText('test.py')).toBeInTheDocument();
    expect(screen.getByText('src/test.py')).toBeInTheDocument();
    expect(screen.getByText('file')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.getByText('.py')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders file metrics correctly', () => {
    render(<FileDetails fileId="test-file" data={mockData} onClose={mockOnClose} />);

    expect(screen.getByText('Lines of code: 40')).toBeInTheDocument();
    expect(screen.getByText('Comment lines: 8')).toBeInTheDocument();
    expect(screen.getByText('Empty lines: 2')).toBeInTheDocument();
    expect(screen.getByText('Complexity: 3.5')).toBeInTheDocument();
  });

  it('renders components correctly', () => {
    render(<FileDetails fileId="test-file" data={mockData} onClose={mockOnClose} />);

    expect(screen.getByText('TestClass')).toBeInTheDocument();
    expect(screen.getByText('(class)')).toBeInTheDocument();
    expect(screen.getByText('Lines 10-30')).toBeInTheDocument();

    expect(screen.getByText('test_method')).toBeInTheDocument();
    expect(screen.getByText('(method)')).toBeInTheDocument();
    expect(screen.getByText('Lines 15-20')).toBeInTheDocument();

    expect(screen.getByText('test_function')).toBeInTheDocument();
    expect(screen.getByText('(function)')).toBeInTheDocument();
    expect(screen.getByText('Lines 35-45')).toBeInTheDocument();
  });

  it('renders directory details correctly', () => {
    render(<FileDetails fileId="test-dir" data={mockData} onClose={mockOnClose} />);

    expect(screen.getByText('utils')).toBeInTheDocument();
    expect(screen.getByText('src/utils')).toBeInTheDocument();
    expect(screen.getByText('directory')).toBeInTheDocument();
    expect(screen.getByText('0 bytes')).toBeInTheDocument();

    // Directory should not have extension
    expect(screen.queryByText('Extension:')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<FileDetails fileId="test-file" data={mockData} onClose={mockOnClose} />);

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('returns null when file is not found', () => {
    const { container } = render(
      <FileDetails fileId="nonexistent-file" data={mockData} onClose={mockOnClose} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('formats file sizes correctly', () => {
    const testData = {
      ...mockData,
      files: [
        {
          ...mockData.files[0],
          id: 'small-file',
          size: 500,
        },
        {
          ...mockData.files[0],
          id: 'large-file',
          size: 1048576, // 1 MB
        },
        {
          ...mockData.files[0],
          id: 'huge-file',
          size: 1073741824, // 1 GB
        },
      ],
    };

    const { rerender } = render(
      <FileDetails fileId="small-file" data={testData} onClose={mockOnClose} />
    );
    expect(screen.getByText('500.0 bytes')).toBeInTheDocument();

    rerender(<FileDetails fileId="large-file" data={testData} onClose={mockOnClose} />);
    expect(screen.getByText('1.0 MB')).toBeInTheDocument();

    rerender(<FileDetails fileId="huge-file" data={testData} onClose={mockOnClose} />);
    expect(screen.getByText('1.0 GB')).toBeInTheDocument();
  });

  it('handles files without metrics', () => {
    const testData = {
      ...mockData,
      files: [
        {
          ...mockData.files[0],
          id: 'no-metrics-file',
          metrics: undefined,
        },
      ],
    };

    render(<FileDetails fileId="no-metrics-file" data={testData} onClose={mockOnClose} />);

    expect(screen.queryByText('Metrics:')).not.toBeInTheDocument();
  });

  it('handles files without components', () => {
    const testData = {
      ...mockData,
      files: [
        {
          ...mockData.files[0],
          id: 'no-components-file',
          components: [],
        },
      ],
    };

    render(<FileDetails fileId="no-components-file" data={testData} onClose={mockOnClose} />);

    expect(screen.queryByText('Components:')).not.toBeInTheDocument();
  });

  it('handles files without extension', () => {
    const testData = {
      ...mockData,
      files: [
        {
          ...mockData.files[0],
          id: 'no-extension-file',
          extension: undefined,
        },
      ],
    };

    render(<FileDetails fileId="no-extension-file" data={testData} onClose={mockOnClose} />);

    expect(screen.queryByText('Extension:')).not.toBeInTheDocument();
  });

  it('handles components without line numbers', () => {
    const testData = {
      ...mockData,
      files: [
        {
          ...mockData.files[0],
          id: 'no-lines-file',
          components: [
            {
              id: 'no-lines-component',
              name: 'NoLinesComponent',
              type: 'class',
              components: [],
            },
          ],
        },
      ],
    };

    render(<FileDetails fileId="no-lines-file" data={testData} onClose={mockOnClose} />);

    expect(screen.getByText('NoLinesComponent')).toBeInTheDocument();
    expect(screen.queryByText(/Lines \d+-\d+/)).not.toBeInTheDocument();
  });

  it('handles nested components correctly', () => {
    const testData = {
      ...mockData,
      files: [
        {
          ...mockData.files[0],
          id: 'nested-file',
          components: [
            {
              id: 'outer-class',
              name: 'OuterClass',
              type: 'class',
              line_start: 1,
              line_end: 50,
              components: [
                {
                  id: 'inner-method',
                  name: 'inner_method',
                  type: 'method',
                  line_start: 10,
                  line_end: 15,
                  components: [],
                },
                {
                  id: 'another-method',
                  name: 'another_method',
                  type: 'method',
                  line_start: 20,
                  line_end: 25,
                  components: [],
                },
              ],
            },
          ],
        },
      ],
    };

    render(<FileDetails fileId="nested-file" data={testData} onClose={mockOnClose} />);

    expect(screen.getByText('OuterClass')).toBeInTheDocument();
    expect(screen.getByText('inner_method')).toBeInTheDocument();
    expect(screen.getByText('another_method')).toBeInTheDocument();

    // Check that nested components are properly indented/structured
    const methodElements = screen.getAllByText(/\(method\)/);
    expect(methodElements).toHaveLength(2);
  });

  it('handles zero-size files', () => {
    const testData = {
      ...mockData,
      files: [
        {
          ...mockData.files[0],
          id: 'zero-size-file',
          size: 0,
        },
      ],
    };

    render(<FileDetails fileId="zero-size-file" data={testData} onClose={mockOnClose} />);

    expect(screen.getByText('0 bytes')).toBeInTheDocument();
  });
});
