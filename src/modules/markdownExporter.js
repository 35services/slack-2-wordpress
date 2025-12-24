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
   * @param {Map<string, string>} userMap - Map of user ID to real name (optional)
   * @returns {string} Markdown content
   */
  formatThreadAsMarkdown(messages, threadTs, imageDownloads = null, userMap = null) {
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
      
      // Resolve user name if userMap is provided
      let userName = 'Unknown';
      if (msg.user) {
        if (userMap && userMap.has(msg.user)) {
          userName = userMap.get(msg.user);
        } else {
          userName = msg.user; // Fallback to user ID if not in map
        }
      }
      markdown += `**User:** ${userName}\n`;
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
   * Generate AI summary template content with image placeholders
   * @param {Array} messages - Thread messages
   * @param {string} threadTs - Thread timestamp
   * @param {Array} imageDownloads - Array of image download results (optional)
   * @returns {string} Template markdown content
   */
  formatSummaryTemplate(messages, threadTs, imageDownloads = null) {
    if (!messages || messages.length === 0) {
      throw new Error('No messages to format');
    }

    const firstMessage = messages[0];
    const title = this.extractTitle(firstMessage.text);
    const date = new Date(parseFloat(threadTs) * 1000).toISOString().split('T')[0];
    
    let template = `# AI Summary Template for: ${title}\n\n`;
    template += `**Thread ID:** ${threadTs}\n`;
    template += `**Date:** ${date}\n`;
    template += `**Messages:** ${messages.length}\n\n`;
    template += `---\n\n`;
    template += `## Summary\n\n`;
    template += `<!-- Add your AI-generated summary or write your own summary here -->\n\n`;
    template += `---\n\n`;
    
    // Add image references if available
    if (imageDownloads) {
      const allImages = [];
      messages.forEach((msg, index) => {
        if (imageDownloads[index]) {
          const msgImages = imageDownloads[index].images || [];
          msgImages.forEach(imageResult => {
            if (imageResult.success) {
              allImages.push({
                filename: imageResult.filename,
                relativePath: imageResult.relativePath
              });
            }
          });
        }
      });
      
      if (allImages.length > 0) {
        template += `## Referenced Images\n\n`;
        template += `<!-- These images are from the thread. You can reference them in your summary above -->\n\n`;
        allImages.forEach(image => {
          const altText = image.filename || 'Image';
          template += `![${altText}](${image.relativePath})\n\n`;
        });
      }
    }
    
    return template;
  }

  /**
   * Generate template filename from main filename
   * @param {string} baseFilename - Base filename
   * @returns {string} Template filename
   */
  generateTemplateFilename(baseFilename) {
    const ext = path.extname(baseFilename);
    const nameWithoutExt = baseFilename.substring(0, baseFilename.length - ext.length);
    return `${nameWithoutExt}-summary-template${ext}`;
  }

  /**
   * Export AI summary template file (only if it doesn't exist)
   * @param {Array} messages - Thread messages
   * @param {string} threadTs - Thread timestamp
   * @param {Array} imageDownloads - Array of image download results (optional)
   * @param {string} baseFilename - Base filename of the main markdown file
   * @returns {Promise<Object>} Template file info
   */
  async exportSummaryTemplate(messages, threadTs, imageDownloads = null, baseFilename = null) {
    try {
      await this.init();
      
      const title = this.extractTitle(messages[0].text);
      const filename = baseFilename || this.generateFilename(title, threadTs);
      const templateFilename = this.generateTemplateFilename(filename);
      const templatePath = path.join(this.outputDir, templateFilename);
      
      // Check if template already exists - NEVER overwrite
      try {
        await fs.access(templatePath);
        console.log(`Summary template already exists, skipping: ${templateFilename}`);
        return {
          path: templatePath,
          filename: templateFilename,
          threadTs: threadTs,
          title: title,
          created: false,
          skipped: true
        };
      } catch {
        // File doesn't exist, create it
      }
      
      const template = this.formatSummaryTemplate(messages, threadTs, imageDownloads);
      await fs.writeFile(templatePath, template, 'utf8');
      
      console.log(`Created summary template: ${templateFilename}`);
      
      return {
        path: templatePath,
        filename: templateFilename,
        threadTs: threadTs,
        title: title,
        created: true,
        skipped: false
      };
    } catch (error) {
      console.error(`Error exporting summary template for thread ${threadTs}:`, error);
      throw error;
    }
  }

  /**
   * Export a thread as markdown file
   * @param {Array} messages - Thread messages
   * @param {string} threadTs - Thread timestamp
   * @param {Array} imageDownloads - Array of image download results (optional)
   * @param {Map<string, string>} userMap - Map of user ID to real name (optional)
   * @returns {Promise<string>} Path to the created file
   */
  async exportThread(messages, threadTs, imageDownloads = null, userMap = null) {
    try {
      await this.init();
      
      const markdown = this.formatThreadAsMarkdown(messages, threadTs, imageDownloads, userMap);
      const title = this.extractTitle(messages[0].text);
      const filename = this.generateFilename(title, threadTs);
      const filePath = path.join(this.outputDir, filename);
      
      await fs.writeFile(filePath, markdown, 'utf8');
      
      // Also create the summary template (only if it doesn't exist)
      let summaryTemplateResult = null;
      try {
        summaryTemplateResult = await this.exportSummaryTemplate(messages, threadTs, imageDownloads, filename);
      } catch (templateError) {
        // Don't fail the main export if template creation fails
        console.warn(`Failed to create summary template for ${threadTs}:`, templateError.message);
      }
      
      return {
        path: filePath,
        filename: filename,
        threadTs: threadTs,
        title: title,
        summaryTemplate: summaryTemplateResult
      };
    } catch (error) {
      console.error(`Error exporting thread ${threadTs} to markdown:`, error);
      throw error;
    }
  }

  /**
   * Export multiple threads in parallel
   * @param {Array} threads - Array of {messages, threadTs, imageDownloads, userMap} objects
   * @returns {Promise<Array>} Array of export results
   */
  async exportThreadsParallel(threads) {
    // Use Promise.allSettled to ensure all exports are attempted, even if some fail
    const exportPromises = threads.map(({ messages, threadTs, imageDownloads, userMap }) =>
      this.exportThread(messages, threadTs, imageDownloads, userMap)
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

