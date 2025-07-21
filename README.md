# Repo Visualizer

Repo Visualizer is an interactive tool for visualizing git repositories as dynamic, interactive graphs. This project aims to provide developers with a new way to understand codebases by representing their structure, relationships, and evolution visually.

## Vision

Our vision is to transform how developers explore and understand codebases by creating an intuitive, visual representation that highlights connections between files, classes, and functions. By "playing" through git history, users can see how a project evolves over time, making it easier to understand architectural decisions and development patterns.

## Features

### Repository Analyzer (Available Now)

- **Comprehensive Repository Analysis**
  - Extracts file structure, metadata, and relationships
  - Detects imports and references between files
  - Analyzes components within files (classes, functions, methods)
  - Extracts git history for time-based visualization
  - Calculates language statistics

- **Standardized Output Format**
  - Generates structured JSON according to the [schema](docs/SCHEMA.md)
  - Designed for visualization consumption
  - Human-readable and processable format

### Visualization Interface (Coming Soon)

- **Interactive Visualization**
  - Files represented as interactive nodes (dots)
  - Ability to expand nodes to show internal components (classes, functions)
  - Lines connecting files that reference each other
  - Playback of repository evolution over time through git history

- **Dynamic Attributes**
  - Node size indicating file/class/function size (configurable)
  - Color representing directory depth or other attributes
  - Force-directed layout with "tension" between related components
  - Customizable visualizations through intuitive UI controls

## Architecture

The project consists of two main components:

1. **Repository Analyzer**: A script that processes a local git repository and extracts metadata into a structured JSON file.
2. **Visualization Interface**: A web-based interface that renders the JSON data as an interactive visualization.

This architecture allows for simple local usage while remaining extensible for potential future hosting as a service.

## Getting Started

### Installation

You can install Repo Visualizer using pip:

```bash
pip install repo-visualizer
```

Or directly from the repository:

```bash
git clone https://github.com/AbanteAI/repo-visualizer.git
cd repo-visualizer
pip install -e .
```

### Usage

#### Command Line Interface

Once installed, you can use the Repo Visualizer CLI to analyze a repository:

```bash
# Analyze the current directory
repo-visualizer

# Analyze a specific repository
repo-visualizer /path/to/repository

# Specify an output file
repo-visualizer /path/to/repository -o output.json

# Enable verbose output
repo-visualizer -v
```

#### Python API

You can also use Repo Visualizer as a Python library:

```python
from repo_visualizer import RepositoryAnalyzer

# Analyze a repository
analyzer = RepositoryAnalyzer("/path/to/repository")
data = analyzer.analyze()
analyzer.save_to_file("output.json")

# With history options
analyzer = RepositoryAnalyzer("/path/to/repository", branch="main", history_sample=5, max_commits=100)
data = analyzer.analyze()
analyzer.save_to_file("output_with_history.json")
```

#### Output

The analyzer generates a JSON file that follows the [schema](docs/SCHEMA.md). This file can be used for visualization or analysis.

The JSON includes:
- Repository metadata (name, description, language stats)
- File structure and metrics
- Component details (classes, functions, methods)
- Relationships between files and components
- Git history data

### Starting the Visualization Server

To run the complete visualization interface locally:

**Prerequisites:**
- Python 3.8+ 
- Node.js and npm

**Quick start:**
```bash
# One-step startup - runs the analyzer and starts the visualization server
./start_project.sh
```

This will:
1. Install the Python package if needed
2. Generate repository data for the current repository
3. Install frontend dependencies if needed
4. Start the development server with proper host binding

**Access the application at:**
- Local: http://localhost:5173/
- Network: (URL shown in terminal output)

**Usage:**
- Click "Choose File" and select `repo_data.json` to visualize the current repository
- Or click "Load Example Data" to see a demo visualization

**Note:** For full development setup, you can still run `.mentat/setup.sh` which sets up virtual environments and installs all dependencies.

## Development

To set up a development environment:

```bash
git clone https://github.com/AbanteAI/repo-visualizer.git
cd repo-visualizer
bash .mentat/setup.sh  # Sets up a virtual environment and installs dependencies
```

### Running Tests

```bash
pytest
```

### Running Checks

```bash
ruff check .        # Run linting
ruff format .       # Run formatting
pyright             # Run type checking
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for details on our development plans and milestone features.

## Contributing

We welcome contributions from the community! As the project evolves, we'll establish more formal contribution guidelines. For now, feel free to:
- Open issues with feature requests or bug reports
- Submit pull requests with improvements
- Share ideas for enhancing the visualization

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.