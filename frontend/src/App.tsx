import React, { useState, useRef, useEffect } from 'react';
import { RepositoryData } from './types/schema';
import FileUpload from './components/FileUpload';
import RepositoryGraph, { RepositoryGraphHandle } from './components/Visualization/RepositoryGraph';
import FileDetails from './components/FileDetails';
import DraggableControls from './components/DraggableControls';
import FloatingNodeSizing from './components/FloatingNodeSizing';
import MenuDropdown from './components/MenuDropdown';

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

  // Menu visibility state
  const [showConnectionWeights, setShowConnectionWeights] = useState(true);
  const [showNodeSizing, setShowNodeSizing] = useState(true);

  // Node sizing weights
  const [fileSizeWeight, setFileSizeWeight] = useState(100);
  const [commitCountWeight, setCommitCountWeight] = useState(0);
  const [recencyWeight, setRecencyWeight] = useState(0);
  const [identifiersWeight, setIdentifiersWeight] = useState(0);
  const [referencesWeight, setReferencesWeight] = useState(0);

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
      } catch (error) {
        console.log('Failed to auto-load repo_data.json:', error);
      }

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

  // Node sizing weight handlers
  const handleFileSizeWeightChange = (weight: number) => {
    setFileSizeWeight(weight);
  };

  const handleCommitCountWeightChange = (weight: number) => {
    setCommitCountWeight(weight);
  };

  const handleRecencyWeightChange = (weight: number) => {
    setRecencyWeight(weight);
  };

  const handleIdentifiersWeightChange = (weight: number) => {
    setIdentifiersWeight(weight);
  };

  const handleReferencesWeightChange = (weight: number) => {
    setReferencesWeight(weight);
  };

  // Menu visibility handlers
  const handleCloseConnectionWeights = () => {
    setShowConnectionWeights(false);
  };

  const handleCloseNodeSizing = () => {
    setShowNodeSizing(false);
  };

  const handleOpenConnectionWeights = () => {
    setShowConnectionWeights(true);
  };

  const handleOpenNodeSizing = () => {
    setShowNodeSizing(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Repo Visualizer</h1>
              <p className="text-sm text-gray-500">
                Visualize your repository structure interactively
              </p>
            </div>

            {repositoryData && (
              <div className="flex items-center gap-4">
                {/* Navigation Controls */}
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                  <button
                    onClick={handleZoomIn}
                    className="flex items-center justify-center w-10 h-10 rounded-md bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors shadow-sm"
                    title="Zoom In"
                  >
                    <span className="text-lg font-bold">+</span>
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="flex items-center justify-center w-10 h-10 rounded-md bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors shadow-sm"
                    title="Zoom Out"
                  >
                    <span className="text-lg font-bold">−</span>
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center justify-center w-10 h-10 rounded-md bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors shadow-sm"
                    title="Reset View"
                  >
                    <span className="text-base font-bold">⌂</span>
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="flex items-center justify-center w-10 h-10 rounded-md bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors shadow-sm"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    <span className="text-base font-bold">{isFullscreen ? '⇱' : '⛶'}</span>
                  </button>
                </div>

                {/* Menu Controls */}
                <MenuDropdown
                  showConnectionWeights={showConnectionWeights}
                  showNodeSizing={showNodeSizing}
                  onOpenConnectionWeights={handleOpenConnectionWeights}
                  onOpenNodeSizing={handleOpenNodeSizing}
                />
              </div>
            )}
          </div>
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
              className={`flex-1 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}
            >
              <div
                className="flex-1 min-h-0 relative"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <RepositoryGraph
                  ref={graphRef}
                  data={getCurrentData() || repositoryData}
                  onSelectFile={handleFileSelect}
                  selectedFile={selectedFile}
                  referenceWeight={referenceWeight}
                  filesystemWeight={filesystemWeight}
                  semanticWeight={semanticWeight}
                  fileSizeWeight={fileSizeWeight}
                  commitCountWeight={commitCountWeight}
                  recencyWeight={recencyWeight}
                  identifiersWeight={identifiersWeight}
                  referencesWeight={referencesWeight}
                />

                {/* Floating Menus */}
                {showConnectionWeights && (
                  <DraggableControls
                    referenceWeight={referenceWeight}
                    filesystemWeight={filesystemWeight}
                    semanticWeight={semanticWeight}
                    onReferenceWeightChange={handleReferenceWeightChange}
                    onFilesystemWeightChange={handleFilesystemWeightChange}
                    onSemanticWeightChange={handleSemanticWeightChange}
                    onClose={handleCloseConnectionWeights}
                  />
                )}
              </div>

              {showNodeSizing && (
                <FloatingNodeSizing
                  fileSizeWeight={fileSizeWeight}
                  commitCountWeight={commitCountWeight}
                  recencyWeight={recencyWeight}
                  identifiersWeight={identifiersWeight}
                  referencesWeight={referencesWeight}
                  onFileSizeWeightChange={handleFileSizeWeightChange}
                  onCommitCountWeightChange={handleCommitCountWeightChange}
                  onRecencyWeightChange={handleRecencyWeightChange}
                  onIdentifiersWeightChange={handleIdentifiersWeightChange}
                  onReferencesWeightChange={handleReferencesWeightChange}
                  onClose={handleCloseNodeSizing}
                />
              )}

              {/* Timeline Controls */}
              {repositoryData?.history?.timelinePoints &&
                repositoryData.history.timelinePoints.length > 0 && (
                  <div className="flex-shrink-0 bg-white border-t p-4">
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-medium text-gray-700 text-center">
                        Repository Timeline
                      </h3>

                      {/* Play Controls */}
                      <div className="flex justify-center gap-2 items-center">
                        <button
                          onClick={handlePlayPause}
                          className="bg-green-600 text-white py-1 px-3 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          {isPlaying ? 'Pause' : 'Play'}
                        </button>

                        <select
                          value={playbackSpeed}
                          onChange={e => handlePlaybackSpeedChange(Number(e.target.value))}
                          className="bg-gray-100 border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value={0.5}>0.5x</option>
                          <option value={1}>1x</option>
                          <option value={2}>2x</option>
                          <option value={3}>3x</option>
                        </select>

                        <button
                          onClick={() => handleTimelineChange(-1)}
                          disabled={currentTimelineIndex === -1}
                          className="bg-gray-600 text-white py-1 px-3 rounded text-sm hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Current
                        </button>
                      </div>

                      {/* Timeline Scrubber */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">First</span>
                        <input
                          type="range"
                          min={0}
                          max={repositoryData.history.timelinePoints.length - 1}
                          value={
                            currentTimelineIndex === -1
                              ? repositoryData.history.timelinePoints.length - 1
                              : currentTimelineIndex
                          }
                          onChange={e => handleTimelineChange(Number(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-gray-500">Latest</span>
                      </div>

                      {/* Timeline Info */}
                      <div className="text-center text-xs text-gray-600">
                        {currentTimelineIndex === -1 ? (
                          <span>Current State</span>
                        ) : getCurrentTimelineInfo() ? (
                          <div className="flex flex-col gap-1">
                            <span>
                              Commit {currentTimelineIndex + 1} of{' '}
                              {repositoryData.history.timelinePoints.length}
                            </span>
                            <span className="font-mono text-xs">
                              {getCurrentTimelineInfo()?.message?.substring(0, 50)}
                              {getCurrentTimelineInfo()?.message?.length > 50 ? '...' : ''}
                            </span>
                            <span className="text-gray-500">
                              {getCurrentTimelineInfo()?.author} •{' '}
                              {getCurrentTimelineInfo()?.timestamp
                                ? new Date(getCurrentTimelineInfo()?.timestamp).toLocaleDateString()
                                : ''}
                            </span>
                          </div>
                        ) : (
                          <span>
                            Timeline point {currentTimelineIndex + 1} of{' '}
                            {repositoryData.history.timelinePoints.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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
