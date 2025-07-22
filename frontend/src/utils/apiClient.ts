// API client for backend content operations

const API_BASE_URL = 'http://localhost:3001/api';

export interface FileContentResponse {
  path: string;
  content: string;
  size: number;
  lastModified: string;
}

export interface SearchResult {
  path: string;
  relevance: number;
  contentLength?: number;
  error?: string;
}

export interface SearchContentResponse {
  searchTerm: string;
  searchType: string;
  results: SearchResult[];
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getFileContent(filePath: string): Promise<FileContentResponse> {
    const response = await fetch(
      `${this.baseUrl}/file-content?path=${encodeURIComponent(filePath)}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async searchContent(
    files: string[],
    searchTerm: string,
    searchType: 'keyword' | 'semantic'
  ): Promise<SearchContentResponse> {
    const response = await fetch(`${this.baseUrl}/search-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files,
        searchTerm,
        searchType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async checkHealth(): Promise<{ status: string; timestamp: string; repoRoot: string }> {
    const response = await fetch(`${this.baseUrl}/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: HTTP ${response.status}`);
    }

    return response.json();
  }

  // Check if the backend API is available
  async isAvailable(): Promise<boolean> {
    try {
      await this.checkHealth();
      return true;
    } catch (error) {
      console.warn('Backend API not available:', error);
      return false;
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;
