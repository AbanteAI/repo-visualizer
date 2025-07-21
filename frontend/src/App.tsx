import React, { useState, useRef, useEffect } from 'react';
import { RepositoryData } from './types/schema';
import { VisualizationConfig, DEFAULT_CONFIG } from './types/visualization';
import FileUpload from './components/FileUpload';
import RepositoryGraph, { RepositoryGraphHandle } from './components/Visualization/RepositoryGraph';
import HistoryVisualization from './components/HistoryVisualization';
import FileDetails from './components/FileDetails';
import UnifiedVisualizationControls from './components/UnifiedVisualizationControls';

// Import the example data for demonstration purposes
import { exampleData } from './utils/exampleData';

const App: React.FC = () => {
  const [repositoryData, setRepositoryData] = useState<RepositoryData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoLoading, setIsAutoLoading] = useState(true);
  const [autoLoadFailed, setAutoLoadFailed] = useState(false);
  const [config, setConfig] = useState<VisualizationConfig>(DEFAULT_CONFIG);
  const [showControls, setShowControls] = useState(true);

  const graphRef = useRef<RepositoryGraphHandle | null>(null);

  // Check if repository has history data
  const hasHistory =
    repositoryData?.history?.timelinePoints && repositoryData.history.timelinePoints.length > 0;

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

  const handleConfigChange = (newConfig: VisualizationConfig) => {
    setConfig(newConfig);
  };

  const handleToggleControls = () => {
    setShowControls(!showControls);
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
                <button
                  onClick={handleToggleControls}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 text-gray-600 hover:text-gray-800"
                  aria-label="Toggle controls"
                >
                  <span className="text-lg font-bold">⚙</span>
                </button>
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
                {hasHistory && (
                  <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    History Available
                  </span>
                )}
              </h2>
              {repositoryData.metadata.analyzedBranch && (
                <p className="text-sm text-gray-600 mt-1">
                  Branch: {repositoryData.metadata.analyzedBranch}
                  {repositoryData.metadata.historyRange && (
                    <span className="ml-2">
                      ({repositoryData.metadata.historyRange.sampledCommits} timeline points)
                    </span>
                  )}
                </p>
              )}
            </div>

            <div
              className={`flex-1 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}
            >
              <div
                className="flex-1 min-h-0 relative"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                {hasHistory ? (
                  <HistoryVisualization
                    data={repositoryData}
                    onSelectFile={handleFileSelect}
                    selectedFile={selectedFile}
                    config={config}
                  />
                ) : (
                  <RepositoryGraph
                    ref={graphRef}
                    data={repositoryData}
                    onSelectFile={handleFileSelect}
                    selectedFile={selectedFile}
                    config={config}
                  />
                )}

                {/* Visualization Controls - only show for regular graph view */}
                {!hasHistory && showControls && (
                  <UnifiedVisualizationControls
                    config={config}
                    onConfigChange={handleConfigChange}
                    onClose={() => setShowControls(false)}
                  />
                )}

                {selectedFile && (
                  <FileDetails
                    fileId={selectedFile}
                    data={repositoryData}
                    onClose={handleCloseFileDetails}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
