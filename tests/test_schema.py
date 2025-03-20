"""Tests for repository visualization schema."""

import json
from datetime import datetime

import pytest

from src.repo_visualizer.schema import (
    create_empty_schema,
    validate_repository_data,
    schema_version,
)
from src.repo_visualizer.example import create_example_data


def test_create_empty_schema():
    """Test creating an empty schema."""
    schema = create_empty_schema()
    
    # Verify required fields are present
    assert "metadata" in schema
    assert "files" in schema
    assert "relationships" in schema
    assert "customData" in schema
    
    # Verify metadata fields
    assert "repoName" in schema["metadata"]
    assert "schemaVersion" in schema["metadata"]
    assert "analysisDate" in schema["metadata"]
    
    # Verify empty lists
    assert isinstance(schema["files"], list)
    assert len(schema["files"]) == 0
    assert isinstance(schema["relationships"], list)
    assert len(schema["relationships"]) == 0


def test_schema_version():
    """Test schema version is a valid string."""
    version = schema_version()
    assert isinstance(version, str)
    assert "." in version  # Simple format check - should contain at least one dot


def test_validate_repository_data_valid():
    """Test validation with valid data."""
    data = create_example_data()
    assert validate_repository_data(data) is True


def test_validate_repository_data_invalid():
    """Test validation with invalid data."""
    # Missing required fields
    invalid_data = {
        "metadata": {"repoName": "test"},
        # Missing "files" field
        "relationships": []
    }
    assert validate_repository_data(invalid_data) is False


def test_json_serialization():
    """Test that the schema can be serialized to JSON."""
    data = create_example_data()
    
    # Custom JSON encoder to handle datetime objects
    class DateTimeEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            return super().default(obj)
    
    # Should not raise any exceptions
    json_str = json.dumps(data, cls=DateTimeEncoder)
    assert isinstance(json_str, str)
    assert len(json_str) > 0
    
    # Should be valid JSON that can be parsed back
    parsed_data = json.loads(json_str)
    assert isinstance(parsed_data, dict)
    assert "metadata" in parsed_data
    assert "files" in parsed_data
    assert "relationships" in parsed_data


def test_example_data_is_valid():
    """Test that the example data is valid according to our schema."""
    data = create_example_data()
    assert validate_repository_data(data) is True
    
    # Verify specific required elements
    assert len(data["files"]) > 0
    assert "id" in data["files"][0]
    assert "path" in data["files"][0]
    assert len(data["relationships"]) > 0
    assert "source" in data["relationships"][0]
    assert "target" in data["relationships"][0]
