const WordPressService = require('../../src/modules/wordpressService');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('WordPressService', () => {
  let wordpressService;
  const testUrl = 'https://example.com';
  const testUsername = 'testuser';
  const testPassword = 'test-app-password';

  beforeEach(() => {
    wordpressService = new WordPressService(testUrl, testUsername, testPassword);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(wordpressService.url).toBe(testUrl);
      expect(wordpressService.auth.username).toBe(testUsername);
      expect(wordpressService.auth.password).toBe(testPassword);
      expect(wordpressService.apiBase).toBe(`${testUrl}/wp-json/wp/v2`);
    });

    test('should remove trailing slash from URL', () => {
      const serviceWithTrailingSlash = new WordPressService('https://example.com/', testUsername, testPassword);
      expect(serviceWithTrailingSlash.url).toBe('https://example.com');
    });
  });

  describe('testAuthentication', () => {
    test('should return authenticated status on success', async () => {
      const userData = require('../fixtures/wordpress-user-me.json');
      axios.get.mockResolvedValue({ data: userData });

      const result = await wordpressService.testAuthentication();
      
      expect(result.authenticated).toBe(true);
      expect(result.user).toEqual(userData);
      expect(axios.get).toHaveBeenCalledWith(
        `${testUrl}/wp-json/wp/v2/users/me`,
        { auth: { username: testUsername, password: testPassword } }
      );
    });

    test('should return error on authentication failure', async () => {
      axios.get.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid username or password' }
        }
      });

      const result = await wordpressService.testAuthentication();
      
      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('Authentication failed');
      expect(result.error).toContain(testUsername);
    });
  });

  describe('checkUserRole', () => {
    test('should return user role information', async () => {
      const userData = require('../fixtures/wordpress-user-me.json');
      axios.get.mockResolvedValue({ data: userData });

      const result = await wordpressService.checkUserRole();
      
      expect(result.authenticated).toBe(true);
      expect(result.username).toBe('testuser');
      expect(result.roles).toContain('author');
      expect(result.canCreatePosts).toBe(true);
      expect(result.hasRequiredRole).toBe(true);
    });

    test('should detect when user cannot create posts', async () => {
      const subscriberUser = {
        ...require('../fixtures/wordpress-user-me.json'),
        roles: ['subscriber'],
        capabilities: { read: true }
      };
      axios.get.mockResolvedValue({ data: subscriberUser });

      const result = await wordpressService.checkUserRole();
      
      expect(result.canCreatePosts).toBe(false);
      expect(result.hasRequiredRole).toBe(false);
    });
  });

  describe('createPost', () => {
    test('should create a new post', async () => {
      const postData = {
        title: 'Test Post',
        content: '<p>Test content</p>'
      };
      const createdPost = require('../fixtures/wordpress-post-created.json');
      axios.post.mockResolvedValue({ data: createdPost });

      const result = await wordpressService.createPost(postData);
      
      expect(result.id).toBe(123);
      expect(result.title).toContain('Node.js best practices');
      expect(result.link).toBe('https://example.com/test-post/');
      expect(result.status).toBe('draft');
      expect(axios.post).toHaveBeenCalledWith(
        `${testUrl}/wp-json/wp/v2/posts`,
        {
          title: postData.title,
          content: postData.content,
          status: 'draft'
        },
        expect.objectContaining({
          auth: { username: testUsername, password: testPassword }
        })
      );
    });

    test('should handle 401 authentication error', async () => {
      const postData = { title: 'Test', content: 'Content' };
      axios.post.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid credentials' }
        }
      });

      await expect(wordpressService.createPost(postData))
        .rejects.toThrow('WordPress authentication failed');
    });

    test('should handle 403 permission error', async () => {
      const postData = { title: 'Test', content: 'Content' };
      axios.post.mockRejectedValue({
        response: {
          status: 403,
          data: { message: 'Forbidden' }
        }
      });

      await expect(wordpressService.createPost(postData))
        .rejects.toThrow('WordPress permission denied');
    });
  });

  describe('updatePost', () => {
    test('should update an existing post', async () => {
      const postData = {
        title: 'Updated Title',
        content: '<p>Updated content</p>'
      };
      const updatedPost = require('../fixtures/wordpress-post-updated.json');
      axios.put.mockResolvedValue({ data: updatedPost });

      const result = await wordpressService.updatePost(123, postData);
      
      expect(result.id).toBe(123);
      expect(result.title).toContain('Updated');
      expect(axios.put).toHaveBeenCalledWith(
        `${testUrl}/wp-json/wp/v2/posts/123`,
        {
          title: postData.title,
          content: postData.content
        },
        expect.objectContaining({
          auth: { username: testUsername, password: testPassword }
        })
      );
    });

    test('should handle update errors', async () => {
      const postData = { title: 'Test', content: 'Content' };
      axios.put.mockRejectedValue({
        response: {
          status: 404,
          data: { message: 'Post not found' }
        }
      });

      await expect(wordpressService.updatePost(999, postData))
        .rejects.toThrow();
    });
  });

  describe('getPost', () => {
    test('should retrieve a post by ID', async () => {
      const postData = require('../fixtures/wordpress-post-created.json');
      axios.get.mockResolvedValue({ data: postData });

      const result = await wordpressService.getPost(123);
      
      expect(result.id).toBe(123);
      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.link).toBeDefined();
      expect(axios.get).toHaveBeenCalledWith(
        `${testUrl}/wp-json/wp/v2/posts/123`,
        expect.objectContaining({
          auth: { username: testUsername, password: testPassword }
        })
      );
    });
  });

  describe('testConnection', () => {
    test('should return success when all checks pass', async () => {
      const userData = require('../fixtures/wordpress-user-me.json');
      axios.get.mockResolvedValue({ data: userData });

      const result = await wordpressService.testConnection();
      
      expect(result.connected).toBe(true);
      expect(result.authenticated).toBe(true);
      expect(result.username).toBe('testuser');
      expect(result.hasRequiredRole).toBe(true);
    });

    test('should return error when authentication fails', async () => {
      axios.get.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid credentials' }
        }
      });

      const result = await wordpressService.testConnection();
      
      expect(result.connected).toBe(false);
      expect(result.authenticated).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should detect insufficient permissions', async () => {
      const subscriberUser = {
        ...require('../fixtures/wordpress-user-me.json'),
        roles: ['subscriber'],
        capabilities: { read: true }
      };
      axios.get.mockResolvedValue({ data: subscriberUser });

      const result = await wordpressService.testConnection();
      
      expect(result.connected).toBe(true);
      expect(result.authenticated).toBe(true);
      expect(result.hasRequiredRole).toBe(false);
    });
  });

  describe('isPermissionError', () => {
    test('should detect permission-related errors', () => {
      expect(wordpressService.isPermissionError('not authorized')).toBe(true);
      expect(wordpressService.isPermissionError('insufficient permissions')).toBe(true);
      expect(wordpressService.isPermissionError('cannot create')).toBe(true);
      expect(wordpressService.isPermissionError('regular error')).toBe(false);
    });
  });

  describe('formatWordPressError', () => {
    test('should format 401 permission errors', () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'You are not authorized to create posts' }
        }
      };

      const formatted = wordpressService.formatWordPressError(error);
      
      expect(formatted.message).toContain('WordPress permission denied');
      expect(formatted.message).toContain('role');
    });

    test('should format 403 errors', () => {
      const error = {
        response: {
          status: 403,
          data: { message: 'Forbidden' }
        }
      };

      const formatted = wordpressService.formatWordPressError(error);
      
      expect(formatted.message).toContain('permission denied');
    });

    test('should format 404 errors', () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'Not found' }
        }
      };

      const formatted = wordpressService.formatWordPressError(error);
      
      expect(formatted.message).toContain('endpoint not found');
    });

    test('should preserve non-HTTP errors', () => {
      const error = new Error('Network error');
      const formatted = wordpressService.formatWordPressError(error);
      expect(formatted).toBe(error);
    });
  });
});
