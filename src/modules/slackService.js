const { WebClient } = require('@slack/web-api');

class SlackService {
  constructor(token) {
    this.client = new WebClient(token);
  }

  /**
   * Fetch all threads from a specific channel
   * @param {string} channelId - The Slack channel ID
   * @returns {Promise<Array>} Array of thread messages
   */
  async getChannelThreads(channelId) {
    try {
      const result = await this.client.conversations.history({
        channel: channelId,
        limit: 100
      });

      // Filter messages that have replies (threads)
      const threads = result.messages.filter(msg => msg.thread_ts && msg.thread_ts === msg.ts);
      
      return threads;
    } catch (error) {
      console.error('Error fetching channel threads:', error);
      throw error;
    }
  }

  /**
   * Fetch all replies in a thread
   * @param {string} channelId - The Slack channel ID
   * @param {string} threadTs - The thread timestamp
   * @returns {Promise<Array>} Array of replies
   */
  async getThreadReplies(channelId, threadTs) {
    try {
      const result = await this.client.conversations.replies({
        channel: channelId,
        ts: threadTs
      });

      return result.messages;
    } catch (error) {
      console.error('Error fetching thread replies:', error);
      throw error;
    }
  }

  /**
   * Format thread messages into a blog post structure
   * @param {Array} messages - Thread messages
   * @returns {Object} Formatted post data
   */
  formatThreadAsPost(messages) {
    if (!messages || messages.length === 0) {
      throw new Error('No messages to format');
    }

    const firstMessage = messages[0];
    const title = this.extractTitle(firstMessage.text);
    const content = this.formatContent(messages);

    return {
      title,
      content,
      threadTs: firstMessage.ts
    };
  }

  /**
   * Extract title from first message (first line or first 50 chars)
   * @param {string} text - Message text
   * @returns {string} Title
   */
  extractTitle(text) {
    const firstLine = text.split('\n')[0];
    return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
  }

  /**
   * Format thread messages into HTML content
   * @param {Array} messages - Thread messages
   * @returns {string} HTML content
   */
  formatContent(messages) {
    let content = '';
    
    messages.forEach((msg, index) => {
      if (index === 0) {
        // First message is the main content
        content += `<p>${this.escapeHtml(msg.text)}</p>\n`;
      } else {
        // Subsequent messages are comments/additions
        content += `<div class="thread-reply">\n`;
        content += `<p><strong>Reply:</strong></p>\n`;
        content += `<p>${this.escapeHtml(msg.text)}</p>\n`;
        content += `</div>\n`;
      }
    });

    return content;
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]).replace(/\n/g, '<br>');
  }

  /**
   * Generate an LLM prompt from thread messages
   * @param {Array} messages - Thread messages
   * @returns {string} LLM prompt text
   */
  generateLLMPrompt(messages) {
    if (!messages || messages.length === 0) {
      throw new Error('No messages to generate prompt from');
    }

    let prompt = 'Please write a professional blog post based on the following Slack thread conversation:\n\n';
    prompt += '=== THREAD START ===\n\n';

    messages.forEach((msg, index) => {
      if (index === 0) {
        prompt += `Original Post:\n${msg.text}\n\n`;
      } else {
        prompt += `Reply ${index}:\n${msg.text}\n\n`;
      }
    });

    prompt += '=== THREAD END ===\n\n';
    prompt += 'Instructions:\n';
    prompt += '1. Create an engaging blog post title\n';
    prompt += '2. Write a well-structured blog post with proper paragraphs\n';
    prompt += '3. Include relevant headings if appropriate\n';
    prompt += '4. Maintain a professional yet approachable tone\n';
    prompt += '5. Incorporate insights from all the replies in the thread\n';
    prompt += '6. Format the output in HTML suitable for WordPress\n';

    return prompt;
  }
}

module.exports = SlackService;
