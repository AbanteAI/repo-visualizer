import React from 'react';
import { RepositoryData, File } from '../types/schema';

interface FileDetailsProps {
  fileId: string;
  data: RepositoryData;
  onClose: () => void;
}

const FileDetails: React.FC<FileDetailsProps> = ({ fileId, data, onClose }) => {
  // Find the file by ID
  const file = data.files.find(f => f.id === fileId);

  if (!file) {
    return null;
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 bytes';

    const units = ['bytes', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;

    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }

    return `${size.toFixed(1)} ${units[i]}`;
  };

  // Render a component and its children
  const renderComponent = (component: any, depth = 0) => {
    return (
      <div key={component.id} className="ml-4">
        <div className="font-medium text-gray-800 text-sm">
          {component.name} <span className="text-gray-500 text-xs">({component.type})</span>
        </div>
        {component.lineStart && component.lineEnd && (
          <div className="text-xs text-gray-600 mb-1">
            Lines {component.lineStart}-{component.lineEnd}
          </div>
        )}
        {component.components && component.components.length > 0 && (
          <div className="ml-4 mt-2 border-l-2 border-gray-200 pl-2 space-y-1">
            {component.components.map((subComp: any) => renderComponent(subComp, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="absolute z-10"
      style={{
        position: 'absolute',
        right: '20px',
        top: '20px',
        width: '320px',
        maxHeight: '80vh',
        overflowY: 'auto',
        pointerEvents: 'auto',
        transform: 'translate3d(0, 0, 0)',
        userSelect: 'none',
        backgroundColor: 'white',
        border: '2px solid #e5e7eb',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        padding: '20px',
      }}
    >
      {/* Close button positioned absolutely in top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-red-50 border border-gray-200 text-gray-400 hover:text-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
        style={{ cursor: 'pointer' }}
        aria-label="Close"
      >
        <span className="text-lg font-bold">×</span>
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pr-12">
        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <h3 className="text-xl font-bold text-gray-900 border-b-2 border-green-500 pb-1">
          File Details
        </h3>
      </div>

      <div className="border-b border-gray-200 pb-4 mb-4">
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium text-gray-800">Path:</span> {file.path}
        </p>
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium text-gray-800">Type:</span> {file.type}
        </p>

        {file.type === 'file' && (
          <>
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-medium text-gray-800">Size:</span> {formatFileSize(file.size)}
            </p>
            {file.extension && (
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium text-gray-800">Extension:</span> .{file.extension}
              </p>
            )}
          </>
        )}

        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium text-gray-800">Depth:</span> {file.depth}
        </p>

        {file.metrics && (
          <div className="mt-2">
            <p className="font-medium text-gray-800 mb-2">Metrics:</p>
            <div className="ml-4 space-y-1">
              {file.metrics.linesOfCode && (
                <p className="text-sm text-gray-600">Lines of code: {file.metrics.linesOfCode}</p>
              )}
              {file.metrics.commentLines && (
                <p className="text-sm text-gray-600">Comment lines: {file.metrics.commentLines}</p>
              )}
              {file.metrics.emptyLines && (
                <p className="text-sm text-gray-600">Empty lines: {file.metrics.emptyLines}</p>
              )}
              {file.metrics.complexity && (
                <p className="text-sm text-gray-600">Complexity: {file.metrics.complexity}</p>
              )}
              {file.metrics.topLevelIdentifiers && (
                <p className="text-sm text-gray-600">
                  Top-level identifiers: {file.metrics.topLevelIdentifiers}
                </p>
              )}
              {file.metrics.commitCount && (
                <p className="text-sm text-gray-600">Commit count: {file.metrics.commitCount}</p>
              )}
              {file.metrics.lastCommitDaysAgo !== undefined && (
                <p className="text-sm text-gray-600">
                  Last commit: {file.metrics.lastCommitDaysAgo} days ago
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* References section */}
      {(() => {
        const incomingRefs = data.relationships.filter(rel => rel.target === fileId);
        const outgoingRefs = data.relationships.filter(rel => rel.source === fileId);

        return (
          (incomingRefs.length > 0 || outgoingRefs.length > 0) && (
            <div className="border-b border-gray-200 pb-4 mb-4">
              <p className="font-medium text-gray-800 mb-3">References:</p>

              {/* Incoming references */}
              {incomingRefs.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Incoming ({incomingRefs.reduce((sum, ref) => sum + (ref.strength || 1), 0)}{' '}
                    total):
                  </p>
                  <div className="ml-4 space-y-1 max-h-32 overflow-y-auto">
                    {incomingRefs.map((rel, idx) => {
                      const sourceFile = data.files.find(f => f.id === rel.source);
                      const refCount = rel.strength || 1;
                      const refText = refCount > 1 ? `${refCount} refs` : '1 ref';
                      return (
                        <p key={idx} className="text-xs text-gray-600">
                          <span className="text-blue-600">{sourceFile?.name || rel.source}</span>
                          <span className="text-gray-500 ml-1">
                            ({rel.type}, {refText})
                          </span>
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Outgoing references */}
              {outgoingRefs.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Outgoing ({outgoingRefs.reduce((sum, ref) => sum + (ref.strength || 1), 0)}{' '}
                    total):
                  </p>
                  <div className="ml-4 space-y-1 max-h-32 overflow-y-auto">
                    {outgoingRefs.map((rel, idx) => {
                      const targetFile = data.files.find(f => f.id === rel.target);
                      const refCount = rel.strength || 1;
                      const refText = refCount > 1 ? `${refCount} refs` : '1 ref';
                      return (
                        <p key={idx} className="text-xs text-gray-600">
                          <span className="text-green-600">{targetFile?.name || rel.target}</span>
                          <span className="text-gray-500 ml-1">
                            ({rel.type}, {refText})
                          </span>
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        );
      })()}

      {file.components && file.components.length > 0 && (
        <div>
          <p className="font-medium text-gray-800 mb-3">Components:</p>
          <div className="space-y-2">
            {file.components.map(component => renderComponent(component))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDetails;
