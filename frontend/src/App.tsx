import React, { useState, useRef, useEffect } from 'react';
import { RepositoryData } from './types/schema';
import FileUpload from './components/FileUpload';
import RepositoryGraph, { RepositoryGraphHandle } from './components/Visualization/RepositoryGraph';
import FileDetails from './components/FileDetails';
import DraggableControls from './components/DraggableControls';
import FloatingNodeSizing from './components/FloatingNodeSizing';

// Import the example data for demonstration purposes
import { exampleData } from './utils/exampleData';

const App: React.FC = () => {
  const [repositoryData, setRepositoryData] = useState<RepositoryData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
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
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {repositoryData
                    ? repositoryData.metadata.repoName.replace(/_/g, '/')
                    : 'Repo Visualizer'}
                </h1>
                <p className="text-sm text-gray-500">
                  Visualize your repository structure interactively
                </p>
              </div>

              {repositoryData && repositoryData.metadata.description && (
                <div className="flex items-center gap-2">
                  {repositoryData.metadata.description.includes('github.com') && (
                    <a
                      href={repositoryData.metadata.description
                        .replace('Git repository at ', '')
                        .replace(/\.git$/, '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center text-black hover:text-gray-600 transition-colors"
                      title="View on GitHub"
                    >
                      <svg
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        style={{
                          width: '12px',
                          height: '12px',
                          minWidth: '12px',
                          minHeight: '12px',
                          maxWidth: '12px',
                          maxHeight: '12px',
                        }}
                      >
                        <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </div>

            {repositoryData && (
              <div className="flex items-center gap-4">
                {/* Navigation Controls */}
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                  <button
                    onClick={handleReset}
                    className="flex items-center justify-center w-10 h-10 rounded-md bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors shadow-sm"
                    title="Reset View"
                  >
                    <span className="text-base font-bold">⌂</span>
                  </button>
                </div>

                {/* Menu Controls */}
                <div className="flex items-center gap-2">
                  {!showConnectionWeights && (
                    <button
                      onClick={handleOpenConnectionWeights}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 text-gray-700 hover:text-gray-900"
                      title="Connection Weights"
                    >
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">Connections</span>
                    </button>
                  )}

                  {!showNodeSizing && (
                    <button
                      onClick={handleOpenNodeSizing}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 text-gray-700 hover:text-gray-900"
                      title="Node Sizing"
                    >
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">Node Size</span>
                    </button>
                  )}
                </div>
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
            <div className="flex-1 flex flex-col">
              <div
                className="flex-1 min-h-0 relative"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <RepositoryGraph
                  ref={graphRef}
                  data={repositoryData}
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
