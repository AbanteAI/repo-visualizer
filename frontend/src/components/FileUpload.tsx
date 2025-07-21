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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchTypes, setSearchTypes] = useState<{ keyword: boolean; semantic: boolean }>({
    keyword: true,
    semantic: false,
  });
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
          // Use GET request since HEAD is not supported by Vite dev server
          const response = await fetch(`/${file}`);
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
    setSearchTerm(''); // Clear search
    setError(null);
  };

  const handleServerFileChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedServerFile(event.target.value);
    setSelectedFile(null); // Clear local file selection
    setSearchTerm(''); // Clear search
    setError(null);
  };

  const handleSearchTermChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setSelectedFile(null); // Clear file selections
    setSelectedServerFile('');
    setError(null);
  };

  const handleSearchTypeChange = (type: 'keyword' | 'semantic', checked: boolean) => {
    setSearchTypes(prev => ({ ...prev, [type]: checked }));
  };

  const handleVisualize = async () => {
    if (!selectedFile && !selectedServerFile && !searchTerm.trim()) {
      setError('Please select a file or enter a search term');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let jsonData: RepositoryData;

      if (selectedFile) {
        // Load from uploaded file
        const fileContent = await readFileContent(selectedFile);
        jsonData = JSON.parse(fileContent);
      } else if (selectedServerFile) {
        // Load from server file
        const response = await fetch(`/${selectedServerFile}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch server file: ${response.statusText}`);
        }
        const fileContent = await response.text();
        jsonData = JSON.parse(fileContent);
      } else if (searchTerm.trim()) {
        // Generate search-based data
        jsonData = await generateSearchData(searchTerm.trim(), searchTypes);
      } else {
        throw new Error('No data source selected');
      }

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

  const generateSearchData = async (
    term: string,
    types: { keyword: boolean; semantic: boolean }
  ): Promise<RepositoryData> => {
    // Generate synthetic repository data based on search term
    const searchFiles = [
      `${term.toLowerCase()}_main.py`,
      `${term.toLowerCase()}_utils.ts`,
      `${term.toLowerCase()}_config.json`,
      `test_${term.toLowerCase()}.py`,
      `${term.toLowerCase()}/index.tsx`,
      `docs/${term.toLowerCase()}.md`,
      `src/${term.toLowerCase()}/core.js`,
      `lib/${term.toLowerCase()}_helper.rb`,
    ].map((path, index) => ({
      id: `search_file_${index}`,
      path,
      name: path.split('/').pop() || path,
      extension: path.split('.').pop() || null,
      size: Math.floor(Math.random() * 10000) + 1000,
      type: 'file' as const,
      depth: path.split('/').length - 1,
      metrics: {
        linesOfCode: Math.floor(Math.random() * 500) + 50,
        commitCount: Math.floor(Math.random() * 20) + 1,
        lastCommitDaysAgo: Math.floor(Math.random() * 30),
        topLevelIdentifiers: Math.floor(Math.random() * 10) + 1,
        custom: {
          keywordRelevance: types.keyword ? calculateKeywordRelevance(path, term) : 0,
          semanticRelevance: types.semantic ? calculateSemanticRelevance(path, term) : 0,
        },
      },
      components: [],
    }));

    const relationships = searchFiles.flatMap((file, i) =>
      searchFiles.slice(i + 1).map((targetFile, j) => ({
        source: file.id,
        target: targetFile.id,
        type: 'import',
        strength: Math.random() * 0.8 + 0.2,
      }))
    );

    return {
      metadata: {
        repoName: `Search Results: "${term}"`,
        description: `Generated repository visualization for search: ${term}`,
        schemaVersion: '1.0.0',
        analysisDate: new Date().toISOString(),
        language: { TypeScript: 40, Python: 30, JavaScript: 20, Markdown: 10 },
      },
      files: searchFiles,
      relationships,
    };
  };

  const calculateKeywordRelevance = (path: string, term: string): number => {
    const lowerPath = path.toLowerCase();
    const lowerTerm = term.toLowerCase();

    if (lowerPath.includes(lowerTerm)) {
      // Exact match gets high score
      return 100;
    }

    // Partial matches get lower scores
    const words = lowerTerm.split(/\s+/);
    const matches = words.filter(word => lowerPath.includes(word)).length;
    return (matches / words.length) * 80;
  };

  const calculateSemanticRelevance = (path: string, term: string): number => {
    // Mock semantic similarity - in real implementation would use embeddings
    const semanticPairs = {
      user: ['auth', 'login', 'profile', 'account'],
      data: ['database', 'model', 'schema', 'store'],
      api: ['endpoint', 'route', 'service', 'client'],
      ui: ['component', 'view', 'render', 'display'],
      test: ['spec', 'mock', 'assert', 'verify'],
    };

    const lowerPath = path.toLowerCase();
    const lowerTerm = term.toLowerCase();

    for (const [concept, related] of Object.entries(semanticPairs)) {
      if (lowerTerm.includes(concept)) {
        for (const relatedWord of related) {
          if (lowerPath.includes(relatedWord)) {
            return Math.random() * 60 + 40; // 40-100 for semantic matches
          }
        }
      }
    }

    return Math.random() * 30; // Low baseline semantic relevance
  };

  return (
    <div className="text-center">
      <h2 className="text-lg font-medium mb-6">Load Repository Data</h2>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
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

        {/* Search */}
        <div className="border rounded-lg p-4">
          <h3 className="text-md font-medium mb-3">Search Repository</h3>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchTermChange}
            placeholder="Enter search term..."
            className="w-full p-2 border rounded shadow mb-3"
          />
          <div className="text-left space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={searchTypes.keyword}
                onChange={e => handleSearchTypeChange('keyword', e.target.checked)}
                className="rounded"
              />
              Keyword matching
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={searchTypes.semantic}
                onChange={e => handleSearchTypeChange('semantic', e.target.checked)}
                className="rounded"
              />
              Semantic matching
            </label>
          </div>
          <div className="mt-2 text-sm text-gray-600 italic">
            {searchTerm ? `Search: "${searchTerm}"` : 'No search term entered'}
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="flex justify-center gap-4">
        <button
          onClick={handleVisualize}
          disabled={
            (!selectedFile && !selectedServerFile && !searchTerm.trim()) ||
            loading ||
            (searchTerm.trim() && !searchTypes.keyword && !searchTypes.semantic)
          }
          className="bg-green-600 text-white py-2 px-4 rounded shadow disabled:bg-gray-400 hover:bg-green-700 transition-colors"
        >
          {loading
            ? 'Processing...'
            : searchTerm.trim()
              ? 'Generate Search Visualization'
              : 'Visualize Repository'}
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
