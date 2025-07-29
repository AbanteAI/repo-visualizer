# Repository Visualization JSON Schema

This document defines the JSON schema used by Repo Visualizer to represent repository data for visualization. The schema is designed to be both comprehensive and extensible, allowing for future enhancements while maintaining backward compatibility.

## Schema Overview

The repository data is organized into several main sections:

1. **Metadata**: Basic information about the repository
2. **Files**: Array of all files and directories in the repository
3. **Relationships**: Connections between files and components
4. **History**: Git commit history and timeline data
5. **CustomData**: Extension point for additional data

## Detailed Schema

### Metadata

Repository-level information:

```json
{
  "metadata": {
    "repoName": "string",
    "description": "string",
    "createdAt": "ISO-date",
    "updatedAt": "ISO-date",
    "schemaVersion": "string",
    "analysisDate": "ISO-date",
    "defaultBranch": "string",
    "language": {
      "Python": 0.75,
      "JavaScript": 0.25
    }
  }
}
```

| Field | Description | Required |
|-------|-------------|----------|
| repoName | Name of the repository | Yes |
| description | Repository description | No |
| createdAt | Repository creation date (ISO format) | No |
| updatedAt | Last update date (ISO format) | No |
| schemaVersion | Version of this schema | Yes |
| analysisDate | When the analysis was performed | Yes |
| defaultBranch | Default branch name | No |
| language | Language composition as name:percentage | No |

### Files

Array of all files and directories in the repository:

```json
{
  "files": [
    {
      "id": "string",
      "path": "string",
      "name": "string",
      "extension": "string",
      "size": "number",
      "type": "string",
      "depth": "number",
      "createdAt": "ISO-date",
      "updatedAt": "ISO-date",
      "metrics": {},
      "components": []
    }
  ]
}
```

| Field | Description | Required |
|-------|-------------|----------|
| id | Unique identifier for the file | Yes |
| path | Full path from repository root | Yes |
| name | Filename without path | Yes |
| extension | File extension (without dot) | No |
| size | File size in bytes | Yes |
| type | "file" or "directory" | Yes |
| depth | Directory depth from root | Yes |
| createdAt | File creation date | No |
| updatedAt | Last modification date | No |
| metrics | Object containing file metrics | No |
| components | Array of internal components | Yes |

#### File Metrics

```json
{
  "metrics": {
    "complexity": "number",
    "linesOfCode": "number",
    "commentLines": "number", 
    "emptyLines": "number",
    "commitCount": "number",
    "lastCommitDaysAgo": "number",
    "lastCommitDate": "string",
    "topLevelIdentifiers": "number",
    "custom": {}
  }
}
```

| Field | Description | Required |
|-------|-------------|----------|
| complexity | Cyclomatic complexity or similar metric | No |
| linesOfCode | Total lines of code | No |
| commentLines | Number of comment lines | No |
| emptyLines | Number of empty lines | No |
| commitCount | Number of commits that changed this file | No |
| lastCommitDaysAgo | Days since the last commit to this file | No |
| lastCommitDate | Date of the last commit to this file (ISO format) | No |
| topLevelIdentifiers | Number of top-level identifiers (classes, functions, variables) | No |
| githubActivity | GitHub activity data from open pull requests | No |
| custom | Object for custom metrics | No |

#### File Components

Internal file structure elements:

```json
{
  "components": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "lineStart": "number",
      "lineEnd": "number",
      "metrics": {},
      "components": []
    }
  ]
}
```

| Field | Description | Required |
|-------|-------------|----------|
| id | Unique identifier for the component | Yes |
| name | Component name | Yes |
| type | "class", "function", "method", "variable", etc. | Yes |
| lineStart | Starting line number | Yes |
| lineEnd | Ending line number | Yes |
| metrics | Component-specific metrics | No |
| components | Nested components (e.g., methods within a class) | Yes |

### Relationships

Connections between files and components:

```json
{
  "relationships": [
    {
      "source": "string",
      "target": "string",
      "type": "string",
      "strength": "number",
      "metadata": {}
    }
  ]
}
```

