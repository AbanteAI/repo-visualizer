import lunr from 'lunr';
import Fuse from 'fuse.js';
import { RepositoryData, File, Component } from '../types/schema';

export interface SearchResult {
  id: string;
  score: number;
  type: 'file' | 'component';
  highlights?: string[];
}

export interface SearchIndex {
  lunrIndex: lunr.Index;
  fuseIndex: Fuse<SearchableItem>;
  documents: Map<string, SearchableItem>;
}

interface SearchableItem {
  id: string;
  title: string;
  content: string;
  path: string;
  type: 'file' | 'component';
  extension?: string;
  parentId?: string;
}

export function createSearchIndex(data: RepositoryData): SearchIndex {
  const documents = new Map<string, SearchableItem>();
  const searchableItems: SearchableItem[] = [];

  // Index files
  data.files.forEach(file => {
    const item: SearchableItem = {
      id: file.id,
      title: file.name,
      content: `${file.name} ${file.path} ${file.extension || ''} ${file.type}`,
      path: file.path,
      type: 'file',
      extension: file.extension || undefined,
    };
    documents.set(file.id, item);
    searchableItems.push(item);

    // Index components within files
    if (file.components) {
      indexComponents(file.components, file, documents, searchableItems);
    }
  });

  // Create Lunr index for boolean search
  const lunrIndex = lunr(function () {
    this.ref('id');
    this.field('title', { boost: 10 });
    this.field('content', { boost: 5 });
    this.field('path', { boost: 2 });

    searchableItems.forEach(item => {
      this.add(item);
    });
  });

  // Create Fuse index for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'content', weight: 0.3 },
      { name: 'path', weight: 0.1 },
    ],
    threshold: 0.3,
    includeScore: true,
    includeMatches: true,
  };

  const fuseIndex = new Fuse(searchableItems, fuseOptions);

  return {
    lunrIndex,
    fuseIndex,
    documents,
  };
}

function indexComponents(
  components: Component[],
  file: File,
  documents: Map<string, SearchableItem>,
  searchableItems: SearchableItem[]
) {
  components.forEach(component => {
    const item: SearchableItem = {
      id: component.id,
      title: component.name,
      content: `${component.name} ${component.type} ${file.name} ${file.path}`,
      path: file.path,
      type: 'component',
      extension: file.extension || undefined,
      parentId: file.id,
    };
    documents.set(component.id, item);
    searchableItems.push(item);

    // Recursively index nested components
    if (component.components) {
      indexComponents(component.components, file, documents, searchableItems);
    }
  });
}

export function performExactSearch(query: string, index: SearchIndex): Map<string, number> {
  const results = new Map<string, number>();

  if (!query.trim()) {
    return results;
  }

  try {
    // Use Lunr for boolean search
    const lunrResults = index.lunrIndex.search(query);

    lunrResults.forEach(result => {
      // Lunr scores are typically between 0 and some positive number
      // We'll normalize them to 0-1 range
      const normalizedScore = Math.min(result.score / 5, 1);
      results.set(result.ref, normalizedScore);
    });

    // If no results from Lunr (maybe it's not boolean syntax), fallback to Fuse
    if (results.size === 0) {
      const fuseResults = index.fuseIndex.search(query);
      fuseResults.forEach(result => {
        if (result.score !== undefined) {
          // Fuse scores are 0-1 where 0 is perfect match, 1 is no match
          // We invert it so higher scores mean better matches
          const normalizedScore = 1 - result.score;
          results.set(result.item.id, normalizedScore);
        }
      });
    }
  } catch (error) {
    console.warn('Search error:', error);
    // Fallback to simple fuzzy search if boolean search fails
    const fuseResults = index.fuseIndex.search(query);
    fuseResults.forEach(result => {
      if (result.score !== undefined) {
        const normalizedScore = 1 - result.score;
        results.set(result.item.id, normalizedScore);
      }
    });
  }

  return results;
}

export async function performSemanticSearch(
  query: string,
  index: SearchIndex
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  if (!query.trim()) {
    return results;
  }

  // TODO: Implement semantic search with embeddings
  // For now, we'll use a placeholder that does fuzzy matching
  // In a real implementation, you would:
  // 1. Generate embeddings for the query
  // 2. Compare with pre-computed embeddings of all documents
  // 3. Return similarity scores

  // Placeholder: use fuzzy search as a fallback
  const fuseResults = index.fuseIndex.search(query);
  fuseResults.forEach(result => {
    if (result.score !== undefined) {
      // Apply a different scoring strategy for "semantic" search
      // This is just a placeholder - real semantic search would use embeddings
      const normalizedScore = Math.pow(1 - result.score, 0.5); // Different curve
      results.set(result.item.id, normalizedScore);
    }
  });

  return results;
}

export function getSearchResultScore(itemId: string, searchResults: Map<string, number>): number {
  return searchResults.get(itemId) || 0;
}

export function getNodeSizeMultiplier(score: number): number {
  if (score === 0) {
    return 0.3; // Very small for non-matching nodes
  }

  // Scale from 0.5 to 2.0 based on score
  return 0.5 + score * 1.5;
}
