# Repo Visualizer: AI Agent Guide

This is an internal guide for AI agents working on the Repo Visualizer project. It provides essential context and guidance to help you effectively contribute to this project.

## Project Overview

Repo Visualizer is a tool designed to create interactive, visual representations of git repositories. The goal is to transform complex codebases into intuitive visual graphs where:

- Files are represented as interactive nodes (dots)
- Nodes can be expanded to reveal internal components (classes/functions)
- Connections between nodes represent relationships (imports, function calls)
- Repository evolution can be "played" through git history

## Architecture

The project follows a two-component architecture:

1. **Repository Analyzer**
   - A Python script that processes local git repositories
   - Extracts structure, relationships, and history
   - Outputs standardized JSON data containing repository metadata

2. **Visualization Interface**
   - Web-based interface (HTML/CSS/JavaScript)
   - Renders repository data as an interactive force-directed graph
   - Provides controls for customizing the visualization
   - Allows playback of repository evolution over time

## Development Context

This project starts as a local tool but is designed to be extensible for potential future hosting as a service. The initial architecture prioritizes simplicity while keeping future scalability in mind.

### Technical Considerations

- **Repository Analyzer**: 
  - Should support multiple programming languages
  - Must efficiently parse large repositories
  - Should extract meaningful relationship data beyond simple imports

- **Visualization Interface**:
  - Prioritize performance and responsiveness
  - Use modern web standards for rendering
  - Implement intuitive controls for customization
  - Follow principles of good information visualization

## Contribution Guidelines for AI Agents

When working on this project, consider the following principles:

1. **Maintainability**: Write clean, well-documented code with thorough tests
2. **Extensibility**: Design components to be easily extended with new features
3. **Performance**: Consider optimizations for handling large repositories
4. **User Experience**: Prioritize intuitive interactions and clear visual communication

### Suggested Development Approach

1. Start with minimal functionality to establish the basic pipeline
2. Implement features incrementally, focusing on end-to-end functionality
3. Consider the user perspective when designing visualizations and controls
4. Follow the priorities established in the ROADMAP.md file

## Development Priorities

The current development focus is on establishing the foundational components as outlined in Phase 1 of the roadmap. Specifically:

1. Creating the repository analyzer script that can extract basic metadata
2. Developing a simple visualization interface to render the data
3. Implementing the core interactive features (node selection, basic controls)

Refer to ROADMAP.md for the complete development trajectory.

## How to Start the Server

The setup has been streamlined to a one-step process:

### Quick Start
```bash
# Run the project (this will handle all setup and start the server)
./start_project.sh
```

This script will:
1. Generate repository data for the current repository
2. Copy the data to the frontend directory
3. Start the development server with proper host binding

### Access the Application
- **Local URL**: http://localhost:5173/
- **Network URL**: Will be shown in terminal (e.g., http://172.17.0.3:5173/)
- **Usage**: 
  - Click "Choose File" and select `repo_data.json` to visualize the current repository
  - Or click "Load Example Data" to see a demo visualization

### Manual Steps (if needed)
If you need to run the steps manually:

1. **Generate Repository Data**
   ```bash
   python -m repo_visualizer . -o repo_data.json -v
   ```

2. **Prepare Frontend**
   ```bash
   cp repo_data.json frontend/
   cd frontend
   npm install  # if not already installed
   ```

3. **Start Development Server**
   ```bash
   npm run dev -- --host 0.0.0.0
   ```

### Troubleshooting
- If `npm run dev` fails with "vite: not found", run `npm install` first
- If users can't access the server, ensure `--host 0.0.0.0` is used for external access
- Python's basic HTTP server has MIME type issues with .tsx files - always use Vite for the React app

## Important Implementation Notes

- The JSON format should be designed to be both human-readable and efficient
- Consider visualization performance from the beginning
- Plan for scalability in both the analyzer and visualization components
- Documentation should be thorough and updated alongside code changes
- User experience should be prioritized throughout development
