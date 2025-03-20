"""Tests for repository analyzer module."""

from unittest.mock import MagicMock, patch

import pytest

from repo_visualizer.analyzer import RepositoryAnalyzer, analyze_repository


class TestRepositoryAnalyzer:
    """Test the RepositoryAnalyzer class."""

    def test_init_with_invalid_path(self):
        """Test initializing with an invalid path."""
        with pytest.raises(ValueError, match="Repository path does not exist"):
            RepositoryAnalyzer("/path/does/not/exist")

    @patch("os.path.isdir")
    def test_init_with_non_git_repo(self, mock_isdir):
        """Test initializing with a path that isn't a git repository."""
        # First call to isdir returns True (path exists)
        # Second call to isdir returns False (.git directory doesn't exist)
        mock_isdir.side_effect = [True, False]

        with pytest.raises(ValueError, match="Not a git repository"):
            RepositoryAnalyzer("/fake/path")

    @patch("os.path.isdir")
    @patch("subprocess.run")
    def test_extract_metadata(self, mock_run, mock_isdir):
        """Test extracting repository metadata."""
        # Mock directory checks
        mock_isdir.return_value = True

        # Mock subprocess calls
        def mock_subprocess_run(args, **kwargs):
            result = MagicMock()
            if "config" in args:
                # Mock git config call
                result.returncode = 0
                result.stdout = "https://github.com/user/repo.git\n"
            elif "symbolic-ref" in args:
                # Mock default branch call
                result.returncode = 0
                result.stdout = "main\n"
            elif "log" in args and "--reverse" in args:
                # Mock first commit date call
                result.returncode = 0
                result.stdout = ""  # Return empty string to trigger fallback
            elif "log" in args:
                # Mock last commit date call
                result.returncode = 0
                result.stdout = ""  # Empty string to trigger fallback
            return result

        mock_run.side_effect = mock_subprocess_run

        # Create analyzer and extract metadata
        with patch("os.walk") as mock_walk:
            # Mock empty file system for _calculate_language_stats
            mock_walk.return_value = []

            analyzer = RepositoryAnalyzer("/fake/repo")
            analyzer._extract_metadata()

        # Check metadata values
        assert analyzer.data["metadata"]["repoName"] == "repo"
        assert "Git repository at" in analyzer.data["metadata"]["description"]
        assert analyzer.data["metadata"]["defaultBranch"] == "main"
        # Using current date as fallback when git log is empty
        assert analyzer.data["metadata"]["createdAt"] is not None
        # Using current date as fallback when git log is empty
        assert analyzer.data["metadata"]["updatedAt"] is not None

    @patch("os.path.isdir")
    @patch("os.walk")
    @patch("os.path.isfile")
    @patch("os.path.getsize")
    def test_calculate_language_stats(
        self, mock_getsize, mock_isfile, mock_walk, mock_isdir
    ):
        """Test calculation of language statistics."""
        # Mock directory checks
        mock_isdir.return_value = True

        # Mock file system structure
        mock_walk.return_value = [
            ("/fake/repo", [], ["file1.py", "file2.py", "file3.js"]),
        ]

        # Mock file checks
        mock_isfile.return_value = True

        # Mock file sizes
        mock_getsize.side_effect = lambda path: {
            "/fake/repo/file1.py": 100,
            "/fake/repo/file2.py": 200,
            "/fake/repo/file3.js": 100,
        }.get(path, 0)

        # Create analyzer and calculate language stats
        analyzer = RepositoryAnalyzer("/fake/repo")
        language_stats = analyzer._calculate_language_stats()

        # Check language statistics
        assert len(language_stats) == 2
        assert "Python" in language_stats
        assert "JavaScript" in language_stats
        assert language_stats["Python"] == pytest.approx(0.75, rel=1e-2)
        assert language_stats["JavaScript"] == pytest.approx(0.25, rel=1e-2)

    @patch("os.path.isdir")
    @patch("os.path.exists")
    @patch("os.path.isfile")
    @patch("builtins.open", new_callable=MagicMock)
    def test_analyze_python_file(self, mock_open, mock_isfile, mock_exists, mock_isdir):
        """Test analysis of Python file content."""
        # Mock directory checks
        mock_isdir.return_value = True
        mock_exists.return_value = True
        mock_isfile.return_value = True

        # Mock file content
        python_content = """
# This is a comment
\"\"\"Module docstring\"\"\"

def top_level_function():
    \"\"\"Function docstring\"\"\"
    return True

class ExampleClass:
    \"\"\"Class docstring\"\"\"

    def __init__(self):
        \"\"\"Init method\"\"\"
        self.value = 42

    def example_method(self):
        \"\"\"Method docstring\"\"\"
        return self.value
"""
        # Set up file reading mock
        file_mock = MagicMock()
        file_mock.__enter__.return_value.read.return_value = python_content
        mock_open.return_value = file_mock

        # Create analyzer
        analyzer = RepositoryAnalyzer("/fake/repo")

        # Analyze Python file
        components, metrics = analyzer._analyze_python_file(
            python_content, "test.py", {"linesOfCode": 20, "emptyLines": 5}
        )

        # Check metrics
        assert "commentLines" in metrics
        assert metrics["commentLines"] > 0

        # Check components
        assert len(components) == 2  # One function, one class

        # Check function
        function = next(c for c in components if c["type"] == "function")
        assert function["name"] == "top_level_function"
        assert function["id"] == "test.py:top_level_function"

        # Check class
        class_component = next(c for c in components if c["type"] == "class")
        assert class_component["name"] == "ExampleClass"
        assert class_component["id"] == "test.py:ExampleClass"

        # Check methods in class
        assert len(class_component["components"]) == 2
        method_names = [m["name"] for m in class_component["components"]]
        assert "__init__" in method_names
        assert "example_method" in method_names

    @patch("os.path.isdir")
    def test_analyze_repository(self, mock_isdir):
        """Test end-to-end repository analysis."""
        # This is a more integrated test that patches several methods
        # to avoid actual file system and git operations

        # Mock directory checks
        mock_isdir.return_value = True

        with patch.object(RepositoryAnalyzer, "_extract_metadata"), patch.object(
            RepositoryAnalyzer, "_analyze_files"
        ), patch.object(RepositoryAnalyzer, "_extract_relationships"), patch.object(
            RepositoryAnalyzer, "_analyze_history"
        ):
            analyzer = RepositoryAnalyzer("/fake/repo")
            result = analyzer.analyze()

            # Check basic structure
            assert "metadata" in result
            assert "files" in result
            assert "relationships" in result

    @patch("os.path.isdir")
    @patch("json.dump")
    def test_save_to_file(self, mock_json_dump, mock_isdir):
        """Test saving repository data to a file."""
        # Mock directory checks
        mock_isdir.return_value = True

        # Mock open file
        mock_file = MagicMock()

        with patch("builtins.open", mock_file):
            analyzer = RepositoryAnalyzer("/fake/repo")
            analyzer.save_to_file("output.json")

            # Check that json.dump was called
            assert mock_json_dump.called

    @patch("repo_visualizer.analyzer.RepositoryAnalyzer")
    def test_analyze_repository_function(self, mock_analyzer_class):
        """Test the analyze_repository convenience function."""
        # Setup mock
        mock_instance = MagicMock()
        mock_analyzer_class.return_value = mock_instance

        # Call function
        analyze_repository("/path/to/repo", "output.json")

        # Check that methods were called
        mock_analyzer_class.assert_called_once_with("/path/to/repo")
        mock_instance.analyze.assert_called_once()
        mock_instance.save_to_file.assert_called_once_with("output.json")


if __name__ == "__main__":
    pytest.main(["-v", "test_analyzer.py"])
