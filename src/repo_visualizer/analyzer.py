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
from typing import Any, Dict, List, Optional, Set, Tuple

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

    def __init__(self, repo_path: str):
        """
        Initialize the repository analyzer.

        Args:
            repo_path: Path to the local git repository
        """
        self.repo_path = os.path.abspath(repo_path)
        if not os.path.isdir(self.repo_path):
            raise ValueError(f"Repository path does not exist: {self.repo_path}")

        # Check if it's a git repo
        git_dir = os.path.join(self.repo_path, ".git")
        if not os.path.isdir(git_dir):
            raise ValueError(f"Not a git repository: {self.repo_path}")

        self.data = create_empty_schema()
        self.file_ids: Set[str] = set()
        self.relationships: List[Relationship] = []

        # Load gitignore patterns
        self.gitignore_spec = self._load_gitignore_patterns()

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

                # Skip if somehow outside repo path
                if rel_path.startswith(".."):
                    continue

                # Normalize path separator to forward slash
                rel_path = rel_path.replace(os.path.sep, "/")

                # Calculate file depth
                depth = len(os.path.dirname(rel_path).split("/"))
                if os.path.dirname(rel_path) == "":
                    depth = 0

                # Get file extension
                _, ext = os.path.splitext(file_name)
                ext = ext.lstrip(".")

                # Get file size
                try:
                    size = os.path.getsize(file_path)
                except Exception:
                    size = 0

                # Get file creation and modification times
                try:
                    created = datetime.fromtimestamp(
                        os.path.getctime(file_path)
                    ).isoformat()
                    updated = datetime.fromtimestamp(
                        os.path.getmtime(file_path)
                    ).isoformat()
                except Exception:
                    created = None
                    updated = None

                # Extract components and metrics based on file type
                components, metrics = self._analyze_file_content(
                    file_path, rel_path, ext
                )

                # Extract git history data for this file
                git_metrics = self._extract_file_git_metrics(rel_path)
                if git_metrics:
                    if not metrics:
                        metrics = {}
                    metrics.update(git_metrics)

                # Create file entry
                file_entry: File = {
                    "id": rel_path,
                    "path": rel_path,
                    "name": file_name,
                    "extension": ext if ext else None,
                    "size": size,
                    "type": "file",
                    "depth": depth,
                    "components": components,
                }

                if created:
                    file_entry["createdAt"] = created
                if updated:
                    file_entry["updatedAt"] = updated
                if metrics:
                    file_entry["metrics"] = metrics

                files.append(file_entry)
                self.file_ids.add(rel_path)

                # Create relationship with parent directory
                parent_dir = os.path.dirname(rel_path)
                if parent_dir:
                    # Ensure parent_dir exists as an entry
                    if parent_dir not in self.file_ids:
                        # Create missing directory entries
                        # (this can happen with nested directories)
                        parts = parent_dir.split("/")
                        current_path = ""
                        for i, part in enumerate(parts):
                            current_path = (
                                current_path + part
                                if i == 0
                                else f"{current_path}/{part}"
                            )
                            if current_path not in self.file_ids:
                                dir_depth = i
                                dir_entry = {
                                    "id": current_path,
                                    "path": current_path,
                                    "name": part,
                                    "type": "directory",
                                    "depth": dir_depth,
                                    "size": 0,
                                    "components": [],
                                }
                                files.append(dir_entry)
                                self.file_ids.add(current_path)
                                dir_file_map[current_path] = []

                                # Create relationship with parent
                                if i > 0:
                                    parent_path = "/".join(parts[:i])
                                    if parent_path in self.file_ids:
                                        self.relationships.append(
                                            {
                                                "source": parent_path,
                                                "target": current_path,
                                                "type": "contains",
                                            }
                                        )
                                        if parent_path in dir_file_map:
                                            dir_file_map[parent_path].append(
                                                current_path
                                            )

                    # Create contains relationship
                    self.relationships.append(
                        {
                            "source": parent_dir,
                            "target": rel_path,
                            "type": "contains",
                        }
                    )
                    if parent_dir in dir_file_map:
                        dir_file_map[parent_dir].append(rel_path)

                # Add file-component relationships
                for component in components:
                    self.relationships.append(
                        {
                            "source": rel_path,
                            "target": component["id"],
                            "type": "contains",
                        }
                    )

                    # Add component-to-component relationships (for methods in a class)
                    for method in component.get("components", []):
                        self.relationships.append(
                            {
                                "source": component["id"],
                                "target": method["id"],
                                "type": "contains",
                            }
                        )

        # Update file sizes for directories
        self._update_directory_sizes(files)

        # Set files in data
        self.data["files"] = files

    def _analyze_file_content(
        self, file_path: str, rel_path: str, extension: str
    ) -> Tuple[List[Component], Optional[Dict[str, Any]]]:
        """
        Analyze file content to extract components and metrics.

        Args:
            file_path: Absolute path to the file
            rel_path: Relative path from repository root
            extension: File extension

        Returns:
            Tuple of components list and metrics dictionary
        """
        components: List[Component] = []
        metrics: Dict[str, Any] = {}

        # Skip binary files and files that are too large
        try:
            if (
                not self._is_text_file(file_path)
                or os.path.getsize(file_path) > 1024 * 1024
            ):
                return components, None

            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
                lines = content.split("\n")

                # Calculate basic metrics
                metrics["linesOfCode"] = len(lines)
                metrics["emptyLines"] = len(
                    [line for line in lines if not line.strip()]
                )

                # Extract components based on file type
                if extension == "py":
                    components, metrics = self._analyze_python_file(
                        content, rel_path, metrics
                    )
                elif extension in ("js", "ts", "jsx", "tsx"):
                    components, metrics = self._analyze_js_file(
                        content, rel_path, metrics
                    )

                # Extract imports and add relationships
                self._extract_file_relationships(content, rel_path, extension)

                return components, metrics
        except Exception as e:
            print(f"Error analyzing file {rel_path}: {e}")
            return components, None

    def _is_text_file(self, file_path: str) -> bool:
        """Check if a file is a text file by looking at the first 1024 bytes."""
        try:
            with open(file_path, "rb") as f:
                chunk = f.read(1024)
                return b"\0" not in chunk
        except Exception:
            return False

    def _analyze_python_file(
        self, content: str, file_path: str, metrics: Dict[str, Any]
    ) -> Tuple[List[Component], Dict[str, Any]]:
        """
        Analyze Python file to extract classes and functions.

        Args:
            content: File content
            file_path: Relative file path
            metrics: Existing metrics dictionary

        Returns:
            Tuple of components list and updated metrics
        """
        components: List[Component] = []

        # Count comment lines
        comment_lines = 0
        for line in content.split("\n"):
            line = line.strip()
            if line.startswith("#"):
                comment_lines += 1
            elif '"""' in line or "'''" in line:
                # Simple heuristic for docstrings, not perfect
                comment_lines += 1

        metrics["commentLines"] = comment_lines

        # Count top-level identifiers (classes, functions, variables)
        top_level_count = 0

        # Extract classes using regex
        class_pattern = r"class\s+(\w+)(?:\(.*\))?:"
        class_matches = re.finditer(class_pattern, content)
        class_count = 0

        for class_match in class_matches:
            class_name = class_match.group(1)
            class_start = content[: class_match.start()].count("\n") + 1

            # Find class end by indentation
            lines = content.split("\n")
            class_end = class_start
            for i in range(class_start, len(lines)):
                if (
                    i + 1 < len(lines)
                    and lines[i + 1].strip()
                    and not lines[i + 1].startswith(" ")
                ):
                    class_end = i + 1
                    break
                class_end = i + 1

            # Create class component
            class_component: Component = {
                "id": f"{file_path}:{class_name}",
                "name": class_name,
                "type": "class",
                "lineStart": class_start,
                "lineEnd": class_end,
                "components": [],
            }

            class_count += 1

            # Extract methods within class
            method_pattern = r"    def\s+(\w+)\s*\("
            class_content = "\n".join(lines[class_start - 1 : class_end])
            method_matches = re.finditer(method_pattern, class_content)

            for method_match in method_matches:
                method_name = method_match.group(1)
                method_start = class_start + class_content[
                    : method_match.start()
                ].count("\n")

                # Find method end by indentation
                method_end = method_start
                for i in range(method_start, class_end):
                    if (
                        i + 1 < len(lines)
                        and lines[i + 1].strip()
                        and not lines[i + 1].startswith("        ")
                    ):
                        method_end = i + 1
                        break
                    method_end = i + 1

                # Create method component
                method_component: Component = {
                    "id": f"{file_path}:{class_name}.{method_name}",
                    "name": method_name,
                    "type": "method",
                    "lineStart": method_start,
                    "lineEnd": method_end,
                    "components": [],
                }

                class_component["components"].append(method_component)

            components.append(class_component)

        # Extract top-level functions
        function_pattern = r"^def\s+(\w+)\s*\("
        function_matches = re.finditer(function_pattern, content, re.MULTILINE)
        function_count = 0

        for func_match in function_matches:
            func_name = func_match.group(1)
            func_start = content[: func_match.start()].count("\n") + 1

            # Find function end by indentation
            lines = content.split("\n")
            func_end = func_start
            for i in range(func_start, len(lines)):
                if (
                    i + 1 < len(lines)
                    and lines[i + 1].strip()
                    and not lines[i + 1].startswith(" ")
                ):
                    func_end = i + 1
                    break
                func_end = i + 1

            # Create function component
            func_component: Component = {
                "id": f"{file_path}:{func_name}",
                "name": func_name,
                "type": "function",
                "lineStart": func_start,
                "lineEnd": func_end,
                "components": [],
            }

            components.append(func_component)
            function_count += 1

        # Count top-level variables (simplified heuristic)
        variable_pattern = r"^(\w+)\s*="
        variable_matches = re.finditer(variable_pattern, content, re.MULTILINE)
        variable_count = 0

        for var_match in variable_matches:
            var_name = var_match.group(1)
            # Skip if it's inside a function or class (basic check)
            line_start = content[: var_match.start()].count("\n") + 1
            lines = content.split("\n")
            if line_start > 0 and line_start <= len(lines):
                line = lines[line_start - 1]
                if not line.startswith(" ") and not line.startswith("\t"):
                    # Skip common non-variable assignments
                    if var_name not in [
                        "if",
                        "for",
                        "while",
                        "try",
                        "except",
                        "finally",
                        "with",
                        "import",
                        "from",
                    ]:
                        variable_count += 1

        # Total top-level identifiers
        top_level_count = class_count + function_count + variable_count
        metrics["topLevelIdentifiers"] = top_level_count

        return components, metrics

    def _analyze_js_file(
        self, content: str, file_path: str, metrics: Dict[str, Any]
    ) -> Tuple[List[Component], Dict[str, Any]]:
        """
        Analyze JavaScript/TypeScript file to extract classes and functions.

        Args:
            content: File content
            file_path: Relative file path
            metrics: Existing metrics dictionary

        Returns:
            Tuple of components list and updated metrics
        """
        components: List[Component] = []

        # Count comment lines
        comment_lines = 0
        for line in content.split("\n"):
            line = line.strip()
            if line.startswith("//"):
                comment_lines += 1
            elif "/*" in line or "*/" in line:
                # Simple heuristic for block comments, not perfect
                comment_lines += 1

        metrics["commentLines"] = comment_lines

        # Count top-level identifiers (classes, functions, variables)
        top_level_count = 0

        # Extract classes using regex (simplified)
        class_pattern = (
            r"class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+\w+)?\s*\{"
        )
        class_matches = re.finditer(class_pattern, content)
        class_count = 0

        for class_match in class_matches:
            class_name = class_match.group(1)
            class_start = content[: class_match.start()].count("\n") + 1

            # Find class end (this is simplified and may not handle nested classes well)
            class_content = content[class_match.start() :]
            open_braces = 0
            for i, char in enumerate(class_content):
                if char == "{":
                    open_braces += 1
                elif char == "}":
                    open_braces -= 1
                    if open_braces == 0:
                        class_end = class_start + class_content[:i].count("\n")
                        break
            else:
                class_end = content.count("\n") + 1

            # Create class component
            class_component: Component = {
                "id": f"{file_path}:{class_name}",
                "name": class_name,
                "type": "class",
                "lineStart": class_start,
                "lineEnd": class_end,
                "components": [],
            }

            components.append(class_component)
            class_count += 1

        # Extract functions (simplified)
        function_patterns = [
            r"function\s+(\w+)\s*\(",  # regular functions
            r"const\s+(\w+)\s*=\s*function",  # function expressions
            r"const\s+(\w+)\s*=\s*\(",  # arrow functions
        ]
        function_count = 0

        for pattern in function_patterns:
            func_matches = re.finditer(pattern, content)
            for func_match in func_matches:
                func_name = func_match.group(1)
                func_start = content[: func_match.start()].count("\n") + 1

                # Find function end (simplified)
                func_content = content[func_match.start() :]
                open_braces = 0
                for i, char in enumerate(func_content):
                    if char == "{":
                        open_braces += 1
                    elif char == "}":
                        open_braces -= 1
                        if open_braces == 0:
                            func_end = func_start + func_content[:i].count("\n")
                            break
                else:
                    func_end = func_start + 10  # Arbitrary fallback

                # Create function component
                func_component: Component = {
                    "id": f"{file_path}:{func_name}",
                    "name": func_name,
                    "type": "function",
                    "lineStart": func_start,
                    "lineEnd": func_end,
                    "components": [],
                }

                components.append(func_component)
                function_count += 1

        # Count top-level variables/constants (simplified heuristic)
        variable_patterns = [
            r"^const\s+(\w+)\s*=",  # const declarations
            r"^let\s+(\w+)\s*=",  # let declarations
            r"^var\s+(\w+)\s*=",  # var declarations
        ]
        variable_count = 0

        for pattern in variable_patterns:
            var_matches = re.finditer(pattern, content, re.MULTILINE)
            for var_match in var_matches:
                # Skip if it's a function (already counted)
                if not any(
                    func_pattern in content[var_match.start() : var_match.end() + 50]
                    for func_pattern in ["function", "=>"]
                ):
                    variable_count += 1

        # Count export statements (additional top-level identifiers)
        export_pattern = (
            r"^export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)"
        )
        export_matches = re.finditer(export_pattern, content, re.MULTILINE)
        export_count = len(list(export_matches))

        # Total top-level identifiers
        top_level_count = class_count + function_count + variable_count + export_count
        metrics["topLevelIdentifiers"] = top_level_count

        return components, metrics

    def _extract_file_relationships(
        self, content: str, file_path: str, extension: str
    ) -> None:
        """
        Extract relationships from file content.

        Args:
            content: File content
            file_path: Relative file path
            extension: File extension
        """
        if extension == "py":
            # Extract Python imports - more comprehensive patterns
            import_patterns = [
                # Standard imports
                r"import\s+([\w\.]+(?:\s*,\s*[\w\.]+)*)",
                # From imports with specific items
                r"from\s+([\w\.]+)\s+import\s+(?:[\w\*]+(?:\s*,\s*[\w\*]+)*|\((?:[\w\*]+(?:\s*,\s*[\w\*]+)*)\))",
                # Relative imports
                r"from\s+(\.*[\w\.]*)\s+import",
                # Import with aliases
                r"import\s+([\w\.]+)\s+as\s+\w+",
                # From import with alias
                r"from\s+([\w\.]+)\s+import\s+[\w\*]+\s+as\s+\w+",
            ]

            # Process each import pattern
            for pattern in import_patterns:
                try:
                    matches = re.finditer(pattern, content)
                    for match in matches:
                        raw_modules = match.group(1)

                        # Handle comma-separated imports
                        if "," in raw_modules and "from" not in match.group(0):
                            modules = [m.strip() for m in raw_modules.split(",")]
                        else:
                            modules = [raw_modules]

                        for module in modules:
                            # Try to resolve the import to a file in the repository
                            import_paths = self._resolve_python_import(
                                module, file_path
                            )
                            for import_path in import_paths:
                                if import_path and import_path in self.file_ids:
                                    relationship: Relationship = {
                                        "source": file_path,
                                        "target": import_path,
                                        "type": "import",
                                    }
                                    # Check if this relationship already exists
                                    if not any(
                                        r["source"] == relationship["source"]
                                        and r["target"] == relationship["target"]
                                        and r["type"] == relationship["type"]
                                        for r in self.relationships
                                    ):
                                        self.relationships.append(relationship)
                except Exception as e:
                    print(
                        f"Error extracting Python relationships from {file_path}: {e}"
                    )

            # Look for function calls between modules
            self._extract_python_function_calls(content, file_path)

        elif extension in ("js", "ts", "jsx", "tsx"):
            # Extract JavaScript/TypeScript imports - more comprehensive patterns
            import_patterns = [
                # ES6 imports
                r"import\s+(?:(?:[\w{},$\s*]+\s+from\s+)|(?:[\w*]*\s*))['\"](.+?)['\"]",
                # Dynamic imports
                r"import\s*\(\s*['\"](.+?)['\"]\s*\)",
                # CommonJS requires
                r"require\s*\(\s*['\"](.+?)['\"]\s*\)",
                # ES6 re-exports
                r"export\s+(?:{[\s\w,]+})?\s+from\s+['\"](.+?)['\"]",
            ]

            for pattern in import_patterns:
                try:
                    matches = re.finditer(pattern, content)
                    for match in matches:
                        module = match.group(1)

                        # Try to resolve the import to a file in the repository
                        import_path = self._resolve_js_import(module, file_path)
                        if import_path and import_path in self.file_ids:
                            relationship: Relationship = {
                                "source": file_path,
                                "target": import_path,
                                "type": "import",
                            }
                            # Check if this relationship already exists
                            if not any(
                                r["source"] == relationship["source"]
                                and r["target"] == relationship["target"]
                                and r["type"] == relationship["type"]
                                for r in self.relationships
                            ):
                                self.relationships.append(relationship)
                except Exception as e:
                    print(f"Error extracting JS/TS relationships from {file_path}: {e}")

    def _extract_python_function_calls(self, content: str, file_path: str) -> None:
        """
        Extract Python function calls between components.

        Args:
            content: File content
            file_path: Relative file path
        """
        try:
            # Get all components in this file
            file_components = []
            for file in self.data.get("files", []):
                if file["id"] == file_path:
                    file_components = file.get("components", [])
                    break

            # Look for local function calls
            for component in file_components:
                # Skip if not a function or method
                if component["type"] in ("function", "method"):
                    # Look for calls to other functions/methods in the same file
                    for other_comp in file_components:
                        if other_comp["id"] != component["id"]:
                            other_name = other_comp["name"]
                            # Simple check for function calls with regex
                            call_pattern = rf"\b{other_name}\s*\("
                            comp_start, comp_end = (
                                component.get("lineStart", 0),
                                component.get("lineEnd", 0),
                            )
                            if comp_start > 0 and comp_end > 0:
                                # Extract component content
                                lines = content.split("\n")
                                comp_content = "\n".join(
                                    lines[comp_start - 1 : comp_end]
                                )
                                if re.search(call_pattern, comp_content):
                                    self.relationships.append(
                                        {
                                            "source": component["id"],
                                            "target": other_comp["id"],
                                            "type": "call",
                                        }
                                    )
        except Exception as e:
            print(f"Error extracting Python function calls from {file_path}: {e}")

    def _resolve_python_import(self, module: str, file_path: str) -> List[str]:
        """
        Resolve a Python import to file paths.

        Args:
            module: Imported module name
            file_path: File path of the importing file

        Returns:
            List of resolved file paths that match the import
        """
        resolved_paths = []

        # Handle relative imports
        if module.startswith("."):
            # Count the number of dots for relative import level
            dots = 0
            while dots < len(module) and module[dots] == ".":
                dots += 1

            # Get the module name without dots
            rel_module = module[dots:]

            # Get the current directory and go up based on the number of dots
            current_parts = file_path.split("/")
            if len(current_parts) <= dots:
                # Invalid relative import (trying to go beyond repo root)
                return resolved_paths

            # Base directory after going up the right number of levels
            base_dir = "/".join(current_parts[:-dots])

            # If there's a specific module after the dots
            if rel_module:
                rel_module_parts = rel_module.split(".")
                # Try as file in the resulting directory
                rel_path = f"{base_dir}/{'/'.join(rel_module_parts)}.py"
                init_path = f"{base_dir}/{'/'.join(rel_module_parts)}/__init__.py"
                package_path = f"{base_dir}/{'/'.join(rel_module_parts)}"

                if rel_path.replace("//", "/").lstrip("/") in self.file_ids:
                    resolved_paths.append(rel_path.replace("//", "/").lstrip("/"))
                if init_path.replace("//", "/").lstrip("/") in self.file_ids:
                    resolved_paths.append(init_path.replace("//", "/").lstrip("/"))

                # Try as a directory
                if package_path in self.file_ids:
                    resolved_paths.append(package_path)
            else:
                # Just a directory reference (e.g., from . import x)
                if base_dir in self.file_ids:
                    resolved_paths.append(base_dir)
                init_path = f"{base_dir}/__init__.py"
                if init_path.replace("//", "/").lstrip("/") in self.file_ids:
                    resolved_paths.append(init_path.replace("//", "/").lstrip("/"))
        else:
            # Convert module name to potential file path
            module_parts = module.split(".")

            # Try as a standard library import
            if module_parts[0] in (
                "os",
                "sys",
                "re",
                "datetime",
                "collections",
                "json",
                "math",
                "random",
                "time",
                "logging",
                "argparse",
                "subprocess",
            ):
                return resolved_paths  # Standard library, not in repo

            # Try direct file in same directory
            current_dir = os.path.dirname(file_path)
            local_paths = [
                f"{current_dir}/{module_parts[0]}.py",
                f"{current_dir}/{module_parts[0]}/__init__.py",
                f"{current_dir}/{'/'.join(module_parts)}.py",
                f"{current_dir}/{'/'.join(module_parts)}/__init__.py",
            ]

            # Also try resolving sub-packages
            if len(module_parts) > 1:
                for i in range(1, len(module_parts)):
                    base_parts = module_parts[:i]
                    base_path = f"{current_dir}/{'/'.join(base_parts)}"
                    if base_path.replace("//", "/").lstrip("/") in self.file_ids:
                        sub_path = f"{base_path}/{'/'.join(module_parts[i:])}.py"
                        sub_init = f"{base_path}/{'/'.join(module_parts[i:])}"

                        if sub_path.replace("//", "/").lstrip("/") in self.file_ids:
                            resolved_paths.append(
                                sub_path.replace("//", "/").lstrip("/")
                            )
                        elif sub_init.replace("//", "/").lstrip("/") in self.file_ids:
                            resolved_paths.append(
                                sub_init.replace("//", "/").lstrip("/")
                            )

                        # Try as __init__.py
                        sub_init_py = f"{sub_init}/__init__.py"
                        if sub_init_py.replace("//", "/").lstrip("/") in self.file_ids:
                            resolved_paths.append(
                                sub_init_py.replace("//", "/").lstrip("/")
                            )

            # Try as absolute import from repository root
            absolute_paths = [
                f"{'/'.join(module_parts)}.py",
                f"{'/'.join(module_parts)}/__init__.py",
                f"{'/'.join(module_parts)}",
            ]

            # Try resolving with package prefixes
            # (ex: src.repo_visualizer => src/repo_visualizer)
            potential_paths = local_paths + absolute_paths

            # Check for partial path matches
            for file_id in self.file_ids:
                if file_id.endswith("/" + module_parts[-1] + ".py"):
                    # Check if the path ends with the full module path
                    file_parts = file_id.split("/")
                    module_match = True
                    for i, part in enumerate(reversed(module_parts)):
                        if i >= len(file_parts) or file_parts[-i - 1] != part:
                            if i == 0 and file_parts[-1] == part + ".py":
                                continue  # Handle the .py extension
                            module_match = False
                            break
                    if module_match:
                        potential_paths.append(file_id)

            # Add all package directories on the path
            for i in range(1, len(module_parts) + 1):
                partial_path = "/".join(module_parts[:i])
                potential_paths.append(partial_path)

            # Normalize paths
            potential_paths = [
                p.replace("//", "/").lstrip("/") for p in potential_paths
            ]

            # Check if paths exist
            for path in potential_paths:
                if path in self.file_ids and path not in resolved_paths:
                    resolved_paths.append(path)

        return resolved_paths

    def _resolve_js_import(self, module: str, file_path: str) -> Optional[str]:
        """
        Resolve a JavaScript/TypeScript import to a file path.

        Args:
            module: Imported module path
            file_path: File path of the importing file

        Returns:
            Resolved file path or None if not found
        """
        # Skip external modules
        if module.startswith("@") or not (
            module.startswith("./")
            or module.startswith("../")
            or module.startswith("/")
        ):
            return None

        # Normalize path and make it relative to repo root
        current_dir = os.path.dirname(file_path)
        if module.startswith("./") or module.startswith("../"):
            # Relative import
            module_path = os.path.normpath(os.path.join(current_dir, module))
        else:
            # Absolute import (from repo root)
            module_path = module.lstrip("/")

        # Add potential extensions if not specified
        if not os.path.splitext(module_path)[1]:
            potential_paths = [
                f"{module_path}.js",
                f"{module_path}.jsx",
                f"{module_path}.ts",
                f"{module_path}.tsx",
                f"{module_path}/index.js",
                f"{module_path}/index.jsx",
                f"{module_path}/index.ts",
                f"{module_path}/index.tsx",
            ]
        else:
            potential_paths = [module_path]

        # Normalize paths
        potential_paths = [p.replace("\\", "/") for p in potential_paths]

        # Return first existing path
        for path in potential_paths:
            if path in self.file_ids:
                return path

        return None

    def _update_directory_sizes(self, files: List[File]) -> None:
        """
        Update directory sizes based on contained files.

        Args:
            files: List of file entries
        """
        # Create a mapping of directories to their entries
        dir_map: Dict[str, File] = {}

        for file in files:
            if file["type"] == "directory":
                dir_map[file["path"]] = file

        # Calculate sizes
        for file in files:
            if file["type"] == "file":
                # Update all parent directories
                path_parts = file["path"].split("/")
                for i in range(len(path_parts) - 1):
                    dir_path = "/".join(path_parts[: i + 1])
                    if dir_path in dir_map:
                        dir_map[dir_path]["size"] = (
                            dir_map[dir_path].get("size", 0) + file["size"]
                        )

    def _extract_relationships(self) -> None:
        """Extract relationships between files and components."""
        # Add filesystem-based relationships
        self._add_filesystem_relationships()

        # Add semantic similarity relationships if available
        self._add_semantic_similarity_relationships()

        # Add components as "nodes" to be visualized
        files = self.data["files"]
        component_nodes = []

        # Collect components for visualization
        for file in files:
            if file["type"] == "file":
                for component in file.get("components", []):
                    # Create a node for this component
                    comp_node = {
                        "id": component["id"],
                        "path": component["id"],
                        "name": component["name"],
                        "type": component["type"],
                        "size": 100,  # Default size for components
                        "depth": file["depth"] + 1,
                        "components": [],
                    }
                    component_nodes.append(comp_node)

                    # Add nodes for nested components
                    for nested in component.get("components", []):
                        nested_node = {
                            "id": nested["id"],
                            "path": nested["id"],
                            "name": nested["name"],
                            "type": nested["type"],
                            "size": 50,  # Smaller size for nested components
                            "depth": file["depth"] + 2,
                            "components": [],
                        }
                        component_nodes.append(nested_node)

        # Add component nodes to files list
        self.data["files"].extend(component_nodes)

        # De-duplicate relationships
        unique_relationships = []
        relationship_keys = set()

        for rel in self.relationships:
            key = f"{rel['source']}|{rel['target']}|{rel['type']}"
            if key not in relationship_keys:
                relationship_keys.add(key)
                unique_relationships.append(rel)

        self.data["relationships"] = unique_relationships

    def _add_filesystem_relationships(self) -> None:
        """Add relationships between files based on filesystem proximity."""
        # Get all files (not directories or components)
        files = [f for f in self.data["files"] if f["type"] == "file"]

        # Group files by directory
        directory_files = {}
        for file in files:
            file_path = file.get("path", file["id"])
            dir_path = os.path.dirname(file_path)
            if dir_path not in directory_files:
                directory_files[dir_path] = []
            directory_files[dir_path].append(file)

        # Add relationships between files in the same directory
        for _dir_path, dir_files in directory_files.items():
            for i, file1 in enumerate(dir_files):
                for file2 in dir_files[i + 1 :]:
                    self.relationships.append(
                        {
                            "source": file1["id"],
                            "target": file2["id"],
                            "type": "filesystem_proximity",
                            "strength": 1.0,
                        }
                    )

        # Add relationships between files in sibling directories
        for dir_path1, files1 in directory_files.items():
            for dir_path2, files2 in directory_files.items():
                if dir_path1 >= dir_path2:  # Avoid duplicates
                    continue

                # Check if directories are siblings or cousins
                dir1_parts = dir_path1.split("/") if dir_path1 else []
                dir2_parts = dir_path2.split("/") if dir_path2 else []

                # Calculate common prefix length
                common_prefix_len = 0
                for i in range(min(len(dir1_parts), len(dir2_parts))):
                    if dir1_parts[i] == dir2_parts[i]:
                        common_prefix_len += 1
                    else:
                        break

                # Calculate filesystem distance
                dir1_depth = len(dir1_parts) - common_prefix_len
                dir2_depth = len(dir2_parts) - common_prefix_len
                distance = dir1_depth + dir2_depth

                # Only add relationships for relatively close directories
                if distance <= 2:  # Sibling directories or one level apart
                    strength = 1.0 / (distance + 1)  # Closer = stronger

                    # Add relationships between files in these directories
                    for file1 in files1:
                        for file2 in files2:
                            self.relationships.append(
                                {
                                    "source": file1["id"],
                                    "target": file2["id"],
                                    "type": "filesystem_proximity",
                                    "strength": strength,
                                }
                            )

    def _add_semantic_similarity_relationships(self) -> None:
        """Add relationships between files based on semantic similarity."""
        if not OPENAI_AVAILABLE or not NUMPY_AVAILABLE:
            print(
                "Warning: OpenAI and NumPy are required for semantic similarity. "
                "Skipping semantic analysis."
            )
            return

        # Check if API key is available
        if not os.getenv("OPENAI_API_KEY"):
            print(
                "Warning: OPENAI_API_KEY not set. "
                "Skipping semantic similarity analysis."
            )
            return

        # Get all files (not directories or components)
        files = [f for f in self.data["files"] if f["type"] == "file"]

        # Filter for code files that we can analyze
        code_files = []
        for file in files:
            extension = file.get("extension", "") or ""
            extension = extension.lower()
            if extension in [
                "py",
                "js",
                "ts",
                "jsx",
                "tsx",
                "java",
                "cpp",
                "c",
                "h",
                "rb",
                "go",
                "rs",
                "php",
                "kt",
                "swift",
            ]:
                code_files.append(file)

        if len(code_files) < 2:
            print(
                "Warning: Need at least 2 code files for semantic similarity analysis."
            )
            return

        print(f"Analyzing semantic similarity for {len(code_files)} files...")

        # Extract text content and generate embeddings
        file_embeddings = {}

        for file in code_files:
            try:
                text_content = self._extract_file_text_content(file)
                if (
                    text_content and len(text_content.strip()) > 50
                ):  # Only process files with meaningful content
                    embedding = self._generate_embedding(text_content)
                    if embedding is not None:
                        file_embeddings[file["id"]] = embedding
            except Exception as e:
                print(
                    f"Warning: Could not process file {file['id']} "
                    f"for semantic similarity: {e}"
                )
                continue

        if len(file_embeddings) < 2:
            print(
                "Warning: Not enough files with valid embeddings "
                "for semantic similarity."
            )
            return

        print(
            f"Generated embeddings for {len(file_embeddings)} files. "
            f"Computing similarities..."
        )

        # Compute pairwise similarities
        file_ids = list(file_embeddings.keys())
        similarity_threshold = 0.7  # Only include files with high similarity

        for i, file_id1 in enumerate(file_ids):
            for file_id2 in file_ids[i + 1 :]:
                try:
                    similarity = self._cosine_similarity(
                        file_embeddings[file_id1], file_embeddings[file_id2]
                    )

                    if similarity >= similarity_threshold:
                        self.relationships.append(
                            {
                                "source": file_id1,
                                "target": file_id2,
                                "type": "semantic_similarity",
                                "strength": float(similarity),
                            }
                        )
                except Exception as e:
                    print(
                        f"Warning: Could not compute similarity between "
                        f"{file_id1} and {file_id2}: {e}"
                    )
                    continue

        semantic_count = len(
            [r for r in self.relationships if r["type"] == "semantic_similarity"]
        )
        print(f"Found {semantic_count} semantic similarity relationships.")

    def _extract_file_text_content(self, file: Dict[str, Any]) -> Optional[str]:
        """Extract meaningful text content from a file for semantic analysis."""
        file_path = os.path.join(self.repo_path, file["path"])

        if not os.path.isfile(file_path):
            return None

        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

            # Extract meaningful content based on file type
            extension = file.get("extension", "") or ""
            extension = extension.lower()

            if extension == "py":
                return self._extract_python_semantic_content(content)
            elif extension in ["js", "ts", "jsx", "tsx"]:
                return self._extract_javascript_semantic_content(content)
            else:
                # For other code files, extract comments and identifiers
                return self._extract_generic_semantic_content(content)

        except Exception as e:
            print(f"Warning: Could not read file {file['path']}: {e}")
            return None

    def _extract_python_semantic_content(self, content: str) -> str:
        """Extract semantic content from Python files."""
        parts = []

        # Extract docstrings
        docstring_matches = re.finditer(r'"""(.*?)"""', content, re.DOTALL)
        for match in docstring_matches:
            parts.append(match.group(1).strip())

        # Extract comments
        comment_matches = re.finditer(r"#\s*(.+)", content)
        for match in comment_matches:
            parts.append(match.group(1).strip())

        # Extract function and class names with their context
        function_matches = re.finditer(r"def\s+(\w+)\s*\([^)]*\):", content)
        for match in function_matches:
            parts.append(f"function {match.group(1)}")

        class_matches = re.finditer(r"class\s+(\w+)(?:\([^)]*\))?:", content)
        for match in class_matches:
            parts.append(f"class {match.group(1)}")

        # Extract import statements to understand dependencies
        import_matches = re.finditer(r"(?:from\s+(\S+)\s+)?import\s+([^\n]+)", content)
        for match in import_matches:
            if match.group(1):
                parts.append(f"imports from {match.group(1)}")
            parts.append(f"imports {match.group(2).strip()}")

        return " ".join(parts)

    def _extract_javascript_semantic_content(self, content: str) -> str:
        """Extract semantic content from JavaScript/TypeScript files."""
        parts = []

        # Extract comments
        comment_matches = re.finditer(r"//\s*(.+)", content)
        for match in comment_matches:
            parts.append(match.group(1).strip())

        # Extract block comments
        block_comment_matches = re.finditer(r"/\*(.*?)\*/", content, re.DOTALL)
        for match in block_comment_matches:
            parts.append(match.group(1).strip())

        # Extract function names
        function_matches = re.finditer(
            r"(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))",
            content,
        )
        for match in function_matches:
            func_name = match.group(1) or match.group(2)
            if func_name:
                parts.append(f"function {func_name}")

        # Extract class names
        class_matches = re.finditer(r"class\s+(\w+)", content)
        for match in class_matches:
            parts.append(f"class {match.group(1)}")

        # Extract imports
        import_matches = re.finditer(
            r'import\s+[^;]+from\s+[\'"]([^\'"]+)[\'"]', content
        )
        for match in import_matches:
            parts.append(f"imports from {match.group(1)}")

        return " ".join(parts)

    def _extract_generic_semantic_content(self, content: str) -> str:
        """Extract semantic content from generic code files."""
        parts = []

        # Extract various comment patterns
        comment_patterns = [
            r"//\s*(.+)",  # C++ style comments
            r"#\s*(.+)",  # Shell/Python style comments
            r"/\*(.*?)\*/",  # Block comments
        ]

        for pattern in comment_patterns:
            matches = re.finditer(
                pattern, content, re.DOTALL if r"\*" in pattern else 0
            )
            for match in matches:
                parts.append(match.group(1).strip())

        # Extract function-like patterns
        function_patterns = [
            r"(?:function|def|fn)\s+(\w+)",  # function definitions
            r"class\s+(\w+)",  # class definitions
            r"struct\s+(\w+)",  # struct definitions
        ]

        for pattern in function_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                parts.append(f"defines {match.group(1)}")

        return " ".join(parts)

    def _generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for text using OpenAI API."""
        if not text or len(text.strip()) == 0:
            return None

        try:
            # Truncate text to avoid API limits (roughly 8000 tokens)
            if len(text) > 30000:
                text = text[:30000] + "..."

            client = openai.OpenAI()
            response = client.embeddings.create(
                model="text-embedding-3-small", input=text
            )

            return response.data[0].embedding

        except Exception as e:
            print(f"Warning: Could not generate embedding: {e}")
            return None

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0

        try:
            vec1_np = np.array(vec1)
            vec2_np = np.array(vec2)

            dot_product = np.dot(vec1_np, vec2_np)
            norm1 = np.linalg.norm(vec1_np)
            norm2 = np.linalg.norm(vec2_np)

            if norm1 == 0 or norm2 == 0:
                return 0.0

            return dot_product / (norm1 * norm2)

        except Exception as e:
            print(f"Warning: Could not compute cosine similarity: {e}")
            return 0.0

    def _analyze_history(self) -> None:
        """Analyze git history."""
        # Extract commit history
        commits = self._extract_commits()

        # Create timeline points (simplified for now)
        timeline_points = self._create_timeline_points(commits)

        # Set history data
        if commits:
            self.data["history"] = {
                "commits": commits,
                "timelinePoints": timeline_points,
            }

    def _extract_commits(self) -> List[Dict[str, Any]]:
        """
        Extract commit history from the git repository.

        Returns:
            List of commit data (ordered from oldest to newest)
        """
        try:
            # Get commit logs from all branches and sort chronologically
            result = subprocess.run(
                [
                    "git",
                    "log",
                    "--all",  # Get commits from all branches
                    "--pretty=format:%H|||%an <%ae>|||%ad|||%s",
                    "--date=iso",
                    # Remove commit limit to get all commits
                ],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=False,
            )

            if result.returncode != 0:
                return []

            # Parse commit log
            commits = []
            commit_lines = result.stdout.strip().split("\n")

            for line in commit_lines:
                if not line.strip():
                    continue

                # Parse header
                try:
                    header = line.split("|||")
                    if len(header) < 4:
                        continue

                    commit_hash = header[0]
                    author = header[1]
                    date_str = header[2]
                    message = header[3]

                    # Convert date to ISO format
                    dt = datetime.fromisoformat(
                        date_str.replace(" ", "T").replace(" +", "+")
                    )
                    date = dt.isoformat()

                    # Get file changes for this specific commit
                    file_changes = self._get_file_changes_for_commit(commit_hash)

                    commits.append(
                        {
                            "id": commit_hash,
                            "author": author,
                            "date": date,
                            "message": message,
                            "fileChanges": file_changes,
                            "timestamp": dt,  # Keep datetime for sorting
                        }
                    )
                except Exception as e:
                    print(f"Error parsing commit: {e}")
                    continue

            # Sort commits by timestamp (oldest first)
            commits.sort(key=lambda c: c["timestamp"])

            # Remove the timestamp field as it's not needed in the final output
            for commit in commits:
                del commit["timestamp"]

            return commits
        except Exception as e:
            print(f"Error extracting commits: {e}")
            return []

    def _get_file_changes_for_commit(self, commit_hash: str) -> List[Dict[str, Any]]:
        """
        Get file changes for a specific commit.

        Args:
            commit_hash: The commit hash to get changes for

        Returns:
            List of file changes for this commit
        """
        try:
            # Get file changes for this specific commit
            result = subprocess.run(
                [
                    "git",
                    "diff-tree",
                    "-r",  # Recursively show all file changes, not just directory changes
                    "--no-commit-id",
                    "--name-status",
                    commit_hash,
                ],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=False,
            )

            if result.returncode != 0:
                return []

            file_changes = []
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue

                change_parts = line.split("\t")
                if len(change_parts) < 2:
                    continue

                change_type = change_parts[0]
                file_path = change_parts[-1].replace("\\", "/")

                # Skip files outside the repo
                if ".." in file_path:
                    continue

                # Map change type
                if change_type == "A":
                    change_type_mapped = "add"
                elif change_type in ("M", "R"):
                    change_type_mapped = "modify"
                elif change_type == "D":
                    change_type_mapped = "delete"
                else:
                    continue

                # Get additions and deletions (simplified)
                additions = 0
                deletions = 0
                if change_type_mapped == "add":
                    additions = 10  # Placeholder value
                elif change_type_mapped == "modify":
                    additions = 5  # Placeholder value
                    deletions = 3  # Placeholder value
                elif change_type_mapped == "delete":
                    deletions = 10  # Placeholder value

                file_changes.append(
                    {
                        "fileId": file_path,
                        "type": change_type_mapped,
                        "additions": additions,
                        "deletions": deletions,
                    }
                )

            return file_changes
        except Exception as e:
            print(f"Error getting file changes for commit {commit_hash}: {e}")
            return []

    def _create_timeline_points(
        self, commits: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Create timeline points from commits.

        Args:
            commits: List of commit data

        Returns:
            List of timeline points
        """
        timeline_points = []

        if not commits:
            return timeline_points

        # Create timeline points for key commits, focusing on actual development
        max_points = 30  # Increase max points to capture more file additions
        total_commits = len(commits)

        # First, collect all commits that add files (these are most important)
        file_adding_commits = []
        other_important_commits = []

        for i, commit in enumerate(commits):
            # Skip merge commits
            if commit["message"].startswith("Merge "):
                continue

            # Prioritize commits that add files
            adds_files = any(fc["type"] == "add" for fc in commit["fileChanges"])
            if adds_files:
                file_adding_commits.append(i)
            elif len(commit["fileChanges"]) > 0:
                other_important_commits.append(i)

        # Always include the first commit (index 0)
        indices = [0]

        # Include ALL file-adding commits (these show repository growth)
        indices.extend(file_adding_commits)

        # Fill remaining slots with other important commits
        remaining_slots = max_points - len(indices)
        if remaining_slots > 0 and other_important_commits:
            if len(other_important_commits) <= remaining_slots:
                indices.extend(other_important_commits)
            else:
                # Sample other commits evenly
                step = len(other_important_commits) // remaining_slots
                for i in range(0, len(other_important_commits), step):
                    if len(indices) < max_points:
                        indices.append(other_important_commits[i])

        # Remove duplicates and sort
        indices = sorted(list(set(indices)))

        # Always include the latest commit
        if indices[-1] != total_commits - 1:
            indices.append(total_commits - 1)

        for i in indices:
            commit = commits[i]

            # Create a snapshot by tracking which files existed at this commit
            snapshot_files = self._get_files_at_commit(commit, commits[: i + 1])
            snapshot_relationships = self._get_relationships_at_commit(snapshot_files)

            timeline_points.append(
                {
                    "commitId": commit["id"],
                    "state": {
                        "commitIndex": i,
                        "timestamp": commit["date"],
                        "message": commit["message"],
                        "author": commit["author"],
                        "totalCommits": total_commits,
                    },
                    "snapshot": {
                        "files": snapshot_files,
                        "relationships": snapshot_relationships,
                    },
                }
            )

        return timeline_points

    def _get_files_at_commit(
        self, commit: Dict[str, Any], commits_up_to_here: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Get the list of files that existed at a specific commit.

        Args:
            commit: The commit to get files for
            commits_up_to_here: All commits up to and including this one (in chronological order, oldest first)

        Returns:
            List of file objects that existed at this commit
        """
        # Track file states by path - start with all files not existing
        file_states = {}

        # Go through all commits up to this point to track file changes (oldest to newest)
        for c in commits_up_to_here:
            for file_change in c["fileChanges"]:
                file_path = file_change["fileId"]
                change_type = file_change["type"]

                if change_type == "add" or change_type == "modify":
                    # File was added or modified, so it exists
                    file_states[file_path] = True
                elif change_type == "delete":
                    # File was deleted, so it doesn't exist
                    file_states[file_path] = False

        # Create file objects for files that existed at this commit
        existing_files = []

        # Create a map of current files by path for quick lookup
        current_files_by_path = {f["path"]: f for f in self.data["files"]}

        # Go through all file paths that have state information
        for file_path, exists in file_states.items():
            if exists:  # File existed at this commit
                if file_path in current_files_by_path:
                    # File exists in current state, use existing file object
                    existing_files.append(current_files_by_path[file_path])
                else:
                    # File existed in history but not in current state
                    # Create a minimal file object for it
                    import os

                    file_name = os.path.basename(file_path)
                    extension = os.path.splitext(file_name)[1].lstrip(".")
                    depth = len(file_path.split("/")) - 1 if "/" in file_path else 0

                    # Determine if it's a directory (heuristic: no extension and known to be a directory)
                    file_type = (
                        "directory"
                        if not extension
                        and file_path
                        in [".github", ".mentat", "src", "tests", "docs", "frontend"]
                        else "file"
                    )

                    existing_files.append(
                        {
                            "id": file_path,
                            "path": file_path,
                            "name": file_name,
                            "extension": extension if extension else None,
                            "size": 0,  # Unknown size for historical files
                            "type": file_type,
                            "depth": depth,
                            "components": [],
                        }
                    )

        return existing_files

    def _get_relationships_at_commit(
        self, files_at_commit: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Get the relationships between files that existed at a specific commit.

        Args:
            files_at_commit: List of files that existed at this commit

        Returns:
            List of relationship objects for this commit
        """
        # Get the set of file IDs that existed at this commit
        existing_file_ids = set(file["id"] for file in files_at_commit)

        # Filter relationships to only include those between existing files
        relationships_at_commit = []
        for rel in self.data["relationships"]:
            source_id = rel["source"]
            target_id = rel["target"]

            # Check if both source and target existed at this commit
            if source_id in existing_file_ids and target_id in existing_file_ids:
                relationships_at_commit.append(rel)

        return relationships_at_commit

    def _extract_file_git_metrics(self, file_path: str) -> Dict[str, Any]:
        """
        Extract git history metrics for a specific file.

        Args:
            file_path: Relative file path

        Returns:
            Dictionary containing git metrics
        """
        metrics = {}

        try:
            # Get commit count for this file
            result = subprocess.run(
                ["git", "log", "--oneline", "--", file_path],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=False,
            )

            if result.returncode == 0:
                commit_lines = [
                    line.strip() for line in result.stdout.split("\n") if line.strip()
                ]
                metrics["commitCount"] = len(commit_lines)
            else:
                metrics["commitCount"] = 0

            # Get most recent commit date for this file
            result = subprocess.run(
                ["git", "log", "-1", "--format=%ad", "--date=iso", "--", file_path],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=False,
            )

            if result.returncode == 0 and result.stdout.strip():
                date_str = result.stdout.strip()
                try:
                    # Parse the date and calculate days ago
                    dt = datetime.fromisoformat(
                        date_str.replace(" ", "T").replace(" +", "+")
                    )
                    days_ago = (datetime.now() - dt.replace(tzinfo=None)).days
                    metrics["lastCommitDaysAgo"] = days_ago
                    metrics["lastCommitDate"] = dt.isoformat()
                except Exception:
                    metrics["lastCommitDaysAgo"] = 0
                    metrics["lastCommitDate"] = datetime.now().isoformat()
            else:
                metrics["lastCommitDaysAgo"] = 0
                metrics["lastCommitDate"] = datetime.now().isoformat()

        except Exception as e:
            print(f"Error extracting git metrics for {file_path}: {e}")
            metrics["commitCount"] = 0
            metrics["lastCommitDaysAgo"] = 0
            metrics["lastCommitDate"] = datetime.now().isoformat()

        return metrics

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


def analyze_repository(repo_path: str, output_path: str) -> None:
    """
    Analyze a repository and generate visualization data.

    Args:
        repo_path: Path to the local git repository
        output_path: Path to output JSON file
    """
    analyzer = RepositoryAnalyzer(repo_path)
    analyzer.analyze()
    analyzer.save_to_file(output_path)

    print(f"Repository analysis complete. Data saved to {output_path}")


def main() -> None:
    """Command-line entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Analyze a git repository for visualization"
    )
    parser.add_argument("repo_path", help="Path to the local git repository")
    parser.add_argument(
        "--output",
        "-o",
        default="repo_data.json",
        help="Output JSON file path (default: repo_data.json)",
    )

    args = parser.parse_args()
    analyze_repository(args.repo_path, args.output)


if __name__ == "__main__":
    main()
