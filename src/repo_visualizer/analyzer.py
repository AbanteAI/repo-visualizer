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
from typing import Dict, List, Optional, Tuple, cast

import pathspec

# Optional dependency for semantic similarity
from .schema import (
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
        self.file_ids: Dict[str, File] = {}
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
                                "lines": float(summary.get("lines", {}).get("pct", 0))
                                / 100.0,
                                "statements": float(
                                    summary.get("statements", {}).get("pct", 0)
                                )
                                / 100.0,
                                "functions": float(
                                    summary.get("functions", {}).get("pct", 0)
                                )
                                / 100.0,
                                "branches": float(
                                    summary.get("branches", {}).get("pct", 0)
                                )
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

        self.data["files"] = list(self.file_ids.values())
        self._consolidate_relationships()

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

    def _read_file_content(self, file_path: str) -> Optional[str]:
        """Read file content, returning None if it fails."""
        try:
            with open(os.path.join(self.repo_path, file_path), encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

    def _analyze_files(self) -> None:
        """Analyze file structure and content."""
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
                depth = len(rel_path.split("/")) - 1

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

                self.file_ids[rel_path] = dir_entry

                # Initialize directory in map
                dir_file_map[rel_path] = []

                # Create parent directory relationship
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in self.file_ids:
                    self._add_relationship(parent_dir, rel_path, "contains")
                    if parent_dir in dir_file_map:
                        dir_file_map[parent_dir].append(rel_path)

            # Process files
            for file_name in file_names:
                file_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(file_path, self.repo_path)

                # Skip if somehow outside repo path
                if rel_path.startswith(".."):
                    continue

                # Skip ignored files
                if self._is_ignored(rel_path, is_directory=False):
                    continue

                # Normalize path separator to forward slash
                rel_path = rel_path.replace(os.path.sep, "/")

                # Calculate file depth
                depth = len(rel_path.split("/")) - 1

                # Get file size
                try:
                    size = os.path.getsize(file_path)
                except OSError:
                    size = 0

                # Get coverage data
                file_coverage = coverage_data.get(rel_path)

                # Create file entry
                file_entry: File = {
                    "id": rel_path,
                    "path": rel_path,
                    "name": file_name,
                    "type": "file",
                    "depth": depth,
                    "size": size,
                    "components": [],
                    "coverage": file_coverage,
                }

                self.file_ids[rel_path] = file_entry

                # Add to parent directory map
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in dir_file_map:
                    dir_file_map[parent_dir].append(rel_path)
                    self._add_relationship(parent_dir, rel_path, "contains")

        # Update directory sizes
        self._update_directory_sizes(dir_file_map)

    def _update_directory_sizes(self, dir_file_map: Dict[str, List[str]]) -> None:
        """Recursively update directory sizes based on their contents."""
        # Sort directories by depth to process from deepest to shallowest
        sorted_dirs = sorted(
            [d for d in self.file_ids.values() if d["type"] == "directory"],
            key=lambda d: d["depth"],
            reverse=True,
        )

        for dir_entry in sorted_dirs:
            dir_path = dir_entry["path"]
            total_size = 0
            if dir_path in dir_file_map:
                for child_id in dir_file_map[dir_path]:
                    if child_id in self.file_ids:
                        total_size += self.file_ids[child_id]["size"]
            dir_entry["size"] = total_size

    def _extract_relationships(self) -> None:
        """Extract relationships between files."""
        for file_id, file_data in self.file_ids.items():
            if file_data["type"] == "file":
                content = self._read_file_content(file_id)
                if content:
                    # Extract relationships based on file type
                    ext = file_id.split(".")[-1]
                    if ext == "py":
                        self._extract_python_imports(file_id, content)
                    elif ext in ["js", "ts", "jsx", "tsx"]:
                        self._extract_js_imports(file_id, content)

    def _extract_python_imports(self, file_path: str, content: str) -> None:
        """Extract import relationships from Python files."""
        # Regex for `from . import ...` and `import ...`
        import_regex = re.compile(
            r"^(?:from\s+([.\w]+)\s+)?import\s+(?:\S+|\([^)]+\))", re.MULTILINE
        )
        # Regex for `from ... import (...)`
        from_import_regex = re.compile(
            r"^from\s+([.\w]+)\s+import\s+\(([^)]+)\)", re.MULTILINE | re.DOTALL
        )

        # Handle `from .module import something`
        for match in import_regex.finditer(content):
            if match.group(1):
                import_path = match.group(1)
                level = 0
                if import_path.startswith("."):
                    # Count leading dots for relative imports
                    level = len(import_path) - len(import_path.lstrip("."))
                    import_path = import_path.lstrip(".")

                if import_path:
                    target_file = self._resolve_python_import(
                        import_path, file_path, level
                    )
                    if target_file:
                        self._add_relationship(file_path, target_file, "import")

        # Handle multi-line `from ... import (a, b, c)`
        for match in from_import_regex.finditer(content):
            import_path = match.group(1)
            level = 0
            if import_path.startswith("."):
                level = len(import_path) - len(import_path.lstrip("."))
                import_path = import_path.lstrip(".")

            if import_path:
                target_file = self._resolve_python_import(import_path, file_path, level)
                if target_file:
                    self._add_relationship(file_path, target_file, "import")

    def _resolve_python_import(
        self, import_name: str, file_path: str, level: int = 0
    ) -> Optional[str]:
        """Resolve a Python import to a file path."""
        # Reconstruct the absolute path of the importing file's directory
        current_dir = os.path.dirname(os.path.join(self.repo_path, file_path))

        # Handle relative imports
        if level > 0:
            # Move up the directory tree for each level
            for _ in range(level - 1):
                current_dir = os.path.dirname(current_dir)

        # Convert import name to path segments
        import_parts = import_name.split(".")

        # Attempt to resolve as a .py file
        possible_file_path = os.path.join(current_dir, *import_parts) + ".py"
        if os.path.isfile(possible_file_path):
            return os.path.relpath(possible_file_path, self.repo_path).replace(
                os.path.sep, "/"
            )

        # Attempt to resolve as a package (directory with __init__.py)
        possible_package_path = os.path.join(current_dir, *import_parts)
        if os.path.isdir(possible_package_path):
            init_file = os.path.join(possible_package_path, "__init__.py")
            if os.path.isfile(init_file):
                return os.path.relpath(init_file, self.repo_path).replace(
                    os.path.sep, "/"
                )

        # Handle absolute imports from the repo root
        if level == 0:
            possible_path_from_root = os.path.join(self.repo_path, *import_parts)
            # As a file
            if os.path.isfile(possible_path_from_root + ".py"):
                return os.path.relpath(
                    possible_path_from_root + ".py", self.repo_path
                ).replace(os.path.sep, "/")
            # As a package
            if os.path.isdir(possible_path_from_root):
                init_file = os.path.join(possible_path_from_root, "__init__.py")
                if os.path.isfile(init_file):
                    return os.path.relpath(init_file, self.repo_path).replace(
                        os.path.sep, "/"
                    )

        return None

    def _extract_js_imports(self, file_path: str, content: str) -> None:
        """Extract import relationships from JavaScript/TypeScript files."""
        # This is a placeholder for future relationship extraction logic
        pass

    def _analyze_history(self) -> None:
        """Analyze git history to create commits data."""
        try:
            # Get git log with commit hash, author, date, and message
            log_format = "%H%x1f%an%x1f%ad%x1f%s"
            result = subprocess.run(
                ["git", "log", f"--format={log_format}", "--date=iso"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=True,
            )

            commits = []
            for line in result.stdout.strip().split("\n"):
                parts = line.split("\x1f")
                if len(parts) == 4:
                    commit_hash, author, date_str, message = parts
                    # Parse and convert to ISO format
                    dt = datetime.fromisoformat(
                        date_str.replace(" ", "T").replace(" +", "+")
                    )
                    commits.append(
                        {
                            "id": commit_hash,
                            "author": author,
                            "date": dt.isoformat(),
                            "message": message,
                        }
                    )
            self.data["commits"] = commits
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"Warning: Could not analyze git history: {e}")
            self.data["commits"] = []

    def _add_relationship(self, source: str, target: str, rel_type: str) -> None:
        """Add a relationship to the list, avoiding duplicates."""
        # Ensure both source and target are in file_ids before adding
        if source in self.file_ids and target in self.file_ids:
            # Use a tuple to count occurrences of each unique relationship
            rel_tuple = (source, target, rel_type)
            if rel_tuple not in self.relationship_counts:
                self.relationship_counts[rel_tuple] = 0
            self.relationship_counts[rel_tuple] += 1

    def _consolidate_relationships(self) -> None:
        """Consolidate relationships from counts to the final list."""
        self.relationships = [
            {
                "source": source,
                "target": target,
                "type": rel_type,
                "strength": count,
            }
            for (source, target, rel_type), count in self.relationship_counts.items()
        ]
        self.data["relationships"] = self.relationships

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
        self.file_ids: Dict[str, File] = {}
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
                                "lines": float(summary.get("lines", {}).get("pct", 0))
                                / 100.0,
                                "statements": float(
                                    summary.get("statements", {}).get("pct", 0)
                                )
                                / 100.0,
                                "functions": float(
                                    summary.get("functions", {}).get("pct", 0)
                                )
                                / 100.0,
                                "branches": float(
                                    summary.get("branches", {}).get("pct", 0)
                                )
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

        self.data["files"] = list(self.file_ids.values())
        self._consolidate_relationships()

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

    def _read_file_content(self, file_path: str) -> Optional[str]:
        """Read file content, returning None if it fails."""
        try:
            with open(os.path.join(self.repo_path, file_path), encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

    def _analyze_files(self) -> None:
        """Analyze file structure and content."""
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
                depth = len(rel_path.split("/")) - 1

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

                self.file_ids[rel_path] = dir_entry

                # Initialize directory in map
                dir_file_map[rel_path] = []

                # Create parent directory relationship
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in self.file_ids:
                    self._add_relationship(parent_dir, rel_path, "contains")
                    if parent_dir in dir_file_map:
                        dir_file_map[parent_dir].append(rel_path)

            # Process files
            for file_name in file_names:
                file_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(file_path, self.repo_path)

                # Skip if somehow outside repo path
                if rel_path.startswith(".."):
                    continue

                # Skip ignored files
                if self._is_ignored(rel_path, is_directory=False):
                    continue

                # Normalize path separator to forward slash
                rel_path = rel_path.replace(os.path.sep, "/")

                # Calculate file depth
                depth = len(rel_path.split("/")) - 1

                # Get file size
                try:
                    size = os.path.getsize(file_path)
                except OSError:
                    size = 0

                # Get coverage data
                file_coverage = coverage_data.get(rel_path)

                # Create file entry
                file_entry: File = {
                    "id": rel_path,
                    "path": rel_path,
                    "name": file_name,
                    "type": "file",
                    "depth": depth,
                    "size": size,
                    "components": [],
                    "coverage": file_coverage,
                }

                self.file_ids[rel_path] = file_entry

                # Add to parent directory map
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in dir_file_map:
                    dir_file_map[parent_dir].append(rel_path)
                    self._add_relationship(parent_dir, rel_path, "contains")

        # Update directory sizes
        self._update_directory_sizes(dir_file_map)

    def _update_directory_sizes(self, dir_file_map: Dict[str, List[str]]) -> None:
        """Recursively update directory sizes based on their contents."""
        # Sort directories by depth to process from deepest to shallowest
        sorted_dirs = sorted(
            [d for d in self.file_ids.values() if d["type"] == "directory"],
            key=lambda d: d["depth"],
            reverse=True,
        )

        for dir_entry in sorted_dirs:
            dir_path = dir_entry["path"]
            total_size = 0
            if dir_path in dir_file_map:
                for child_id in dir_file_map[dir_path]:
                    if child_id in self.file_ids:
                        total_size += self.file_ids[child_id]["size"]
            dir_entry["size"] = total_size

    def _extract_relationships(self) -> None:
        """Extract relationships between files."""
        for file_id, file_data in self.file_ids.items():
            if file_data["type"] == "file":
                content = self._read_file_content(file_id)
                if content:
                    # Extract relationships based on file type
                    ext = file_id.split(".")[-1]
                    if ext == "py":
                        self._extract_python_imports(file_id, content)
                    elif ext in ["js", "ts", "jsx", "tsx"]:
                        self._extract_js_imports(file_id, content)

    def _extract_python_imports(self, file_path: str, content: str) -> None:
        """Extract import relationships from Python files."""
        # Regex for `from . import ...` and `import ...`
        import_regex = re.compile(
            r"^(?:from\s+([.\w]+)\s+)?import\s+(?:\S+|\([^)]+\))", re.MULTILINE
        )
        # Regex for `from ... import (...)`
        from_import_regex = re.compile(
            r"^from\s+([.\w]+)\s+import\s+\(([^)]+)\)", re.MULTILINE | re.DOTALL
        )

        # Handle `from .module import something`
        for match in import_regex.finditer(content):
            if match.group(1):
                import_path = match.group(1)
                level = 0
                if import_path.startswith("."):
                    # Count leading dots for relative imports
                    level = len(import_path) - len(import_path.lstrip("."))
                    import_path = import_path.lstrip(".")

                if import_path:
                    target_file = self._resolve_python_import(
                        import_path, file_path, level
                    )
                    if target_file:
                        self._add_relationship(file_path, target_file, "import")

        # Handle multi-line `from ... import (a, b, c)`
        for match in from_import_regex.finditer(content):
            import_path = match.group(1)
            level = 0
            if import_path.startswith("."):
                level = len(import_path) - len(import_path.lstrip("."))
                import_path = import_path.lstrip(".")

            if import_path:
                target_file = self._resolve_python_import(import_path, file_path, level)
                if target_file:
                    self._add_relationship(file_path, target_file, "import")

    def _resolve_python_import(
        self, import_name: str, file_path: str, level: int = 0
    ) -> Optional[str]:
        """Resolve a Python import to a file path."""
        # Reconstruct the absolute path of the importing file's directory
        current_dir = os.path.dirname(os.path.join(self.repo_path, file_path))

        # Handle relative imports
        if level > 0:
            # Move up the directory tree for each level
            for _ in range(level - 1):
                current_dir = os.path.dirname(current_dir)

        # Convert import name to path segments
        import_parts = import_name.split(".")

        # Attempt to resolve as a .py file
        possible_file_path = os.path.join(current_dir, *import_parts) + ".py"
        if os.path.isfile(possible_file_path):
            return os.path.relpath(possible_file_path, self.repo_path).replace(
                os.path.sep, "/"
            )

        # Attempt to resolve as a package (directory with __init__.py)
        possible_package_path = os.path.join(current_dir, *import_parts)
        if os.path.isdir(possible_package_path):
            init_file = os.path.join(possible_package_path, "__init__.py")
            if os.path.isfile(init_file):
                return os.path.relpath(init_file, self.repo_path).replace(
                    os.path.sep, "/"
                )

        # Handle absolute imports from the repo root
        if level == 0:
            possible_path_from_root = os.path.join(self.repo_path, *import_parts)
            # As a file
            if os.path.isfile(possible_path_from_root + ".py"):
                return os.path.relpath(
                    possible_path_from_root + ".py", self.repo_path
                ).replace(os.path.sep, "/")
            # As a package
            if os.path.isdir(possible_path_from_root):
                init_file = os.path.join(possible_path_from_root, "__init__.py")
                if os.path.isfile(init_file):
                    return os.path.relpath(init_file, self.repo_path).replace(
                        os.path.sep, "/"
                    )

        return None

    def _extract_js_imports(self, file_path: str, content: str) -> None:
        """Extract import relationships from JavaScript/TypeScript files."""
        # This is a placeholder for future relationship extraction logic
        pass

    def _analyze_history(self) -> None:
        """Analyze git history to create commits data."""
        try:
            # Get git log with commit hash, author, date, and message
            log_format = "%H%x1f%an%x1f%ad%x1f%s"
            result = subprocess.run(
                ["git", "log", f"--format={log_format}", "--date=iso"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=True,
            )

            commits = []
            for line in result.stdout.strip().split("\n"):
                parts = line.split("\x1f")
                if len(parts) == 4:
                    commit_hash, author, date_str, message = parts
                    # Parse and convert to ISO format
                    dt = datetime.fromisoformat(
                        date_str.replace(" ", "T").replace(" +", "+")
                    )
                    commits.append(
                        {
                            "id": commit_hash,
                            "author": author,
                            "date": dt.isoformat(),
                            "message": message,
                        }
                    )
            self.data["commits"] = commits
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"Warning: Could not analyze git history: {e}")
            self.data["commits"] = []

    def _add_relationship(self, source: str, target: str, rel_type: str) -> None:
        """Add a relationship to the list, avoiding duplicates."""
        # Ensure both source and target are in file_ids before adding
        if source in self.file_ids and target in self.file_ids:
            # Use a tuple to count occurrences of each unique relationship
            rel_tuple = (source, target, rel_type)
            if rel_tuple not in self.relationship_counts:
                self.relationship_counts[rel_tuple] = 0
            self.relationship_counts[rel_tuple] += 1

    def _consolidate_relationships(self) -> None:
        """Consolidate relationships from counts to the final list."""
        self.relationships = [
            {
                "source": source,
                "target": target,
                "type": rel_type,
                "strength": count,
            }
            for (source, target, rel_type), count in self.relationship_counts.items()
        ]
        self.data["relationships"] = self.relationships

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
        self.file_ids: Dict[str, File] = {}
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
                                "lines": float(summary.get("lines", {}).get("pct", 0))
                                / 100.0,
                                "statements": float(
                                    summary.get("statements", {}).get("pct", 0)
                                )
                                / 100.0,
                                "functions": float(
                                    summary.get("functions", {}).get("pct", 0)
                                )
                                / 100.0,
                                "branches": float(
                                    summary.get("branches", {}).get("pct", 0)
                                )
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

        self.data["files"] = list(self.file_ids.values())
        self._consolidate_relationships()

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

    def _read_file_content(self, file_path: str) -> Optional[str]:
        """Read file content, returning None if it fails."""
        try:
            with open(os.path.join(self.repo_path, file_path), encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

    def _analyze_files(self) -> None:
        """Analyze file structure and content."""
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
                depth = len(rel_path.split("/")) - 1

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

                self.file_ids[rel_path] = dir_entry

                # Initialize directory in map
                dir_file_map[rel_path] = []

                # Create parent directory relationship
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in self.file_ids:
                    self._add_relationship(parent_dir, rel_path, "contains")
                    if parent_dir in dir_file_map:
                        dir_file_map[parent_dir].append(rel_path)

            # Process files
            for file_name in file_names:
                file_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(file_path, self.repo_path)

                # Skip if somehow outside repo path
                if rel_path.startswith(".."):
                    continue

                # Skip ignored files
                if self._is_ignored(rel_path, is_directory=False):
                    continue

                # Normalize path separator to forward slash
                rel_path = rel_path.replace(os.path.sep, "/")

                # Calculate file depth
                depth = len(rel_path.split("/")) - 1

                # Get file size
                try:
                    size = os.path.getsize(file_path)
                except OSError:
                    size = 0

                # Get coverage data
                file_coverage = coverage_data.get(rel_path)

                # Create file entry
                file_entry: File = {
                    "id": rel_path,
                    "path": rel_path,
                    "name": file_name,
                    "type": "file",
                    "depth": depth,
                    "size": size,
                    "components": [],
                    "coverage": file_coverage,
                }

                self.file_ids[rel_path] = file_entry

                # Add to parent directory map
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in dir_file_map:
                    dir_file_map[parent_dir].append(rel_path)
                    self._add_relationship(parent_dir, rel_path, "contains")

        # Update directory sizes
        self._update_directory_sizes(dir_file_map)

    def _update_directory_sizes(self, dir_file_map: Dict[str, List[str]]) -> None:
        """Recursively update directory sizes based on their contents."""
        # Sort directories by depth to process from deepest to shallowest
        sorted_dirs = sorted(
            [d for d in self.file_ids.values() if d["type"] == "directory"],
            key=lambda d: d["depth"],
            reverse=True,
        )

        for dir_entry in sorted_dirs:
            dir_path = dir_entry["path"]
            total_size = 0
            if dir_path in dir_file_map:
                for child_id in dir_file_map[dir_path]:
                    if child_id in self.file_ids:
                        total_size += self.file_ids[child_id]["size"]
            dir_entry["size"] = total_size

    def _extract_relationships(self) -> None:
        """Extract relationships between files."""
        for file_id, file_data in self.file_ids.items():
            if file_data["type"] == "file":
                content = self._read_file_content(file_id)
                if content:
                    # Extract relationships based on file type
                    ext = file_id.split(".")[-1]
                    if ext == "py":
                        self._extract_python_imports(file_id, content)
                    elif ext in ["js", "ts", "jsx", "tsx"]:
                        self._extract_js_imports(file_id, content)

    def _extract_python_imports(self, file_path: str, content: str) -> None:
        """Extract import relationships from Python files."""
        # Regex for `from . import ...` and `import ...`
        import_regex = re.compile(
            r"^(?:from\s+([.\w]+)\s+)?import\s+(?:\S+|\([^)]+\))", re.MULTILINE
        )
        # Regex for `from ... import (...)`
        from_import_regex = re.compile(
            r"^from\s+([.\w]+)\s+import\s+\(([^)]+)\)", re.MULTILINE | re.DOTALL
        )

        # Handle `from .module import something`
        for match in import_regex.finditer(content):
            if match.group(1):
                import_path = match.group(1)
                level = 0
                if import_path.startswith("."):
                    # Count leading dots for relative imports
                    level = len(import_path) - len(import_path.lstrip("."))
                    import_path = import_path.lstrip(".")

                if import_path:
                    target_file = self._resolve_python_import(
                        import_path, file_path, level
                    )
                    if target_file:
                        self._add_relationship(file_path, target_file, "import")

        # Handle multi-line `from ... import (a, b, c)`
        for match in from_import_regex.finditer(content):
            import_path = match.group(1)
            level = 0
            if import_path.startswith("."):
                level = len(import_path) - len(import_path.lstrip("."))
                import_path = import_path.lstrip(".")

            if import_path:
                target_file = self._resolve_python_import(import_path, file_path, level)
                if target_file:
                    self._add_relationship(file_path, target_file, "import")

    def _resolve_python_import(
        self, import_name: str, file_path: str, level: int = 0
    ) -> Optional[str]:
        """Resolve a Python import to a file path."""
        # Reconstruct the absolute path of the importing file's directory
        current_dir = os.path.dirname(os.path.join(self.repo_path, file_path))

        # Handle relative imports
        if level > 0:
            # Move up the directory tree for each level
            for _ in range(level - 1):
                current_dir = os.path.dirname(current_dir)

        # Convert import name to path segments
        import_parts = import_name.split(".")

        # Attempt to resolve as a .py file
        possible_file_path = os.path.join(current_dir, *import_parts) + ".py"
        if os.path.isfile(possible_file_path):
            return os.path.relpath(possible_file_path, self.repo_path).replace(
                os.path.sep, "/"
            )

        # Attempt to resolve as a package (directory with __init__.py)
        possible_package_path = os.path.join(current_dir, *import_parts)
        if os.path.isdir(possible_package_path):
            init_file = os.path.join(possible_package_path, "__init__.py")
            if os.path.isfile(init_file):
                return os.path.relpath(init_file, self.repo_path).replace(
                    os.path.sep, "/"
                )

        # Handle absolute imports from the repo root
        if level == 0:
            possible_path_from_root = os.path.join(self.repo_path, *import_parts)
            # As a file
            if os.path.isfile(possible_path_from_root + ".py"):
                return os.path.relpath(
                    possible_path_from_root + ".py", self.repo_path
                ).replace(os.path.sep, "/")
            # As a package
            if os.path.isdir(possible_path_from_root):
                init_file = os.path.join(possible_path_from_root, "__init__.py")
                if os.path.isfile(init_file):
                    return os.path.relpath(init_file, self.repo_path).replace(
                        os.path.sep, "/"
                    )

        return None

    def _extract_js_imports(self, file_path: str, content: str) -> None:
        """Extract import relationships from JavaScript/TypeScript files."""
        # This is a placeholder for future relationship extraction logic
        pass

    def _analyze_history(self) -> None:
        """Analyze git history to create commits data."""
        try:
            # Get git log with commit hash, author, date, and message
            log_format = "%H%x1f%an%x1f%ad%x1f%s"
            result = subprocess.run(
                ["git", "log", f"--format={log_format}", "--date=iso"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=True,
            )

            commits = []
            for line in result.stdout.strip().split("\n"):
                parts = line.split("\x1f")
                if len(parts) == 4:
                    commit_hash, author, date_str, message = parts
                    # Parse and convert to ISO format
                    dt = datetime.fromisoformat(
                        date_str.replace(" ", "T").replace(" +", "+")
                    )
                    commits.append(
                        {
                            "id": commit_hash,
                            "author": author,
                            "date": dt.isoformat(),
                            "message": message,
                        }
                    )
            self.data["commits"] = commits
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"Warning: Could not analyze git history: {e}")
            self.data["commits"] = []

    def _add_relationship(self, source: str, target: str, rel_type: str) -> None:
        """Add a relationship to the list, avoiding duplicates."""
        # Ensure both source and target are in file_ids before adding
        if source in self.file_ids and target in self.file_ids:
            # Use a tuple to count occurrences of each unique relationship
            rel_tuple = (source, target, rel_type)
            if rel_tuple not in self.relationship_counts:
                self.relationship_counts[rel_tuple] = 0
            self.relationship_counts[rel_tuple] += 1

    def _consolidate_relationships(self) -> None:
        """Consolidate relationships from counts to the final list."""
        self.relationships = [
            {
                "source": source,
                "target": target,
                "type": rel_type,
                "strength": count,
            }
            for (source, target, rel_type), count in self.relationship_counts.items()
        ]
        self.data["relationships"] = self.relationships

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
        self.file_ids: Dict[str, File] = {}
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
                                "lines": float(summary.get("lines", {}).get("pct", 0))
                                / 100.0,
                                "statements": float(
                                    summary.get("statements", {}).get("pct", 0)
                                )
                                / 100.0,
                                "functions": float(
                                    summary.get("functions", {}).get("pct", 0)
                                )
                                / 100.0,
                                "branches": float(
                                    summary.get("branches", {}).get("pct", 0)
                                )
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

        self.data["files"] = list(self.file_ids.values())
        self._consolidate_relationships()

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

    def _read_file_content(self, file_path: str) -> Optional[str]:
        """Read file content, returning None if it fails."""
        try:
            with open(os.path.join(self.repo_path, file_path), encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

    def _analyze_files(self) -> None:
        """Analyze file structure and content."""
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
                depth = len(rel_path.split("/")) - 1

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

                self.file_ids[rel_path] = dir_entry

                # Initialize directory in map
                dir_file_map[rel_path] = []

                # Create parent directory relationship
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in self.file_ids:
                    self._add_relationship(parent_dir, rel_path, "contains")
                    if parent_dir in dir_file_map:
                        dir_file_map[parent_dir].append(rel_path)

            # Process files
            for file_name in file_names:
                file_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(file_path, self.repo_path)

                # Skip if somehow outside repo path
                if rel_path.startswith(".."):
                    continue

                # Skip ignored files
                if self._is_ignored(rel_path, is_directory=False):
                    continue

                # Normalize path separator to forward slash
                rel_path = rel_path.replace(os.path.sep, "/")

                # Calculate file depth
                depth = len(rel_path.split("/")) - 1

                # Get file size
                try:
                    size = os.path.getsize(file_path)
                except OSError:
                    size = 0

                # Get coverage data
                file_coverage = coverage_data.get(rel_path)

                # Create file entry
                file_entry: File = {
                    "id": rel_path,
                    "path": rel_path,
                    "name": file_name,
                    "type": "file",
                    "depth": depth,
                    "size": size,
                    "components": [],
                    "coverage": file_coverage,
                }

                self.file_ids[rel_path] = file_entry

                # Add to parent directory map
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in dir_file_map:
                    dir_file_map[parent_dir].append(rel_path)
                    self._add_relationship(parent_dir, rel_path, "contains")

        # Update directory sizes
        self._update_directory_sizes(dir_file_map)

    def _update_directory_sizes(self, dir_file_map: Dict[str, List[str]]) -> None:
        """Recursively update directory sizes based on their contents."""
        # Sort directories by depth to process from deepest to shallowest
        sorted_dirs = sorted(
            [d for d in self.file_ids.values() if d["type"] == "directory"],
            key=lambda d: d["depth"],
            reverse=True,
        )

        for dir_entry in sorted_dirs:
            dir_path = dir_entry["path"]
            total_size = 0
            if dir_path in dir_file_map:
                for child_id in dir_file_map[dir_path]:
                    if child_id in self.file_ids:
                        total_size += self.file_ids[child_id]["size"]
            dir_entry["size"] = total_size

    def _extract_relationships(self) -> None:
        """Extract relationships between files."""
        for file_id, file_data in self.file_ids.items():
            if file_data["type"] == "file":
                content = self._read_file_content(file_id)
                if content:
                    # Extract relationships based on file type
                    ext = file_id.split(".")[-1]
                    if ext == "py":
                        self._extract_python_imports(file_id, content)
                    elif ext in ["js", "ts", "jsx", "tsx"]:
                        self._extract_js_imports(file_id, content)

    def _extract_python_imports(self, file_path: str, content: str) -> None:
        """Extract import relationships from Python files."""
        # Regex for `from . import ...` and `import ...`
        import_regex = re.compile(
            r"^(?:from\s+([.\w]+)\s+)?import\s+(?:\S+|\([^)]+\))", re.MULTILINE
        )
        # Regex for `from ... import (...)`
        from_import_regex = re.compile(
            r"^from\s+([.\w]+)\s+import\s+\(([^)]+)\)", re.MULTILINE | re.DOTALL
        )

        # Handle `from .module import something`
        for match in import_regex.finditer(content):
            if match.group(1):
                import_path = match.group(1)
                level = 0
                if import_path.startswith("."):
                    # Count leading dots for relative imports
                    level = len(import_path) - len(import_path.lstrip("."))
                    import_path = import_path.lstrip(".")

                if import_path:
                    target_file = self._resolve_python_import(
                        import_path, file_path, level
                    )
                    if target_file:
                        self._add_relationship(file_path, target_file, "import")

        # Handle multi-line `from ... import (a, b, c)`
        for match in from_import_regex.finditer(content):
            import_path = match.group(1)
            level = 0
            if import_path.startswith("."):
                level = len(import_path) - len(import_path.lstrip("."))
                import_path = import_path.lstrip(".")

            if import_path:
                target_file = self._resolve_python_import(import_path, file_path, level)
                if target_file:
                    self._add_relationship(file_path, target_file, "import")

    def _resolve_python_import(
        self, import_name: str, file_path: str, level: int = 0
    ) -> Optional[str]:
        """Resolve a Python import to a file path."""
        # Reconstruct the absolute path of the importing file's directory
        current_dir = os.path.dirname(os.path.join(self.repo_path, file_path))

        # Handle relative imports
        if level > 0:
            # Move up the directory tree for each level
            for _ in range(level - 1):
                current_dir = os.path.dirname(current_dir)

        # Convert import name to path segments
        import_parts = import_name.split(".")

        # Attempt to resolve as a .py file
        possible_file_path = os.path.join(current_dir, *import_parts) + ".py"
        if os.path.isfile(possible_file_path):
            return os.path.relpath(possible_file_path, self.repo_path).replace(
                os.path.sep, "/"
            )

        # Attempt to resolve as a package (directory with __init__.py)
        possible_package_path = os.path.join(current_dir, *import_parts)
        if os.path.isdir(possible_package_path):
            init_file = os.path.join(possible_package_path, "__init__.py")
            if os.path.isfile(init_file):
                return os.path.relpath(init_file, self.repo_path).replace(
                    os.path.sep, "/"
                )

        # Handle absolute imports from the repo root
        if level == 0:
            possible_path_from_root = os.path.join(self.repo_path, *import_parts)
            # As a file
            if os.path.isfile(possible_path_from_root + ".py"):
                return os.path.relpath(
                    possible_path_from_root + ".py", self.repo_path
                ).replace(os.path.sep, "/")
            # As a package
            if os.path.isdir(possible_path_from_root):
                init_file = os.path.join(possible_path_from_root, "__init__.py")
                if os.path.isfile(init_file):
                    return os.path.relpath(init_file, self.repo_path).replace(
                        os.path.sep, "/"
                    )

        return None

    def _extract_js_imports(self, file_path: str, content: str) -> None:
        """Extract import relationships from JavaScript/TypeScript files."""
        # This is a placeholder for future relationship extraction logic
        pass

    def _analyze_history(self) -> None:
        """Analyze git history to create commits data."""
        try:
            # Get git log with commit hash, author, date, and message
            log_format = "%H%x1f%an%x1f%ad%x1f%s"
            result = subprocess.run(
                ["git", "log", f"--format={log_format}", "--date=iso"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=True,
            )

            commits = []
            for line in result.stdout.strip().split("\n"):
                parts = line.split("\x1f")
                if len(parts) == 4:
                    commit_hash, author, date_str, message = parts
                    # Parse and convert to ISO format
                    dt = datetime.fromisoformat(
                        date_str.replace(" ", "T").replace(" +", "+")
                    )
                    commits.append(
                        {
                            "id": commit_hash,
                            "author": author,
                            "date": dt.isoformat(),
                            "message": message,
                        }
                    )
            self.data["commits"] = commits
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"Warning: Could not analyze git history: {e}")
            self.data["commits"] = []

    def _add_relationship(self, source: str, target: str, rel_type: str) -> None:
        """Add a relationship to the list, avoiding duplicates."""
        # Ensure both source and target are in file_ids before adding
        if source in self.file_ids and target in self.file_ids:
            # Use a tuple to count occurrences of each unique relationship
            rel_tuple = (source, target, rel_type)
            if rel_tuple not in self.relationship_counts:
                self.relationship_counts[rel_tuple] = 0
            self.relationship_counts[rel_tuple] += 1

    def _consolidate_relationships(self) -> None:
        """Consolidate relationships from counts to the final list."""
        self.relationships = [
            {
                "source": source,
                "target": target,
                "type": rel_type,
                "strength": count,
            }
            for (source, target, rel_type), count in self.relationship_counts.items()
        ]
        self.data["relationships"] = self.relationships
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
        self.file_ids: Dict[str, File] = {}
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
                                "lines": float(summary.get("lines", {}).get("pct", 0))
                                / 100.0,
                                "statements": float(
                                    summary.get("statements", {}).get("pct", 0)
                                )
                                / 100.0,
                                "functions": float(
                                    summary.get("functions", {}).get("pct", 0)
                                )
                                / 100.0,
                                "branches": float(
                                    summary.get("branches", {}).get("pct", 0)
                                )
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

        self.data["files"] = list(self.file_ids.values())
        self._consolidate_relationships()

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

        # Remove credentials from HTTPS URLs
        # Pattern matches: https://username:token@github.com/org/repo.git
        url = re.sub(r"https://[^@]+@([^/]+)(/.*)$", r"https://\1\2", url)

        # Remove credentials from SSH URLs if any
        # Pattern matches: ssh://user:pass@host/path
        url = re.sub(r"ssh://[^@]+@([^/]+)(/.*)$", r"ssh://\1\2", url)

        return url

    def _read_file_content(self, file_path: str) -> Optional[str]:
        """Read file content, returning None if it fails."""
        try:
            with open(os.path.join(self.repo_path, file_path), encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

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

    def _read_file_content(self, file_path: str) -> Optional[str]:
        """Read file content, returning None if it fails."""
        try:
            with open(os.path.join(self.repo_path, file_path), encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

    def _analyze_files(self) -> None:
        """Analyze file structure and content."""
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
                depth = len(rel_path.split("/")) - 1

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

                self.file_ids[rel_path] = dir_entry

                # Initialize directory in map
                dir_file_map[rel_path] = []

                # Create parent directory relationship
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in self.file_ids:
                    self._add_relationship(parent_dir, rel_path, "contains")
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

                # Normalize path separator
                rel_path = rel_path.replace(os.path.sep, "/")

                # Get file extension
                _, ext = os.path.splitext(file_name)
                ext = ext.lstrip(".").lower()

                # Get file size
                try:
                    size = os.path.getsize(os.path.join(root, file_name))
                except OSError:
                    continue

                # Calculate file depth
                depth = len(rel_path.split("/")) - 1

                # Create file entry
                file_entry: File = {
                    "id": rel_path,
                    "path": rel_path,
                    "name": file_name,
                    "type": "file",
                    "extension": ext,
                    "size": size,
                    "depth": depth,
                    "components": [],
                }

                # Add test coverage if available
                file_coverage = coverage_data.get(rel_path)
                if file_coverage:
                    if file_entry.get("metrics") is None:
                        file_entry["metrics"] = {}

                    metrics = file_entry.get("metrics")
                    if metrics:
                        metrics["testCoverage"] = file_coverage

                # Analyze file content for components and relationships
                try:
                    with open(os.path.join(root, file_name), encoding="utf-8") as f:
                        content = f.read()
                    self._analyze_file_content(content, file_entry)
                    self._extract_file_relationships(content, rel_path, ext)
                except Exception as e:
                    print(f"Warning: Could not analyze file {rel_path}: {e}")

                self.file_ids[rel_path] = file_entry

                # Add to parent directory map
                parent_dir = os.path.dirname(rel_path)
                if parent_dir and parent_dir in dir_file_map:
                    dir_file_map[parent_dir].append(rel_path)
                    self._add_relationship(parent_dir, rel_path, "contains")

    def _analyze_file_content(self, content: str, file_info: File) -> None:
        """Analyze file content to extract components and metrics."""
        lines = content.splitlines()
        metrics = {
            "linesOfCode": len(lines),
            "emptyLines": lines.count(""),
            "commentLines": sum(
                1
                for line in lines
                if line.strip().startswith(("#", "//", "/*", "*", "*/"))
            ),
        }
        if file_info.get("metrics") is None:
            file_info["metrics"] = {}

        # We know that metrics is not None here
        file_metrics = cast(Dict, file_info["metrics"])
        file_metrics.update(metrics)

        if file_info["extension"] == "py":
            components, _ = self._analyze_python_file(
                content, file_info["path"], file_metrics
            )
            file_info["components"] = components
        elif file_info["extension"] in ("js", "ts", "jsx", "tsx"):
            components, _ = self._analyze_js_file(
                content, file_info["path"], file_metrics
            )
            file_info["components"] = components

    def _extract_file_relationships(
        self, content: str, file_path: str, extension: str
    ) -> None:
        """Extract relationships from a single file."""
        if extension == "py":
            self._extract_python_imports(content, file_path)
        elif extension in ("js", "ts", "jsx", "tsx"):
            self._extract_js_imports(content, file_path)

    def _extract_python_imports(self, file_path: str, content: str) -> None:
        """Extract import relationships from Python files."""
        # Regex for `from . import ...` and `import ...`
        import_regex = re.compile(
            r"^(?:from\s+([.\w]+)\s+)?import\s+(?:\S+|\([^)]+\))", re.MULTILINE
        )
        # Regex for `from ... import (...)`
        from_import_regex = re.compile(
            r"^from\s+([.\w]+)\s+import\s+\(([^)]+)\)", re.MULTILINE | re.DOTALL
        )

        # Handle `from .module import something`
        for match in import_regex.finditer(content):
            if match.group(1):
                import_path = match.group(1)
                level = 0
                if import_path.startswith("."):
                    # Count leading dots for relative imports
                    level = len(import_path) - len(import_path.lstrip("."))
                    import_path = import_path.lstrip(".")

                if import_path:
                    target_file = self._resolve_python_import(
                        import_path, file_path, level
                    )
                    if target_file:
                        self._add_relationship(file_path, target_file, "import")

        # Handle multi-line `from ... import (a, b, c)`
        for match in from_import_regex.finditer(content):
            import_path = match.group(1)
            level = 0
            if import_path.startswith("."):
                level = len(import_path) - len(import_path.lstrip("."))
                import_path = import_path.lstrip(".")

            if import_path:
                target_file = self._resolve_python_import(import_path, file_path, level)
                if target_file:
                    self._add_relationship(file_path, target_file, "import")

    def _extract_relationships(self) -> None:
        """Extract relationships between files."""
        # This is a placeholder for future relationship extraction logic
        pass

    def _add_relationship(self, source: str, target: str, type: str) -> None:
        """Add a relationship, handling duplicates and counting."""
        # For undirected relationships, ensure consistent key ordering
        if type in ("semantic_similarity", "filesystem_proximity"):
            rel_key_tuple = (*tuple(sorted((source, target))), type)
        else:
            rel_key_tuple = (source, target, type)

        rel_key = cast(Tuple[str, str, str], rel_key_tuple)

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
            if type in ("semantic_similarity", "filesystem_proximity"):
                rel_key_tuple = (*tuple(sorted((source, target))), type)
            else:
                rel_key_tuple = (source, target, type)

            rel_key = cast(Tuple[str, str, str], rel_key_tuple)
            strength = self.relationship_counts.get(rel_key, 1)
            consolidated.append(
                {"source": source, "target": target, "type": type, "strength": strength}
            )
        self.data["relationships"] = consolidated

    def _analyze_history(self) -> None:
        """Analyze git history to get commit metrics."""
        try:
            result = subprocess.run(
                ["git", "log", "--name-status", "--pretty=format:commit:%H %at"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=True,
            )
            log_output = result.stdout
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"Warning: Could not analyze git history: {e}")
            return

        current_commit_timestamp = 0
        for line in log_output.splitlines():
            if line.startswith("commit:"):
                parts = line.split()
                if len(parts) >= 3:
                    current_commit_timestamp = int(parts[2])
            elif line:
                parts = line.split("\t")
                if len(parts) >= 2:
                    status = parts[0]
                    file_path = parts[1]

                    # Handle renamed files
                    if status.startswith("R"):
                        _, file_path, new_path = parts
                        file_path = new_path

                    if file_path in self.file_ids:
                        file_info = self.file_ids[file_path]
                        if not isinstance(file_info, dict):
                            continue
                        if file_info.get("metrics") is None:
                            file_info["metrics"] = {}

                        metrics = file_info.get("metrics")
                        if metrics:
                            metrics["lastModified"] = current_commit_timestamp
                            metrics["commitCount"] = metrics.get("commitCount", 0) + 1

    def _analyze_python_file(
        self, content: str, file_path: str, metrics: Dict
    ) -> Tuple[List[Dict], Dict]:
        """Analyze Python file to extract components."""
        components = []
        try:
            import ast

            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    components.append(
                        {
                            "id": f"{file_path}:{node.name}",
                            "name": node.name,
                            "type": "function",
                            "lineStart": node.lineno,
                            "lineEnd": node.end_lineno,
                        }
                    )
                elif isinstance(node, ast.ClassDef):
                    components.append(
                        {
                            "id": f"{file_path}:{node.name}",
                            "name": node.name,
                            "type": "class",
                            "lineStart": node.lineno,
                            "lineEnd": node.end_lineno,
                            "components": [],
                        }
                    )
        except Exception as e:
            print(f"Warning: Could not parse Python file {file_path}: {e}")
        return components, metrics

    def _analyze_js_file(
        self, content: str, file_path: str, metrics: Dict
    ) -> Tuple[List[Dict], Dict]:
        """Analyze JavaScript/TypeScript file to extract components."""
        components = []
        # Simplified analysis. A better solution would use a proper JS/TS parser.
        function_patterns = [
            r"function\s+([a-zA-Z0-9_]+)\s*\(",  # function myFunction()
            r"const\s+([a-zA-Z0-9_]+)\s*=\s*\(",  # const myFunction = () =>
            r"let\s+([a-zA-Z0-9_]+)\s*=\s*\(",  # let myFunction = () =>
            r"var\s+([a-zA-Z0-9_]+)\s*=\s*\(",  # var myFunction = () =>
        ]
        class_pattern = r"class\s+([a-zA-Z0-9_]+)"

        for i, line in enumerate(content.splitlines()):
            for pattern in function_patterns:
                match = re.search(pattern, line)
                if match:
                    components.append(
                        {
                            "id": f"{file_path}:{match.group(1)}",
                            "name": match.group(1),
                            "type": "function",
                            "lineStart": i + 1,
                            "lineEnd": i + 1,
                        }
                    )

            match = re.search(class_pattern, line)
            if match:
                components.append(
                    {
                        "id": f"{file_path}:{match.group(1)}",
                        "name": match.group(1),
                        "type": "class",
                        "lineStart": i + 1,
                        "lineEnd": i + 1,
                        "components": [],
                    }
                )
        return components, metrics

    def _extract_python_imports(self, content: str, file_path: str) -> None:
        """Extract import relationships from a Python file."""
        try:
            import ast

            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        resolved_path = self._resolve_python_import(
                            alias.name, file_path
                        )
                        if resolved_path:
                            self._add_relationship(file_path, resolved_path, "import")
                elif isinstance(node, ast.ImportFrom):
                    module = node.module
                    if module:
                        for alias in node.names:
                            self._handle_import_from_alias(
                                module, file_path, node.level, alias
                            )
        except Exception as e:
            print(f"Warning: Could not parse Python file for imports {file_path}: {e}")

    def _handle_import_from_alias(self, module, file_path, level, alias):
        resolved_path = self._resolve_python_import(module, file_path, level)
        if resolved_path:
            # If resolved to a package, find the specific module.
            if os.path.basename(resolved_path) == "__init__.py":
                module_dir = os.path.dirname(resolved_path)
                imported_file = os.path.join(module_dir, alias.name + ".py")
                if imported_file in self.file_ids:
                    self._add_relationship(file_path, imported_file, "import")
                else:
                    # Fallback to package if module not found
                    self._add_relationship(file_path, resolved_path, "import")
            else:
                self._add_relationship(file_path, resolved_path, "import")

    def _resolve_python_import(
        self, import_name: str, file_path: str, level: int = 0
    ) -> Optional[str]:
        """Resolve a Python import to a file path."""
        if level > 0:
            # Relative import
            base_path = os.path.dirname(file_path)
            for _ in range(level - 1):
                base_path = os.path.dirname(base_path)
        else:
            # Absolute import from repo root
            base_path = ""

        parts = import_name.split(".")

        # Try resolving as a file (e.g. from . import a)
        possible_path = os.path.join(self.repo_path, base_path, *parts) + ".py"
        if os.path.exists(possible_path):
            return os.path.relpath(possible_path, self.repo_path).replace(
                os.path.sep, "/"
            )

        # Try resolving as a directory/package (e.g. import a)
        possible_path = os.path.join(self.repo_path, base_path, *parts, "__init__.py")
        if os.path.exists(possible_path):
            return os.path.relpath(possible_path, self.repo_path).replace(
                os.path.sep, "/"
            )

        # Try resolving relative to file path
        if level > 0:
            possible_path = os.path.join(os.path.dirname(file_path), *parts) + ".py"
            if os.path.exists(possible_path):
                return os.path.relpath(possible_path, self.repo_path).replace(
                    os.path.sep, "/"
                )

        return None

    def _extract_js_imports(self, content: str, file_path: str) -> None:
        """Extract import relationships from a JavaScript/TypeScript file."""
        # Simplified analysis for JS/TS files.
        import_pattern = re.compile(
            r"""
            (?:import|export) .*? from \s* ['"]([^'"]+)['"] | # import/export ... from
            import \s* ['"]([^'"]+)['"] | # import "..."
            require \s* \( \s* ['"]([^'"]+)['"] \s* \) # require("...")
            """,
            re.VERBOSE,
        )
        for match in import_pattern.finditer(content):
            import_path = next((g for g in match.groups() if g is not None), None)
            if import_path:
                resolved_path = self._resolve_js_import(import_path, file_path)
                if resolved_path:
                    self._add_relationship(file_path, resolved_path, "import")

    def _resolve_js_import(self, import_path: str, file_path: str) -> Optional[str]:
        """Resolve a JavaScript import path to a file path."""
        if not import_path.startswith((".", "/")):
            return None  # Skip node_modules imports

        base_dir = os.path.dirname(file_path)

        # Handle absolute paths from root
        if import_path.startswith("/"):
            base_dir = self.repo_path
            import_path = import_path[1:]

        resolved_path = os.path.normpath(os.path.join(base_dir, import_path))

        # Try with extensions
        for ext in [
            ".js",
            ".ts",
            ".jsx",
            ".tsx",
            "/index.js",
            "/index.ts",
            "/index.jsx",
            "/index.tsx",
        ]:
            path_with_ext = resolved_path + ext
            if path_with_ext in self.file_ids:
                return path_with_ext

        if resolved_path in self.file_ids:
            return resolved_path

        return None


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
    data = analyzer.analyze()
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
