import { exampleData } from '../utils/exampleData';

describe('Example Data', () => {
  test('should have metadata property', () => {
    expect(exampleData).toHaveProperty('metadata');
  });

  test('should have files property', () => {
    expect(exampleData).toHaveProperty('files');
    expect(Array.isArray(exampleData.files)).toBe(true);
  });

  test('should have relationships property', () => {
    expect(exampleData).toHaveProperty('relationships');
    expect(Array.isArray(exampleData.relationships)).toBe(true);
  });
});
