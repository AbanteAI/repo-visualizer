import React from 'react';
import Controls from '../components/Controls';
import FileUpload from '../components/FileUpload';

// This is just a simple test to verify imports work
describe('Component imports', () => {
  test('Components can be imported', () => {
    expect(Controls).toBeDefined();
    expect(FileUpload).toBeDefined();
  });
});
