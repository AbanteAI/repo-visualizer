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
        <div className="font-medium">
          {component.name} <span className="text-gray-500 text-sm">({component.type})</span>
        </div>
        {component.lineStart && component.lineEnd && (
          <div className="text-sm text-gray-600">
            Lines {component.lineStart}-{component.lineEnd}
          </div>
        )}
        {component.components && component.components.length > 0 && (
          <div className="ml-4 mt-2 border-l-2 border-gray-200 pl-2">
            {component.components.map((subComp: any) => renderComponent(subComp, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute top-4 right-4 w-80 max-h-[80vh] overflow-y-auto bg-white shadow-lg rounded-lg p-4 z-10">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold">{file.name}</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          &times;
        </button>
      </div>

      <div className="border-b border-gray-200 pb-2 mb-2">
        <p>
          <span className="font-medium">Path:</span> {file.path}
        </p>
        <p>
          <span className="font-medium">Type:</span> {file.type}
        </p>

        {file.type === 'file' && (
          <>
            <p>
              <span className="font-medium">Size:</span> {formatFileSize(file.size)}
            </p>
            {file.extension && (
              <p>
                <span className="font-medium">Extension:</span> .{file.extension}
              </p>
            )}
          </>
        )}

        <p>
          <span className="font-medium">Depth:</span> {file.depth}
        </p>

        {file.metrics && (
          <div className="mt-2">
            <p className="font-medium">Metrics:</p>
            <div className="ml-4">
              {file.metrics.linesOfCode && <p>Lines of code: {file.metrics.linesOfCode}</p>}
              {file.metrics.commentLines && <p>Comment lines: {file.metrics.commentLines}</p>}
              {file.metrics.emptyLines && <p>Empty lines: {file.metrics.emptyLines}</p>}
              {file.metrics.complexity && <p>Complexity: {file.metrics.complexity}</p>}
            </div>
          </div>
        )}
      </div>

      {file.components && file.components.length > 0 && (
        <div>
          <p className="font-medium mb-2">Components:</p>
          {file.components.map(component => renderComponent(component))}
        </div>
      )}
    </div>
  );
};

export default FileDetails;
