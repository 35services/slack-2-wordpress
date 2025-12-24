# Test Fixtures

This directory contains sample data fixtures used for unit testing the Slack-2-WordPress integration.

## Purpose

These fixtures allow you to:
- Run tests without requiring live Slack or WordPress credentials
- Test consistently with known data
- Develop and debug offline
- Test edge cases and error scenarios

## Fixture Files

### Slack API Responses

These files simulate responses from the Slack Web API:

- **`slack-auth-test.json`** - Response from `auth.test` endpoint
  - Used to verify Slack authentication
  - Contains workspace and bot information

- **`slack-channel-info.json`** - Response from `conversations.info` endpoint
  - Contains detailed channel information
  - Used to validate channel access

- **`slack-channel-history.json`** - Response from `conversations.history` endpoint
  - Contains channel messages with thread information
  - Includes both threaded and non-threaded messages

- **`slack-thread-replies.json`** - Response from `conversations.replies` endpoint
  - Contains all messages in a thread
  - Includes original post and replies

- **`slack-user-info.json`** - Response from `users.info` endpoint
  - Contains user profile information
  - Used for resolving user IDs to real names

- **`slack-channels-list.json`** - Response from `conversations.list` endpoint
  - Lists available channels
  - Includes public and private channels

### WordPress API Responses

These files simulate responses from the WordPress REST API:

- **`wordpress-user-me.json`** - Response from `/wp/v2/users/me` endpoint
  - Current user information
  - Includes roles and capabilities

- **`wordpress-post-created.json`** - Response from POST `/wp/v2/posts` endpoint
  - Response when creating a new post
  - Includes post ID, title, content, and link

- **`wordpress-post-updated.json`** - Response from PUT `/wp/v2/posts/{id}` endpoint
  - Response when updating an existing post
  - Shows modified date and updated content

## Using Fixtures in Tests

```javascript
// Load a fixture
const mockData = require('../fixtures/slack-thread-replies.json');

// Use in test
test('should process thread replies', () => {
  expect(mockData.messages).toHaveLength(3);
  expect(mockData.ok).toBe(true);
});
```

## Modifying Fixtures

When modifying fixtures:
1. Keep the structure consistent with real API responses
2. Use realistic but fictional data (no real user info)
3. Update relevant tests if structure changes
4. Document any significant changes

## Adding New Fixtures

To add new fixtures:
1. Capture a real API response (with sensitive data removed)
2. Save as a `.json` file with a descriptive name
3. Add documentation here
4. Create tests that use the fixture

## Data Format

All fixtures use the actual JSON format returned by their respective APIs:
- Slack API responses include an `ok: true` field and the main data
- WordPress API responses are the JSON objects directly

## Security Note

These fixtures contain **no real credentials or sensitive data**. All tokens, IDs, names, and URLs are fictional examples for testing purposes only.
