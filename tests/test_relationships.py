"""Tests for repository relationships functionality in analyzer module."""

from unittest.mock import patch

from repo_visualizer.analyzer import RepositoryAnalyzer


class TestRepositoryRelationships:
    """Test the relationship extraction and resolution functionality."""

    @patch("os.path.isdir")
    def test_directory_file_relationships(self, mock_isdir):
        """Test directory-file containment relationships are created."""
        # Mock directory checks
        mock_isdir.return_value = True

        # Create test file structure
        file_structure = [
            # root, dirs, files
            ("/fake/repo", ["src", "docs"], []),
            ("/fake/repo/src", ["utils"], ["main.py"]),
            ("/fake/repo/src/utils", [], ["helpers.py"]),
            ("/fake/repo/docs", [], ["README.md"]),
        ]

        # Create analyzer with mocked directory access
        with patch("os.walk", return_value=file_structure), patch(
            "os.path.getsize", return_value=100
        ), patch("os.path.isfile", return_value=True), patch(
            "os.path.getmtime", return_value=1000000000
        ), patch("os.path.getctime", return_value=1000000000), patch.object(
            RepositoryAnalyzer, "_is_text_file", return_value=True
        ), patch.object(
            RepositoryAnalyzer, "_analyze_file_content", return_value=([], {})
        ):
            analyzer = RepositoryAnalyzer("/fake/repo")
            analyzer._analyze_files()

            # Check that files were added to file_ids
            assert "src" in analyzer.file_ids
            assert "src/utils" in analyzer.file_ids
            assert "src/main.py" in analyzer.file_ids
            assert "src/utils/helpers.py" in analyzer.file_ids
            assert "docs" in analyzer.file_ids
            assert "docs/README.md" in analyzer.file_ids

            # Check directory-file relationships
            dir_file_rel = [
                r for r in analyzer.relationships if r["type"] == "contains"
            ]

            # Check counts - should have 4 relationships for this test structure
            assert len(dir_file_rel) == 4  # One relationship for each parent-child pair

            # Check specific relationships
            assert {
                "source": "src",
                "target": "src/utils",
                "type": "contains",
            } in dir_file_rel
            assert {
                "source": "src",
                "target": "src/main.py",
                "type": "contains",
            } in dir_file_rel
            assert {
                "source": "src/utils",
                "target": "src/utils/helpers.py",
                "type": "contains",
            } in dir_file_rel
            assert {
                "source": "docs",
                "target": "docs/README.md",
                "type": "contains",
            } in dir_file_rel

    @patch("os.path.isdir")
    def test_missing_directory_creation(self, mock_isdir):
        """Test creation of missing directory entries."""
        mock_isdir.return_value = True

        # Create test structure with missing intermediate directories
        file_structure = [
            # Only specify deep file without intermediate directories
            ("/fake/repo", [], []),
            ("/fake/repo/deeply/nested/dir", [], ["test.py"]),
        ]

        # Create analyzer with mocked directory access
        with patch("os.walk", return_value=file_structure), patch(
            "os.path.getsize", return_value=100
        ), patch("os.path.isfile", return_value=True), patch(
            "os.path.getmtime", return_value=1000000000
        ), patch("os.path.getctime", return_value=1000000000), patch.object(
            RepositoryAnalyzer, "_is_text_file", return_value=True
        ), patch.object(
            RepositoryAnalyzer, "_analyze_file_content", return_value=([], {})
        ):
            analyzer = RepositoryAnalyzer("/fake/repo")
            analyzer._analyze_files()

            # Check that directories were created
            assert "deeply" in analyzer.file_ids
            assert "deeply/nested" in analyzer.file_ids
            assert "deeply/nested/dir" in analyzer.file_ids
            assert "deeply/nested/dir/test.py" in analyzer.file_ids

            # Check directory-file relationships
            dir_file_rel = [
                r for r in analyzer.relationships if r["type"] == "contains"
            ]

            # Check specific relationships
            assert {
                "source": "deeply",
                "target": "deeply/nested",
                "type": "contains",
            } in dir_file_rel
            assert {
                "source": "deeply/nested",
                "target": "deeply/nested/dir",
                "type": "contains",
            } in dir_file_rel
            assert {
                "source": "deeply/nested/dir",
                "target": "deeply/nested/dir/test.py",
                "type": "contains",
            } in dir_file_rel

    @patch("os.path.isdir")
    def test_python_import_resolution(self, mock_isdir):
        """Test resolution of Python imports."""
        mock_isdir.return_value = True

        # Setup analyzer with mocked file_ids
        analyzer = RepositoryAnalyzer("/fake/repo")
        analyzer.file_ids = {
            "src",
            "src/main.py",
            "src/utils",
            "src/utils/__init__.py",
            "src/utils/helpers.py",
            "src/models",
            "src/models/__init__.py",
            "src/models/user.py",
        }

        # Test standard import
        paths = analyzer._resolve_python_import("utils.helpers", "src/main.py")
        assert "src/utils/helpers.py" in paths

        # Test relative import (single dot)
        paths = analyzer._resolve_python_import(".utils.helpers", "src/main.py")
        assert "src/utils/helpers.py" in paths

        # Test relative import (double dot)
        paths = analyzer._resolve_python_import("..models.user", "src/utils/helpers.py")
        assert "src/models/user.py" in paths

        # Test package import
        paths = analyzer._resolve_python_import("src.utils.helpers", "test.py")
        assert "src/utils/helpers.py" in paths

    @patch("os.path.isdir")
    def test_file_component_relationships(self, mock_isdir):
        """Test creating relationships between files and components."""
        mock_isdir.return_value = True

        # Create file with components
        test_file = {
            "id": "test.py",
            "type": "file",
            "depth": 0,
            "components": [
                {
                    "id": "test.py:TestClass",
                    "name": "TestClass",
                    "type": "class",
                    "components": [
                        {
                            "id": "test.py:TestClass.method",
                            "name": "method",
                            "type": "method",
                            "components": [],
                        }
                    ],
                },
                {
                    "id": "test.py:test_function",
                    "name": "test_function",
                    "type": "function",
                    "components": [],
                },
            ],
        }

        # Setup analyzer
        analyzer = RepositoryAnalyzer("/fake/repo")
        analyzer.data["files"] = [test_file]

        # In actual implementation, file-component relationships
        # are added during _analyze_files. We need to simulate that here.
        analyzer.relationships = [
            {"source": "test.py", "target": "test.py:TestClass", "type": "contains"},
            {
                "source": "test.py",
                "target": "test.py:test_function",
                "type": "contains",
            },
            {
                "source": "test.py:TestClass",
                "target": "test.py:TestClass.method",
                "type": "contains",
            },
        ]

        # Run the relationship extraction
        analyzer._extract_relationships()

        # Get the relationships from the processed data
        relationships = analyzer.data["relationships"]

        # Check file-component relationships (they should be in the processed data)
        assert {
            "source": "test.py",
            "target": "test.py:TestClass",
            "type": "contains",
        } in relationships
        assert {
            "source": "test.py",
            "target": "test.py:test_function",
            "type": "contains",
        } in relationships
        assert {
            "source": "test.py:TestClass",
            "target": "test.py:TestClass.method",
            "type": "contains",
        } in relationships

        # Check that component nodes were added to files list
        file_ids = [f["id"] for f in analyzer.data["files"]]
        assert "test.py:TestClass" in file_ids
        assert "test.py:test_function" in file_ids
        assert "test.py:TestClass.method" in file_ids

    @patch("os.path.isdir")
    def test_python_import_extraction(self, mock_isdir):
        """Test extraction of Python imports from file content."""
        mock_isdir.return_value = True

        # Create analyzer
        analyzer = RepositoryAnalyzer("/fake/repo")
        analyzer.file_ids = {"utils.py", "models.py", "config.py"}

        # Test with different import styles
        python_content = """
import utils
import models, config
from utils import helper
from models import User, Admin
from . import local
from .sub import module
import utils as u
from config import settings as s
"""

        # Mock the import resolution to return the file itself for simplicity
        with patch.object(RepositoryAnalyzer, "_resolve_python_import") as mock_resolve:
            mock_resolve.side_effect = (
                lambda mod, path: ["utils.py"]
                if "utils" in mod
                else ["models.py"]
                if "models" in mod
                else ["config.py"]
                if "config" in mod
                else []
            )

            # Extract relationships
            analyzer._extract_file_relationships(python_content, "test.py", "py")

            # Check the relationships were created
            import_relations = [
                r for r in analyzer.relationships if r["type"] == "import"
            ]

            # Should have import relationships for utils, models, and config
            assert {
                "source": "test.py",
                "target": "utils.py",
                "type": "import",
            } in import_relations
            assert {
                "source": "test.py",
                "target": "models.py",
                "type": "import",
            } in import_relations
            assert {
                "source": "test.py",
                "target": "config.py",
                "type": "import",
            } in import_relations

            # Check number of imports matches expected
            # (note: relationships get deduplicated)
            unique_imports = {(r["source"], r["target"]) for r in import_relations}
            assert len(unique_imports) == 3  # One for each unique module

    @patch("os.path.isdir")
    def test_duplicate_relationship_removal(self, mock_isdir):
        """Test removal of duplicate relationships."""
        mock_isdir.return_value = True

        # Create analyzer with duplicate relationships
        analyzer = RepositoryAnalyzer("/fake/repo")
        analyzer.relationships = [
            {"source": "file1.py", "target": "file2.py", "type": "import"},
            {"source": "file1.py", "target": "file2.py", "type": "import"},  # Duplicate
            {"source": "file1.py", "target": "file3.py", "type": "import"},
            {"source": "dir1", "target": "file1.py", "type": "contains"},
            {"source": "dir1", "target": "file1.py", "type": "contains"},  # Duplicate
        ]

        # Run relationship extraction which includes deduplication
        analyzer._extract_relationships()

        # Check that duplicates were removed
        unique_relationships = analyzer.data["relationships"]

        # Count relationships by type
        import_rels = [r for r in unique_relationships if r["type"] == "import"]
        contains_rels = [r for r in unique_relationships if r["type"] == "contains"]

        assert len(import_rels) == 2  # Two unique imports
        assert len(contains_rels) == 1  # One unique contains

    @patch("os.path.isdir")
    def test_component_import_extraction(self, mock_isdir):
        """Test extraction of specific component imports."""
        mock_isdir.return_value = True

        # Create analyzer with mock files and components
        analyzer = RepositoryAnalyzer("/fake/repo")

        # Create target file with components that can be imported
        target_file = {
            "id": "utils.py",
            "path": "utils.py",
            "name": "utils.py",
            "type": "file",
            "components": [
                {
                    "id": "utils.py:HelperClass",
                    "name": "HelperClass",
                    "type": "class",
                    "components": [],
                },
                {
                    "id": "utils.py:utility_function",
                    "name": "utility_function",
                    "type": "function",
                    "components": [],
                },
                {
                    "id": "utils.py:CONSTANT",
                    "name": "CONSTANT",
                    "type": "variable",
                    "components": [],
                },
            ],
        }

        # Add the target file to the analyzer's data
        analyzer.data = {"files": [target_file], "relationships": []}
        analyzer.file_ids = {"utils.py"}

        # Test different import styles
        import_statements = [
            # Regular component import
            "from utils import HelperClass, utility_function",
            # Import with alias
            "from utils import HelperClass as HC, CONSTANT as C",
            # Parenthesized import
            "from utils import (HelperClass, utility_function)",
            # Star import
            "from utils import *",
        ]

        # Test each import style
        for import_statement in import_statements:
            # Clear existing relationships
            analyzer.relationships = []

            # Call the method directly
            analyzer._extract_component_imports(import_statement, "main.py", "utils.py")

            # Check for component import relationships
            if "*" in import_statement:
                # Star import should import all components
                assert len(analyzer.relationships) == 3
            else:
                # Should have relationships for the specific components
                component_imports = [
                    r
                    for r in analyzer.relationships
                    if r["type"] == "imports_component"
                ]

                # Check that HelperClass was imported
                assert any(
                    r["source"] == "main.py"
                    and r["target"] == "utils.py:HelperClass"
                    and r["type"] == "imports_component"
                    for r in component_imports
                )

                # utility_function should be imported in regular and parenthesized imports
                if "utility_function" in import_statement:
                    assert any(
                        r["source"] == "main.py"
                        and r["target"] == "utils.py:utility_function"
                        and r["type"] == "imports_component"
                        for r in component_imports
                    )

                # CONSTANT should be imported in the aliased import
                if "CONSTANT" in import_statement:
                    assert any(
                        r["source"] == "main.py"
                        and r["target"] == "utils.py:CONSTANT"
                        and r["type"] == "imports_component"
                        for r in component_imports
                    )
