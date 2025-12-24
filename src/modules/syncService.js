const SlackService = require('./slackService');
const WordPressService = require('./wordpressService');
const StateManager = require('./stateManager');

class SyncService {
  constructor(config) {
    this.slackService = new SlackService(config.slackToken);
    this.wordpressService = new WordPressService(
      config.wordpressUrl,
      config.wordpressUsername,
      config.wordpressPassword
    );
    this.stateManager = new StateManager(config.stateFile);
    this.channelId = config.channelId;
  }

  /**
   * Initialize the sync service
   */
  async init() {
    await this.stateManager.init();
  }

  /**
   * Sync all threads from Slack channel to WordPress
   * @returns {Promise<Object>} Sync results
   */
  async syncAll() {
    const results = {
      created: [],
      updated: [],
      skipped: [],
      errors: []
    };

    try {
      // Get all threads from channel
      const threads = await this.slackService.getChannelThreads(this.channelId);
      console.log(`Found ${threads.length} threads in channel`);

      for (const thread of threads) {
        try {
          const result = await this.syncThread(thread.ts);
          
          if (result.action === 'created') {
            results.created.push(result);
          } else if (result.action === 'updated') {
            results.updated.push(result);
          } else if (result.action === 'skipped') {
            results.skipped.push(result);
          }
        } catch (error) {
          results.errors.push({
            threadTs: thread.ts,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error during sync:', error);
      throw error;
    }
  }

  /**
   * Sync a specific thread to WordPress
   * @param {string} threadTs - Thread timestamp
   * @returns {Promise<Object>} Sync result
   */
  async syncThread(threadTs) {
    try {
      // Get thread messages
      const messages = await this.slackService.getThreadReplies(this.channelId, threadTs);
      
      // Format as post
      const postData = this.slackService.formatThreadAsPost(messages);

      // Check if thread is already mapped
      const existingPostId = this.stateManager.getPostId(threadTs);

      let result;
      if (existingPostId) {
        // Update existing post
        const wpPost = await this.wordpressService.updatePost(existingPostId, postData);
        await this.stateManager.setMapping(threadTs, wpPost.id, wpPost.title);
        
        result = {
          action: 'updated',
          threadTs,
          postId: wpPost.id,
          title: wpPost.title,
          link: wpPost.link
        };
      } else {
        // Create new post
        const wpPost = await this.wordpressService.createPost(postData);
        await this.stateManager.setMapping(threadTs, wpPost.id, wpPost.title);
        
        result = {
          action: 'created',
          threadTs,
          postId: wpPost.id,
          title: wpPost.title,
          link: wpPost.link
        };
      }

      console.log(`Thread ${threadTs} ${result.action}: ${result.title}`);
      return result;
    } catch (error) {
      console.error(`Error syncing thread ${threadTs}:`, error);
      throw error;
    }
  }

  /**
   * Get current sync status
   * @returns {Object} Status information
   */
  getStatus() {
    const mappings = this.stateManager.getAllMappings();
    return {
      totalMappings: Object.keys(mappings).length,
      mappings: Object.entries(mappings).map(([threadTs, data]) => ({
        threadTs,
        ...data
      }))
    };
  }

  /**
   * Test connections to Slack and WordPress
   * @returns {Promise<Object>} Connection test results
   */
  async testConnections() {
    const results = {
      slack: false,
      wordpress: false
    };

    try {
      // Test Slack
      await this.slackService.client.auth.test();
      results.slack = true;
    } catch (error) {
      console.error('Slack connection test failed:', error.message);
    }

    try {
      // Test WordPress
      results.wordpress = await this.wordpressService.testConnection();
    } catch (error) {
      console.error('WordPress connection test failed:', error.message);
    }

    return results;
  }
}

module.exports = SyncService;
