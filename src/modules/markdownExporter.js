const fs = require('fs').promises;
const path = require('path');

class MarkdownExporter {
  constructor(outputDir = './data/posts', imageDownloader = null) {
    this.outputDir = outputDir;
    this.imageDownloader = imageDownloader;
  }

  /**
   * Initialize the export directory
   */
  async init() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Error creating markdown export directory:', error);
      throw error;
    }
  }

  /**
   * Format thread messages as markdown
   * @param {Array} messages - Thread messages
   * @param {string} threadTs - Thread timestamp
   * @param {Array} imageDownloads - Array of image download results (optional)
   * @returns {string} Markdown content
   */
  formatThreadAsMarkdown(messages, threadTs, imageDownloads = null) {
    if (!messages || messages.length === 0) {
      throw new Error('No messages to format');
    }

    const firstMessage = messages[0];
    const title = this.extractTitle(firstMessage.text);
    const date = new Date(parseFloat(threadTs) * 1000).toISOString().split('T')[0];
    
    let markdown = `# ${title}\n\n`;
    markdown += `**Thread ID:** ${threadTs}\n`;
    markdown += `**Date:** ${date}\n`;
    markdown += `**Messages:** ${messages.length}\n\n`;
    markdown += `---\n\n`;

    messages.forEach((msg, index) => {
      if (index === 0) {
        markdown += `## Original Post\n\n`;
      } else {
        markdown += `## Reply ${index}\n\n`;
      }
      
      markdown += `**User:** ${msg.user || 'Unknown'}\n`;
      if (msg.ts) {
        const msgDate = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
        markdown += `**Time:** ${msgDate}\n`;
      }
      markdown += `\n${this.formatMessageText(msg.text)}\n\n`;
      
      // Add images if available
      if (imageDownloads && imageDownloads[index]) {
        const msgImages = imageDownloads[index].images || [];
        msgImages.forEach(imageResult => {
          if (imageResult.success) {
            const altText = imageResult.filename || 'Image';
            markdown += `![${altText}](${imageResult.relativePath})\n\n`;
          }
        });
      }
    });

    return markdown;
  }

  /**
   * Extract title from first message
   * @param {string} text - Message text
   * @returns {string} Title
   */
  extractTitle(text) {
    const firstLine = text.split('\n')[0].trim();
    // Remove markdown headers if present
    const cleaned = firstLine.replace(/^#+\s*/, '').trim();
    return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned || 'Untitled';
  }

  /**
   * Format message text, preserving formatting
   * @param {string} text - Message text
   * @returns {string} Formatted text
   */
  formatMessageText(text) {
    if (!text) return '';
    
    // Preserve line breaks
    let formatted = text;
    
    // Convert Slack mentions to markdown
    formatted = formatted.replace(/<@([A-Z0-9]+)\|([^>]+)>/g, '@$2');
    formatted = formatted.replace(/<@([A-Z0-9]+)>/g, '@user');
    
    // Convert Slack channels to markdown
    formatted = formatted.replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2');
    formatted = formatted.replace(/<#([A-Z0-9]+)>/g, '#channel');
    
    // Convert URLs
    formatted = formatted.replace(/<([^|>]+)\|([^>]+)>/g, '[$2]($1)');
    formatted = formatted.replace(/<([^>]+)>/g, '$1');
    
    // Preserve code blocks
    formatted = formatted.replace(/```([^`]+)```/g, '```\n$1\n```');
    
    return formatted;
  }

  /**
   * Generate a safe filename from title and thread ID
   * @param {string} title - Post title
   * @param {string} threadTs - Thread timestamp
   * @returns {string} Safe filename
   */
  generateFilename(title, threadTs) {
    // Create a safe filename
    const safeTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    
    const timestamp = threadTs.replace(/\./g, '-');
    return `${timestamp}-${safeTitle}.md`;
  }

  /**
   * Export a thread as markdown file
   * @param {Array} messages - Thread messages
   * @param {string} threadTs - Thread timestamp
   * @param {Array} imageDownloads - Array of image download results (optional)
   * @returns {Promise<string>} Path to the created file
   */
  async exportThread(messages, threadTs, imageDownloads = null) {
    try {
      await this.init();
      
      const markdown = this.formatThreadAsMarkdown(messages, threadTs, imageDownloads);
      const title = this.extractTitle(messages[0].text);
      const filename = this.generateFilename(title, threadTs);
      const filePath = path.join(this.outputDir, filename);
      
      await fs.writeFile(filePath, markdown, 'utf8');
      
      return {
        path: filePath,
        filename: filename,
        threadTs: threadTs,
        title: title
      };
    } catch (error) {
      console.error(`Error exporting thread ${threadTs} to markdown:`, error);
      throw error;
    }
  }

  /**
   * Export multiple threads in parallel
   * @param {Array} threads - Array of {messages, threadTs, imageDownloads} objects
   * @returns {Promise<Array>} Array of export results
   */
  async exportThreadsParallel(threads) {
    // Use Promise.allSettled to ensure all exports are attempted, even if some fail
    const exportPromises = threads.map(({ messages, threadTs, imageDownloads }) =>
      this.exportThread(messages, threadTs, imageDownloads)
        .then(result => ({ ...result, success: true, threadTs }))
        .catch(error => {
          console.error(`Failed to export thread ${threadTs} to markdown:`, error.message);
          return {
            threadTs,
            error: error.message,
            success: false
          };
        })
    );

    const results = await Promise.allSettled(exportPromises);
    
    // Extract results from settled promises
    return results.map((settled, index) => {
      if (settled.status === 'fulfilled') {
        return settled.value;
      } else {
        // This shouldn't happen since we catch errors in the promise, but handle it anyway
        return {
          threadTs: threads[index]?.threadTs || 'unknown',
          error: settled.reason?.message || 'Unknown error',
          success: false
        };
      }
    });
  }
}

module.exports = MarkdownExporter;

