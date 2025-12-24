const axios = require('axios');

/**
 * WordPress REST API Service
 * 
 * IMPORTANT: When adding or modifying WordPress API endpoints in this file,
 * please also update the Postman collection: WordPress_API.postman_collection.json
 * 
 * The Postman collection should mirror all API calls made by this service to ensure
 * developers can test WordPress API interactions independently.
 */
class WordPressService {
  constructor(url, username, password) {
    this.url = url.replace(/\/$/, ''); // Remove trailing slash
    this.auth = {
      username,
      password
    };
    this.apiBase = `${this.url}/wp-json/wp/v2`;
    
    // Log auth setup for debugging (without exposing password)
    console.log(`WordPress service initialized for: ${this.url}`);
    console.log(`Username: ${username}`);
    console.log(`Password length: ${password ? password.length : 0} characters`);
    console.log(`Application password format: ${password && password.includes(' ') ? 'Yes (has spaces)' : 'No (might be wrong format)'}`);
  }

  /**
   * Check if error message indicates a role/permission issue
   * @param {string} message - Error message
   * @returns {boolean} True if it's a permission issue
   */
  isPermissionError(message) {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    const permissionKeywords = [
      'not authorized',
      'not berechtigt',
      'nicht berechtigt',
      'permission',
      'role',
      'capability',
      'cannot create',
      'cannot edit',
      'insufficient permissions'
    ];
    return permissionKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Format WordPress API errors into user-friendly messages
   * @param {Error} error - The error object
   * @param {string} operation - The operation being performed
   * @returns {Error} Formatted error
   */
  formatWordPressError(error, operation = 'operation') {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const errorMessage = data?.message || error.message || '';
      
      // Check if it's actually a permission issue (WordPress sometimes returns 401 for permissions)
      const isPermissionIssue = this.isPermissionError(errorMessage);
      
      if (status === 401 && isPermissionIssue) {
        return new Error(
          `WordPress permission denied (401). ` +
          `Your user role doesn't have permission to create/edit posts.\n\n` +
          `Required roles: Administrator, Editor, or Author\n` +
          `Current role appears to be insufficient.\n\n` +
          `To fix this:\n` +
          `1. Go to WordPress Admin → Users → All Users\n` +
          `2. Edit your user account\n` +
          `3. Change the role to "Author", "Editor", or "Administrator"\n` +
          `4. Save changes and try again\n\n` +
          `Error details: ${errorMessage}`
        );
      } else if (status === 401) {
        return new Error(
          `WordPress authentication failed (401). ` +
          `Please verify:\n` +
          `1. Your WordPress username is correct\n` +
          `2. Your application password is correct (not your regular password)\n` +
          `3. The application password hasn't been revoked\n` +
          `4. Your WordPress user has permission to create/edit posts\n` +
          `Error details: ${errorMessage}`
        );
      } else if (status === 403) {
        return new Error(
          `WordPress permission denied (403). ` +
          `Your user doesn't have permission to ${operation}. ` +
          `Please check your WordPress user role and permissions. ` +
          `Required roles: Administrator, Editor, or Author`
        );
      } else if (status === 404) {
        return new Error(
          `WordPress endpoint not found (404). ` +
          `Please verify your WordPress URL is correct: ${this.url}`
        );
      } else {
        return new Error(
          `WordPress API error (${status}): ${errorMessage}`
        );
      }
    }
    return error;
  }

