"""
Repository Analyzer

This module provides functionality to analyze a local git repository and
generate a structured JSON representation according to the repository
visualization schema.
"""

import json
import os
import re
import subprocess
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

import pathspec

# Optional dependency for semantic similarity
try:
    import openai

    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import numpy as np

    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

from .schema import (
    Component,
    File,
    Relationship,
    RepositoryData,
    create_empty_schema,
)


class RepositoryAnalyzer:
    """Analyzes a local git repository and generates visualization data."""

    def __init__(
        self,
        repo_path: str,
        python_coverage_path: Optional[str] = None,
        frontend_coverage_path: Optional[str] = None,
    ):
        """
        Initialize the repository analyzer.

        Args:
            repo_path: Path to the local git repository
        """
        self.repo_path = os.path.abspath(repo_path)
        self.python_coverage_path = python_coverage_path
        self.frontend_coverage_path = frontend_coverage_path
        if not os.path.isdir(self.repo_path):
            raise ValueError(f"Repository path does not exist: {self.repo_path}")

        # Check if it's a git repo
        git_dir = os.path.join(self.repo_path, ".git")
        if not os.path.isdir(git_dir):
            raise ValueError(f"Not a git repository: {self.repo_path}")

        self.data = create_empty_schema()
        self.file_ids: Set[str] = set()
        self.relationships: List[Relationship] = []
        self.relationship_counts: Dict[Tuple[str, str, str], int] = {}

        # Load gitignore patterns
        self.gitignore_spec = self._load_gitignore_patterns()

        # Cache for coverage data to avoid reparsing
        self._coverage_cache: Optional[Dict[str, Dict[str, float]]] = None

    def _load_coverage_data(self) -> Dict[str, Dict[str, float]]:
        """Load and parse coverage data from JSON files."""
        if self._coverage_cache is not None:
            return self._coverage_cache

        coverage_data: Dict[str, Dict[str, float]] = {}

        # Load Python coverage
        if self.python_coverage_path and os.path.exists(self.python_coverage_path):
            try:
                with open(self.python_coverage_path) as f:
                    py_coverage = json.load(f)
                    for file_path, summary in py_coverage.get("files", {}).items():
                        abs_path = (
                            file_path
                            if os.path.isabs(file_path)
                            else os.path.join(self.repo_path, file_path)
                        )
                        rel_path = os.path.relpath(abs_path, self.repo_path).replace(
                            os.path.sep, "/"
                        )
                        coverage_data.setdefault(rel_path, {}).update(
                            {
                                "lines": summary.get("summary", {}).get(
                                    "percent_covered", 0
                                )
                                / 100.0
                            }
                        )
            except (OSError, json.JSONDecodeError) as e:
                print(f"Warning: Could not parse Python coverage file: {e}")

        # Load frontend coverage
        if self.frontend_coverage_path and os.path.exists(self.frontend_coverage_path):
            try:
                with open(self.frontend_coverage_path) as f:
                    fe_coverage = json.load(f)
                    for file_path, summary in fe_coverage.items():
                        abs_path = (
                            file_path
                            if os.path.isabs(file_path)
                            else os.path.join(self.repo_path, file_path)
                        )
                        rel_path = os.path.relpath(abs_path, self.repo_path).replace(
                            os.path.sep, "/"
                        )
                        coverage_data.setdefault(rel_path, {}).update(
                            {
                                "lines": summary.get("lines", {}).get("pct", 0) / 100.0,
                                "statements": summary.get("statements", {}).get(
                                    "pct", 0
                                )
                                / 100.0,
                                "functions": summary.get("functions", {}).get("pct", 0)
                                / 100.0,
                                "branches": summary.get("branches", {}).get("pct", 0)
                                / 100.0,
                            }
                        )
            except (OSError, json.JSONDecodeError) as e:
                print(f"Warning: Could not parse frontend coverage file: {e}")

        self._coverage_cache = coverage_data
        return self._coverage_cache

    def analyze(self) -> RepositoryData:
        """
        Perform the repository analysis.

        Returns:
            RepositoryData: The complete repository data structure
        """
        # Extract repository metadata
        self._extract_metadata()

        # Analyze file structure
        self._analyze_files()

        # Extract relationships
        self._extract_relationships()

        # Analyze git history
        self._analyze_history()

        return self.data

    def _extract_metadata(self) -> None:
        """Extract repository metadata."""
        # Get repository name from the directory name
        repo_name = os.path.basename(self.repo_path)

        # Try to get description from git if available
        description = self._get_git_description()

        # Get default branch
        default_branch = self._get_default_branch()

        # Get repository creation date (first commit date)
        created_at = self._get_first_commit_date()

        # Get repository update date (last commit date)
        updated_at = self._get_last_commit_date()

        # Get language statistics
        language_stats = self._calculate_language_stats()

        # Update metadata
        self.data["metadata"].update(
            {
                "repoName": repo_name,
                "description": description,
                "createdAt": created_at,
                "updatedAt": updated_at,
                "schemaVersion": "1.0.0",
                "analysisDate": datetime.now().isoformat(),
                "defaultBranch": default_branch,
                "language": language_stats,
            }
        )

    def _get_git_description(self) -> str:
        """Get repository description from git if available."""
        try:
            # Try to get description from git config
            result = subprocess.run(
                ["git", "config", "--get", "remote.origin.url"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0:
                git_url = result.stdout.strip()
                # Sanitize URL to remove any embedded credentials
                git_url = self._sanitize_git_url(git_url)
                return f"Git repository at {git_url}"
            return ""
        except Exception:
            return ""

    def _get_default_branch(self) -> str:
        """Get the default branch name."""
        try:
            result = subprocess.run(
                ["git", "symbolic-ref", "--short", "HEAD"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0:
                return result.stdout.strip()
            return "main"  # Default fallback
        except Exception:
            return "main"  # Default fallback

    def _get_first_commit_date(self) -> str:
        """Get the date of the first commit."""
        try:
            result = subprocess.run(
                [
                    "git",
                    "log",
                    "--reverse",
                    "--date=iso",
                    "--format=%ad",
                    "--max-count=1",
                ],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                # Parse and convert to ISO format
                date_str = result.stdout.strip()
                dt = datetime.fromisoformat(
                    date_str.replace(" ", "T").replace(" +", "+")
                )
                return dt.isoformat()
            return datetime.now().isoformat()
        except Exception:
            return datetime.now().isoformat()

    def _get_last_commit_date(self) -> str:
        """Get the date of the last commit."""
        try:
            result = subprocess.run(
                ["git", "log", "--date=iso", "--format=%ad", "--max-count=1"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                # Parse and convert to ISO format
                date_str = result.stdout.strip()
                dt = datetime.fromisoformat(
                    date_str.replace(" ", "T").replace(" +", "+")
                )
                return dt.isoformat()
            return datetime.now().isoformat()
        except Exception:
            return datetime.now().isoformat()

    def _load_gitignore_patterns(self) -> pathspec.PathSpec:
        """
        Load gitignore patterns from the repository.

        Returns:
            A PathSpec object that can match paths against gitignore patterns
        """
        gitignore_path = os.path.join(self.repo_path, ".gitignore")
        patterns = []

        # If .gitignore file exists, read the patterns
        if os.path.isfile(gitignore_path):
            try:
                with open(gitignore_path, encoding="utf-8") as f:
                    patterns = f.readlines()
            except Exception as e:
                print(f"Warning: Could not read .gitignore file: {e}")

        # Create a PathSpec object to match against gitignore patterns
        return pathspec.PathSpec.from_lines("gitwildmatch", patterns)

    def _is_ignored(self, path: str, is_directory: Optional[bool] = None) -> bool:
        """
        Check if a path should be ignored according to gitignore rules.

        Args:
            path: The path to check, relative to the repository root
            is_directory: Explicitly specify if path is a directory; if None, will check
                filesystem

        Returns:
            True if the path should be ignored, False otherwise
        """
        # Always ignore common directories that shouldn't be visualized
        always_ignore = {
            ".git",
            "node_modules",
            ".venv",
            "venv",
            "__pycache__",
            ".pytest_cache",
            "build",
            "dist",
            ".next",
            ".nuxt",
            "coverage",
            ".coverage",
            "*.egg-info",
            ".tox",
            ".nox",
            "vendor",
            ".DS_Store",
            "Thumbs.db",
        }

        path_parts = path.split(os.path.sep)
        for part in path_parts:
            if part in always_ignore:
                return True
            # Handle glob patterns like *.egg-info
            for ignore_pattern in always_ignore:
                if "*" in ignore_pattern:
                    import fnmatch

                    if fnmatch.fnmatch(part, ignore_pattern):
                        return True

        # Normalize path separator to forward slash for consistency
        norm_path = path.replace(os.path.sep, "/")

        # Determine if the path is a directory and add trailing slash if so
        if is_directory is None:
            is_directory = os.path.isdir(os.path.join(self.repo_path, norm_path))

        if is_directory and not norm_path.endswith("/"):
            norm_path += "/"

        # 1. First check if the path itself is ignored
        if self.gitignore_spec.match_file(norm_path):
            return True

        # 2. For a file path, also check if any parent directory is ignored
        if not is_directory and "/" in norm_path:
            # Check if any parent directory is ignored
            parts = norm_path.split("/")
            for i in range(1, len(parts)):
                parent_dir = "/".join(parts[:i]) + "/"
                if self.gitignore_spec.match_file(parent_dir):
                    return True

        return False

    def _sanitize_git_url(self, url: str) -> str:
        """
        Remove credentials from git URLs to prevent token exposure.

        Args:
            url: Git URL that may contain credentials

        Returns:
            Sanitized URL without credentials
        """
        import re

        # Remove credentials from HTTPS URLs
        # Pattern matches: https://username:token@github.com/org/repo.git
        url = re.sub(r"https://[^@]+@([^/]+)(/.*)$", r"https://\1\2", url)

        # Remove credentials from SSH URLs if any
        # Pattern matches: ssh://user:pass@host/path
        url = re.sub(r"ssh://[^@]+@([^/]+)(/.*)$", r"ssh://\1\2", url)

        return url

    def _calculate_language_stats(self) -> Dict[str, float]:
        """Calculate language statistics based on file extensions."""
        extension_map = {
            "py": "Python",
            "js": "JavaScript",
            "ts": "TypeScript",
            "jsx": "JavaScript",
            "tsx": "TypeScript",
            "html": "HTML",
            "css": "CSS",
            "scss": "SCSS",
            "java": "Java",
            "c": "C",
            "cpp": "C++",
            "h": "C/C++ Header",
            "hpp": "C++ Header",
            "go": "Go",
            "rb": "Ruby",
            "php": "PHP",
            "rs": "Rust",
            "swift": "Swift",
            "kt": "Kotlin",
            "md": "Markdown",
            "json": "JSON",
            "yml": "YAML",
            "yaml": "YAML",
            "xml": "XML",
            "sh": "Shell",
            "bat": "Batch",
            "ps1": "PowerShell",
        }

        # Count bytes per extension
        extension_sizes: Dict[str, int] = {}
        total_size = 0

        for root, dirs, files in os.walk(self.repo_path):
            # Filter out gitignore directories
            rel_root = os.path.relpath(root, self.repo_path)
            if rel_root == ".":
                rel_root = ""

            # Filter directories in-place
            i = 0
            while i < len(dirs):
                dir_name = dirs[i]
                dir_path = os.path.join(rel_root, dir_name)

                # Explicitly check as a directory
                if self._is_ignored(dir_path, is_directory=True):
                    dirs.pop(i)
                else:
                    i += 1

            for file in files:
                rel_path = os.path.join(rel_root, file)

                # Skip ignored files
                if self._is_ignored(rel_path, is_directory=False):
                    continue

                file_path = os.path.join(root, file)
                try:
                    # Only count regular files
                    if not os.path.isfile(file_path):
                        continue

                    # Get file extension
                    _, ext = os.path.splitext(file)
                    ext = ext.lstrip(".").lower()

                    # Skip files without extensions or unknown types
                    if not ext:
                        continue

                    # Get file size
                    size = os.path.getsize(file_path)
                    if ext in extension_sizes:
                        extension_sizes[ext] += size
                    else:
                        extension_sizes[ext] = size

                    total_size += size
                except Exception:
                    continue

        # Convert to language stats with percentages
        language_stats: Dict[str, float] = {}
        if total_size > 0:
            for ext, size in extension_sizes.items():
                language = extension_map.get(ext, ext.upper())
                percentage = size / total_size
                if language in language_stats:
                    language_stats[language] += percentage
                else:
                    language_stats[language] = percentage

        # Round percentages to 2 decimal places
        return {lang: round(pct, 4) for lang, pct in language_stats.items()}

    def _analyze_files(self) -> None:
        """Analyze file structure and content."""
        files: List[File] = []
        dir_file_map: Dict[
            str, List[str]
        ] = {}  # Maps directory paths to contained file IDs

        coverage_data = self._load_coverage_data()

        for root, dirs, file_names in os.walk(self.repo_path):
            # Get the path relative to the repository root
            rel_root = os.path.relpath(root, self.repo_path)
            if rel_root == ".":
                rel_root = ""

            # Filter directories in-place to respect gitignore
            # Use a copy of the list since we're modifying it during iteration
            i = 0
            while i < len(dirs):
                dir_name = dirs[i]
                dir_path = os.path.join(rel_root, dir_name)

                # Skip hidden directories and those that match gitignore patterns
                if dir_name.startswith(".") or self._is_ignored(
                    dir_path, is_directory=True
                ):
                    dirs.pop(i)
                else:
                    i += 1

            # Process directories that weren't filtered out
            for dir_name in dirs:
                dir_path = os.path.join(root, dir_name)
                rel_path = os.path.relpath(dir_path, self.repo_path)

                # Skip if somehow outside repo path
                if rel_path.startswith(".."):
                    continue

                # Normalize path separator to forward slash
                rel_path = rel_path.replace(os.path.sep, "/")

                # Calculate directory depth
                depth = len(rel_path.split("/"))

                # Create directory entry
                dir_entry: File = {
                    "id": rel_path,
                    "path": rel_path,
                    "name": dir_name,
                    "type": "directory",
                    "depth": depth,
                    "size": 0,  # Will be updated later
                    "components": [],
                }

                files.append(dir_entry)
                self.file_ids.add(rel_path)

                # Initialize directory in map
                dir_file_map[rel_path] = []

                # Create parent directory relationship
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in self.file_ids:
                    self.relationships.append(
                        {
                            "source": parent_dir,
                            "target": rel_path,
                            "type": "contains",
                        }
                    )
                    if parent_dir in dir_file_map:
                        dir_file_map[parent_dir].append(rel_path)

            # Process files
            for file_name in file_names:
                # Skip hidden files
                if file_name.startswith("."):
                    continue

                rel_path = os.path.join(rel_root, file_name)

                # Skip ignored files
                if self._is_ignored(rel_path, is_directory=False):
                    continue

                file_path = os.path.join(root, file_name)

                # Skip if not a regular file
                if not os.path.isfile(file_path):
                    continue

                # Normalize path separator to forward slash
                rel_path = rel_path.replace(os.path.sep, "/")

                # Get file extension
                _, ext = os.path.splitext(file_name)
                ext = ext.lstrip(".")

                # Calculate file size
                try:
                    size = os.path.getsize(file_path)
                except OSError:
                    continue

                # Calculate file depth
                depth = len(rel_path.split("/"))

                # Extract components from the file
                components = self._extract_components(file_path)

                # Get test coverage for the file
                file_coverage = coverage_data.get(rel_path)

                # Create file entry
                file_entry: File = {
                    "id": rel_path,
                    "path": rel_path,
                    "name": file_name,
                    "type": "file",
                    "extension": ext,
                    "size": size,
                    "depth": depth,
                    "components": components,
                    "metrics": {
                        "testCoverage": file_coverage,
                    },
                }

                files.append(file_entry)
                self.file_ids.add(rel_path)

                # Add to parent directory map
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in dir_file_map:
                    dir_file_map[parent_dir].append(rel_path)

        # Update directory sizes
        for f in files:
            if f["type"] == "directory":
                f["size"] = self._calculate_directory_size(f["id"], files, dir_file_map)

        self.data["files"] = files

    def _calculate_directory_size(
        self,
        dir_id: str,
        all_files: List[File],
        dir_file_map: Dict[str, List[str]],
    ) -> int:
        """Recursively calculate the size of a directory."""
        total_size = 0
        if dir_id in dir_file_map:
            for child_id in dir_file_map[dir_id]:
                child_file = next((f for f in all_files if f["id"] == child_id), None)
                if child_file:
                    if child_file["type"] == "file":
                        total_size += child_file["size"]
                    elif child_file["type"] == "directory":
                        total_size += self._calculate_directory_size(
                            child_id, all_files, dir_file_map
                        )
        return total_size

    def _extract_components(self, file_path: str) -> List[Component]:
        """
        Extract components (classes, functions) from a file.

        Args:
            file_path: The absolute path to the file

        Returns:
            A list of Component objects
        """
        components: List[Component] = []
        rel_path = os.path.relpath(file_path, self.repo_path)
        _, ext = os.path.splitext(file_path)
        ext = ext.lstrip(".")

        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception:
            return []

        # Python component extraction
        if ext == "py":
            # Regex for classes and functions
            pattern = re.compile(
                r"^(?:class|def)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[:(]", re.MULTILINE
            )
            for match in pattern.finditer(content):
                component_name = match.group(1)
                component_type = "class" if "class" in match.group(0) else "function"
                components.append(
                    {
                        "id": f"{rel_path}::{component_name}",
                        "name": component_name,
                        "type": component_type,
                    }
                )

        # JavaScript/TypeScript component extraction
        elif ext in ["js", "ts", "jsx", "tsx"]:
            # Regex for functions (including arrow functions) and classes
            pattern = re.compile(
                r"^(?:export\s+)?(?:async\s+)?(?:class|function\*?|const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|\(|extends|{)",
                re.MULTILINE,
            )
            for match in pattern.finditer(content):
                component_name = match.group(1)
                declaration = match.group(0)
                component_type = "class" if "class" in declaration else "function"
                components.append(
                    {
                        "id": f"{rel_path}::{component_name}",
                        "name": component_name,
                        "type": component_type,
                    }
                )

        return components

    def _extract_relationships(self) -> None:
        """Extract relationships between files (e.g., imports)."""
        # Regex patterns for different languages
        patterns = {
            "py": re.compile(r"^\s*(?:from|import)\s+([a-zA-Z0-9_.]+)", re.MULTILINE),
            "js": re.compile(
                r"^\s*import\s+.*\s+from\s+['\"]([^'\"]+)['\"]", re.MULTILINE
            ),
            "ts": re.compile(
                r"^\s*import\s+.*\s+from\s+['\"]([^'\"]+)['\"]", re.MULTILINE
            ),
            "jsx": re.compile(
                r"^\s*import\s+.*\s+from\s+['\"]([^'\"]+)['\"]", re.MULTILINE
            ),
            "tsx": re.compile(
                r"^\s*import\s+.*\s+from\s+['\"]([^'\"]+)['\"]", re.MULTILINE
            ),
        }

        for file_info in self.data["files"]:
            if file_info["type"] != "file":
                continue

            ext = file_info["extension"]
            if ext not in patterns:
                continue

            file_path = os.path.join(self.repo_path, file_info["path"])
            try:
                with open(file_path, encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except Exception:
                continue

            for match in patterns[ext].finditer(content):
                import_path = match.group(1)
                target_file = self._resolve_import_path(
                    import_path, file_info["path"], ext
                )
                if target_file and target_file in self.file_ids:
                    self._add_relationship(file_info["id"], target_file, "imports")

        # Add semantic similarity relationships if enabled
        self._add_semantic_relationships()

        # Add filesystem proximity relationships
        self._add_filesystem_relationships()

        # Consolidate relationships
        self._consolidate_relationships()

    def _resolve_import_path(
        self, import_path: str, source_path: str, ext: str
    ) -> Optional[str]:
        """
        Resolve an import path to a file path in the repository.

        Args:
            import_path: The imported path string
            source_path: The path of the file containing the import
            ext: The file extension of the source file

        Returns:
            The resolved file path relative to the repo root, or None
        """
        # Python import resolution
        if ext == "py":
            # Convert import path to file path
            parts = import_path.split(".")
            possible_paths = [
                os.path.join(*parts) + ".py",
                os.path.join(*parts, "__init__.py"),
            ]
            for path in possible_paths:
                full_path = os.path.join(self.repo_path, path)
                if os.path.isfile(full_path):
                    return path.replace(os.path.sep, "/")
            return None

        # JavaScript/TypeScript import resolution
        elif ext in ["js", "ts", "jsx", "tsx"]:
            # Handle relative paths
            if import_path.startswith("./") or import_path.startswith("../"):
                source_dir = os.path.dirname(source_path)
                resolved_path = os.path.normpath(os.path.join(source_dir, import_path))
                possible_exts = [".js", ".ts", ".jsx", ".tsx", "/index.js", "/index.ts"]
                for possible_ext in possible_exts:
                    full_path = os.path.join(
                        self.repo_path, resolved_path + possible_ext
                    )
                    if os.path.isfile(full_path):
                        return (resolved_path + possible_ext).replace(os.path.sep, "/")
                # Check for extensionless import
                full_path = os.path.join(self.repo_path, resolved_path)
                if os.path.isfile(full_path):
                    return resolved_path.replace(os.path.sep, "/")
            return None

        return None

    def _add_relationship(self, source: str, target: str, type: str) -> None:
        """Add a relationship, handling duplicates and counting."""
        # Ensure consistent ordering for relationship key
        rel_key = (source, target, type)
        if rel_key in self.relationship_counts:
            self.relationship_counts[rel_key] += 1
        else:
            self.relationship_counts[rel_key] = 1
            self.relationships.append(
                {"source": source, "target": target, "type": type}
            )

    def _consolidate_relationships(self) -> None:
        """Consolidate relationships and add strength based on counts."""
        consolidated: List[Relationship] = []
        for rel in self.relationships:
            source, target, type = rel["source"], rel["target"], rel["type"]
            rel_key = (source, target, type)
            strength = self.relationship_counts.get(rel_key, 1)
            consolidated.append(
                {"source": source, "target": target, "type": type, "strength": strength}
            )
        self.data["relationships"] = consolidated

    def _add_semantic_relationships(self) -> None:
        """Add relationships based on semantic similarity (if enabled)."""
        if not OPENAI_AVAILABLE or not NUMPY_AVAILABLE:
            return

        # Get embeddings for all files
        embeddings = self._get_file_embeddings()
        if not embeddings:
            return

        # Calculate cosine similarity between all pairs of files
        file_ids = list(embeddings.keys())
        embedding_matrix = np.array(list(embeddings.values()))

        # Normalize embeddings
        norms = np.linalg.norm(embedding_matrix, axis=1, keepdims=True)
        normalized_embeddings = embedding_matrix / norms

        # Compute cosine similarity matrix
        similarity_matrix = np.dot(normalized_embeddings, normalized_embeddings.T)

        # Add relationships for pairs with similarity above a threshold
        threshold = 0.8
        for i in range(len(file_ids)):
            for j in range(i + 1, len(file_ids)):
                if similarity_matrix[i, j] > threshold:
                    self._add_relationship(
                        file_ids[i], file_ids[j], "semantic_similarity"
                    )

    def _get_file_embeddings(self) -> Dict[str, List[float]]:
        """Get OpenAI embeddings for all text files."""
        embeddings: Dict[str, List[float]] = {}
        text_extensions = {"py", "js", "ts", "jsx", "tsx", "md", "txt", "html", "css"}

        for file_info in self.data["files"]:
            if (
                file_info["type"] == "file"
                and file_info["extension"] in text_extensions
            ):
                try:
                    file_path = os.path.join(self.repo_path, file_info["path"])
                    with open(file_path, encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    # Truncate content to avoid excessive token usage
                    content = content[:4096]
                    response = openai.Embedding.create(
                        input=content, model="text-embedding-ada-002"
                    )
                    embeddings[file_info["id"]] = response["data"][0]["embedding"]
                except Exception as e:
                    print(
                        f"Warning: Could not get embedding for {file_info['path']}: {e}"
                    )
        return embeddings

    def _add_filesystem_relationships(self) -> None:
        """Add relationships based on filesystem proximity."""
        for i, file1 in enumerate(self.data["files"]):
            if file1["type"] != "file":
                continue
            for j in range(i + 1, len(self.data["files"])):
                file2 = self.data["files"][j]
                if file2["type"] != "file":
                    continue

                # Add relationship if files are in the same directory
                if os.path.dirname(file1["path"]) == os.path.dirname(file2["path"]):
                    self._add_relationship(
                        file1["id"], file2["id"], "filesystem_proximity"
                    )

    def _analyze_history(self) -> None:
        """Analyze git history to get commit counts and recency for each file."""
        try:
            # Get commit history for all files in one go
            result = subprocess.run(
                ["git", "log", "--name-only", "--pretty=format:%H %at"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode != 0:
                return

            commit_counts: Dict[str, int] = {}
            last_modified: Dict[str, int] = {}
            current_commit_timestamp = 0

            for line in result.stdout.splitlines():
                if not line:
                    continue
                # Check if it's a commit line (hash and timestamp)
                if " " in line and len(line.split()[0]) == 40:
                    parts = line.split()
                    parts[0]
                    current_commit_timestamp = int(parts[1])
                else:
                    # It's a file path
                    file_path = line.strip()
                    if file_path in self.file_ids:
                        # Increment commit count
                        commit_counts[file_path] = commit_counts.get(file_path, 0) + 1
                        # Update last modified timestamp
                        if file_path not in last_modified:
                            last_modified[file_path] = current_commit_timestamp

            # Update file metrics
            for file_info in self.data["files"]:
                if file_info["type"] == "file":
                    path = file_info["path"]
                    if "metrics" not in file_info:
                        file_info["metrics"] = {}
                    file_info["metrics"]["commitCount"] = commit_counts.get(path, 0)
                    file_info["metrics"]["lastModified"] = last_modified.get(path, 0)

        except Exception as e:
            print(f"Warning: Could not analyze git history: {e}")

    def save_to_file(self, output_path: str) -> None:
        """
        Save the repository data to a JSON file.

        Args:
            output_path: Path to output JSON file
        """

        # Custom JSON encoder to handle datetime objects
        class DateTimeEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                return super().default(obj)

        with open(output_path, "w") as f:
            json.dump(self.data, f, indent=2, cls=DateTimeEncoder)

        print(f"Repository data saved to {output_path}")


def analyze_repository(
    repo_path: str,
    output_path: str,
    python_coverage_path: Optional[str] = None,
    frontend_coverage_path: Optional[str] = None,
) -> None:
    """
    Analyze a repository and generate visualization data.

    Args:
        repo_path: Path to the local git repository
        output_path: Path to output JSON file
        python_coverage_path: Path to Python coverage.json file
        frontend_coverage_path: Path to frontend coverage.json file
    """
    analyzer = RepositoryAnalyzer(
        repo_path,
        python_coverage_path=python_coverage_path,
        frontend_coverage_path=frontend_coverage_path,
    )
    analyzer.analyze()
    analyzer.save_to_file(output_path)

    print(f"Repository analysis complete. Data saved to {output_path}")
