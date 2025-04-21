import React, { useRef, useState } from 'react';
import { RepositoryData } from '../types/schema';

interface FileUploadProps {
  onDataLoaded: (data: RepositoryData) => void;
  onLoadExample: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, onLoadExample }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError(null);
  };

  const handleVisualize = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fileContent = await readFileContent(selectedFile);
      const jsonData = JSON.parse(fileContent);

      // Basic validation
      if (
        !jsonData.metadata ||
        !Array.isArray(jsonData.files) ||
        !Array.isArray(jsonData.relationships)
      ) {
        setError(
          'Invalid repository data format. The file should contain metadata, files, and relationships arrays.'
        );
        setLoading(false);
        return;
      }

      onDataLoaded(jsonData);
    } catch (err) {
      console.error('Error processing file:', err);
      setError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = e => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  return (
    <div className="text-center">
      <h2 className="text-lg font-medium mb-4">Upload Repository JSON</h2>

      <div className="mb-6">
        <input
          type="file"
          id="file-input"
          ref={fileInputRef}
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
        <label
          htmlFor="file-input"
          className="inline-block bg-blue-600 text-white py-2 px-4 rounded shadow cursor-pointer hover:bg-blue-700 transition-colors"
        >
          Choose File
        </label>
        <div className="mt-2 text-sm text-gray-600 italic">
          {selectedFile ? selectedFile.name : 'No file selected'}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="flex justify-center gap-4">
        <button
          onClick={handleVisualize}
          disabled={!selectedFile || loading}
          className="bg-green-600 text-white py-2 px-4 rounded shadow disabled:bg-gray-400 hover:bg-green-700 transition-colors"
        >
          {loading ? 'Processing...' : 'Visualize Repository'}
        </button>

        <button
          onClick={onLoadExample}
          className="bg-gray-600 text-white py-2 px-4 rounded shadow hover:bg-gray-700 transition-colors"
        >
          Load Example Data
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
