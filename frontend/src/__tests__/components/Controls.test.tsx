import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Controls from '../../components/Controls';

describe('Controls Component', () => {
  const mockZoomIn = jest.fn();
  const mockZoomOut = jest.fn();
  const mockReset = jest.fn();
  const mockFullscreen = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all control buttons', () => {
    render(
      <Controls
        onZoomIn={mockZoomIn}
        onZoomOut={mockZoomOut}
        onReset={mockReset}
        onFullscreen={mockFullscreen}
        isFullscreen={false}
      />
    );

    expect(screen.getByText('Zoom In')).toBeInTheDocument();
    expect(screen.getByText('Zoom Out')).toBeInTheDocument();
    expect(screen.getByText('Reset View')).toBeInTheDocument();
    expect(screen.getByText('Fullscreen')).toBeInTheDocument();
  });

  test('calls zoom in function when zoom in button is clicked', () => {
    render(
      <Controls
        onZoomIn={mockZoomIn}
        onZoomOut={mockZoomOut}
        onReset={mockReset}
        onFullscreen={mockFullscreen}
        isFullscreen={false}
      />
    );

    fireEvent.click(screen.getByText('Zoom In'));
    expect(mockZoomIn).toHaveBeenCalledTimes(1);
  });

  test('calls zoom out function when zoom out button is clicked', () => {
    render(
      <Controls
        onZoomIn={mockZoomIn}
        onZoomOut={mockZoomOut}
        onReset={mockReset}
        onFullscreen={mockFullscreen}
        isFullscreen={false}
      />
    );

    fireEvent.click(screen.getByText('Zoom Out'));
    expect(mockZoomOut).toHaveBeenCalledTimes(1);
  });

  test('calls reset function when reset button is clicked', () => {
    render(
      <Controls
        onZoomIn={mockZoomIn}
        onZoomOut={mockZoomOut}
        onReset={mockReset}
        onFullscreen={mockFullscreen}
        isFullscreen={false}
      />
    );

    fireEvent.click(screen.getByText('Reset View'));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  test('changes button text when in fullscreen mode', () => {
    render(
      <Controls
        onZoomIn={mockZoomIn}
        onZoomOut={mockZoomOut}
        onReset={mockReset}
        onFullscreen={mockFullscreen}
        isFullscreen={true}
      />
    );

    expect(screen.getByText('Exit Fullscreen')).toBeInTheDocument();
  });
});
