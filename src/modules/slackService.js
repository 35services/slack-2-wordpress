const { WebClient } = require('@slack/web-api');

class SlackService {
  constructor(token) {
    this.client = new WebClient(token);
  }

  /**
   * List all channels the bot can access
   * @returns {Promise<Array>} Array of channel objects
   */
  async listChannels() {
    try {
      const result = await this.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true
      });
      return result.channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        is_member: ch.is_member,
        is_private: ch.is_private
      }));
    } catch (error) {
      console.error('Error listing channels:', error);
      throw this.formatSlackError(error);
    }
  }

  /**
   * Validate channel access
   * @param {string} channelId - The Slack channel ID
   * @returns {Promise<Object>} Channel info if accessible
   */
  async validateChannel(channelId) {
    try {
      const result = await this.client.conversations.info({
        channel: channelId
      });
      return { valid: true, channel: result.channel };
    } catch (error) {
      if (error.data?.error === 'channel_not_found') {
        throw new Error(
          `Channel not found or bot doesn't have access. ` +
          `Please verify:\n` +
          `1. The channel ID "${channelId}" is correct\n` +
          `2. The bot has been invited to the channel (use /invite @YourBotName in Slack)\n` +
          `3. The bot has the required scopes: channels:read, channels:history`
        );
      } else if (error.data?.error === 'not_in_channel') {
        throw new Error(
          `Bot is not a member of the channel. ` +
          `Please invite the bot to the channel using: /invite @YourBotName`
        );
      } else if (error.data?.error === 'missing_scope') {
        throw new Error(
          `Bot is missing required permissions. ` +
          `Please add the following scopes in Slack App settings: channels:read, channels:history`
        );
      }
      throw this.formatSlackError(error);
    }
  }

  /**
   * Format Slack API errors into user-friendly messages
   * @param {Error} error - The error object
   * @returns {Error} Formatted error
   */
  formatSlackError(error) {
    if (error.data?.error) {
      const errorCode = error.data.error;
      const errorMessage = error.data.error || 'Unknown error';
      
      switch (errorCode) {
        case 'channel_not_found':
          return new Error(
            `Channel not found. Please verify:\n` +
            `1. The channel ID is correct\n` +
            `2. The bot has been invited to the channel\n` +
            `3. The bot has the required permissions`
          );
        case 'not_in_channel':
          return new Error(
            `Bot is not a member of the channel. ` +
            `Invite the bot using: /invite @YourBotName in the channel`
          );
        case 'missing_scope':
          return new Error(
            `Bot is missing required permissions. ` +
            `Add scopes: channels:read, channels:history in Slack App settings`
          );
        default:
          return new Error(`Slack API error: ${errorMessage}`);
      }
    }
    return error;
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
      throw this.formatSlackError(error);
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
        ts: threadTs,
        include_all_metadata: true
      });

      return result.messages;
    } catch (error) {
      console.error('Error fetching thread replies:', error);
      throw this.formatSlackError(error);
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