| Field | Description | Required |
|-------|-------------|----------|
| source | ID of source file/component | Yes |
| target | ID of target file/component | Yes |
| type | "import", "call", "inheritance", etc. | Yes |
| strength | Optional weighting for visualization | No |
| metadata | Additional relationship data | No |

### History

Git commit history and timeline data:

```json
{
  "history": {
    "commits": [],
    "timelinePoints": []
  }
}
```

#### Commits

```json
{
  "commits": [
    {
      "id": "string",
      "author": "string",
      "date": "ISO-date",
      "message": "string",
      "fileChanges": []
    }
  ]
}
```

| Field | Description | Required |
|-------|-------------|----------|
| id | Commit hash | Yes |
| author | Author name/email | Yes |
| date | Commit date | Yes |
| message | Commit message | Yes |
| fileChanges | Array of changes to files | Yes |

#### File Changes

```json
{
  "fileChanges": [
    {
      "fileId": "string",
      "type": "string",
      "additions": "number",
      "deletions": "number"
    }
  ]
}
```

| Field | Description | Required |
|-------|-------------|----------|
| fileId | ID of changed file | Yes |
| type | "add", "modify", "delete" | Yes |
| additions | Lines added | Yes |
| deletions | Lines deleted | Yes |

#### Timeline Points

Snapshots of repository state at key points:

```json
{
  "timelinePoints": [
    {
      "commitId": "string",
      "state": {},
      "snapshot": {
        "files": [],
        "relationships": []
      }
    }
  ]
}
```

| Field | Description | Required |
|-------|-------------|----------|
| commitId | Reference to commit | Yes |
| state | Optional summary state data | Yes |
| snapshot | Repository snapshot at this point | Yes |

### CustomData

Extension point for additional data:

```json
{
  "customData": {}
}
```

This section can contain any additional data that might be useful for specific visualization needs or extensions.

## Usage Guidelines

### 1. Identifying Objects

Every file and component must have a unique ID. These IDs are used to establish relationships between entities.

- File IDs should be stable across analysis runs
- Consider using normalized paths for file IDs
- For components, a combination of file ID and component name works well

### 2. Schema Extensibility

The schema is designed to be extended without breaking compatibility:

- Use the `custom` and `metadata` objects to add new attributes
- Always include the `schemaVersion` field to track schema evolution
- New optional fields can be added without increasing the schema version
- Breaking changes should increment the schema version

### 3. Performance Considerations

For large repositories:

- Consider limiting component depth to improve performance
- Timeline points can be selective rather than for every commit
- Large file content can be omitted or stored externally
- Consider pagination or lazy-loading strategies for the frontend

### 4. Language Support

The schema supports multi-language repositories through:

- Language-specific parsing in the analyzer
- Language composition statistics in metadata
- Language-specific relationship types where appropriate

## Example

A minimal example of the schema:

```json
{
  "metadata": {
    "repoName": "example-repo",
    "schemaVersion": "1.0.0",
    "analysisDate": "2025-03-20T12:00:00Z"
  },
  "files": [
    {
      "id": "src/example.py",
      "path": "src/example.py",
      "name": "example.py",
      "extension": "py",
      "size": 2048,
      "type": "file",
      "depth": 1,
      "components": [
        {
          "id": "src/example.py:ExampleClass",
          "name": "ExampleClass",
          "type": "class",
          "lineStart": 10,
          "lineEnd": 50,
          "components": []
        }
      ]
    }
  ],
  "relationships": [
    {
      "source": "src/example.py",
      "target": "src/utils.py",
      "type": "import"
    }
  ],
  "customData": {}
}
```

## Future Schema Evolution

As the project evolves, the schema may be extended to include:

1. **Code Quality Metrics**: Expanded metrics for code quality and complexity
2. **Visualization Hints**: Metadata to guide visualization layout and styling
3. **User Annotations**: Support for user-added notes and highlights
4. **Semantic Relationships**: More nuanced relationship types based on semantic analysis
5. **Comparative Data**: Support for comparing multiple branches or repository versions

The schema is designed with these potential extensions in mind, allowing for graceful evolution without breaking existing tools.
