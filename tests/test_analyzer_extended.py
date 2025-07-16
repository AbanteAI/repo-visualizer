"""Extended tests for repository analyzer module - covering under-tested methods."""

from unittest.mock import MagicMock, mock_open, patch

import pytest

from repo_visualizer.analyzer import RepositoryAnalyzer


class TestRepositoryAnalyzerExtended:
    """Extended test coverage for RepositoryAnalyzer methods."""

    @patch("os.path.isdir")
    @patch("subprocess.run")
    def test_get_git_description(self, mock_run, mock_isdir):
        """Test git description extraction."""
        mock_isdir.return_value = True

        # Test successful description extraction
        mock_run.return_value = MagicMock(
            returncode=0, stdout="https://github.com/user/repo.git\n"
        )

        analyzer = RepositoryAnalyzer("/fake/repo")
        description = analyzer._get_git_description()

        assert description == "Git repository at https://github.com/user/repo.git"
        mock_run.assert_called_with(
            ["git", "config", "--get", "remote.origin.url"],
            cwd="/fake/repo",
            capture_output=True,
            text=True,
            check=False,
        )

    @patch("os.path.isdir")
    @patch("subprocess.run")
    def test_get_git_description_no_remote(self, mock_run, mock_isdir):
        """Test git description when no remote is configured."""
        mock_isdir.return_value = True

        # Test when git command fails
        mock_run.return_value = MagicMock(returncode=1, stdout="")

        analyzer = RepositoryAnalyzer("/fake/repo")
        description = analyzer._get_git_description()

        assert description == ""

    @patch("os.path.isdir")
    @patch("subprocess.run")
    def test_get_default_branch(self, mock_run, mock_isdir):
        """Test default branch detection."""
        mock_isdir.return_value = True

        # Test successful branch detection
        mock_run.return_value = MagicMock(returncode=0, stdout="main\n")

        analyzer = RepositoryAnalyzer("/fake/repo")
        branch = analyzer._get_default_branch()

        assert branch == "main"

    @patch("os.path.isdir")
    @patch("subprocess.run")
    def test_get_default_branch_fallback(self, mock_run, mock_isdir):
        """Test default branch fallback."""
        mock_isdir.return_value = True

        # Test when git command fails
        mock_run.return_value = MagicMock(returncode=1, stdout="")

        analyzer = RepositoryAnalyzer("/fake/repo")
        branch = analyzer._get_default_branch()

        assert branch == "main"  # Default fallback

    @patch("os.path.isdir")
    def test_sanitize_git_url(self, mock_isdir):
        """Test git URL sanitization."""
        mock_isdir.return_value = True

        analyzer = RepositoryAnalyzer("/fake/repo")

        # Test HTTPS URL with credentials
        url = "https://username:token@github.com/user/repo.git"
        sanitized = analyzer._sanitize_git_url(url)
        assert sanitized == "https://github.com/user/repo.git"

        # Test SSH URL with credentials
        url = "ssh://user:pass@github.com/user/repo.git"
        sanitized = analyzer._sanitize_git_url(url)
        assert sanitized == "ssh://github.com/user/repo.git"

        # Test URL without credentials
        url = "https://github.com/user/repo.git"
        sanitized = analyzer._sanitize_git_url(url)
        assert sanitized == "https://github.com/user/repo.git"

    @patch("os.path.isdir")
    @patch("os.walk")
    @patch("os.path.isfile")
    @patch("os.path.getsize")
    def test_calculate_language_stats_comprehensive(
        self, mock_getsize, mock_isfile, mock_walk, mock_isdir
    ):
        """Test comprehensive language statistics calculation."""
        mock_isdir.return_value = True
        mock_isfile.return_value = True

        # Mock file system with various file types
        mock_walk.return_value = [
            (
                "/fake/repo",
                [],
                ["main.py", "utils.py", "app.js", "style.css", "README.md"],
            ),
        ]

        # Mock file sizes
        mock_getsize.side_effect = lambda path: {
            "/fake/repo/main.py": 1000,
            "/fake/repo/utils.py": 500,
            "/fake/repo/app.js": 800,
            "/fake/repo/style.css": 300,
            "/fake/repo/README.md": 200,
        }.get(path, 0)

        analyzer = RepositoryAnalyzer("/fake/repo")
        analyzer.gitignore_spec = None  # Mock gitignore
        analyzer._is_ignored = MagicMock(return_value=False)

        stats = analyzer._calculate_language_stats()

        total_size = 1000 + 500 + 800 + 300 + 200  # 2800

        assert stats["Python"] == pytest.approx(1500 / 2800, rel=1e-3)
        assert stats["JavaScript"] == pytest.approx(800 / 2800, rel=1e-3)
        assert stats["CSS"] == pytest.approx(300 / 2800, rel=1e-3)
        assert stats["Markdown"] == pytest.approx(200 / 2800, rel=1e-3)

    @patch("os.path.isdir")
    @patch("os.walk")
    @patch("os.path.isfile")
    @patch("os.path.getsize")
    def test_calculate_language_stats_empty_repo(
        self, mock_getsize, mock_isfile, mock_walk, mock_isdir
    ):
        """Test language statistics for empty repository."""
        mock_isdir.return_value = True
        mock_walk.return_value = []

        analyzer = RepositoryAnalyzer("/fake/repo")
        analyzer.gitignore_spec = None
        analyzer._is_ignored = MagicMock(return_value=False)

        stats = analyzer._calculate_language_stats()

        assert stats == {}

    @patch("os.path.isdir")
    def test_analyze_js_file(self, mock_isdir):
        """Test JavaScript file analysis."""
        mock_isdir.return_value = True

        js_content = """
// This is a comment
/* Another comment */
class TestClass extends BaseClass {
    constructor() {
        super();
    }
    
    method1() {
        return "test";
    }
}

function regularFunction() {
    return true;
}

const arrowFunction = () => {
    return false;
};

const functionExpression = function() {
    return null;
};
"""

        analyzer = RepositoryAnalyzer("/fake/repo")
        components, metrics = analyzer._analyze_js_file(js_content, "test.js", {})

        # Check metrics
        assert "commentLines" in metrics
        assert metrics["commentLines"] > 0
        assert "topLevelIdentifiers" in metrics

        # Check components
        assert len(components) >= 4  # At least class + 3 functions

        # Check that components have correct structure
        for component in components:
            assert "id" in component
            assert "name" in component
            assert "type" in component
            assert component["type"] in ["class", "function"]
            assert "lineStart" in component
            assert "lineEnd" in component

    @patch("os.path.isdir")
    def test_resolve_js_import(self, mock_isdir):
        """Test JavaScript import resolution."""
        mock_isdir.return_value = True

        analyzer = RepositoryAnalyzer("/fake/repo")
        analyzer.file_ids = {
            "src/utils.js",
            "src/components/Button.jsx",
            "src/components/index.js",
            "lib/helper.ts",
        }

        # Test relative import
        result = analyzer._resolve_js_import("./utils.js", "src/main.js")
        assert result == "src/utils.js"

        # Test relative import with extension inference
        result = analyzer._resolve_js_import("./utils", "src/main.js")
        assert result == "src/utils.js"

        # Test parent directory import
        result = analyzer._resolve_js_import("../lib/helper", "src/main.js")
        assert result == "lib/helper.ts"

        # Test index file resolution
        result = analyzer._resolve_js_import("./components", "src/main.js")
        assert result == "src/components/index.js"

        # Test external module (should return None)
        result = analyzer._resolve_js_import("react", "src/main.js")
        assert result is None

        # Test scoped module (should return None)
        result = analyzer._resolve_js_import("@babel/core", "src/main.js")
        assert result is None

    @patch("os.path.isdir")
    def test_update_directory_sizes(self, mock_isdir):
        """Test directory size calculation."""
        mock_isdir.return_value = True

        analyzer = RepositoryAnalyzer("/fake/repo")

        # Create test file structure
        files = [
            {
                "id": "src",
                "path": "src",
                "name": "src",
                "type": "directory",
                "size": 0,
                "depth": 0,
            },
            {
                "id": "src/utils",
                "path": "src/utils",
                "name": "utils",
                "type": "directory",
                "size": 0,
                "depth": 1,
            },
            {
                "id": "src/main.py",
                "path": "src/main.py",
                "name": "main.py",
                "type": "file",
                "size": 1000,
                "depth": 1,
            },
            {
                "id": "src/utils/helper.py",
                "path": "src/utils/helper.py",
                "name": "helper.py",
                "type": "file",
                "size": 500,
                "depth": 2,
            },
        ]

        # Mock relationships
        analyzer.relationships = [
            {"source": "src", "target": "src/main.py", "type": "contains"},
            {"source": "src", "target": "src/utils", "type": "contains"},
            {
                "source": "src/utils",
                "target": "src/utils/helper.py",
                "type": "contains",
            },
        ]

        analyzer._update_directory_sizes(files)

        # Check that directory sizes were updated
        src_dir = next(f for f in files if f["id"] == "src")
        utils_dir = next(f for f in files if f["id"] == "src/utils")

        assert src_dir["size"] == 1500  # 1000 + 500
        assert utils_dir["size"] == 500

    @patch("os.path.isdir")
    @patch("subprocess.run")
    def test_extract_file_git_metrics(self, mock_run, mock_isdir):
        """Test git metrics extraction for files."""
        mock_isdir.return_value = True

        analyzer = RepositoryAnalyzer("/fake/repo")

        # Mock git log output
        mock_run.side_effect = [
            # First call: commit count
            MagicMock(
                returncode=0, stdout="abc123 Initial commit\ndef456 Update file\n"
            ),
            # Second call: last commit date
            MagicMock(returncode=0, stdout="2023-12-01 10:00:00 +0000\n"),
        ]

        metrics = analyzer._extract_file_git_metrics("src/main.py")

        assert "commitCount" in metrics
        assert metrics["commitCount"] == 2
        assert "lastCommitDaysAgo" in metrics
        assert "lastCommitDate" in metrics

    @patch("os.path.isdir")
    @patch("subprocess.run")
    def test_extract_file_git_metrics_no_commits(self, mock_run, mock_isdir):
        """Test git metrics extraction for files with no commits."""
        mock_isdir.return_value = True

        analyzer = RepositoryAnalyzer("/fake/repo")

        # Mock git log output with no commits
        mock_run.side_effect = [
            MagicMock(returncode=0, stdout=""),
            MagicMock(returncode=1, stdout=""),
        ]

        metrics = analyzer._extract_file_git_metrics("src/new_file.py")

        assert metrics["commitCount"] == 0
        assert metrics["lastCommitDaysAgo"] == 0
        assert "lastCommitDate" in metrics

    @patch("os.path.isdir")
    def test_extract_python_semantic_content(self, mock_isdir):
        """Test Python semantic content extraction."""
        mock_isdir.return_value = True

        analyzer = RepositoryAnalyzer("/fake/repo")

        python_content = '''
"""
This is a module docstring
explaining what the module does.
"""

# This is a comment
def example_function():
    """Function docstring."""
    pass

class ExampleClass:
    """Class docstring."""
    
    def method_one(self):
        # Method comment
        return True
'''

        content = analyzer._extract_python_semantic_content(python_content)

        assert "module docstring" in content
        assert "Function docstring" in content
        assert "Class docstring" in content
        assert "This is a comment" in content
        assert "function example_function" in content
        assert "class ExampleClass" in content

    @patch("os.path.isdir")
    def test_extract_javascript_semantic_content(self, mock_isdir):
        """Test JavaScript semantic content extraction."""
        mock_isdir.return_value = True

        analyzer = RepositoryAnalyzer("/fake/repo")

        js_content = """
/**
 * This is a JSDoc comment
 * @param {string} name - The name
 */
function greet(name) {
    // Single line comment
    return `Hello, ${name}!`;
}

/* Block comment */
class TestClass {
    constructor() {
        this.value = 42;
    }
}
"""

        content = analyzer._extract_javascript_semantic_content(js_content)

        assert "JSDoc comment" in content
        assert "Single line comment" in content
        assert "Block comment" in content
        assert "function greet" in content
        assert "class TestClass" in content

    @patch("os.path.isdir")
    def test_extract_generic_semantic_content(self, mock_isdir):
        """Test generic semantic content extraction."""
        mock_isdir.return_value = True

        analyzer = RepositoryAnalyzer("/fake/repo")

        generic_content = """
// Single line comment
/* Multi-line
   comment */
# Hash comment
function function_name() {
    variable_name = "value";
}
"""

        content = analyzer._extract_generic_semantic_content(generic_content)

        assert "Single line comment" in content
        assert "Multi-line" in content
        assert "Hash comment" in content
        assert "defines function_name" in content

    @patch("os.path.isdir")
    def test_is_text_file(self, mock_isdir):
        """Test text file detection."""
        mock_isdir.return_value = True

        analyzer = RepositoryAnalyzer("/fake/repo")

        # Test with text content (no null bytes)
        with patch("builtins.open", mock_open()) as mock_file:
            mock_file.return_value.read.return_value = b"def main():\n    pass\n"
            assert analyzer._is_text_file("/fake/file.py") is True

        # Test with binary content (contains null bytes)
        with patch("builtins.open", mock_open()) as mock_file:
            mock_file.return_value.read.return_value = b"\x00\x01\x02\x03"
            assert analyzer._is_text_file("/fake/file.bin") is False

        # Test with file that raises exception
        with patch("builtins.open", mock_open()) as mock_file:
            mock_file.return_value.read.side_effect = OSError("File not found")
            assert analyzer._is_text_file("/fake/file.txt") is False

    @patch("os.path.isdir")
    def test_save_to_file(self, mock_isdir):
        """Test saving repository data to file."""
        mock_isdir.return_value = True

        analyzer = RepositoryAnalyzer("/fake/repo")
        analyzer.data = {
            "metadata": {"repoName": "test"},
            "files": [],
            "relationships": [],
        }

        with patch("builtins.open", mock_open()) as mock_file:
            with patch("json.dump") as mock_json_dump:
                analyzer.save_to_file("output.json")

                mock_file.assert_called_once_with("output.json", "w")
                mock_json_dump.assert_called_once()


if __name__ == "__main__":
    pytest.main(["-v", "test_analyzer_extended.py"])
