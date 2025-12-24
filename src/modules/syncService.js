const path = require('path');
const SlackService = require('./slackService');
const WordPressService = require('./wordpressService');
const StateManager = require('./stateManager');
const MarkdownExporter = require('./markdownExporter');
const ImageDownloader = require('./imageDownloader');

class SyncService {
  constructor(config) {
    this.slackService = new SlackService(config.slackToken);
    this.wordpressService = new WordPressService(
      config.wordpressUrl,
      config.wordpressUsername,
      config.wordpressPassword
    );
    this.stateManager = new StateManager(config.stateFile);
    this.imageDownloader = new ImageDownloader(
      this.slackService.client,
      config.markdownOutputDir ? path.dirname(config.markdownOutputDir) : './data',
      config.slackToken
    );
    this.markdownExporter = new MarkdownExporter(
      config.markdownOutputDir || './data/posts',
      this.imageDownloader
    );
    this.channelId = config.channelId;
    this.syncProgress = null;
  }

  /**
   * Initialize the sync service
   */
  async init() {
    await this.stateManager.init();
  }

  /**
   * Get current sync progress
   * @returns {Object|null} Current sync progress
   */
  getSyncProgress() {
    return this.syncProgress;
  }

  /**
   * Sync all threads from Slack channel to WordPress
   * @returns {Promise<Object>} Sync results
   */
  async syncAll() {
    this.syncProgress = {
      status: 'starting',
      message: 'Initializing sync...',
      step: 0,
      totalSteps: 0,
      currentThread: null,
      results: {
        created: [],
        updated: [],
        skipped: [],
        errors: [],
        markdownExported: 0,
        imagesDownloaded: 0
      }
    };

    const results = {
      created: [],
      updated: [],
      skipped: [],
      errors: [],
      markdownExported: 0,
      markdownErrors: 0
    };

    try {
      // Step 1: Validate channel access
      this.syncProgress.status = 'validating';
      this.syncProgress.message = 'Validating channel access...';
      this.syncProgress.step = 1;
      await this.slackService.validateChannel(this.channelId);
      
      // Step 2: Get all threads from channel
      this.syncProgress.status = 'fetching';
      this.syncProgress.message = 'Fetching threads from Slack channel...';
      this.syncProgress.step = 2;
      const threads = await this.slackService.getChannelThreads(this.channelId);
      console.log(`Found ${threads.length} threads in channel`);
      
      this.syncProgress.totalSteps = threads.length;
      this.syncProgress.message = `Found ${threads.length} threads. Processing...`;

      // Step 3: Fetch all thread messages in parallel
      this.syncProgress.status = 'fetching-threads';
      this.syncProgress.message = `Fetching messages for ${threads.length} threads...`;
      this.syncProgress.step = 3;
      
      const threadDataPromises = threads.map(async (thread) => {
        try {
          const messages = await this.slackService.getThreadReplies(this.channelId, thread.ts);
          return { threadTs: thread.ts, messages, success: true };
        } catch (error) {
          return { threadTs: thread.ts, messages: null, success: false, error: error.message };
        }
      });
      
      const threadData = await Promise.all(threadDataPromises);
      
      // Step 4: Download images in parallel (most important!)
      this.syncProgress.status = 'downloading-images';
      this.syncProgress.message = `Downloading images from ${threadData.filter(t => t.success).length} threads...`;
      this.syncProgress.step = 4;
      
      const successfulThreads = threadData.filter(t => t.success);
      let imageDownloadResults = [];
      let totalImagesDownloaded = 0;
      
      try {
        const imageDownloadPromises = successfulThreads.map(async ({ messages, threadTs }) => {
          try {
            const downloads = await this.imageDownloader.downloadThreadImages(messages, threadTs);
            const imageCount = downloads.reduce((sum, msg) => sum + (msg.images?.filter(i => i.success).length || 0), 0);
            totalImagesDownloaded += imageCount;
            return { threadTs, downloads, success: true, imageCount };
          } catch (error) {
            console.error(`Error downloading images for thread ${threadTs}:`, error);
            return { threadTs, downloads: [], success: false, error: error.message };
          }
        });
        
        imageDownloadResults = await Promise.all(imageDownloadPromises);
        console.log(`Image download complete: ${totalImagesDownloaded} images downloaded`);
      } catch (imageError) {
        console.error('Error during image download (continuing anyway):', imageError);
      }
      
      // Step 5: Export to markdown in parallel (with image references)
      // This always runs, regardless of WordPress configuration or errors
      this.syncProgress.status = 'exporting-markdown';
      this.syncProgress.message = `Exporting ${successfulThreads.length} threads to markdown with ${totalImagesDownloaded} images...`;
      this.syncProgress.step = 5;
      
      let markdownExports = [];
      try {
        if (successfulThreads.length > 0) {
          // Map image downloads to threads
          const threadsWithImages = successfulThreads.map(t => {
            const imageData = imageDownloadResults.find(r => r.threadTs === t.threadTs);
            // Create array indexed by message position
            const imageMap = {};
            if (imageData && imageData.downloads) {
              imageData.downloads.forEach((msgDownload, index) => {
                const message = t.messages.find(m => m.ts === msgDownload.messageTs);
                if (message) {
                  const msgIndex = t.messages.indexOf(message);
                  imageMap[msgIndex] = msgDownload;
                }
              });
            }
            return {
              messages: t.messages,
              threadTs: t.threadTs,
              imageDownloads: imageMap
            };
          });
          
          markdownExports = await this.markdownExporter.exportThreadsParallel(threadsWithImages);
        }
        
        results.markdownExported = markdownExports.filter(e => e.success).length;
        results.markdownErrors = markdownExports.filter(e => !e.success).length;
        results.imagesDownloaded = totalImagesDownloaded;
        this.syncProgress.results.markdownExported = results.markdownExported;
        this.syncProgress.results.imagesDownloaded = totalImagesDownloaded;
        
        console.log(`Markdown export complete: ${results.markdownExported} files exported, ${totalImagesDownloaded} images, ${results.markdownErrors} errors`);
      } catch (markdownError) {
        // Markdown export errors don't stop the process
        console.error('Error during markdown export (continuing anyway):', markdownError);
        results.markdownErrors = results.markdownErrors || 0;
        results.markdownErrors += 1;
        this.syncProgress.message = `Markdown export had errors, but continuing with WordPress sync...`;
      }
      
      // Step 6: Process each thread (WordPress sync)
      // This runs independently - WordPress errors don't affect markdown files
      // Markdown files and images are already written, so WordPress errors are non-blocking
      this.syncProgress.status = 'processing';
      this.syncProgress.message = `Syncing to WordPress (markdown files and images already saved)...`;
      
      for (let i = 0; i < threads.length; i++) {
        const thread = threads[i];
        const threadInfo = threadData.find(t => t.threadTs === thread.ts);
        
        this.syncProgress.step = 6;
        this.syncProgress.currentStep = i + 1;
        this.syncProgress.currentThread = thread.ts;
        this.syncProgress.message = `WordPress sync: thread ${i + 1} of ${threads.length} (${thread.ts})...`;
        
        try {
          const result = await this.syncThread(thread.ts);
          
          if (result.action === 'created') {
            results.created.push(result);
            this.syncProgress.results.created.push(result);
            this.syncProgress.message = `✓ WordPress: Created ${result.title} (${i + 1}/${threads.length})`;
          } else if (result.action === 'updated') {
            results.updated.push(result);
            this.syncProgress.results.updated.push(result);
            this.syncProgress.message = `↻ WordPress: Updated ${result.title} (${i + 1}/${threads.length})`;
          } else if (result.action === 'skipped') {
            results.skipped.push(result);
            this.syncProgress.results.skipped.push(result);
            this.syncProgress.message = `⊘ WordPress: Skipped ${result.title} (${i + 1}/${threads.length})`;
          }
        } catch (error) {
          // WordPress errors don't stop the process - markdown files are already saved
          const errorResult = {
            threadTs: thread.ts,
            error: error.message,
            note: 'Markdown file was saved successfully'
          };
          results.errors.push(errorResult);
          this.syncProgress.results.errors.push(errorResult);
          this.syncProgress.message = `✗ WordPress error for thread ${thread.ts}: ${error.message} (markdown saved) (${i + 1}/${threads.length})`;
          console.error(`WordPress sync failed for thread ${thread.ts}, but markdown file was saved:`, error.message);
        }
      }

      // Step 7: Complete
      this.syncProgress.status = 'completed';
      const wpErrors = results.errors.length;
      const markdownCount = results.markdownExported || 0;
      const imageCount = results.imagesDownloaded || 0;
      this.syncProgress.message = `Complete! ${markdownCount} markdown files, ${imageCount} images saved. WordPress: ${results.created.length} created, ${results.updated.length} updated, ${wpErrors} errors`;
      this.syncProgress.step = 7;
      this.syncProgress.currentThread = null;
      
      // Log summary
      console.log(`Sync complete: ${markdownCount} markdown files, ${imageCount} images exported, ${results.created.length} WordPress posts created, ${results.updated.length} updated, ${wpErrors} WordPress errors`);

      return results;
    } catch (error) {
      console.error('Error during sync:', error);
      this.syncProgress.status = 'error';
      
      // Even if sync fails, markdown files may have been exported
      const markdownCount = results.markdownExported || 0;
      if (markdownCount > 0) {
        this.syncProgress.message = `Sync error: ${error.message} (but ${markdownCount} markdown files were saved)`;
      } else {
        this.syncProgress.message = `Sync failed: ${error.message}`;
      }
      throw error;
    } finally {
      // Clear progress after a delay
      setTimeout(() => {
        this.syncProgress = null;
      }, 30000); // Clear after 30 seconds
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

      // Generate LLM prompt
      const llmPrompt = this.slackService.generateLLMPrompt(messages);

      // Check if thread is already mapped
      const existingPostId = this.stateManager.getPostId(threadTs);

      let result;
      if (existingPostId) {
        // Update existing post
        const wpPost = await this.wordpressService.updatePost(existingPostId, postData);
        await this.stateManager.setMapping(threadTs, wpPost.id, wpPost.title, llmPrompt);
        
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
        await this.stateManager.setMapping(threadTs, wpPost.id, wpPost.title, llmPrompt);
        
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
      slackChannel: false,
      wordpress: false,
      errors: {},
      availableChannels: []
    };

    try {
      // Test Slack authentication
      await this.slackService.client.auth.test();
      results.slack = true;
      
      // List available channels
      try {
        results.availableChannels = await this.slackService.listChannels();
      } catch (error) {
        console.error('Error listing channels:', error.message);
      }
      
      // Test channel access
      try {
        await this.slackService.validateChannel(this.channelId);
        results.slackChannel = true;
      } catch (error) {
        results.errors.slackChannel = error.message;
        console.error('Slack channel validation failed:', error.message);
      }
    } catch (error) {
      results.errors.slack = error.message;
      console.error('Slack connection test failed:', error.message);
    }

    try {
      // Test WordPress
      const wpTest = await this.wordpressService.testConnection();
      
      if (wpTest.connected === false || wpTest.authenticated === false) {
        // Authentication failed
        results.wordpress = false;
        results.wordpressRole = null;
        results.errors.wordpress = wpTest.error || 'WordPress authentication failed';
      } else {
        // Successfully connected and authenticated
        results.wordpress = true;
        results.wordpressRole = wpTest;
        
        // Check if user has required permissions
        if (wpTest.hasRequiredRole === false) {
          results.errors.wordpress = 
            `WordPress user "${wpTest.username || 'unknown'}" does not have permission to create posts. ` +
            `Current role(s): ${wpTest.roles?.join(', ') || 'unknown'}. ` +
            `Required roles: Administrator, Editor, or Author. ` +
            `Please update the user role in WordPress Admin → Users.`;
        }
      }
    } catch (error) {
      results.wordpress = false;
      results.wordpressRole = null;
      results.errors.wordpress = error.message;
      console.error('WordPress connection test failed:', error.message);
    }

    return results;
  }

  /**
   * Get LLM prompt for a specific thread
   * @param {string} threadTs - Thread timestamp
   * @returns {Promise<Object>} LLM prompt data
   */
  async getLLMPrompt(threadTs) {
    try {
      // Validate threadTs parameter
      if (!threadTs || typeof threadTs !== 'string') {
        throw new Error('Invalid thread timestamp');
      }

      // Check if we have a cached prompt
      const cachedPrompt = this.stateManager.getLLMPrompt(threadTs);
      if (cachedPrompt) {
        return {
          threadTs,
          prompt: cachedPrompt,
          cached: true
        };
      }

      // Generate new prompt from thread
      const messages = await this.slackService.getThreadReplies(this.channelId, threadTs);
      const prompt = this.slackService.generateLLMPrompt(messages);
      
      // Cache it if thread is mapped
      if (this.stateManager.isMapped(threadTs)) {
        await this.stateManager.setLLMPrompt(threadTs, prompt);
      }

      return {
        threadTs,
        prompt,
        cached: false
      };
    } catch (error) {
      console.error(`Error getting LLM prompt for thread ${threadTs}:`, error);
      throw error;
    }
  }
}

module.exports = SyncService;
