# Repo Visualizer

Repo Visualizer is an interactive tool for visualizing git repositories as dynamic, interactive graphs. This project aims to provide developers with a new way to understand codebases by representing their structure, relationships, and evolution visually.

## Vision

Our vision is to transform how developers explore and understand codebases by creating an intuitive, visual representation that highlights connections between files, classes, and functions. By "playing" through git history, users can see how a project evolves over time, making it easier to understand architectural decisions and development patterns.

## Features (Planned)

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

- **Exploration Tools**
  - Click nodes to view code content
  - Search and filter capabilities
  - Zoom and pan navigation
  - Configurable visualization parameters

## Architecture

The project consists of two main components:

1. **Repository Analyzer**: A script that processes a local git repository and extracts metadata into a structured JSON file.
2. **Visualization Interface**: A web-based interface that renders the JSON data as an interactive visualization.

This architecture allows for simple local usage while remaining extensible for potential future hosting as a service.

## Getting Started (Coming Soon)

As development progresses, we'll provide detailed instructions for:
- Installing dependencies
- Analyzing repositories
- Launching the visualization interface
- Customizing the display

## Roadmap

See [ROADMAP.md](ROADMAP.md) for details on our development plans and milestone features.

## Contributing

We welcome contributions from the community! As the project evolves, we'll establish more formal contribution guidelines. For now, feel free to:
- Open issues with feature requests or bug reports
- Submit pull requests with improvements
- Share ideas for enhancing the visualization

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.