# Testing Guide

This document describes the testing infrastructure for the Slack-2-WordPress integration.

## Overview

The project uses **Jest** as the testing framework, with comprehensive unit tests and sample data fixtures for testing without requiring live Slack or WordPress connections.

## Quick Start

```bash
# Install dependencies (includes Jest)
npm install

# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
__tests__/
├── fixtures/              # Sample data for testing
│   ├── slack-*.json      # Mock Slack API responses
│   └── wordpress-*.json  # Mock WordPress API responses
└── unit/                 # Unit tests
    ├── slackService.test.js
    ├── wordpressService.test.js
    ├── stateManager.test.js
    └── markdownExporter.test.js
```

## Sample Data (Fixtures)

The project includes sample data fixtures that simulate real Slack and WordPress API responses. This allows you to:

- Run tests without live API credentials
- Test edge cases and error scenarios
- Develop and test offline
- Ensure consistent test results

### Slack Fixtures

Located in `__tests__/fixtures/`:

- `slack-auth-test.json` - Slack authentication response
- `slack-channel-info.json` - Channel information
- `slack-channel-history.json` - Channel message history with threads
- `slack-thread-replies.json` - Thread replies/messages
- `slack-user-info.json` - User profile information
- `slack-channels-list.json` - List of available channels

### WordPress Fixtures

Located in `__tests__/fixtures/`:

- `wordpress-user-me.json` - Current user information
- `wordpress-post-created.json` - Response when creating a post
- `wordpress-post-updated.json` - Response when updating a post

## Writing Tests

### Example: Testing a Module

```javascript
const SlackService = require('../../src/modules/slackService');

describe('SlackService', () => {
  let slackService;

  beforeEach(() => {
    slackService = new SlackService('test-token');
  });

  test('should extract title from message', () => {
    const text = 'Title here\nMore content';
    const title = slackService.extractTitle(text);
    expect(title).toBe('Title here');
  });
});
```

### Using Fixtures

```javascript
const mockData = require('../fixtures/slack-thread-replies.json');

test('should parse thread replies', () => {
  // Use mockData in your test
  expect(mockData.messages).toHaveLength(3);
});
```

## Test Coverage

The project maintains test coverage to ensure code quality:

Current coverage (as of last run):

| Module | Line Coverage | Function Coverage |
|--------|---------------|-------------------|
| MarkdownExporter | ~96% | 100% |
| SlackService | ~81% | ~95% |
| StateManager | ~82% | 100% |
| WordPressService | ~81% | 100% |
| SyncService | ~34% | ~32% |
| ImageDownloader | ~29% | ~45% |

**Overall Coverage:** ~56% statements, ~44% branches, ~71% functions, ~57% lines

**Note:** SyncService and ImageDownloader have lower coverage due to complex async workflows and network operations that are difficult to test in unit tests. These are better suited for integration tests.

Run `npm run test:coverage` to see detailed coverage reports in the `coverage/` directory.

## Mocking External Dependencies

Tests use Jest's mocking capabilities to avoid real API calls:

### Mocking Slack API

```javascript
jest.mock('@slack/web-api', () => {
  return {
    WebClient: jest.fn().mockImplementation(() => ({
      auth: { test: jest.fn() },
      conversations: {
        list: jest.fn(),
        info: jest.fn(),
        // ... other methods
      }
    }))
  };
});
```

### Mocking WordPress API (Axios)

```javascript
jest.mock('axios');

// In your test
const axios = require('axios');
axios.get.mockResolvedValue({ data: mockData });
```

## Continuous Integration

Tests should be run:
- Before committing changes
- In CI/CD pipelines
- Before deploying to production

## Adding New Tests

When adding new functionality:

1. **Create fixture data** in `__tests__/fixtures/` if needed
2. **Write unit tests** in `__tests__/unit/`
3. **Run tests** with `npm test`
4. **Check coverage** with `npm run test:coverage`
5. **Commit tests** along with your code changes

## Troubleshooting

### Tests Failing

1. Check that all dependencies are installed: `npm install`
2. Ensure Node.js version is v14 or higher: `node --version`
3. Clear Jest cache: `npx jest --clearCache`
4. Check for console errors in test output

### Coverage Not Meeting Thresholds

If coverage is below 70%:
- Add more test cases for uncovered branches
- Test error scenarios and edge cases
- Check `coverage/lcov-report/index.html` for detailed coverage info

### Mock Not Working

- Ensure mocks are defined before importing the module under test
- Use `jest.clearAllMocks()` in `afterEach()` to reset mocks between tests
- Check Jest documentation for mock syntax

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Use descriptive test names** - Test names should describe the scenario
3. **Keep tests isolated** - Each test should be independent
4. **Use fixtures for consistent data** - Avoid hardcoding test data in tests
5. **Test error cases** - Don't just test the happy path
6. **Keep tests simple** - Complex tests are hard to maintain

## Running Specific Tests

```bash
# Run a specific test file
npm test -- stateManager.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="should create"

# Run tests for a specific module
npm test -- slackService
```

## Test Output

Jest provides clear output showing:
- ✓ Passed tests (green)
- ✗ Failed tests (red)
- Coverage percentages
- Execution time

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Jest Matchers](https://jestjs.io/docs/expect)
- [Jest Mock Functions](https://jestjs.io/docs/mock-functions)

## Future Improvements

Potential testing enhancements:
- Integration tests for full sync workflow
- End-to-end tests with test Slack workspace
- Performance tests for large thread volumes
- Snapshot tests for markdown output
- Visual regression tests for UI components