  /**
   * Test authentication first - verify we can actually log in
   * @returns {Promise<Object>} Authentication status
   */
  async testAuthentication() {
    try {
      // Try to get current user info - this will fail if auth is wrong
      const response = await axios.get(`${this.apiBase}/users/me`, {
        auth: this.auth
      });
      
      return {
        authenticated: true,
        user: response.data
      };
    } catch (error) {
      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.message || error.message;
        
        // Check if it's actually an authentication failure (wrong credentials)
        if (errorMessage.includes('Invalid') || 
            errorMessage.includes('authentication') || 
            errorMessage.includes('credentials') ||
            !errorMessage.includes('berechtigt') && !errorMessage.includes('permission')) {
          return {
            authenticated: false,
            error: 'Authentication failed. Please check:\n' +
                   `1. Username: "${this.auth.username}" is correct\n` +
                   '2. Application password is correct (not your regular password)\n' +
                   '3. Application password hasn\'t been revoked\n' +
                   `4. WordPress URL: ${this.url} is correct\n` +
                   `Error: ${errorMessage}`
          };
        }
      }
      
      // If it's not a clear auth failure, return the error
      throw error;
    }
  }

  /**
   * Check WordPress user role and permissions
   * @returns {Promise<Object>} User info including role and capabilities
   */
  async checkUserRole() {
    try {
      // First verify authentication
      const authTest = await this.testAuthentication();
      if (!authTest.authenticated) {
        throw new Error(authTest.error);
      }
      
      const user = authTest.user;
      const roles = user.roles || [];
      const capabilities = user.capabilities || {};
      
      // Check if user can create posts
      const canCreatePosts = capabilities.publish_posts || 
                            capabilities.edit_posts || 
                            roles.includes('administrator') ||
                            roles.includes('editor') ||
                            roles.includes('author');
      
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        roles: roles,
        capabilities: Object.keys(capabilities),
        canCreatePosts: canCreatePosts,
        hasRequiredRole: canCreatePosts,
        authenticated: true
      };
    } catch (error) {
      // If we can't get user info, it might be an auth issue
      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.message || error.message;
        
        // Check if it's an authentication failure vs permission issue
        if (errorMessage.includes('Invalid') || 
            errorMessage.includes('authentication') ||
            errorMessage.includes('credentials')) {
          throw new Error(
            `WordPress authentication failed. Please verify:\n` +
            `1. Username: "${this.auth.username}" is correct\n` +
            `2. Application password is correct (not your regular password)\n` +
            `3. Application password hasn't been revoked\n` +
            `4. WordPress URL: ${this.url} is correct\n` +
            `Error: ${errorMessage}`
          );
        }
      }
      
      // If test post creation fails, it's a permission issue
      throw this.formatWordPressError(error, 'check user role');
    }
  }

  /**
   * Create a new WordPress post
   * @param {Object} postData - Post data with title and content
   * @returns {Promise<Object>} Created post data
   */
  async createPost(postData) {
    try {
      const response = await axios.post(
        `${this.apiBase}/posts`,
        {
          title: postData.title,
          content: postData.content,
          status: 'draft' // Create as draft by default
        },
        {
          auth: this.auth,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        id: response.data.id,
        title: response.data.title.rendered,
        link: response.data.link,
        status: response.data.status
      };
    } catch (error) {
      console.error('Error creating WordPress post:', error.response?.data || error.message);
      throw this.formatWordPressError(error, 'create posts');
    }
  }

  /**
   * Update an existing WordPress post
   * @param {number} postId - WordPress post ID
   * @param {Object} postData - Post data with title and content
   * @returns {Promise<Object>} Updated post data
   */
  async updatePost(postId, postData) {
    try {
      const response = await axios.put(
        `${this.apiBase}/posts/${postId}`,
        {
          title: postData.title,
          content: postData.content
        },
        {
          auth: this.auth,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        id: response.data.id,
        title: response.data.title.rendered,
        link: response.data.link,
        status: response.data.status
      };
    } catch (error) {
      console.error('Error updating WordPress post:', error.response?.data || error.message);
      throw this.formatWordPressError(error, 'update posts');
    }
  }

  /**
   * Get a WordPress post by ID
   * @param {number} postId - WordPress post ID
   * @returns {Promise<Object>} Post data
   */
  async getPost(postId) {
    try {
      const response = await axios.get(
        `${this.apiBase}/posts/${postId}`,
        {
          auth: this.auth
        }
      );

      return {
        id: response.data.id,
        title: response.data.title.rendered,
        content: response.data.content.rendered,
        link: response.data.link,
        status: response.data.status
      };
    } catch (error) {
      console.error('Error fetching WordPress post:', error.response?.data || error.message);
      throw this.formatWordPressError(error, 'fetch posts');
    }
  }

  /**
   * Test WordPress connection
   * @returns {Promise<Object>} Connection status with role info
   */
  async testConnection() {
    try {
      console.log('Testing WordPress authentication...');
      
      // First test authentication - verify we can actually log in
      const authTest = await this.testAuthentication();
      if (!authTest.authenticated) {
        console.error('WordPress authentication failed:', authTest.error);
        return {
          connected: false,
          authenticated: false,
          error: authTest.error
        };
      }
      
      console.log(`WordPress authentication successful! User: ${authTest.user?.username || 'unknown'}`);
      
      // We're authenticated, now check user role and permissions
      const roleInfo = await this.checkUserRole();
      
      console.log(`WordPress user role check: ${roleInfo.username}, roles: ${roleInfo.roles?.join(', ') || 'none'}, can create posts: ${roleInfo.canCreatePosts}`);
      
      return {
        connected: true,
        authenticated: true,
        ...roleInfo
      };
    } catch (error) {
      console.error('WordPress connection test failed:', error.message);
      console.error('Error details:', error.response?.data || error.stack);
      
      // If it's an authentication error, return clear message
      if (error.message.includes('authentication failed') || 
          error.message.includes('Authentication failed')) {
        return {
          connected: false,
          authenticated: false,
          error: error.message
        };
      }
      
      throw this.formatWordPressError(error, 'access WordPress API');
    }
  }
}

module.exports = WordPressService;
