"""Tests for repository visualizer CLI."""

from unittest.mock import patch

import pytest

from repo_visualizer.cli import main, parse_args, setup_logging


class TestCli:
    """Test the command-line interface."""

    def test_parse_args_defaults(self):
        """Test parsing command-line arguments with defaults."""
        with patch("os.getcwd", return_value="/current/dir"):
            args = parse_args([])
            assert args.repo_path == "/current/dir"
            assert args.output == "repo_data.json"
            assert args.verbose is False

    def test_parse_args_with_values(self):
        """Test parsing command-line arguments with explicit values."""
        args = parse_args(["/path/to/repo", "-o", "custom_output.json", "-v"])
        assert args.repo_path == "/path/to/repo"
        assert args.output == "custom_output.json"
        assert args.verbose is True
        assert args.branch is None  # default
        assert args.history_sample == 10  # default
        assert args.max_commits == 1000  # default

    def test_parse_args_with_history_options(self):
        """Test parsing command-line arguments with history options."""
        args = parse_args(
            [
                "/path/to/repo",
                "-b",
                "main",
                "--history-sample",
                "5",
                "--max-commits",
                "100",
            ]
        )
        assert args.repo_path == "/path/to/repo"
        assert args.branch == "main"
        assert args.history_sample == 5
        assert args.max_commits == 100

    @patch("logging.basicConfig")
    def test_setup_logging(self, mock_basic_config):
        """Test logging setup."""
        # Test normal logging
        setup_logging(False)
        args, kwargs = mock_basic_config.call_args
        assert kwargs["level"] == 20  # INFO level

        # Test verbose logging
        mock_basic_config.reset_mock()
        setup_logging(True)
        args, kwargs = mock_basic_config.call_args
        assert kwargs["level"] == 10  # DEBUG level

    @patch("os.path.isdir")
    @patch("repo_visualizer.cli.RepositoryAnalyzer")
    def test_main_success(self, mock_analyzer_class, mock_isdir):
        """Test successful execution of main function."""
        # Mock directory checks
        mock_isdir.return_value = True

        # Mock analyzer instance and its methods
        mock_analyzer = mock_analyzer_class.return_value
        mock_analyzer.analyze.return_value = {"test": "data"}

        # Run main with test arguments
        exit_code = main(["/path/to/repo", "-o", "output.json"])

        # Check that RepositoryAnalyzer was called with expected args
        mock_analyzer_class.assert_called_once_with(
            "/path/to/repo", branch=None, history_sample=10, max_commits=1000
        )
        mock_analyzer.analyze.assert_called_once()
        mock_analyzer.save_to_file.assert_called_once_with("output.json")
        assert exit_code == 0

    @patch("os.path.isdir")
    def test_main_invalid_repo_path(self, mock_isdir):
        """Test main function with invalid repository path."""
        # First check for directory existence fails
        mock_isdir.side_effect = [False]

        exit_code = main(["/nonexistent/path"])
        assert exit_code == 1

        # Repository path exists but .git directory doesn't
        mock_isdir.side_effect = [True, False]

        exit_code = main(["/not/a/git/repo"])
        assert exit_code == 1

    @patch("os.path.isdir")
    def test_main_invalid_output_dir(self, mock_isdir):
        """Test main function with invalid output directory."""
        # Repository checks pass, but output directory check fails
        mock_isdir.side_effect = [True, True, False]

        exit_code = main(["/path/to/repo", "-o", "/nonexistent/dir/output.json"])
        assert exit_code == 1

    @patch("os.path.isdir")
    @patch("repo_visualizer.cli.RepositoryAnalyzer")
    def test_main_exception(self, mock_analyzer_class, mock_isdir):
        """Test main function with exception during analysis."""
        # Mock directory checks
        mock_isdir.return_value = True

        # Mock exception during analyzer instantiation
        mock_analyzer_class.side_effect = Exception("Test error")

        # Run main
        exit_code = main(["/path/to/repo"])

        # Should catch exception and return error code
        assert exit_code == 1


if __name__ == "__main__":
    pytest.main(["-v", "test_cli.py"])
