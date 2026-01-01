const SyncService = require('../../src/modules/syncService');

// Mock all the dependencies
jest.mock('../../src/modules/slackService');
jest.mock('../../src/modules/wordpressService');
jest.mock('../../src/modules/stateManager');
jest.mock('../../src/modules/markdownExporter');
jest.mock('../../src/modules/imageDownloader');

const SlackService = require('../../src/modules/slackService');
const WordPressService = require('../../src/modules/wordpressService');
const StateManager = require('../../src/modules/stateManager');
const MarkdownExporter = require('../../src/modules/markdownExporter');
const ImageDownloader = require('../../src/modules/imageDownloader');

describe('SyncService', () => {
  let syncService;
  let mockSlackService;
  let mockWordPressService;
  let mockStateManager;
  let mockMarkdownExporter;
  let mockImageDownloader;

  const testConfig = {
    slackToken: 'xoxb-test-token',
    channelId: 'C1234567890',
    wordpressUrl: 'https://example.com',
    wordpressUsername: 'testuser',
    wordpressPassword: 'test-password',
    stateFile: 'test-state.json',
    markdownOutputDir: './test-data/posts'
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockSlackService = {
      client: { options: { token: 'xoxb-test-token' } },
      validateChannel: jest.fn(),
      getChannelThreads: jest.fn(),
      getThreadReplies: jest.fn(),
      formatThreadAsPost: jest.fn(),
      generateLLMPrompt: jest.fn(),
      resolveUsers: jest.fn(),
      listChannels: jest.fn()
    };

    mockWordPressService = {
      testConnection: jest.fn(),
      createPost: jest.fn(),
      updatePost: jest.fn()
    };

    mockStateManager = {
      init: jest.fn(),
      getPostId: jest.fn(),
      setMapping: jest.fn(),
      getAllMappings: jest.fn(),
      getLLMPrompt: jest.fn(),
      setLLMPrompt: jest.fn(),
      isMapped: jest.fn()
    };

    mockMarkdownExporter = {
      exportThreadsParallel: jest.fn()
    };

    mockImageDownloader = {
      downloadThreadImages: jest.fn()
    };

    // Set up constructor mocks
    SlackService.mockImplementation(() => mockSlackService);
    WordPressService.mockImplementation(() => mockWordPressService);
    StateManager.mockImplementation(() => mockStateManager);
    MarkdownExporter.mockImplementation(() => mockMarkdownExporter);
    ImageDownloader.mockImplementation(() => mockImageDownloader);

    syncService = new SyncService(testConfig);
  });

  describe('constructor', () => {
    test('should initialize all services', () => {
      expect(SlackService).toHaveBeenCalledWith(testConfig.slackToken);
      expect(WordPressService).toHaveBeenCalledWith(
        testConfig.wordpressUrl,
        testConfig.wordpressUsername,
        testConfig.wordpressPassword
      );
      expect(StateManager).toHaveBeenCalledWith(testConfig.stateFile);
      expect(syncService.channelId).toBe(testConfig.channelId);
    });
  });

  describe('init', () => {
    test('should initialize state manager', async () => {
      await syncService.init();
      expect(mockStateManager.init).toHaveBeenCalled();
    });
  });

  describe('getSyncProgress', () => {
    test('should return null when no sync in progress', () => {
      const progress = syncService.getSyncProgress();
      expect(progress).toBeNull();
    });

    test('should return progress when sync is running', () => {
      syncService.syncProgress = {
        status: 'processing',
        message: 'Processing threads...',
        step: 1,
        totalSteps: 10
      };

      const progress = syncService.getSyncProgress();
      expect(progress.status).toBe('processing');
      expect(progress.step).toBe(1);
    });
  });

  describe('getStatus', () => {
    test('should return status with mappings', () => {
      const mockMappings = {
        '1234567890.123456': {
          postId: 123,
          title: 'Test Post',
          lastUpdated: '2024-01-15T10:30:00.000Z'
        }
      };

      mockStateManager.getAllMappings.mockReturnValue(mockMappings);

      const status = syncService.getStatus();
      
      expect(status.totalMappings).toBe(1);
      expect(status.mappings).toHaveLength(1);
      expect(status.mappings[0].threadTs).toBe('1234567890.123456');
      expect(status.mappings[0].postId).toBe(123);
    });

    test('should return zero mappings when none exist', () => {
      mockStateManager.getAllMappings.mockReturnValue({});

      const status = syncService.getStatus();
      
      expect(status.totalMappings).toBe(0);
      expect(status.mappings).toHaveLength(0);
    });
  });

  describe('syncThread', () => {
    test('should create new post for unmapped thread', async () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Test thread', user: 'U1234567890' }
      ];
      const postData = {
        title: 'Test thread',
        content: '<p>Test thread</p>'
      };
      const wpPost = {
        id: 123,
        title: 'Test thread',
        link: 'https://example.com/test-thread/'
      };
      const llmPrompt = 'LLM prompt content';

      mockSlackService.getThreadReplies.mockResolvedValue(messages);
      mockSlackService.formatThreadAsPost.mockReturnValue(postData);
      mockSlackService.generateLLMPrompt.mockReturnValue(llmPrompt);
      mockStateManager.getPostId.mockReturnValue(null);
      mockWordPressService.createPost.mockResolvedValue(wpPost);

      const result = await syncService.syncThread('1234567890.123456');
      
      expect(result.action).toBe('created');
      expect(result.postId).toBe(123);
      expect(result.title).toBe('Test thread');
      expect(mockWordPressService.createPost).toHaveBeenCalledWith(postData);
      expect(mockStateManager.setMapping).toHaveBeenCalledWith(
        '1234567890.123456',
        123,
        'Test thread',
        llmPrompt
      );
    });

    test('should update existing post for mapped thread', async () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Updated thread', user: 'U1234567890' }
      ];
      const postData = {
        title: 'Updated thread',
        content: '<p>Updated thread</p>'
      };
      const wpPost = {
        id: 123,
        title: 'Updated thread',
        link: 'https://example.com/updated-thread/'
      };
      const llmPrompt = 'Updated LLM prompt';

      mockSlackService.getThreadReplies.mockResolvedValue(messages);
      mockSlackService.formatThreadAsPost.mockReturnValue(postData);
      mockSlackService.generateLLMPrompt.mockReturnValue(llmPrompt);
      mockStateManager.getPostId.mockReturnValue(123);
      mockWordPressService.updatePost.mockResolvedValue(wpPost);

      const result = await syncService.syncThread('1234567890.123456');
      
      expect(result.action).toBe('updated');
      expect(result.postId).toBe(123);
      expect(mockWordPressService.updatePost).toHaveBeenCalledWith(123, postData);
      expect(mockStateManager.setMapping).toHaveBeenCalledWith(
        '1234567890.123456',
        123,
        'Updated thread',
        llmPrompt
      );
    });
  });

  describe('testConnections', () => {
    test('should test all connections successfully', async () => {
      mockSlackService.client = { auth: { test: jest.fn().mockResolvedValue({}) } };
      mockSlackService.listChannels.mockResolvedValue([
        { id: 'C1234567890', name: 'general' }
      ]);
      mockSlackService.validateChannel.mockResolvedValue({ valid: true });
      mockWordPressService.testConnection.mockResolvedValue({
        connected: true,
        authenticated: true,
        hasRequiredRole: true,
        username: 'testuser'
      });

      const results = await syncService.testConnections();
      
      expect(results.slack).toBe(true);
      expect(results.slackChannel).toBe(true);
      expect(results.wordpress).toBe(true);
      expect(results.availableChannels).toHaveLength(1);
    });

    test('should handle Slack connection failure', async () => {
      mockSlackService.client = {
        auth: {
          test: jest.fn().mockRejectedValue(new Error('Slack auth failed'))
        }
      };

      const results = await syncService.testConnections();
      
      expect(results.slack).toBe(false);
      expect(results.errors.slack).toBe('Slack auth failed');
    });

    test('should handle WordPress connection failure', async () => {
      mockSlackService.client = { auth: { test: jest.fn().mockResolvedValue({}) } };
      mockSlackService.validateChannel.mockResolvedValue({ valid: true });
      mockSlackService.listChannels.mockResolvedValue([]);
      mockWordPressService.testConnection.mockResolvedValue({
        connected: false,
        authenticated: false,
        error: 'WordPress connection failed'
      });

      const results = await syncService.testConnections();
      
      expect(results.wordpress).toBe(false);
      expect(results.errors.wordpress).toBe('WordPress connection failed');
    });
  });

  describe('getLLMPrompt', () => {
    test('should return cached prompt if available', async () => {
      const cachedPrompt = 'Cached LLM prompt content';
      mockStateManager.getLLMPrompt.mockReturnValue(cachedPrompt);

      const result = await syncService.getLLMPrompt('1234567890.123456');
      
      expect(result.threadTs).toBe('1234567890.123456');
      expect(result.prompt).toBe(cachedPrompt);
      expect(result.cached).toBe(true);
      expect(mockSlackService.getThreadReplies).not.toHaveBeenCalled();
    });

    test('should generate new prompt if not cached', async () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Test message' }
      ];
      const generatedPrompt = 'Generated LLM prompt';

      mockStateManager.getLLMPrompt.mockReturnValue(null);
      mockStateManager.isMapped.mockReturnValue(false);
      mockSlackService.getThreadReplies.mockResolvedValue(messages);
      mockSlackService.generateLLMPrompt.mockReturnValue(generatedPrompt);

      const result = await syncService.getLLMPrompt('1234567890.123456');
      
      expect(result.threadTs).toBe('1234567890.123456');
      expect(result.prompt).toBe(generatedPrompt);
      expect(result.cached).toBe(false);
      expect(mockSlackService.getThreadReplies).toHaveBeenCalledWith(
        testConfig.channelId,
        '1234567890.123456'
      );
    });

    test('should throw error for invalid thread timestamp', async () => {
      await expect(syncService.getLLMPrompt(null))
        .rejects.toThrow('Invalid thread timestamp');
      
      await expect(syncService.getLLMPrompt(''))
        .rejects.toThrow('Invalid thread timestamp');
    });

    test('should cache prompt if thread is mapped', async () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Test message' }
      ];
      const generatedPrompt = 'Generated LLM prompt';

      mockStateManager.getLLMPrompt.mockReturnValue(null);
      mockStateManager.isMapped.mockReturnValue(true);
      mockSlackService.getThreadReplies.mockResolvedValue(messages);
      mockSlackService.generateLLMPrompt.mockReturnValue(generatedPrompt);

      await syncService.getLLMPrompt('1234567890.123456');
      
      expect(mockStateManager.setLLMPrompt).toHaveBeenCalledWith(
        '1234567890.123456',
        generatedPrompt
      );
    });
  });
});
