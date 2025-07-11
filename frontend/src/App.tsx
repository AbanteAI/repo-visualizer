import React, { useState, useRef } from 'react';
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
  const graphRef = useRef<RepositoryGraphHandle>(null);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Repo Visualizer</h1>
          <p className="text-sm text-gray-500">Visualize your repository structure interactively</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {!repositoryData ? (
          <div className="bg-white shadow sm:rounded-lg p-6">
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
              />

              <Controls
                onZoomIn={() => graphRef.current?.zoomIn()}
                onZoomOut={() => graphRef.current?.zoomOut()}
                onReset={() => graphRef.current?.resetView()}
                onFullscreen={toggleFullscreen}
                isFullscreen={isFullscreen}
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
