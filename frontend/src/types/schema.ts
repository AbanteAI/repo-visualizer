/**
 * TypeScript definitions for the Repository Visualization JSON Schema
 * Based on the schema defined in docs/SCHEMA.md
 */

export interface RepositoryData {
  metadata: Metadata;
  files: File[];
  relationships: Relationship[];
  history?: History;
  customData?: Record<string, unknown>;
}

export interface Metadata {
  repoName: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  schemaVersion: string;
  analysisDate: string;
  defaultBranch?: string;
  language?: Record<string, number>;
}

export interface File {
  id: string;
  path: string;
  name: string;
  extension?: string | null;
  size: number;
  type: 'file' | 'directory';
  depth: number;
  createdAt?: string;
  updatedAt?: string;
  metrics?: FileMetrics;
  components: Component[];
}

export interface FileMetrics {
  complexity?: number;
  linesOfCode?: number;
  commentLines?: number;
  emptyLines?: number;
  custom?: Record<string, unknown>;
}

export interface Component {
  id: string;
  name: string;
  type: string;
  lineStart: number;
  lineEnd: number;
  metrics?: ComponentMetrics;
  components: Component[];
}

export interface ComponentMetrics {
  complexity?: number;
  linesOfCode?: number;
  custom?: Record<string, unknown>;
}

export interface Relationship {
  source: string;
  target: string;
  type: string;
  strength?: number;
  metadata?: Record<string, unknown>;
}

export interface FileChange {
  fileId: string;
  type: 'add' | 'modify' | 'delete';
  additions: number;
  deletions: number;
}

export interface Commit {
  id: string;
  author: string;
  date: string;
  message: string;
  fileChanges: FileChange[];
}

export interface TimelinePoint {
  commitId: string;
  state: Record<string, unknown>;
  snapshot: {
    files?: File[];
    relationships?: Relationship[];
  };
}

export interface History {
  commits: Commit[];
  timelinePoints: TimelinePoint[];
}
