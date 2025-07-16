import '@testing-library/jest-dom';

// Mock d3 transition behavior for testing
global.d3 = {
  ...global.d3,
  transition: () => ({
    duration: () => ({
      call: (fn: any, ...args: any[]) => fn(...args),
    }),
  }),
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock SVG methods that may not be available in jsdom
Object.defineProperty(SVGElement.prototype, 'getBBox', {
  value: () => ({ x: 0, y: 0, width: 100, height: 100 }),
});

Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
  value: () => 100,
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
