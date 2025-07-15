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
  };

  const handleFileSelect = (fileId: string) => {
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
                data={repositoryData}
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
              />

              {selectedFile && (
                <FileDetails
                  fileId={selectedFile}
                  data={repositoryData}
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
