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
        with open(os.path.join(self.repo_path, "test.py"), "w") as f:
            f.write("import os\n\nclass MyClass:\n    pass\n")

        analyzer = RepositoryAnalyzer(self.repo_path)
        analyzer.analyze()

        file_info = analyzer.file_ids.get("test.py")
        assert file_info is not None
        assert len(file_info.get("components", [])) == 1
        assert file_info.get("components", [])[0].get("name") == "MyClass"
        metrics = file_info.get("metrics")
        assert metrics is not None
        assert "linesOfCode" in metrics

    def test_analyze_js_file_content(self):
        """Test analysis of JavaScript file content."""
        with open(os.path.join(self.repo_path, "test.js"), "w") as f:
            f.write(
                "import React from 'react';\n\n"
                "function MyComponent() {\n"
                "    return <div></div>;\n"
                "}"
            )

        analyzer = RepositoryAnalyzer(self.repo_path)
        analyzer.analyze()

        file_info = analyzer.file_ids.get("test.js")
        assert file_info is not None
        assert len(file_info.get("components", [])) == 1
        assert file_info.get("components", [])[0].get("name") == "MyComponent"
        metrics = file_info.get("metrics")
        assert metrics is not None
        assert "linesOfCode" in metrics

    def test_resolve_python_import(self):
        """Test Python import resolution."""
        os.makedirs(os.path.join(self.repo_path, "src/utils"))
        with open(os.path.join(self.repo_path, "src/utils/__init__.py"), "w") as f:
            f.write("")
        with open(os.path.join(self.repo_path, "src/utils/helpers.py"), "w") as f:
            f.write("")
        with open(os.path.join(self.repo_path, "src/main.py"), "w") as f:
            f.write("from src.utils import helpers\n")

        analyzer = RepositoryAnalyzer(self.repo_path)
        analyzer.analyze()

        assert any(
            r["source"] == "src/main.py" and r["target"] == "src/utils/helpers.py"
            for r in analyzer.data["relationships"]
        )

    def test_resolve_js_import(self):
        """Test JavaScript import resolution."""
        os.makedirs(os.path.join(self.repo_path, "src/components"))
        with open(os.path.join(self.repo_path, "src/components/Button.js"), "w") as f:
            f.write("")
        with open(os.path.join(self.repo_path, "src/components/Card.js"), "w") as f:
            f.write("import Button from './Button';\n")

        analyzer = RepositoryAnalyzer(self.repo_path)
        analyzer.analyze()

        assert any(
            r["source"] == "src/components/Card.js"
            and r["target"] == "src/components/Button.js"
            for r in analyzer.data["relationships"]
        )
