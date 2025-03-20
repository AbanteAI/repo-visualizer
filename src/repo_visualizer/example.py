"""
Example usage of the repository visualization schema.

This module provides an example of how to create and use the repository
visualization JSON schema.
"""

import json
from datetime import datetime
from typing import Dict, Any

from .schema import (
    RepositoryData,
    create_empty_schema,
    validate_repository_data,
)


def create_example_data() -> RepositoryData:
    """
    Create an example repository data structure.
    
    Returns:
        RepositoryData: Example repository data
    """
    # Start with an empty schema
    data = create_empty_schema()
    
    # Add repository metadata
    data["metadata"].update({
        "repoName": "example-repo",
        "description": "An example repository for visualization",
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-03-20T12:34:56Z",
        "defaultBranch": "main",
        "language": {
            "Python": 0.75,
            "JavaScript": 0.25
        }
    })
    
    # Add some files
    data["files"] = [
        {
            "id": "src/main.py",
            "path": "src/main.py",
            "name": "main.py",
            "extension": "py",
            "size": 1024,
            "type": "file",
            "depth": 1,
            "createdAt": "2025-01-01T00:00:00Z",
            "updatedAt": "2025-03-15T09:00:00Z",
            "metrics": {
                "complexity": 5.2,
                "linesOfCode": 150,
                "commentLines": 25,
                "emptyLines": 15
            },
            "components": [
                {
                    "id": "src/main.py:main",
                    "name": "main",
                    "type": "function",
                    "lineStart": 10,
                    "lineEnd": 20,
                    "metrics": {
                        "complexity": 2.0,
                        "linesOfCode": 10
                    },
                    "components": []
                },
                {
                    "id": "src/main.py:ExampleClass",
                    "name": "ExampleClass",
                    "type": "class",
                    "lineStart": 25,
                    "lineEnd": 100,
                    "metrics": {
                        "complexity": 3.2,
                        "linesOfCode": 75
                    },
                    "components": [
                        {
                            "id": "src/main.py:ExampleClass.__init__",
                            "name": "__init__",
                            "type": "method",
                            "lineStart": 26,
                            "lineEnd": 35,
                            "metrics": {
                                "complexity": 1.0,
                                "linesOfCode": 9
                            },
                            "components": []
                        }
                    ]
                }
            ]
        },
        {
            "id": "src/utils.py",
            "path": "src/utils.py",
            "name": "utils.py",
            "extension": "py",
            "size": 512,
            "type": "file",
            "depth": 1,
            "components": [
                {
                    "id": "src/utils.py:helper_function",
                    "name": "helper_function",
                    "type": "function",
                    "lineStart": 5,
                    "lineEnd": 15,
                    "components": []
                }
            ]
        }
    ]
    
    # Add relationships
    data["relationships"] = [
        {
            "source": "src/main.py",
            "target": "src/utils.py",
            "type": "import"
        },
        {
            "source": "src/main.py:main",
            "target": "src/utils.py:helper_function",
            "type": "call",
            "strength": 2.5
        }
    ]
    
    # Add history (simplified)
    data["history"] = {
        "commits": [
            {
                "id": "abc123",
                "author": "Alice <alice@example.com>",
                "date": "2025-03-10T10:00:00Z",
                "message": "Initial commit",
                "fileChanges": [
                    {
                        "fileId": "src/main.py",
                        "type": "add",
                        "additions": 100,
                        "deletions": 0
                    }
                ]
            },
            {
                "id": "def456",
                "author": "Bob <bob@example.com>",
                "date": "2025-03-15T14:30:00Z",
                "message": "Add utils module",
                "fileChanges": [
                    {
                        "fileId": "src/utils.py",
                        "type": "add",
                        "additions": 50,
                        "deletions": 0
                    },
                    {
                        "fileId": "src/main.py",
                        "type": "modify",
                        "additions": 10,
                        "deletions": 5
                    }
                ]
            }
        ],
        "timelinePoints": [
            {
                "commitId": "abc123",
                "state": {"fileCount": 1},
                "snapshot": {
                    "files": [],  # simplified for example
                    "relationships": []
                }
            },
            {
                "commitId": "def456",
                "state": {"fileCount": 2},
                "snapshot": {
                    "files": [],  # simplified for example
                    "relationships": []  # simplified for example
                }
            }
        ]
    }
    
    return data


def save_example_to_file(filename: str = "example_repo_data.json") -> None:
    """
    Save example repository data to a JSON file.
    
    Args:
        filename: Output JSON filename
    """
    data = create_example_data()
    
    # Custom JSON encoder to handle datetime objects
    class DateTimeEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            return super().default(obj)
    
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2, cls=DateTimeEncoder)
    
    print(f"Example data saved to {filename}")


if __name__ == "__main__":
    # Create and save example data
    save_example_to_file()
    
    # Demonstrate validation
    data = create_example_data()
    is_valid = validate_repository_data(data)
    print(f"Data validation result: {is_valid}")
