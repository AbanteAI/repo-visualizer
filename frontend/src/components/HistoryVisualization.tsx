import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { RepositoryData } from '../types/schema';
import { VisualizationConfig } from '../types/visualization';
import RepositoryGraph, { RepositoryGraphHandle } from './Visualization/RepositoryGraph';
import FloatingHistoryControls from './FloatingHistoryControls';

interface HistoryVisualizationProps {
  data: RepositoryData;
  onSelectFile: (fileId: string | null) => void;
  selectedFile: string | null;
  config: VisualizationConfig;
}

export const HistoryVisualization: React.FC<HistoryVisualizationProps> = ({
  data,
  onSelectFile,
  selectedFile,
  config,
}) => {
  const [currentTimelineIndex, setCurrentTimelineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1000);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showHistoryControls, setShowHistoryControls] = useState(true);
  const [currentBranch, setCurrentBranch] = useState(
    data.metadata.analyzedBranch || data.metadata.defaultBranch || 'main'
  );

  const repositoryGraphRef = React.useRef<RepositoryGraphHandle>(null);
  const animationIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const timelinePoints = data.history?.timelinePoints || [];
  const hasHistory = timelinePoints.length > 0;

  // Create a modified data object with the current timeline point's data
  const currentData = useMemo(() => {
    if (!hasHistory || timelinePoints.length === 0) {
      return data;
    }

    const currentPoint = timelinePoints[currentTimelineIndex];
    if (!currentPoint) {
      return data;
    }

    // Create a new data object with the timeline snapshot
    return {
      ...data,
      files: currentPoint.snapshot.files,
      relationships: currentPoint.snapshot.relationships,
    };
  }, [data, timelinePoints, currentTimelineIndex, hasHistory]);

  // Handle timeline index changes with smooth transitions
  const handleTimelineChange = useCallback(
    (newIndex: number) => {
      if (newIndex < 0 || newIndex >= timelinePoints.length) return;

      if (newIndex !== currentTimelineIndex) {
        setIsTransitioning(true);
        setCurrentTimelineIndex(newIndex);

        // Clear transition flag after a short delay
        setTimeout(() => setIsTransitioning(false), 300);
      }
    },
    [currentTimelineIndex, timelinePoints.length]
  );

  // Animation control functions
  const handlePlay = useCallback(() => {
    if (currentTimelineIndex >= timelinePoints.length - 1) {
      // If at the end, restart from beginning
      setCurrentTimelineIndex(0);
    }
    setIsPlaying(true);
  }, [currentTimelineIndex, timelinePoints.length]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setAnimationSpeed(speed);
  }, []);

  const handleBranchChange = useCallback((branch: string) => {
    console.log('Branch change requested:', branch);
    setCurrentBranch(branch);
    // TODO: Implement branch switching by re-running analyzer
  }, []);

  // Animation effect
  useEffect(() => {
    if (isPlaying && timelinePoints.length > 1) {
      animationIntervalRef.current = setInterval(() => {
        setCurrentTimelineIndex(prevIndex => {
          if (prevIndex >= timelinePoints.length - 1) {
            // Animation complete, stop playing
            setIsPlaying(false);
            return prevIndex;
          }
          return prevIndex + 1;
        });
      }, animationSpeed);
    } else {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    }

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, [isPlaying, animationSpeed, timelinePoints.length]);

  // Stop animation when component unmounts
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, []);

  // Reset timeline when data changes
  useEffect(() => {
    setCurrentTimelineIndex(0);
    setIsPlaying(false);
  }, [data]);

  // Expose graph controls through imperative handle would be nice,
  // but for now we'll just pass through the ref

  const graphProps = {
    data: currentData,
    onSelectFile,
    selectedFile,
    config: {
      ...config,
      // Add transition effects during timeline changes
      enableTransitions: isTransitioning,
    },
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex-1 relative">
          {/* Add a subtle overlay during transitions */}
          {isTransitioning && (
            <div className="absolute inset-0 bg-white bg-opacity-10 z-10 pointer-events-none transition-opacity duration-300" />
          )}

          <RepositoryGraph ref={repositoryGraphRef} {...graphProps} />

          {/* Timeline indicator overlay */}
          {hasHistory && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-sm font-mono">
              {timelinePoints[currentTimelineIndex]?.commitId.substring(0, 8) || 'Unknown'}
              {isPlaying && <span className="ml-2 animate-pulse">▶</span>}
            </div>
          )}

          {/* History Controls Toggle Button */}
          {hasHistory && !showHistoryControls && (
            <button
              onClick={() => setShowHistoryControls(true)}
              className="absolute bottom-4 left-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm"
              title="Show History Controls"
            >
              🕰️ History Controls
            </button>
          )}
        </div>
      </div>

      {/* Floating History Controls - Render at top level outside of layout */}
      {hasHistory && showHistoryControls && (
        <FloatingHistoryControls
          data={data}
          currentTimelineIndex={currentTimelineIndex}
          onTimelineChange={handleTimelineChange}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          animationSpeed={animationSpeed}
          onSpeedChange={setAnimationSpeed}
          onBranchChange={handleBranchChange}
          currentBranch={currentBranch}
          onClose={() => setShowHistoryControls(false)}
        />
      )}
    </>
  );
};

export default HistoryVisualization;
