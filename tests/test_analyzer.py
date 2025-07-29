"""Tests for repository analyzer module."""

import json
import os
import shutil
import subprocess
from unittest.mock import patch

import pytest

from repo_visualizer.analyzer import RepositoryAnalyzer, analyze_repository


class TestRepositoryAnalyzer:
    """Test the RepositoryAnalyzer class."""

    def setup_method(self):
        self.repo_path = os.path.join(os.path.dirname(__file__), "test_repo")
        os.makedirs(self.repo_path, exist_ok=True)
        subprocess.run(
            ["git", "init"], cwd=self.repo_path, check=True, capture_output=True
        )
        subprocess.run(
            ["git", "config", "user.name", "Test User"],
            cwd=self.repo_path,
            check=True,
        )
        subprocess.run(
            ["git", "config", "user.email", "test@example.com"],
            cwd=self.repo_path,
            check=True,
        )
        # Create a dummy file and commit it
        with open(os.path.join(self.repo_path, "README.md"), "w") as f:
            f.write("# Test Repo\n")
        subprocess.run(["git", "add", "README.md"], cwd=self.repo_path, check=True)
        subprocess.run(
            ["git", "commit", "-m", "Initial commit"],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
        )

    def teardown_method(self):
        shutil.rmtree(self.repo_path)

    def test_init_with_invalid_path(self):
        """Test initializing with an invalid path."""
        with pytest.raises(ValueError, match="Repository path does not exist"):
            RepositoryAnalyzer("/path/does/not/exist")

    @patch("os.path.isdir")
    def test_init_with_non_git_repo(self, mock_isdir):
        """Test initializing with a path that isn't a git repository."""
        mock_isdir.side_effect = [True, False]
        with pytest.raises(ValueError, match="Not a git repository"):
            RepositoryAnalyzer("/fake/path")

    def test_analyze_repository_end_to_end(self):
        """Test end-to-end repository analysis."""
        # Create some files
        with open(os.path.join(self.repo_path, "main.py"), "w") as f:
            f.write("import utils\n\ndef main():\n    pass\n")
        os.makedirs(os.path.join(self.repo_path, "utils"))
        with open(os.path.join(self.repo_path, "utils", "__init__.py"), "w") as f:
            f.write("")
        with open(os.path.join(self.repo_path, "utils", "helpers.py"), "w") as f:
            f.write("def helper():\n    return True\n")

        subprocess.run(["git", "add", "."], cwd=self.repo_path, check=True)
        subprocess.run(
            ["git", "commit", "-m", "Add python files"],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
        )

        analyzer = RepositoryAnalyzer(self.repo_path)
        data = analyzer.analyze()

        assert "metadata" in data
        assert "files" in data
        assert "relationships" in data

        assert len(data["files"]) > 0
        assert any(f["path"] == "main.py" for f in data["files"])
        assert any(f["path"] == "utils/helpers.py" for f in data["files"])

        assert len(data["relationships"]) > 0
        assert any(
            r["source"] == "main.py"
            and r["target"] == "utils/__init__.py"
            and r["type"] == "import"
            for r in data["relationships"]
        )

    def test_analyze_repository_function(self):
        """Test the analyze_repository convenience function."""
        output_path = os.path.join(self.repo_path, "output.json")
        analyze_repository(self.repo_path, output_path)

        assert os.path.exists(output_path)
        with open(output_path) as f:
            data = json.load(f)

        assert "metadata" in data
        assert "files" in data
        assert "relationships" in data
