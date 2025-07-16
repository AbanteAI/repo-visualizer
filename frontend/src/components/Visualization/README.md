# RepositoryGraph Component Tests

This document describes the comprehensive test suite for the RepositoryGraph component.

## Test Structure

The test suite is organized into several focused test files:

### 1. `RepositoryGraph.simple.test.tsx`
Basic integration tests that verify the component renders correctly with different props and data:
- Basic rendering without errors
- SVG element creation
- Container CSS classes
- Prop changes handling
- Data variations (simple, empty)
- Component lifecycle (mount/unmount)

### 2. `RepositoryGraph.helpers.test.tsx`
Unit tests for helper functions used within the component:
- `getNodeRadius()` - Tests node size calculation based on type and file size
- `getLinkWidth()` - Tests link width calculation based on type and weight
- `getLinkColor()` - Tests color assignment for different relationship types
- `getNodeColor()` - Tests node color assignment based on file extension and type

## Test Coverage

Current test coverage for `RepositoryGraph.tsx`:
- **Statements**: 64.12%
- **Branches**: 65.85%
- **Functions**: 37.5%
- **Lines**: 64.12%

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run tests in watch mode
npm run test:watch
```

## Test Environment

The tests use the following setup:
- **Framework**: Vitest
- **Testing Library**: @testing-library/react
- **Environment**: jsdom
- **Mocking**: D3.js is mocked to avoid complex DOM manipulation in tests

## D3.js Mocking Strategy

Due to the complexity of D3.js interactions, the tests use a simplified mocking approach:
- D3 methods are mocked to return chainable objects
- Focus is on testing component behavior rather than D3 internals
- Helper functions are tested separately for business logic

## Test Data

Mock data is provided in `../../test/mockData.ts` with:
- `mockRepositoryData` - Complete repository data with files, components, and relationships
- `emptyRepositoryData` - Empty repository for edge case testing
- `largeRepositoryData` - Large dataset for performance testing

## Key Test Scenarios

### Component Rendering
- ✅ Renders without crashing
- ✅ Creates SVG element correctly
- ✅ Applies proper CSS classes
- ✅ Handles empty data gracefully

### Props and State
- ✅ Handles weight changes (reference, filesystem, semantic)
- ✅ Handles file selection changes
- ✅ Handles data updates
- ✅ Maintains component state during re-renders

### Helper Functions
- ✅ Node radius calculation for different file types and sizes
- ✅ Link width calculation based on relationship type and weight
- ✅ Color assignment for nodes and links
- ✅ Edge cases (missing data, extreme values)

### Component Lifecycle
- ✅ Proper mount/unmount behavior
- ✅ Cleanup on component destruction
- ✅ Multiple re-renders without issues

## Future Test Improvements

1. **Increase Function Coverage**: Add tests for more internal functions
2. **Interactive Features**: Test zoom, pan, and click behaviors
3. **Performance**: Add performance benchmarks for large datasets
4. **Accessibility**: Add tests for screen reader compatibility
5. **Error Boundaries**: Test error handling and recovery

## Test Philosophy

The test suite follows these principles:
1. **Reliability**: Tests should pass consistently
2. **Maintainability**: Simple, focused tests that are easy to understand
3. **Coverage**: Test important business logic and edge cases
4. **Performance**: Tests should run quickly
5. **Isolation**: Tests should not depend on each other

## Troubleshooting

### Common Issues

1. **D3 Mocking Errors**: Ensure all D3 methods used in the component are mocked
2. **DOM Dimensions**: Mock `clientWidth` and `clientHeight` properties
3. **SVG Elements**: Use `document.querySelector('svg')` instead of `getByRole`
4. **Async Operations**: Use `waitFor` for asynchronous updates

### Adding New Tests

When adding new tests:
1. Follow the existing naming convention
2. Use descriptive test names
3. Test both success and failure cases
4. Mock external dependencies properly
5. Update this README with new test categories

## Integration with CI/CD

The test suite is configured to run in CI/CD pipelines:
- Tests must pass before merging PRs
- Coverage reports are generated automatically
- Performance regressions are detected
- Cross-browser testing is supported
