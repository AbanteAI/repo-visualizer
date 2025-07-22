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

  const handleConfigChange = (newConfig: VisualizationConfig) => {
    setConfig(newConfig);
  };

  const handleToggleControls = () => {
    setShowControls(!showControls);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <header
        style={{
          backgroundColor: 'white',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        }}
      >
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#111827',
                    margin: 0,
                  }}
                >
                  {repositoryData
                    ? repositoryData.metadata.repoName.replace(/_/g, '/')
                    : 'Repo Visualizer'}
                </h1>

                {repositoryData &&
                  repositoryData.metadata.description &&
                  repositoryData.metadata.description.includes('github.com') && (
                    <a
                      href={repositoryData.metadata.description
                        .replace('Git repository at ', '')
                        .replace(/\.git$/, '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        textDecoration: 'none',
                      }}
                      title="View on GitHub"
                    >
                      <svg
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        style={{
                          width: '16px',
                          height: '16px',
                        }}
                      >
                        <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                      </svg>
                    </a>
                  )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem 2rem' }}>
        {isAutoLoading ? (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                border: '2px solid #e5e7eb',
                borderTop: '2px solid #2563eb',
                borderRadius: '50%',
                margin: '0 auto 1rem',
                animation: 'spin 1s linear infinite',
              }}
            ></div>
            <p style={{ color: '#6b7280' }}>Loading repository data...</p>
          </div>
        ) : !repositoryData ? (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            }}
          >
            {autoLoadFailed && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  borderRadius: '6px',
                }}
              >
                Could not auto-load repo_data.json. Please select a file manually.
              </div>
            )}
            <FileUpload onDataLoaded={handleDataLoaded} onLoadExample={handleLoadExample} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                  position: 'relative',
                }}
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

                {/* Controls Toggle Button - positioned on canvas */}
                {repositoryData && (
                  <button
                    onClick={handleToggleControls}
                    style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '20px',
                      color: '#666',
                      cursor: 'pointer',
                      zIndex: 10,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.border = '1px solid #d1d5db';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.border = 'none';
                    }}
                    aria-label="Toggle controls"
                  >
                    ⚙
                  </button>
                )}

                {/* Visualization Controls - show for both regular and history views */}
                {showControls && (
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

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default App;
