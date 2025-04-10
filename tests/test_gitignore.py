"""Tests for gitignore functionality in the repository analyzer."""

import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from repo_visualizer.analyzer import RepositoryAnalyzer


class TestGitignore:
    """Test gitignore pattern matching functionality."""

    def test_load_gitignore_patterns(self):
        """Test loading gitignore patterns from a file."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a fake git repo with a .gitignore file
            git_dir = os.path.join(temp_dir, ".git")
            os.makedirs(git_dir)

            # Create a .gitignore file
            gitignore_content = """
# Python bytecode
*.pyc
__pycache__/

# Distribution / packaging
dist/
build/
*.egg-info/

# Test files to ignore
temp_*.txt
sample/ignore_me/
"""
            with open(os.path.join(temp_dir, ".gitignore"), "w") as f:
                f.write(gitignore_content)

            # Initialize the analyzer
            with patch.object(RepositoryAnalyzer, "_extract_metadata"), patch.object(
                RepositoryAnalyzer, "_analyze_files"
            ), patch.object(RepositoryAnalyzer, "_extract_relationships"), patch.object(
                RepositoryAnalyzer, "_analyze_history"
            ):
                analyzer = RepositoryAnalyzer(temp_dir)

            # Test if the gitignore spec is properly loaded
            assert analyzer.gitignore_spec is not None

            # Test various paths against the gitignore patterns
            assert analyzer._is_ignored("file.pyc") is True
            assert analyzer._is_ignored("some/path/file.pyc") is True
            assert analyzer._is_ignored("__pycache__/") is True
            assert analyzer._is_ignored("src/__pycache__/") is True
            assert analyzer._is_ignored("dist/") is True
            assert analyzer._is_ignored("build/something.txt") is True
            assert analyzer._is_ignored("package.egg-info/") is True
            assert analyzer._is_ignored("temp_file.txt") is True
            assert analyzer._is_ignored("sample/ignore_me/file.txt") is True

            # Test paths that should not be ignored
            assert analyzer._is_ignored("file.py") is False
            assert analyzer._is_ignored("temp.txt") is False  # Not matching temp_*.txt
            assert analyzer._is_ignored("sample/keep_me/file.txt") is False

    def test_always_ignore_git_directory(self):
        """Test that .git directory is always ignored regardless of gitignore content."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a fake git repo
            git_dir = os.path.join(temp_dir, ".git")
            os.makedirs(git_dir)

            # Initialize the analyzer with empty .gitignore
            with open(os.path.join(temp_dir, ".gitignore"), "w") as f:
                f.write("")  # Empty gitignore file

            # Initialize the analyzer
            with patch.object(RepositoryAnalyzer, "_extract_metadata"), patch.object(
                RepositoryAnalyzer, "_analyze_files"
            ), patch.object(RepositoryAnalyzer, "_extract_relationships"), patch.object(
                RepositoryAnalyzer, "_analyze_history"
            ):
                analyzer = RepositoryAnalyzer(temp_dir)

            # Test that .git directory is ignored
            assert analyzer._is_ignored(".git") is True
            assert analyzer._is_ignored(".git/config") is True
            assert analyzer._is_ignored("path/with/.git/inside") is True

    def test_missing_gitignore_file(self):
        """Test behavior when .gitignore file is missing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a fake git repo without a .gitignore file
            git_dir = os.path.join(temp_dir, ".git")
            os.makedirs(git_dir)

            # Initialize the analyzer
            with patch.object(RepositoryAnalyzer, "_extract_metadata"), patch.object(
                RepositoryAnalyzer, "_analyze_files"
            ), patch.object(RepositoryAnalyzer, "_extract_relationships"), patch.object(
                RepositoryAnalyzer, "_analyze_history"
            ):
                analyzer = RepositoryAnalyzer(temp_dir)

            # Check that only .git directory is ignored
            assert analyzer._is_ignored(".git") is True
            assert analyzer._is_ignored("file.pyc") is False  # No rule to ignore this
            assert analyzer._is_ignored("dist/") is False  # No rule to ignore this

    def test_respect_gitignore_in_file_scanning(self):
        """Test that file scanning respects gitignore patterns."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a fake git repo
            git_dir = os.path.join(temp_dir, ".git")
            os.makedirs(git_dir)

            # Create a .gitignore file
            with open(os.path.join(temp_dir, ".gitignore"), "w") as f:
                f.write("*.ignore\nignored_dir/\n")

            # Create some files and directories
            Path(os.path.join(temp_dir, "regular_file.txt")).touch()
            Path(os.path.join(temp_dir, "should.ignore")).touch()
            os.makedirs(os.path.join(temp_dir, "regular_dir"))
            Path(os.path.join(temp_dir, "regular_dir", "inside_regular.txt")).touch()
            os.makedirs(os.path.join(temp_dir, "ignored_dir"))
            Path(os.path.join(temp_dir, "ignored_dir", "wont_be_seen.txt")).touch()

            # Initialize the analyzer with mocked methods except for _analyze_files
            with patch.object(RepositoryAnalyzer, "_extract_metadata"), patch.object(
                RepositoryAnalyzer, "_extract_relationships"
            ), patch.object(RepositoryAnalyzer, "_analyze_history"):
                analyzer = RepositoryAnalyzer(temp_dir)
                analyzer._analyze_files()  # Only run the file analysis portion

            # Check that ignored files are not included
            file_paths = {file["path"] for file in analyzer.data["files"]}

            # Print file paths for debugging
            print("Files found:", sorted(file_paths))

            # Files that should be present
            assert "regular_file.txt" in file_paths
            assert "regular_dir" in file_paths
            assert "regular_dir/inside_regular.txt" in file_paths

            # Files that should be ignored
            assert "should.ignore" not in file_paths
            assert "ignored_dir" not in file_paths
            assert "ignored_dir/wont_be_seen.txt" not in file_paths


if __name__ == "__main__":
    pytest.main(["-v", "test_gitignore.py"])
