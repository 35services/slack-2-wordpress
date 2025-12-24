const StateManager = require('../../src/modules/stateManager');
const fs = require('fs').promises;
const path = require('path');

describe('StateManager', () => {
  let stateManager;
  let testStateFile;

  beforeEach(() => {
    // Use a temporary test file
    testStateFile = path.join(__dirname, '../fixtures', `test-state-${Date.now()}.json`);
    stateManager = new StateManager(testStateFile);
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testStateFile);
    } catch (error) {
      // File might not exist, ignore
    }
  });

  describe('init', () => {
    test('should initialize with empty state when file does not exist', async () => {
      await stateManager.init();
      const mappings = stateManager.getAllMappings();
      expect(mappings).toEqual({});
    });

    test('should load existing state from file', async () => {
      // Create a state file with test data
      const testData = {
        mappings: {
          '1234567890.123456': {
            postId: 123,
            title: 'Test Post',
            lastUpdated: '2024-01-15T10:30:00.000Z'
          }
        }
      };
      await fs.writeFile(testStateFile, JSON.stringify(testData), 'utf8');

      await stateManager.init();
      const mappings = stateManager.getAllMappings();
      expect(mappings).toEqual(testData.mappings);
    });
  });

  describe('setMapping', () => {
    test('should create a new mapping', async () => {
      await stateManager.init();
      
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post');
      
      const postId = stateManager.getPostId('1234567890.123456');
      expect(postId).toBe(123);
    });

    test('should update an existing mapping', async () => {
      await stateManager.init();
      
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post');
      await stateManager.setMapping('1234567890.123456', 456, 'Updated Post');
      
      const postId = stateManager.getPostId('1234567890.123456');
      expect(postId).toBe(456);
    });

    test('should save mapping with LLM prompt', async () => {
      await stateManager.init();
      
      const llmPrompt = 'Test LLM prompt';
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post', llmPrompt);
      
      const savedPrompt = stateManager.getLLMPrompt('1234567890.123456');
      expect(savedPrompt).toBe(llmPrompt);
    });

    test('should persist mapping to file', async () => {
      await stateManager.init();
      
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post');
      
      // Read the file directly
      const fileContent = await fs.readFile(testStateFile, 'utf8');
      const savedState = JSON.parse(fileContent);
      
      expect(savedState.mappings['1234567890.123456'].postId).toBe(123);
      expect(savedState.mappings['1234567890.123456'].title).toBe('Test Post');
    });
  });

  describe('getPostId', () => {
    test('should return post ID for existing mapping', async () => {
      await stateManager.init();
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post');
      
      const postId = stateManager.getPostId('1234567890.123456');
      expect(postId).toBe(123);
    });

    test('should return null for non-existent mapping', async () => {
      await stateManager.init();
      
      const postId = stateManager.getPostId('9999999999.999999');
      expect(postId).toBeNull();
    });
  });

  describe('isMapped', () => {
    test('should return true for existing mapping', async () => {
      await stateManager.init();
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post');
      
      const isMapped = stateManager.isMapped('1234567890.123456');
      expect(isMapped).toBe(true);
    });

    test('should return false for non-existent mapping', async () => {
      await stateManager.init();
      
      const isMapped = stateManager.isMapped('9999999999.999999');
      expect(isMapped).toBe(false);
    });
  });

  describe('getLLMPrompt', () => {
    test('should return LLM prompt for existing mapping', async () => {
      await stateManager.init();
      const llmPrompt = 'Test LLM prompt';
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post', llmPrompt);
      
      const savedPrompt = stateManager.getLLMPrompt('1234567890.123456');
      expect(savedPrompt).toBe(llmPrompt);
    });

    test('should return null for mapping without prompt', async () => {
      await stateManager.init();
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post');
      
      const savedPrompt = stateManager.getLLMPrompt('1234567890.123456');
      expect(savedPrompt).toBeNull();
    });

    test('should return null for non-existent mapping', async () => {
      await stateManager.init();
      
      const savedPrompt = stateManager.getLLMPrompt('9999999999.999999');
      expect(savedPrompt).toBeNull();
    });
  });

  describe('setLLMPrompt', () => {
    test('should set LLM prompt for existing mapping', async () => {
      await stateManager.init();
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post');
      
      const llmPrompt = 'New LLM prompt';
      const result = await stateManager.setLLMPrompt('1234567890.123456', llmPrompt);
      
      expect(result).toBe(true);
      expect(stateManager.getLLMPrompt('1234567890.123456')).toBe(llmPrompt);
    });

    test('should return false for non-existent mapping', async () => {
      await stateManager.init();
      
      const result = await stateManager.setLLMPrompt('9999999999.999999', 'Test prompt');
      expect(result).toBe(false);
    });
  });

  describe('getAllMappings', () => {
    test('should return all mappings', async () => {
      await stateManager.init();
      await stateManager.setMapping('1111111111.111111', 111, 'Post 1');
      await stateManager.setMapping('2222222222.222222', 222, 'Post 2');
      
      const mappings = stateManager.getAllMappings();
      expect(Object.keys(mappings)).toHaveLength(2);
      expect(mappings['1111111111.111111'].postId).toBe(111);
      expect(mappings['2222222222.222222'].postId).toBe(222);
    });

    test('should return empty object when no mappings exist', async () => {
      await stateManager.init();
      
      const mappings = stateManager.getAllMappings();
      expect(mappings).toEqual({});
    });
  });

  describe('removeMapping', () => {
    test('should remove existing mapping', async () => {
      await stateManager.init();
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post');
      
      await stateManager.removeMapping('1234567890.123456');
      
      const isMapped = stateManager.isMapped('1234567890.123456');
      expect(isMapped).toBe(false);
    });

    test('should persist removal to file', async () => {
      await stateManager.init();
      await stateManager.setMapping('1234567890.123456', 123, 'Test Post');
      await stateManager.removeMapping('1234567890.123456');
      
      // Read the file directly
      const fileContent = await fs.readFile(testStateFile, 'utf8');
      const savedState = JSON.parse(fileContent);
      
      expect(savedState.mappings['1234567890.123456']).toBeUndefined();
    });
  });
});
