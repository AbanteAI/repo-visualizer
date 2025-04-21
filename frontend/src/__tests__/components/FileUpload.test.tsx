import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FileUpload from '../../components/FileUpload';

describe('FileUpload Component', () => {
  const mockOnDataLoaded = jest.fn();
  const mockOnLoadExample = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the file upload component', () => {
    render(
      <FileUpload
        onDataLoaded={mockOnDataLoaded}
        onLoadExample={mockOnLoadExample}
      />
    );

    expect(screen.getByText(/Upload Repository Data/i)).toBeInTheDocument();
    expect(screen.getByText(/or/i)).toBeInTheDocument();
    expect(screen.getByText(/Try with Example Data/i)).toBeInTheDocument();
  });

  test('calls onLoadExample when example button is clicked', () => {
    render(
      <FileUpload
        onDataLoaded={mockOnDataLoaded}
        onLoadExample={mockOnLoadExample}
      />
    );

    fireEvent.click(screen.getByText(/Try with Example Data/i));
    expect(mockOnLoadExample).toHaveBeenCalledTimes(1);
  });
});
