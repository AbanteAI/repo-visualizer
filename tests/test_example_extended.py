"""Extended tests for example module."""

import json
import os
import tempfile
from unittest.mock import patch, mock_open

import pytest

from repo_visualizer.example import create_example_data, save_example_to_file
from repo_visualizer.schema import validate_repository_data


class TestExampleExtended:
    """Extended tests for example data generation."""

    def test_create_example_data_structure(self):
        """Test that created example data has correct structure."""
        data = create_example_data()
        
        # Check top-level structure
        assert "metadata" in data
        assert "files" in data
        assert "relationships" in data
        assert "history" in data
        
        # Check metadata structure
        metadata = data["metadata"]
        assert "repoName" in metadata
        assert "description" in metadata
        assert "createdAt" in metadata
        assert "updatedAt" in metadata
        assert "defaultBranch" in metadata
        assert "language" in metadata
        
        # Check files structure
        files = data["files"]
        assert len(files) > 0
        
        for file in files:
            assert "id" in file
            assert "path" in file
            assert "name" in file
            assert "type" in file
            assert "depth" in file
            assert "components" in file
            
            # Check components structure
            for component in file["components"]:
                assert "id" in component
                assert "name" in component
                assert "type" in component
                assert "lineStart" in component
                assert "lineEnd" in component
                assert "components" in component

    def test_create_example_data_relationships(self):
        """Test that example data has proper relationships."""
        data = create_example_data()
        
        relationships = data["relationships"]
        assert len(relationships) > 0
        
        for rel in relationships:
            assert "source" in rel
            assert "target" in rel
            assert "type" in rel
            assert rel["type"] in ["import", "call", "contains"]

    def test_create_example_data_history(self):
        """Test that example data has proper history structure."""
        data = create_example_data()
        
        history = data["history"]
        assert "commits" in history
        assert "timelinePoints" in history
        
        commits = history["commits"]
        assert len(commits) > 0
        
        for commit in commits:
            assert "id" in commit
            assert "author" in commit
            assert "date" in commit
            assert "message" in commit
            assert "fileChanges" in commit
            
            for change in commit["fileChanges"]:
                assert "fileId" in change
                assert "type" in change
                assert "additions" in change
                assert "deletions" in change

    def test_create_example_data_validation(self):
        """Test that example data passes validation."""
        data = create_example_data()
        assert validate_repository_data(data) is True

    def test_create_example_data_consistency(self):
        """Test that example data is internally consistent."""
        data = create_example_data()
        
        # Collect all file IDs
        file_ids = {f["id"] for f in data["files"]}
        
        # Check that all relationship sources and targets exist
        for rel in data["relationships"]:
            # Note: components may not be in the files list directly
            if not rel["source"].startswith("src/"):
                continue
            if not rel["target"].startswith("src/"):
                continue
            
            # File-level relationships should reference existing files
            if ":" not in rel["source"]:
                assert rel["source"] in file_ids, f"Source {rel['source']} not found in files"
            if ":" not in rel["target"]:
                assert rel["target"] in file_ids, f"Target {rel['target']} not found in files"

    def test_save_example_to_file_default(self):
        """Test saving example data with default filename."""
        with tempfile.TemporaryDirectory() as temp_dir:
            original_cwd = os.getcwd()
            try:
                os.chdir(temp_dir)
                
                save_example_to_file()
                
                # Check that file was created
                assert os.path.exists("example_repo_data.json")
                
                # Check that file contains valid JSON
                with open("example_repo_data.json") as f:
                    data = json.load(f)
                
                assert validate_repository_data(data) is True
                
            finally:
                os.chdir(original_cwd)

    def test_save_example_to_file_custom_filename(self):
        """Test saving example data with custom filename."""
        with tempfile.TemporaryDirectory() as temp_dir:
            filename = os.path.join(temp_dir, "custom_example.json")
            
            save_example_to_file(filename)
            
            # Check that file was created
            assert os.path.exists(filename)
            
            # Check that file contains valid JSON
            with open(filename) as f:
                data = json.load(f)
            
            assert validate_repository_data(data) is True

    def test_save_example_to_file_error_handling(self):
        """Test error handling when saving to invalid path."""
        with pytest.raises(FileNotFoundError):
            save_example_to_file("/nonexistent/path/example.json")

    def test_example_data_datetime_serialization(self):
        """Test that example data can be serialized with datetime objects."""
        data = create_example_data()
        
        # Try to serialize the data
        from datetime import datetime
        
        class DateTimeEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                return super().default(obj)
        
        json_str = json.dumps(data, cls=DateTimeEncoder)
        
        # Should not raise any exceptions
        assert isinstance(json_str, str)
        assert len(json_str) > 0
        
        # Should be valid JSON
        parsed = json.loads(json_str)
        assert isinstance(parsed, dict)

    def test_example_data_language_stats(self):
        """Test that example data has proper language statistics."""
        data = create_example_data()
        
        language_stats = data["metadata"]["language"]
        assert isinstance(language_stats, dict)
        
        # Check that percentages sum to approximately 1.0
        total = sum(language_stats.values())
        assert abs(total - 1.0) < 0.01
        
        # Check that all values are between 0 and 1
        for lang, percentage in language_stats.items():
            assert 0 <= percentage <= 1
            assert isinstance(lang, str)
            assert len(lang) > 0

    def test_example_data_file_metrics(self):
        """Test that example data files have proper metrics."""
        data = create_example_data()
        
        for file in data["files"]:
            if "metrics" in file:
                metrics = file["metrics"]
                
                # Check that metrics are reasonable
                if "complexity" in metrics:
                    assert metrics["complexity"] > 0
                if "linesOfCode" in metrics:
                    assert metrics["linesOfCode"] > 0
                if "commentLines" in metrics:
                    assert metrics["commentLines"] >= 0
                if "emptyLines" in metrics:
                    assert metrics["emptyLines"] >= 0

    def test_example_data_component_nesting(self):
        """Test that example data has proper component nesting."""
        data = create_example_data()
        
        # Find a class with methods
        class_with_methods = None
        for file in data["files"]:
            for component in file["components"]:
                if component["type"] == "class" and len(component["components"]) > 0:
                    class_with_methods = component
                    break
            if class_with_methods:
                break
        
        assert class_with_methods is not None
        
        # Check that nested components are properly structured
        for method in class_with_methods["components"]:
            assert "id" in method
            assert "name" in method
            assert "type" in method
            assert method["type"] == "method"
            assert "lineStart" in method
            assert "lineEnd" in method
            assert method["lineStart"] <= method["lineEnd"]


if __name__ == "__main__":
    pytest.main(["-v", "test_example_extended.py"])
