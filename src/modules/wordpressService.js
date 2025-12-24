const axios = require('axios');

class WordPressService {
  constructor(url, username, password) {
    this.url = url.replace(/\/$/, ''); // Remove trailing slash
    this.auth = {
      username,
      password
    };
    this.apiBase = `${this.url}/wp-json/wp/v2`;
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
      throw error;
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
      const response = await axios.post(
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
      throw error;
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
      throw error;
    }
  }

  /**
   * Test WordPress connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      await axios.get(this.apiBase, {
        auth: this.auth
      });
      return true;
    } catch (error) {
      console.error('WordPress connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = WordPressService;
