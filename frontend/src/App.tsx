import React, { useState, useRef, useEffect } from 'react';
import { RepositoryData } from './types/schema';
import FileUpload from './components/FileUpload';
import RepositoryGraph, { RepositoryGraphHandle } from './components/Visualization/RepositoryGraph';
import Controls from './components/Controls';
import FileDetails from './components/FileDetails';

// Import the example data for demonstration purposes
import { exampleData } from './utils/exampleData';

const App: React.FC = () => {
  const [repositoryData, setRepositoryData] = useState<RepositoryData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [referenceWeight, setReferenceWeight] = useState(70);
  const [filesystemWeight, setFilesystemWeight] = useState(30);
  const [semanticWeight, setSemanticWeight] = useState(30);
  const [isAutoLoading, setIsAutoLoading] = useState(true);
  const [autoLoadFailed, setAutoLoadFailed] = useState(false);
  const graphRef = useRef<RepositoryGraphHandle | null>(null);

  // Timeline state
  const [currentTimelineIndex, setCurrentTimelineIndex] = useState<number>(-1); // -1 means current state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 3x speed
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-load repo_data.json on component mount
  useEffect(() => {
    const autoLoadRepoData = async () => {
      try {
        const response = await fetch('/repo_data.json');
        if (response.ok) {
          const fileContent = await response.text();
          const jsonData = JSON.parse(fileContent);

          // Basic validation
          if (
            jsonData.metadata &&
            Array.isArray(jsonData.files) &&
            Array.isArray(jsonData.relationships)
          ) {
            setRepositoryData(jsonData);
            setSelectedFile(null);
            setIsAutoLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not auto-load repo_data.json:', err);
      }

      // Auto-load failed, show file upload interface
      setAutoLoadFailed(true);
      setIsAutoLoading(false);
    };

    autoLoadRepoData();
  }, []);

  const handleDataLoaded = (data: RepositoryData) => {
    setRepositoryData(data);
    setSelectedFile(null);
    // Reset timeline to current state when new data is loaded
    setCurrentTimelineIndex(-1);
    setIsPlaying(false);
  };

  const handleFileSelect = (fileId: string | null) => {
    setSelectedFile(fileId);
  };

  const handleCloseFileDetails = () => {
    setSelectedFile(null);
  };

  const handleLoadExample = () => {
    setRepositoryData(exampleData);
    setSelectedFile(null);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleZoomIn = () => {
    graphRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    graphRef.current?.zoomOut();
  };

  const handleReset = () => {
    graphRef.current?.resetView();
  };

  const handleReferenceWeightChange = (weight: number) => {
    setReferenceWeight(weight);
  };

  const handleFilesystemWeightChange = (weight: number) => {
    setFilesystemWeight(weight);
  };

  const handleSemanticWeightChange = (weight: number) => {
    setSemanticWeight(weight);
  };

  // Timeline control handlers
  const handleTimelineChange = (index: number) => {
    setCurrentTimelineIndex(index);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (!isPlaying) {
      // If starting playback, start from beginning if at current state
      if (currentTimelineIndex === -1) {
        setCurrentTimelineIndex(0);
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  // Get current data based on timeline position
  const getCurrentData = (): RepositoryData | null => {
    if (!repositoryData) return null;

    // If no timeline data or showing current state, return original data
    if (!repositoryData.history?.timelinePoints || currentTimelineIndex === -1) {
      return repositoryData;
    }

    // Get the timeline point
    const timelinePoint = repositoryData.history.timelinePoints[currentTimelineIndex];
    if (!timelinePoint) return repositoryData;

    // Create a modified version of the data with timeline snapshot
    return {
      ...repositoryData,
      files: timelinePoint.snapshot.files || [],
      relationships: timelinePoint.snapshot.relationships || [],
    };
  };

  // Get current timeline info
  const getCurrentTimelineInfo = () => {
    if (!repositoryData?.history?.timelinePoints || currentTimelineIndex === -1) {
      return null;
    }

    const timelinePoint = repositoryData.history.timelinePoints[currentTimelineIndex];
    return timelinePoint?.state || null;
  };

  // Playback effect
  useEffect(() => {
    if (!isPlaying || !repositoryData?.history?.timelinePoints) return;

    const interval = setInterval(() => {
      setCurrentTimelineIndex(prev => {
        const maxIndex = repositoryData.history!.timelinePoints.length - 1;
        if (prev >= maxIndex) {
          setIsPlaying(false);
          return maxIndex;
        }
        return prev + 1;
      });
    }, 2000 / playbackSpeed); // Base speed: 2 seconds per commit

    playbackIntervalRef.current = interval;

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, repositoryData]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Repo Visualizer</h1>
          <p className="text-sm text-gray-500">Visualize your repository structure interactively</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {isAutoLoading ? (
          <div className="bg-white shadow sm:rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading repository data...</p>
          </div>
        ) : !repositoryData ? (
          <div className="bg-white shadow sm:rounded-lg p-6">
            {autoLoadFailed && (
              <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded">
                Could not auto-load repo_data.json. Please select a file manually.
              </div>
            )}
            <FileUpload onDataLoaded={handleDataLoaded} onLoadExample={handleLoadExample} />
          </div>
        ) : (
          <>
            <div className="bg-white shadow sm:rounded-lg mb-6 p-4 text-center">
              <h2 className="text-lg font-semibold">
                {repositoryData.metadata.repoName}
                {repositoryData.metadata.description && ` - ${repositoryData.metadata.description}`}
              </h2>
            </div>

            <div
              className={`bg-white shadow sm:rounded-lg relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
            >
              <RepositoryGraph
                ref={graphRef}
                data={getCurrentData() || repositoryData}
                onSelectFile={handleFileSelect}
                selectedFile={selectedFile}
                referenceWeight={referenceWeight}
                filesystemWeight={filesystemWeight}
                semanticWeight={semanticWeight}
              />

              <Controls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleReset}
                onFullscreen={toggleFullscreen}
                isFullscreen={isFullscreen}
                referenceWeight={referenceWeight}
                filesystemWeight={filesystemWeight}
                semanticWeight={semanticWeight}
                onReferenceWeightChange={handleReferenceWeightChange}
                onFilesystemWeightChange={handleFilesystemWeightChange}
                onSemanticWeightChange={handleSemanticWeightChange}
                timelinePoints={repositoryData?.history?.timelinePoints || []}
                currentTimelineIndex={currentTimelineIndex}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                onTimelineChange={handleTimelineChange}
                onPlayPause={handlePlayPause}
                onPlaybackSpeedChange={handlePlaybackSpeedChange}
                timelineInfo={getCurrentTimelineInfo()}
              />

              {selectedFile && (
                <FileDetails
                  fileId={selectedFile}
                  data={getCurrentData() || repositoryData}
                  onClose={handleCloseFileDetails}
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
