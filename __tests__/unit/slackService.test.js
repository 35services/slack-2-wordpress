const SlackService = require('../../src/modules/slackService');

// Mock the Slack WebClient
jest.mock('@slack/web-api', () => {
  return {
    WebClient: jest.fn().mockImplementation(() => {
      return {
        auth: {
          test: jest.fn()
        },
        conversations: {
          list: jest.fn(),
          info: jest.fn(),
          history: jest.fn(),
          replies: jest.fn()
        },
        users: {
          info: jest.fn()
        }
      };
    })
  };
});

describe('SlackService', () => {
  let slackService;
  let mockClient;

  beforeEach(() => {
    slackService = new SlackService('xoxb-test-token');
    mockClient = slackService.client;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateChannel', () => {
    test('should return valid result for accessible channel', async () => {
      const channelData = require('../fixtures/slack-channel-info.json');
      mockClient.conversations.info.mockResolvedValue(channelData);

      const result = await slackService.validateChannel('C1234567890');
      
      expect(result.valid).toBe(true);
      expect(result.channel).toEqual(channelData.channel);
      expect(mockClient.conversations.info).toHaveBeenCalledWith({
        channel: 'C1234567890'
      });
    });

    test('should throw error for channel_not_found', async () => {
      mockClient.conversations.info.mockRejectedValue({
        data: { error: 'channel_not_found' }
      });

      await expect(slackService.validateChannel('C0000000000'))
        .rejects.toThrow('Channel not found or bot doesn\'t have access');
    });

    test('should throw error for not_in_channel', async () => {
      mockClient.conversations.info.mockRejectedValue({
        data: { error: 'not_in_channel' }
      });

      await expect(slackService.validateChannel('C1234567890'))
        .rejects.toThrow('Bot is not a member of the channel');
    });
  });

  describe('getChannelThreads', () => {
    test('should return threads from channel', async () => {
      const historyData = require('../fixtures/slack-channel-history.json');
      mockClient.conversations.history.mockResolvedValue(historyData);

      const threads = await slackService.getChannelThreads('C1234567890');
      
      // Only messages with thread_ts === ts are threads
      expect(threads).toHaveLength(2);
      expect(threads[0].thread_ts).toBe(threads[0].ts);
      expect(threads[1].thread_ts).toBe(threads[1].ts);
      expect(mockClient.conversations.history).toHaveBeenCalledWith({
        channel: 'C1234567890',
        limit: 100
      });
    });

    test('should filter out non-thread messages', async () => {
      const historyData = require('../fixtures/slack-channel-history.json');
      mockClient.conversations.history.mockResolvedValue(historyData);

      const threads = await slackService.getChannelThreads('C1234567890');
      
      // Should not include the regular message without thread
      const hasRegularMessage = threads.some(t => t.ts === '1234567894.123460');
      expect(hasRegularMessage).toBe(false);
    });
  });

  describe('getThreadReplies', () => {
    test('should return all messages in thread', async () => {
      const repliesData = require('../fixtures/slack-thread-replies.json');
      mockClient.conversations.replies.mockResolvedValue(repliesData);

      const messages = await slackService.getThreadReplies('C1234567890', '1234567890.123456');
      
      expect(messages).toHaveLength(3);
      expect(messages[0].text).toContain('Node.js best practices');
      expect(mockClient.conversations.replies).toHaveBeenCalledWith({
        channel: 'C1234567890',
        ts: '1234567890.123456',
        include_all_metadata: true
      });
    });
  });

  describe('formatThreadAsPost', () => {
    test('should format messages as post data', () => {
      const messages = [
        { ts: '1234567890.123456', text: 'First message with title' },
        { ts: '1234567890.123457', text: 'Reply message' }
      ];

      const postData = slackService.formatThreadAsPost(messages);
      
      expect(postData.title).toBe('First message with title');
      expect(postData.content).toContain('First message with title');
      expect(postData.content).toContain('Reply message');
      expect(postData.threadTs).toBe('1234567890.123456');
    });

    test('should throw error for empty messages', () => {
      expect(() => slackService.formatThreadAsPost([]))
        .toThrow('No messages to format');
    });
  });

  describe('extractTitle', () => {
    test('should extract first line as title', () => {
      const text = 'This is the title\nThis is more content';
      const title = slackService.extractTitle(text);
      expect(title).toBe('This is the title');
    });

    test('should truncate long titles', () => {
      const longText = 'a'.repeat(150);
      const title = slackService.extractTitle(longText);
      expect(title).toHaveLength(103); // 100 chars + '...'
      expect(title.endsWith('...')).toBe(true);
    });

    test('should handle single line text', () => {
      const text = 'Short title';
      const title = slackService.extractTitle(text);
      expect(title).toBe('Short title');
    });
  });

  describe('formatContent', () => {
    test('should format first message as main content', () => {
      const messages = [
        { text: 'Main content' },
        { text: 'Reply content' }
      ];

      const content = slackService.formatContent(messages);
      
      expect(content).toContain('<p>Main content</p>');
      expect(content).toContain('<div class="thread-reply">');
      expect(content).toContain('<strong>Reply:</strong>');
      expect(content).toContain('Reply content');
    });

    test('should escape HTML in content', () => {
      const messages = [
        { text: '<script>alert("xss")</script>' }
      ];

      const content = slackService.formatContent(messages);
      
      expect(content).not.toContain('<script>');
      expect(content).toContain('&lt;script&gt;');
    });
  });

  describe('escapeHtml', () => {
    test('should escape HTML special characters', () => {
      const text = '<div>&"\'</div>';
      const escaped = slackService.escapeHtml(text);
      
      expect(escaped).toBe('&lt;div&gt;&amp;&quot;&#039;&lt;/div&gt;');
    });

    test('should convert newlines to <br> tags', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const escaped = slackService.escapeHtml(text);
      
      expect(escaped).toContain('<br>');
      expect(escaped.split('<br>')).toHaveLength(3);
    });
  });

  describe('generateLLMPrompt', () => {
    test('should generate prompt from messages', () => {
      const messages = [
        { text: 'Original post content' },
        { text: 'First reply' },
        { text: 'Second reply' }
      ];

      const prompt = slackService.generateLLMPrompt(messages);
      
      expect(prompt).toContain('=== THREAD START ===');
      expect(prompt).toContain('Original Post:');
      expect(prompt).toContain('Original post content');
      expect(prompt).toContain('Reply 1:');
      expect(prompt).toContain('First reply');
      expect(prompt).toContain('Reply 2:');
      expect(prompt).toContain('Second reply');
      expect(prompt).toContain('=== THREAD END ===');
      expect(prompt).toContain('Instructions:');
    });

    test('should throw error for empty messages', () => {
      expect(() => slackService.generateLLMPrompt([]))
        .toThrow('No messages to generate prompt from');
    });
  });

  describe('getUserName', () => {
    test('should return user real name', async () => {
      const userData = require('../fixtures/slack-user-info.json');
      mockClient.users.info.mockResolvedValue(userData);

      const userName = await slackService.getUserName('U1234567890');
      
      expect(userName).toBe('John Doe');
      expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U1234567890' });
    });

    test('should cache user names', async () => {
      const userData = require('../fixtures/slack-user-info.json');
      mockClient.users.info.mockResolvedValue(userData);

      // First call
      await slackService.getUserName('U1234567890');
      // Second call should use cache
      const userName = await slackService.getUserName('U1234567890');
      
      expect(userName).toBe('John Doe');
      // Should only call API once
      expect(mockClient.users.info).toHaveBeenCalledTimes(1);
    });

    test('should return user ID on error', async () => {
      mockClient.users.info.mockRejectedValue(new Error('User not found'));

      const userName = await slackService.getUserName('U9999999999');
      
      expect(userName).toBe('U9999999999');
    });

    test('should return "Unknown" for null user ID', async () => {
      const userName = await slackService.getUserName(null);
      expect(userName).toBe('Unknown');
    });
  });

  describe('resolveUsers', () => {
    test('should resolve multiple users in parallel', async () => {
      const userData = require('../fixtures/slack-user-info.json');
      mockClient.users.info.mockResolvedValue(userData);

      const userIds = ['U1234567890', 'U0987654321'];
      const userMap = await slackService.resolveUsers(userIds);
      
      expect(userMap.size).toBe(2);
      expect(userMap.has('U1234567890')).toBe(true);
      expect(userMap.has('U0987654321')).toBe(true);
    });

    test('should handle duplicate user IDs', async () => {
      const userData = require('../fixtures/slack-user-info.json');
      mockClient.users.info.mockResolvedValue(userData);

      const userIds = ['U1234567890', 'U1234567890', 'U1234567890'];
      const userMap = await slackService.resolveUsers(userIds);
      
      // Should only resolve unique IDs
      expect(userMap.size).toBe(1);
      // Should only call API once for duplicate IDs
      expect(mockClient.users.info).toHaveBeenCalledTimes(1);
    });

    test('should filter out null/undefined user IDs', async () => {
      const userData = require('../fixtures/slack-user-info.json');
      mockClient.users.info.mockResolvedValue(userData);

      const userIds = ['U1234567890', null, undefined, ''];
      const userMap = await slackService.resolveUsers(userIds);
      
      expect(userMap.size).toBe(1);
      expect(mockClient.users.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('listChannels', () => {
    test('should return list of channels', async () => {
      const channelsData = require('../fixtures/slack-channels-list.json');
      mockClient.conversations.list.mockResolvedValue(channelsData);

      const channels = await slackService.listChannels();
      
      expect(channels).toHaveLength(3);
      expect(channels[0].id).toBe('C1234567890');
      expect(channels[0].name).toBe('general');
      expect(mockClient.conversations.list).toHaveBeenCalledWith({
        types: 'public_channel,private_channel',
        exclude_archived: true
      });
    });
  });
});
