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
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-base font-semibold text-gray-800">File Details</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-xl font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100"
          style={{ cursor: 'pointer' }}
        >
          ×
        </button>
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
            </div>
          </div>
        )}
      </div>

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
