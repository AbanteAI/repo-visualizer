"""Tests for repository relationships functionality in analyzer module."""

import os
import shutil
import subprocess

from repo_visualizer.analyzer import RepositoryAnalyzer


class TestRepositoryRelationships:
    """Test the relationship extraction and resolution functionality."""

    def setup_method(self):
        self.repo_path = os.path.join(os.path.dirname(__file__), "test_repo_rel")
        if os.path.exists(self.repo_path):
            shutil.rmtree(self.repo_path)
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

        # Create a complex file structure
        os.makedirs(os.path.join(self.repo_path, "src/app/components"))
        with open(os.path.join(self.repo_path, "src/app/main.py"), "w") as f:
            f.write("from ..utils import helper\n")
        with open(os.path.join(self.repo_path, "src/utils/helper.py"), "w") as f:
            f.write("def a_helper(): pass\n")
        with open(
            os.path.join(self.repo_path, "src/app/components/button.js"), "w"
        ) as f:
            f.write("import '../styles/button.css';\n")
        os.makedirs(os.path.join(self.repo_path, "src/styles"))
        with open(os.path.join(self.repo_path, "src/styles/button.css"), "w") as f:
            f.write(".btn { color: red; }")

        subprocess.run(["git", "add", "."], cwd=self.repo_path, check=True)
        subprocess.run(
            ["git", "commit", "-m", "Initial commit"],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
        )

    def teardown_method(self):
        shutil.rmtree(self.repo_path)

    def test_directory_containment(self):
        """Test that directory containment relationships are created."""
        analyzer = RepositoryAnalyzer(self.repo_path)
        analyzer.analyze()

        relationships = analyzer.data["relationships"]

        # Check for expected containment relationships
        assert {
            "source": "src",
            "target": "src/app",
            "type": "contains",
        } in relationships
        assert {
            "source": "src/app",
            "target": "src/app/main.py",
            "type": "contains",
        } in relationships
        assert {
            "source": "src/app",
            "target": "src/app/components",
            "type": "contains",
        } in relationships
        assert {
            "source": "src/app/components",
            "target": "src/app/components/button.js",
            "type": "contains",
        } in relationships

    def test_python_import_relationship(self):
        """Test that Python import relationships are created."""
        analyzer = RepositoryAnalyzer(self.repo_path)
        analyzer.analyze()

        relationships = analyzer.data["relationships"]

        # Check for Python import relationship
        assert {
            "source": "src/app/main.py",
            "target": "src/utils/helper.py",
            "type": "import",
            "strength": 1,
        } in relationships

    def test_javascript_import_relationship(self):
        """Test that JavaScript import relationships are created."""
        analyzer = RepositoryAnalyzer(self.repo_path)
        analyzer.analyze()

        relationships = analyzer.data["relationships"]

        # Check for JS/CSS import relationship
        assert {
            "source": "src/app/components/button.js",
            "target": "src/styles/button.css",
            "type": "import",
            "strength": 1,
        } in relationships

    def test_duplicate_relationship_counting(self):
        """Test counting of duplicate relationships."""
        # Add another import to the same file
        with open(os.path.join(self.repo_path, "src/app/main.py"), "a") as f:
            f.write("from ..utils import helper as h2\n")

        subprocess.run(["git", "add", "."], cwd=self.repo_path, check=True)
        subprocess.run(
            ["git", "commit", "-m", "Add duplicate import"],
            cwd=self.repo_path,
            check=True,
            capture_output=True,
        )

        analyzer = RepositoryAnalyzer(self.repo_path)
        analyzer.analyze()

        relationships = analyzer.data["relationships"]

        import_rel = next(
            r
            for r in relationships
            if r["source"] == "src/app/main.py" and r["target"] == "src/utils/helper.py"
        )
        assert import_rel["strength"] == 2
