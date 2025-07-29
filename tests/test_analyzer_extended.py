"""Extended tests for repository analyzer module - covering under-tested methods."""

import os
import shutil
import subprocess

from repo_visualizer.analyzer import RepositoryAnalyzer


class TestRepositoryAnalyzerExtended:
    """Extended test coverage for RepositoryAnalyzer methods."""

    def setup_method(self):
        self.repo_path = os.path.join(os.path.dirname(__file__), "test_repo_ext")
        os.makedirs(self.repo_path, exist_ok=True)
        subprocess.run(
            ["git", "init"], cwd=self.repo_path, check=True, capture_output=True
        )
        with open(os.path.join(self.repo_path, ".gitignore"), "w") as f:
            f.write("node_modules/\n")
        with open(os.path.join(self.repo_path, "main.py"), "w") as f:
            f.write("import os\n")
        subprocess.run(["git", "add", "."], cwd=self.repo_path, check=True)
        subprocess.run(
            ["git", "commit", "-m", "Initial commit"],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
        )

    def teardown_method(self):
        shutil.rmtree(self.repo_path)

    def test_is_ignored(self):
        """Test if files are correctly identified as ignored."""
        analyzer = RepositoryAnalyzer(self.repo_path)
        assert analyzer._is_ignored(
            os.path.join(self.repo_path, "node_modules/test.js")
        )
        assert not analyzer._is_ignored(os.path.join(self.repo_path, "main.py"))

    def test_analyze_python_file_content(self):
        """Test analysis of Python file content."""
        analyzer = RepositoryAnalyzer(self.repo_path)
        python_content = "import os\n\nclass MyClass:\n    pass\n"
        file_info = {
            "id": "test.py",
            "path": "test.py",
            "type": "file",
            "extension": "py",
            "components": [],
            "metrics": {},
        }
        analyzer._analyze_file_content(python_content, file_info)
        assert len(file_info.get("components", [])) == 1
        assert file_info.get("components", [])[0].get("name") == "MyClass"
        assert "linesOfCode" in file_info.get("metrics", {})

    def test_analyze_js_file_content(self):
        """Test analysis of JavaScript file content."""
        analyzer = RepositoryAnalyzer(self.repo_path)
        js_content = (
            "import React from 'react';\n\n"
            "function MyComponent() {\n"
            "    return <div></div>;\n"
            "}"
        )
        file_info = {
            "id": "test.js",
            "path": "test.js",
            "type": "file",
            "extension": "js",
            "components": [],
            "metrics": {},
        }
        analyzer._analyze_file_content(js_content, file_info)
        assert len(file_info.get("components", [])) == 1
        assert file_info.get("components", [])[0].get("name") == "MyComponent"
        assert "linesOfCode" in file_info.get("metrics", {})

    def test_resolve_python_import(self):
        """Test Python import resolution."""
        analyzer = RepositoryAnalyzer(self.repo_path)
        os.makedirs(os.path.join(self.repo_path, "src/utils"))
        with open(os.path.join(self.repo_path, "src/utils/__init__.py"), "w") as f:
            f.write("")
        with open(os.path.join(self.repo_path, "src/utils/helpers.py"), "w") as f:
            f.write("")

        analyzer.file_ids = {
            "src/utils/helpers.py": {
                "id": "src/utils/helpers.py",
                "path": "src/utils/helpers.py",
                "type": "file",
                "extension": "py",
            }
        }

        analyzer._extract_file_relationships(
            "from src.utils import helpers", "src/main.py", "py"
        )
        assert (
            "src/main.py",
            "src/utils/helpers.py",
            "import",
        ) in analyzer.relationship_counts

    def test_resolve_js_import(self):
        """Test JavaScript import resolution."""
        analyzer = RepositoryAnalyzer(self.repo_path)
        os.makedirs(os.path.join(self.repo_path, "src/components"))
        with open(os.path.join(self.repo_path, "src/components/Button.js"), "w") as f:
            f.write("")

        analyzer.file_ids = {
            "src/components/Button.js": {
                "id": "src/components/Button.js",
                "path": "src/components/Button.js",
                "type": "file",
                "extension": "js",
            }
        }

        analyzer._extract_file_relationships(
            "import Button from './Button'", "src/components/Card.js", "js"
        )
        assert (
            "src/components/Card.js",
            "src/components/Button.js",
            "import",
        ) in analyzer.relationship_counts
