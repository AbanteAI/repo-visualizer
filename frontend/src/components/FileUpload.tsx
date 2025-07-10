import React, { useRef, useState, useEffect } from 'react';
import { RepositoryData } from '../types/schema';

interface FileUploadProps {
  onDataLoaded: (data: RepositoryData) => void;
  onLoadExample: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, onLoadExample }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedServerFile, setSelectedServerFile] = useState<string>('');
  const [serverFiles, setServerFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch list of server files on component mount
    fetchServerFiles();
  }, []);

  const fetchServerFiles = async () => {
    try {
      // Try to fetch known files and see which ones exist
      const knownFiles = ['repo_data.json'];
      const availableFiles: string[] = [];

      for (const file of knownFiles) {
        try {
          const response = await fetch(`/data/${file}`, { method: 'HEAD' });
          if (response.ok) {
            availableFiles.push(file);
          }
        } catch (err) {
          console.warn(`File ${file} not accessible:`, err);
        }
      }

      setServerFiles(availableFiles);
    } catch (err) {
      console.warn('Could not fetch server files:', err);
      // Fallback to assume the file exists
      setServerFiles(['repo_data.json']);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setSelectedServerFile(''); // Clear server file selection
    setError(null);
  };

  const handleServerFileChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedServerFile(event.target.value);
    setSelectedFile(null); // Clear local file selection
    setError(null);
  };

  const handleVisualize = async () => {
    if (!selectedFile && !selectedServerFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let fileContent: string;

      if (selectedFile) {
        // Load from uploaded file
        fileContent = await readFileContent(selectedFile);
      } else if (selectedServerFile) {
        // Load from server file
        const response = await fetch(`/data/${selectedServerFile}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch server file: ${response.statusText}`);
        }
        fileContent = await response.text();
      } else {
        throw new Error('No file selected');
      }

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
      <h2 className="text-lg font-medium mb-6">Load Repository Data</h2>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Upload from Computer */}
        <div className="border rounded-lg p-4">
          <h3 className="text-md font-medium mb-3">Upload from Computer</h3>
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

        {/* Select from Server */}
        <div className="border rounded-lg p-4">
          <h3 className="text-md font-medium mb-3">Select from Server</h3>
          <select
            value={selectedServerFile}
            onChange={handleServerFileChange}
            className="w-full p-2 border rounded shadow"
          >
            <option value="">Select a file...</option>
            {serverFiles.map(file => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
          <div className="mt-2 text-sm text-gray-600 italic">
            {selectedServerFile ? `Selected: ${selectedServerFile}` : 'No file selected'}
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="flex justify-center gap-4">
        <button
          onClick={handleVisualize}
          disabled={(!selectedFile && !selectedServerFile) || loading}
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
