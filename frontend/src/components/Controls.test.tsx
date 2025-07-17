import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Controls from './Controls';

describe('Controls', () => {
  const defaultProps = {
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onReset: vi.fn(),
    onFullscreen: vi.fn(),
    isFullscreen: false,
    referenceWeight: 50,
    filesystemWeight: 30,
    semanticWeight: 20,
    onReferenceWeightChange: vi.fn(),
    onFilesystemWeightChange: vi.fn(),
    onSemanticWeightChange: vi.fn(),
    fileSizeWeight: 100,
    commitCountWeight: 0,
    recencyWeight: 0,
    identifiersWeight: 0,
    referencesWeight: 0,
    onFileSizeWeightChange: vi.fn(),
    onCommitCountWeightChange: vi.fn(),
    onRecencyWeightChange: vi.fn(),
    onIdentifiersWeightChange: vi.fn(),
    onReferencesWeightChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all zoom control buttons', () => {
    render(<Controls {...defaultProps} />);

    expect(screen.getByText('Zoom In')).toBeInTheDocument();
    expect(screen.getByText('Zoom Out')).toBeInTheDocument();
    expect(screen.getByText('Reset View')).toBeInTheDocument();
    expect(screen.getByText('Fullscreen')).toBeInTheDocument();
  });

  it('renders fullscreen button text correctly', () => {
    const { rerender } = render(<Controls {...defaultProps} />);

    expect(screen.getByText('Fullscreen')).toBeInTheDocument();

    rerender(<Controls {...defaultProps} isFullscreen={true} />);
    expect(screen.getByText('Exit Fullscreen')).toBeInTheDocument();
  });

  it('calls zoom callbacks when buttons are clicked', () => {
    render(<Controls {...defaultProps} />);

    fireEvent.click(screen.getByText('Zoom In'));
    expect(defaultProps.onZoomIn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Zoom Out'));
    expect(defaultProps.onZoomOut).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Reset View'));
    expect(defaultProps.onReset).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Fullscreen'));
    expect(defaultProps.onFullscreen).toHaveBeenCalledTimes(1);
  });

  it('renders connection weight controls', () => {
    render(<Controls {...defaultProps} />);

    expect(screen.getByText('Reference')).toBeInTheDocument();
    expect(screen.getByText('Filesystem')).toBeInTheDocument();
    expect(screen.getByText('Semantic')).toBeInTheDocument();

    // Check for percentage displays
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('calls weight change callbacks when sliders are moved', () => {
    render(<Controls {...defaultProps} />);

    const referenceSlider = screen.getAllByRole('slider')[0];
    const filesystemSlider = screen.getAllByRole('slider')[1];
    const semanticSlider = screen.getAllByRole('slider')[2];

    fireEvent.change(referenceSlider, { target: { value: '75' } });
    expect(defaultProps.onReferenceWeightChange).toHaveBeenCalledWith(75);

    fireEvent.change(filesystemSlider, { target: { value: '40' } });
    expect(defaultProps.onFilesystemWeightChange).toHaveBeenCalledWith(40);

    fireEvent.change(semanticSlider, { target: { value: '60' } });
    expect(defaultProps.onSemanticWeightChange).toHaveBeenCalledWith(60);
  });

  it('renders node sizing controls', () => {
    render(<Controls {...defaultProps} />);

    expect(screen.getByText('Node Sizing Factors')).toBeInTheDocument();
    expect(screen.getByText('File Size')).toBeInTheDocument();
    expect(screen.getByText('Commit Count')).toBeInTheDocument();
    expect(screen.getByText('Recency')).toBeInTheDocument();
    expect(screen.getByText('Identifiers')).toBeInTheDocument();
    expect(screen.getByText('Incoming Refs')).toBeInTheDocument();
  });

  it('calls node sizing weight change callbacks', () => {
    render(<Controls {...defaultProps} />);

    const sliders = screen.getAllByRole('slider');

    // File size weight (4th slider - after 3 connection weight sliders)
    fireEvent.change(sliders[3], { target: { value: '80' } });
    expect(defaultProps.onFileSizeWeightChange).toHaveBeenCalledWith(80);

    // Commit count weight (5th slider)
    fireEvent.change(sliders[4], { target: { value: '25' } });
    expect(defaultProps.onCommitCountWeightChange).toHaveBeenCalledWith(25);

    // Recency weight (6th slider)
    fireEvent.change(sliders[5], { target: { value: '15' } });
    expect(defaultProps.onRecencyWeightChange).toHaveBeenCalledWith(15);

    // Identifiers weight (7th slider)
    fireEvent.change(sliders[6], { target: { value: '35' } });
    expect(defaultProps.onIdentifiersWeightChange).toHaveBeenCalledWith(35);

    // References weight (8th slider)
    fireEvent.change(sliders[7], { target: { value: '45' } });
    expect(defaultProps.onReferencesWeightChange).toHaveBeenCalledWith(45);
  });

  it('displays correct percentage values for node sizing weights', () => {
    render(<Controls {...defaultProps} />);

    expect(screen.getByText('100%')).toBeInTheDocument(); // File size weight
    expect(screen.getAllByText('0%')).toHaveLength(4); // Other weights are 0
  });

  it('has correct slider ranges and values', () => {
    render(<Controls {...defaultProps} />);

    const sliders = screen.getAllByRole('slider');

    sliders.forEach(slider => {
      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', '100');
      expect(slider).toHaveAttribute('type', 'range');
    });

    // Check specific values
    expect(sliders[0]).toHaveValue('50'); // Reference weight
    expect(sliders[1]).toHaveValue('30'); // Filesystem weight
    expect(sliders[2]).toHaveValue('20'); // Semantic weight
    expect(sliders[3]).toHaveValue('100'); // File size weight
    expect(sliders[4]).toHaveValue('0'); // Commit count weight
  });

  it('applies correct CSS classes', () => {
    render(<Controls {...defaultProps} />);

    const buttons = screen.getAllByRole('button');

    buttons.forEach(button => {
      expect(button).toHaveClass('bg-blue-600', 'text-white', 'hover:bg-blue-700');
    });
  });

  it('handles edge case values', () => {
    const edgeProps = {
      ...defaultProps,
      referenceWeight: 0,
      filesystemWeight: 100,
      semanticWeight: 0,
      fileSizeWeight: 0,
      commitCountWeight: 100,
    };

    render(<Controls {...edgeProps} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    const sliders = screen.getAllByRole('slider');
    expect(sliders[0]).toHaveValue('0'); // Reference weight
    expect(sliders[1]).toHaveValue('100'); // Filesystem weight
    expect(sliders[3]).toHaveValue('0'); // File size weight
    expect(sliders[4]).toHaveValue('100'); // Commit count weight
  });
});
