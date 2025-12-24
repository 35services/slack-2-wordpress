const fs = require('fs').promises;
const path = require('path');

class StateManager {
  constructor(filePath = 'state.json') {
    this.filePath = path.resolve(filePath);
    this.state = {
      mappings: {} // threadTs -> { postId, lastUpdated, title }
    };
  }

  /**
   * Initialize state manager by loading existing state
   */
  async init() {
    try {
      await this.load();
    } catch (error) {
      // If file doesn't exist, initialize with empty state
      console.log('No existing state file found, creating new one');
      await this.save();
    }
  }

  /**
   * Load state from JSON file
   */
  async load() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      this.state = JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading state:', error);
        throw error;
      }
      // File doesn't exist, keep default state
    }
  }

  /**
   * Save state to JSON file
   */
  async save() {
    try {
      const data = JSON.stringify(this.state, null, 2);
      await fs.writeFile(this.filePath, data, 'utf8');
    } catch (error) {
      console.error('Error saving state:', error);
      throw error;
    }
  }

  /**
   * Get WordPress post ID for a Slack thread
   * @param {string} threadTs - Slack thread timestamp
   * @returns {number|null} WordPress post ID or null
   */
  getPostId(threadTs) {
    return this.state.mappings[threadTs]?.postId || null;
  }

  /**
   * Check if a thread is already mapped
   * @param {string} threadTs - Slack thread timestamp
   * @returns {boolean} True if mapped
   */
  isMapped(threadTs) {
    return threadTs in this.state.mappings;
  }

  /**
   * Add or update a thread-to-post mapping
   * @param {string} threadTs - Slack thread timestamp
   * @param {number} postId - WordPress post ID
   * @param {string} title - Post title
   * @param {string} llmPrompt - Optional LLM prompt for the thread
   */
  async setMapping(threadTs, postId, title, llmPrompt = null) {
    this.state.mappings[threadTs] = {
      postId,
      title,
      lastUpdated: new Date().toISOString(),
      ...(llmPrompt && { llmPrompt })
    };
    await this.save();
  }

  /**
   * Get LLM prompt for a thread
   * @param {string} threadTs - Slack thread timestamp
   * @returns {string|null} LLM prompt or null
   */
  getLLMPrompt(threadTs) {
    return this.state.mappings[threadTs]?.llmPrompt || null;
  }

  /**
   * Set LLM prompt for a thread
   * @param {string} threadTs - Slack thread timestamp
   * @param {string} llmPrompt - LLM prompt text
   */
  async setLLMPrompt(threadTs, llmPrompt) {
    if (this.state.mappings[threadTs]) {
      this.state.mappings[threadTs].llmPrompt = llmPrompt;
      await this.save();
    }
  }

  /**
   * Get all mappings
   * @returns {Object} All thread-to-post mappings
   */
  getAllMappings() {
    return this.state.mappings;
  }

  /**
   * Remove a mapping
   * @param {string} threadTs - Slack thread timestamp
   */
  async removeMapping(threadTs) {
    delete this.state.mappings[threadTs];
    await this.save();
  }
}

module.exports = StateManager;
