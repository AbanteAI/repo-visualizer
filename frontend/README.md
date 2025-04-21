# Repo Visualizer React Component

This directory contains a modern React/Tailwind implementation of the Repo Visualizer, migrated from the original index.html implementation.

## Features

- Interactive graph visualization using D3.js and React
- File and directory node visualization with appropriate coloring
- Component view of repository structure
- Responsive design with Tailwind CSS
- Reusable component architecture
- TypeScript for type safety

## Getting Started

### Installation

```bash
cd frontend
npm install
npm run dev
```

### Build

```bash
npm run build
```

## Usage

The main component can be imported and used in other React applications:

```jsx
import { RepositoryGraph } from './components/Visualization';
import { exampleData } from './utils/exampleData';

function App() {
  const [data, setData] = useState(exampleData);
  const [selectedFile, setSelectedFile] = useState(null);

  return <RepositoryGraph data={data} onSelectFile={setSelectedFile} selectedFile={selectedFile} />;
}
```

## Project Structure

- `src/components/Visualization/RepositoryGraph.tsx` - The main visualization component
- `src/components/FileUpload.tsx` - Component for uploading repository JSON data
- `src/components/FileDetails.tsx` - Component for displaying file details
- `src/components/Controls.tsx` - UI controls for visualization
- `src/types/schema.ts` - TypeScript definitions for the repository schema
- `src/utils/exampleData.ts` - Example repository data

## Improvements Over the Original Implementation

1. **Component-Based Architecture**: All UI elements are reusable React components
2. **Type Safety**: Full TypeScript support for all components and data
3. **Modern Styling**: Tailwind CSS for responsive design
4. **Better Extensibility**: Graph visualization is encapsulated in its own component
5. **Modern Build System**: Vite for fast development and optimized builds
6. **Better Developer Experience**: Hot reloading, type checking, and more

## Requirements

- Node.js 14+
- npm 7+
