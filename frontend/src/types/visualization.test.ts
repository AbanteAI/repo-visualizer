import { describe, it, expect } from 'vitest';
import { DATA_SOURCES, VISUAL_FEATURES } from './visualization';

describe('Visualization Configuration Arrays', () => {
  describe('DATA_SOURCES', () => {
    it('should be ordered alphabetically by id', () => {
      const ids = DATA_SOURCES.map(ds => ds.id);
      const sortedIds = [...ids].sort();

      expect(ids).toEqual(sortedIds);
    });

    it('should have unique ids', () => {
      const ids = DATA_SOURCES.map(ds => ds.id);
      const uniqueIds = [...new Set(ids)];

      expect(ids).toHaveLength(uniqueIds.length);
    });
  });

  describe('VISUAL_FEATURES', () => {
    it('should be ordered alphabetically by id', () => {
      const ids = VISUAL_FEATURES.map(vf => vf.id);
      const sortedIds = [...ids].sort();

      expect(ids).toEqual(sortedIds);
    });

    it('should have unique ids', () => {
      const ids = VISUAL_FEATURES.map(vf => vf.id);
      const uniqueIds = [...new Set(ids)];

      expect(ids).toHaveLength(uniqueIds.length);
    });
  });
});
