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
                return f"Git repository at {result.stdout.strip()}"
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

    def _is_ignored(self, path: str) -> bool:
        """
        Check if a path should be ignored according to gitignore rules.

        Args:
            path: The path to check, relative to the repository root

        Returns:
            True if the path should be ignored, False otherwise
        """
        # Always ignore the .git directory
        if ".git" in path.split(os.path.sep):
            return True

        # Normalize path separator to forward slash for consistency
        norm_path = path.replace(os.path.sep, "/")

        # Add trailing slash for directories to match gitignore patterns
        is_dir = os.path.isdir(os.path.join(self.repo_path, norm_path))
        if is_dir and not norm_path.endswith("/"):
            norm_path += "/"

        # Check if the path matches any gitignore patterns
        return self.gitignore_spec.match_file(norm_path)

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

                if self._is_ignored(dir_path):
                    dirs.pop(i)
                else:
                    i += 1

            for file in files:
                rel_path = os.path.join(rel_root, file)

                # Skip ignored files
                if self._is_ignored(rel_path):
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
                if dir_name.startswith(".") or self._is_ignored(dir_path):
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

            # Process files
            for file_name in file_names:
                # Skip hidden files
                if file_name.startswith("."):
                    continue

                rel_path = os.path.join(rel_root, file_name)

                # Skip ignored files
                if self._is_ignored(rel_path):
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

        # Extract classes using regex
        class_pattern = r"class\s+(\w+)(?:\(.*\))?:"
        class_matches = re.finditer(class_pattern, content)

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

        # Extract classes using regex (simplified)
        class_pattern = (
            r"class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+\w+)?\s*\{"
        )
        class_matches = re.finditer(class_pattern, content)

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

        # Extract functions (simplified)
        function_patterns = [
            r"function\s+(\w+)\s*\(",  # regular functions
            r"const\s+(\w+)\s*=\s*function",  # function expressions
            r"const\s+(\w+)\s*=\s*\(",  # arrow functions
        ]

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
            # Extract Python imports
            import_patterns = [
                r"import\s+([\w\.]+)",  # standard imports
                r"from\s+([\w\.]+)\s+import",  # from imports
            ]

            for pattern in import_patterns:
                matches = re.finditer(pattern, content)
                for match in matches:
                    module = match.group(1)

                    # Try to resolve the import to a file in the repository
                    import_path = self._resolve_python_import(module, file_path)
                    if import_path and import_path in self.file_ids:
                        relationship: Relationship = {
                            "source": file_path,
                            "target": import_path,
                            "type": "import",
                        }
                        self.relationships.append(relationship)

        elif extension in ("js", "ts", "jsx", "tsx"):
            # Extract JavaScript/TypeScript imports
            import_patterns = [
                r"import\s+.*\s+from\s+['\"](.+)['\"]",  # ES6 imports
                r"require\s*\(\s*['\"](.+)['\"]\s*\)",  # CommonJS requires
            ]

            for pattern in import_patterns:
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
                        self.relationships.append(relationship)

    def _resolve_python_import(self, module: str, file_path: str) -> Optional[str]:
        """
        Resolve a Python import to a file path.

        Args:
            module: Imported module name
            file_path: File path of the importing file

        Returns:
            Resolved file path or None if not found
        """
        # Convert module name to potential file path
        module_parts = module.split(".")

        # Try direct file in same directory
        current_dir = os.path.dirname(file_path)
        potential_paths = [
            f"{current_dir}/{module_parts[0]}.py",
            f"{current_dir}/{module_parts[0]}/__init__.py",
        ]

        # Try as absolute import from repository root
        potential_paths.extend(
            [
                f"{'/'.join(module_parts)}.py",
                f"{'/'.join(module_parts)}/__init__.py",
            ]
        )

        # Normalize paths
        potential_paths = [p.replace("//", "/").lstrip("/") for p in potential_paths]

        # Return first existing path
        for path in potential_paths:
            if path in self.file_ids:
                return path

        return None

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
        # File relationships are already extracted during file content analysis
        self.data["relationships"] = self.relationships

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
            List of commit data
        """
        try:
            # Get commit logs
            result = subprocess.run(
                [
                    "git",
                    "log",
                    "--pretty=format:%H|||%an <%ae>|||%ad|||%s",
                    "--date=iso",
                    "--name-status",
                    "-n",
                    "100",  # Limit to 100 commits for performance
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
            commit_blocks = result.stdout.split("\n\n")

            for block in commit_blocks:
                lines = block.strip().split("\n")
                if not lines:
                    continue

                # Parse header
                try:
                    header = lines[0].split("|||")
                    commit_hash = header[0]
                    author = header[1]
                    date_str = header[2]
                    message = header[3]

                    # Convert date to ISO format
                    dt = datetime.fromisoformat(
                        date_str.replace(" ", "T").replace(" +", "+")
                    )
                    date = dt.isoformat()

                    # Parse file changes
                    file_changes = []
                    for i in range(1, len(lines)):
                        if not lines[i].strip():
                            continue

                        change_parts = lines[i].split("\t")
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

                    commits.append(
                        {
                            "id": commit_hash,
                            "author": author,
                            "date": date,
                            "message": message,
                            "fileChanges": file_changes,
                        }
                    )
                except Exception as e:
                    print(f"Error parsing commit: {e}")
                    continue

            return commits
        except Exception as e:
            print(f"Error extracting commits: {e}")
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
        # This is a simplified implementation that creates a timeline point
        # for every 10th commit (or fewer if there aren't many commits)
        timeline_points = []

        if not commits:
            return timeline_points

        step = max(1, len(commits) // 10)

        for i in range(0, len(commits), step):
            commit = commits[i]

            # Create a simplified snapshot
            timeline_points.append(
                {
                    "commitId": commit["id"],
                    "state": {
                        "commitIndex": i,
                        "timestamp": commit["date"],
                    },
                    "snapshot": {
                        "files": [],  # Simplified for now
                        "relationships": [],  # Simplified for now
                    },
                }
            )

        return timeline_points

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
