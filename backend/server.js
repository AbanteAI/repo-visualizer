const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Base directory for repository files (parent of backend folder)
const REPO_ROOT = path.resolve(__dirname, '..');

// Helper function to safely resolve file paths within the repository
function safeResolvePath(filePath) {
  const resolved = path.resolve(REPO_ROOT, filePath);
  
  // Security check: ensure the resolved path is within the repository
  if (!resolved.startsWith(REPO_ROOT)) {
    throw new Error('Path outside repository not allowed');
  }
  
  return resolved;
}

// Helper function to check if a file should be readable (exclude sensitive files)
function isReadableFile(filePath) {
  const excluded = [
    '.git',
    'node_modules',
    '.env',
    '*.log',
    '*.tmp',
    'backend/node_modules'
  ];
  
  const normalizedPath = filePath.toLowerCase();
  return !excluded.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(normalizedPath);
    }
    return normalizedPath.includes(pattern);
  });
}

// API Routes

// Get content of a specific file
app.get('/api/file-content', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    if (!isReadableFile(filePath)) {
      return res.status(403).json({ error: 'File not accessible' });
    }

    const fullPath = safeResolvePath(filePath);
    
    // Check if file exists and is a file (not directory)
    const stats = await fs.stat(fullPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    // Check file size (limit to 1MB to avoid memory issues)
    if (stats.size > 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (max 1MB)' });
    }

    const content = await fs.readFile(fullPath, 'utf8');
    
    res.json({
      path: filePath,
      content,
      size: stats.size,
      lastModified: stats.mtime
    });

  } catch (error) {
    console.error('Error reading file:', error);
    
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else if (error.code === 'EACCES') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Search across multiple files' content
app.post('/api/search-content', async (req, res) => {
  try {
    console.log('Received search request:', req.body);
    const { files, searchTerm, searchType = 'keyword' } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      console.log('Files array is missing or empty');
      return res.status(400).json({ error: 'Files array is required' });
    }

    if (!searchTerm || typeof searchTerm !== 'string') {
      console.log('Search term is missing or invalid');
      return res.status(400).json({ error: 'Search term is required' });
    }

    const results = [];

    for (const filePath of files) {
      try {
        if (!isReadableFile(filePath)) {
          results.push({
            path: filePath,
            relevance: 0,
            error: 'File not accessible'
          });
          continue;
        }

        const fullPath = safeResolvePath(filePath);
        const stats = await fs.stat(fullPath);
        
        if (!stats.isFile() || stats.size > 1024 * 1024) {
          results.push({
            path: filePath,
            relevance: 0,
            error: stats.isFile() ? 'File too large' : 'Not a file'
          });
          continue;
        }

        const content = await fs.readFile(fullPath, 'utf8');
        let relevance = 0;

        if (searchType === 'keyword') {
          relevance = calculateKeywordRelevance(content, searchTerm);
        } else if (searchType === 'semantic') {
          relevance = calculateSemanticRelevance(content, searchTerm);
        }

        results.push({
          path: filePath,
          relevance,
          contentLength: content.length
        });

      } catch (fileError) {
        console.error(`Error processing file ${filePath}:`, fileError);
        results.push({
          path: filePath,
          relevance: 0,
          error: fileError.code === 'ENOENT' ? 'File not found' : 'Read error'
        });
      }
    }

    res.json({
      searchTerm,
      searchType,
      results
    });

  } catch (error) {
    console.error('Error in search-content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      repoRoot: REPO_ROOT 
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Search relevance calculation functions
function calculateKeywordRelevance(content, term) {
  const lowerContent = content.toLowerCase();
  const lowerTerm = term.toLowerCase();
  
  // Count exact matches
  const exactMatches = (lowerContent.match(new RegExp(lowerTerm, 'g')) || []).length;
  
  if (exactMatches > 0) {
    // Score based on frequency relative to content length
    const score = Math.min(100, (exactMatches / (content.length / 1000)) * 20);
    return Math.max(score, 20); // Minimum score for any match
  }
  
  // Check for partial word matches
  const words = lowerTerm.split(/\s+/);
  const matches = words.filter(word => lowerContent.includes(word));
  
  if (matches.length > 0) {
    return (matches.length / words.length) * 80;
  }
  
  return 0;
}

function calculateSemanticRelevance(content, term) {
  // Enhanced semantic similarity based on content context
  const semanticPairs = {
    'user': ['auth', 'login', 'profile', 'account', 'session', 'credentials', 'permission'],
    'data': ['database', 'model', 'schema', 'store', 'repository', 'collection', 'entity'],
    'api': ['endpoint', 'route', 'service', 'client', 'request', 'response', 'http'],
    'ui': ['component', 'view', 'render', 'display', 'interface', 'frontend', 'react'],
    'test': ['spec', 'mock', 'assert', 'verify', 'expect', 'describe', 'jest'],
    'config': ['settings', 'options', 'environment', 'env', 'configuration', 'setup'],
    'error': ['exception', 'catch', 'throw', 'fail', 'debug', 'log', 'warning'],
    'package': ['dependency', 'module', 'import', 'require', 'library', 'npm', 'node']
  };

  const lowerContent = content.toLowerCase();
  const lowerTerm = term.toLowerCase();
  
  let maxRelevance = 0;
  
  for (const [concept, related] of Object.entries(semanticPairs)) {
    if (lowerTerm.includes(concept) || concept.includes(lowerTerm)) {
      let conceptRelevance = 0;
      
      for (const relatedWord of related) {
        const matches = (lowerContent.match(new RegExp(relatedWord, 'g')) || []).length;
        if (matches > 0) {
          conceptRelevance += Math.min(30, matches * 5);
        }
      }
      
      maxRelevance = Math.max(maxRelevance, Math.min(100, conceptRelevance));
    }
  }
  
  // Add base relevance for direct term matches
  const directMatches = (lowerContent.match(new RegExp(lowerTerm, 'g')) || []).length;
  if (directMatches > 0) {
    maxRelevance = Math.max(maxRelevance, Math.min(100, directMatches * 10));
  }
  
  return maxRelevance;
}

// Start server
app.listen(PORT, () => {
  console.log(`Repo Visualizer Backend API running on port ${PORT}`);
  console.log(`Repository root: ${REPO_ROOT}`);
  console.log('Available endpoints:');
  console.log('  GET /api/health - Health check');
  console.log('  GET /api/file-content?path=<file-path> - Get file content');
  console.log('  POST /api/search-content - Search across files');
});

module.exports = app;
