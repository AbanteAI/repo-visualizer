# Testing History Visualization

This document explains how to test the history visualization features of the Repo Visualizer.

## Generating Test History Data

To test the history features, you need to generate repository data that includes timeline information:

### Basic History Generation
```bash
# Generate history data for the current repository
python -m repo_visualizer . -o repo_data_with_history.json --history-sample 5 --max-commits 50

# Copy to frontend for testing
cp repo_data_with_history.json frontend/repo_data.json

# Start the development server
cd frontend
npm run dev -- --host 0.0.0.0
```

### CLI Parameters for History

- `--branch <branch>`: Specify which branch to analyze (default: current branch)
- `--history-sample <N>`: Sample every N commits for timeline points (default: 10)
- `--max-commits <N>`: Maximum number of commits to analyze (default: 1000)

### Examples

```bash
# Analyze main branch with detailed history (every commit)
python -m repo_visualizer . --branch main --history-sample 1 --max-commits 20

# Quick test with fewer commits
python -m repo_visualizer . --history-sample 10 --max-commits 50

# Analyze a different branch
python -m repo_visualizer . --branch develop --history-sample 5
```

## What to Expect

When history data is available, the frontend will:

1. **Automatically detect** history data and switch to timeline mode
2. Show a **"History Available" badge** next to the repository name
3. Display **timeline controls** at the bottom with:
   - Play/pause buttons
   - Timeline scrubber to jump to any commit
   - Speed controls (0.1x to 10x)
   - Current commit information
   - File lifecycle indicators (added, removed, renamed files)

## Testing Features

### Timeline Navigation
- **Drag the timeline scrubber** to jump to any commit instantly
- **Use keyboard shortcuts**:
  - Space: Play/pause animation
  - Left/Right arrows: Navigate between commits
  - Home: Jump to first commit
  - End: Jump to last commit

### Animation
- **Click play** to watch the repository evolve over time
- **Adjust speed** using the speed slider
- **Watch nodes appear/disappear** as files are added/removed

### File Changes
- **Green dots** indicate files added in a commit
- **Red dots** indicate files removed in a commit
- **Blue dots** indicate files renamed in a commit

## Performance Notes

- Use `--history-sample` to control the number of timeline points (higher = more detail, slower)
- Use `--max-commits` to limit the total commits analyzed
- Large repositories may take longer to process - start with smaller sample sizes

## Troubleshooting

If you don't see history features:

1. **Check the JSON file** contains a `history` section with `timelinePoints`
2. **Verify timeline points** have `snapshot` data with files and relationships
3. **Check console** for any JavaScript errors
4. **Regenerate data** with different sample parameters if needed

Example of what history data structure looks like:
```json
{
  "metadata": {
    "historyRange": {
      "totalCommits": 50,
      "sampledCommits": 10
    }
  },
  "history": {
    "timelinePoints": [
      {
        "commitId": "abc123...",
        "branch": "main",
        "snapshot": {
          "files": [...],
          "relationships": [...],
          "fileLifecycle": {
            "added": ["file1.py"],
            "removed": [],
            "renamed": []
          }
        }
      }
    ]
  }
}
```
