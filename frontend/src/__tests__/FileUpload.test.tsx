import React from 'react';
import { render, screen } from '@testing-library/react';
import FileUpload from '../components/FileUpload';

jest.mock('../utils/exampleData', () => ({
  exampleData: { metadata: {}, files: [], relationships: [] }
}));

describe('FileUpload Component', () => {
  it('renders upload button', () => {
    render(
      <FileUpload 
        onDataLoaded={() => {}} 
        onLoadExample={() => {}}
      />
    );
    
    expect(screen.getByText(/Upload Repository Data/i)).toBeInTheDocument();
  });
});
