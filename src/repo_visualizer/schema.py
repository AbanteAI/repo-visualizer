"""
Repository Visualization Schema

This module defines the schema for the repository visualization JSON data format.
It provides type definitions and utilities for working with repository
visualization data.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict, Union


class FileMetrics(TypedDict, total=False):
    """Metrics associated with a file."""

    complexity: float
    linesOfCode: int
    commentLines: int
    emptyLines: int
    githubActivity: Optional[Dict[str, Any]]
    custom: Dict[str, Any]


class ComponentMetrics(TypedDict, total=False):
    """Metrics associated with a component."""

    complexity: float
    linesOfCode: int
    custom: Dict[str, Any]


class Component(TypedDict, total=False):
    """Internal component of a file (class, function, etc.)."""

    id: str
    name: str
    type: str  # 'class', 'function', 'method', 'variable', etc.
    lineStart: int
    lineEnd: int
    metrics: Optional[ComponentMetrics]
    components: List["Component"]  # Nested components


class File(TypedDict, total=False):
    """File or directory in the repository."""

    id: str
    path: str
    name: str
    extension: Optional[str]
    size: int
    type: str  # 'file' or 'directory'
    depth: int
    createdAt: Optional[str]  # ISO format date string
    updatedAt: Optional[str]  # ISO format date string
    metrics: Optional[FileMetrics]
    components: List[Component]


class Relationship(TypedDict, total=False):
    """Relationship between files or components."""

    source: str  # ID of source file/component
    target: str  # ID of target file/component
    type: str  # 'import', 'call', 'inheritance', 'filesystem_proximity', etc.
    strength: float
    metadata: Dict[str, Any]


class FileChange(TypedDict):
    """Change to a file in a commit."""

    fileId: str
    type: str  # 'add', 'modify', 'delete'
    additions: int
    deletions: int


class Commit(TypedDict):
    """Git commit data."""

    id: str  # Commit hash
    author: str
    date: str  # ISO format date string
    message: str
    fileChanges: List[FileChange]


class TimelinePoint(TypedDict):
    """Point in time with repository snapshot."""

    commitId: str
    state: Dict[str, Any]
    snapshot: Dict[str, Union[List[File], List[Relationship]]]


class History(TypedDict):
    """Repository history data."""

    commits: List[Commit]
    timelinePoints: List[TimelinePoint]


class Metadata(TypedDict, total=False):
    """Repository metadata."""

    repoName: str
    description: str
    createdAt: str  # ISO format date string
    updatedAt: str  # ISO format date string
    schemaVersion: str
    analysisDate: str  # ISO format date string
    defaultBranch: str
    language: Dict[str, float]  # Language name to percentage


class RepositoryData(TypedDict):
    """Complete repository visualization data."""

    metadata: Metadata
    files: List[File]
    relationships: List[Relationship]
    history: Optional[History]
    customData: Dict[str, Any]


def validate_repository_data(data: Union[RepositoryData, Dict[str, Any]]) -> bool:
    """
    Validate that the provided data conforms to the RepositoryData schema.

    Args:
        data: Dictionary containing repository data

    Returns:
        bool: True if valid, False otherwise
    """
    # Basic validation of required fields
    if "metadata" not in data or "files" not in data or "relationships" not in data:
        return False

    # Additional validation could be implemented here

    return True


def create_empty_schema() -> RepositoryData:
    """
    Create an empty schema with required fields.

    Returns:
        RepositoryData: Empty schema with default values
    """
    return {
        "metadata": {
            "repoName": "",
            "description": "",
            "schemaVersion": "1.0.0",
            "analysisDate": datetime.now().isoformat(),
        },
        "files": [],
        "relationships": [],
        "history": None,
        "customData": {},
    }


def schema_version() -> str:
    """Return the current schema version."""
    return "1.0.0"
