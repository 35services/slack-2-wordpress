const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const https = require('https');

class ImageDownloader {
  constructor(slackClient, baseDir = './data', token = null) {
    this.slackClient = slackClient;
    this.baseDir = baseDir;
    this.imagesDir = path.join(baseDir, 'images');
    // Get token from parameter, client options, or client directly
    this.token = token || slackClient?.options?.token || slackClient?.token;
  }

  /**
   * Initialize image directories
   */
  async init() {
    try {
      await fs.mkdir(this.imagesDir, { recursive: true });
    } catch (error) {
      console.error('Error creating images directory:', error);
      throw error;
    }
  }

  /**
   * Extract images from Slack message
   * @param {Object} message - Slack message object
   * @returns {Array} Array of image file objects
   */
  extractImages(message) {
    const images = [];
    
    if (!message.files || !Array.isArray(message.files)) {
      return images;
    }

    message.files.forEach(file => {
      // Check if it's an image
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        images.push({
          id: file.id,
          name: file.name || `image-${file.id}`,
          url_private: file.url_private,
          url_private_download: file.url_private_download,
          mimetype: file.mimetype,
          size: file.size,
          thumb_64: file.thumb_64,
          thumb_360: file.thumb_360,
          thumb_480: file.thumb_480,
          thumb_720: file.thumb_720,
          original_w: file.original_w,
          original_h: file.original_h
        });
      }
    });

    return images;
  }

  /**
   * Get file extension from mimetype or filename
   * @param {string} mimetype - MIME type
   * @param {string} filename - Original filename
   * @returns {string} File extension
   */
  getFileExtension(mimetype, filename) {
    if (filename) {
      const ext = path.extname(filename).toLowerCase();
      if (ext) return ext;
    }
    
    const mimeMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg'
    };
    
    return mimeMap[mimetype] || '.jpg';
  }

  /**
   * Download image from Slack
   * @param {Object} image - Image file object from Slack
   * @param {string} threadTs - Thread timestamp
   * @param {string} messageTs - Message timestamp
   * @param {number} imageIndex - Index of image in message
   * @returns {Promise<Object>} Download result with local path
   */
  async downloadImage(image, threadTs, messageTs, imageIndex = 0) {
    try {
      await this.init();
      
      // Create subdirectory for this thread
      const threadDir = path.join(this.imagesDir, threadTs.replace(/\./g, '-'));
      await fs.mkdir(threadDir, { recursive: true });
      
      // Generate filename
      const ext = this.getFileExtension(image.mimetype, image.name);
      const safeName = (image.name || `image-${image.id}`)
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/\.[^.]+$/, '');
      const filename = `${messageTs.replace(/\./g, '-')}-${imageIndex}-${safeName}${ext}`;
      const filePath = path.join(threadDir, filename);
      
      // Check if file already exists
      try {
        await fs.access(filePath);
        console.log(`Image already exists: ${filename}`);
        return {
          success: true,
          path: filePath,
          relativePath: `../images/${threadTs.replace(/\./g, '-')}/${filename}`,
          filename: filename,
          cached: true
        };
      } catch {
        // File doesn't exist, proceed with download
      }
      
      // Download the image using Slack WebClient's file download method
      // This ensures proper authentication and handles Slack's file URLs correctly
      const token = this.token || this.slackClient?.options?.token || this.slackClient?.token;
      if (!token) {
        throw new Error('Slack token not available for image download');
      }
      
      // Use Slack's files.info to get the proper download URL with fresh authentication
      let downloadUrl = image.url_private_download || image.url_private;
      
      // If we have a WebClient, try to use it to get file info first
      // This ensures we have the latest URL and proper permissions
      if (this.slackClient && this.slackClient.files) {
        try {
          const fileInfo = await this.slackClient.files.info({
            file: image.id
          });
          if (fileInfo.file && fileInfo.file.url_private_download) {
            downloadUrl = fileInfo.file.url_private_download;
            console.log(`Got fresh download URL for file ${image.id}`);
          }
        } catch (infoError) {
          console.warn(`Could not get file info for ${image.id}, using provided URL:`, infoError.message);
          // Continue with provided URL
        }
      }
      
      // Download with proper headers - Slack requires Bearer token in Authorization header
      const response = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'stream',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Slack-2-WordPress/1.0'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: true
        }),
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept redirects
        }
      });
      
      // Check content type to verify we're getting an image
      const contentType = response.headers['content-type'] || '';
      const isImageContentType = contentType.startsWith('image/') || 
                                 contentType.includes('octet-stream') ||
                                 contentType.includes('binary');
      
      if (!isImageContentType && contentType) {
        console.warn(`Warning: Content-Type is ${contentType}, expected image/*`);
      }
      
      // Write to file using streams - ensure binary mode
      const { createWriteStream } = require('fs');
      const writer = createWriteStream(filePath, { flags: 'w' }); // Binary by default for images
      
      // Collect first chunk to validate it's an image, not HTML
      let firstChunk = null;
      let firstChunkReceived = false;
      
      response.data.on('data', (chunk) => {
        if (!firstChunkReceived) {
          firstChunk = chunk;
          firstChunkReceived = true;
          
          // Check if first bytes indicate HTML error page
          const textStart = chunk.slice(0, 50).toString('utf8', 0, Math.min(50, chunk.length));
          if (textStart.includes('<!DOCTYPE') || 
              textStart.includes('<html') || 
              textStart.toLowerCase().includes('error') ||
              textStart.toLowerCase().includes('unauthorized') ||
              textStart.toLowerCase().includes('forbidden')) {
            writer.destroy();
            response.data.destroy();
            throw new Error(`Received HTML error page instead of image. First bytes: ${textStart.substring(0, 100)}. Check Slack authentication and file permissions.`);
          }
        }
      });
      
      // Pipe the response stream to file
      response.data.pipe(writer);
      
      // Wait for stream to finish and handle errors
      await new Promise((resolve, reject) => {
        let resolved = false;
        
        const cleanup = () => {
          if (!resolved) {
            resolved = true;
            writer.removeAllListeners();
            response.data.removeAllListeners();
          }
        };
        
        writer.once('finish', () => {
          cleanup();
          resolve();
        });
        
        writer.once('error', (err) => {
          cleanup();
          console.error(`Error writing image file ${filename}:`, err);
          reject(err);
        });
        
        response.data.once('error', (err) => {
          cleanup();
          console.error(`Error downloading image ${image.id}:`, err);
          writer.destroy();
          reject(err);
        });
      });
      
      // Verify the downloaded file is actually an image
      const stats = await fs.stat(filePath);
      if (stats.size < 100) {
        // File is too small to be a valid image
        await fs.unlink(filePath);
        throw new Error(`Downloaded file is too small (${stats.size} bytes), likely an error page`);
      }
      
      // Check file header to verify it's an image
      const fileBuffer = await fs.readFile(filePath, { encoding: null });
      const header = fileBuffer.slice(0, 12);
      
      // Check for common image formats
      const isValidImage = 
        // JPEG: FF D8 FF
        (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) ||
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) ||
        // GIF: 47 49 46 38 (GIF8)
        (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && (header[3] === 0x38 || header[3] === 0x39)) ||
        // WebP: RIFF...WEBP (starts with RIFF at offset 0, WEBP at offset 8)
        (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 && 
         header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50);
      
      if (!isValidImage) {
        // Check if it's HTML/error page
        const textStart = fileBuffer.slice(0, 100).toString('utf8', 0, Math.min(100, fileBuffer.length));
        if (textStart.includes('<!DOCTYPE') || 
            textStart.includes('<html') || 
            textStart.toLowerCase().includes('error') ||
            textStart.toLowerCase().includes('unauthorized') ||
            textStart.toLowerCase().includes('forbidden')) {
          await fs.unlink(filePath);
          throw new Error(
            `Downloaded file is not a valid image - appears to be HTML error page.\n` +
            `File size: ${stats.size} bytes\n` +
            `First 100 chars: ${textStart.substring(0, 100)}\n` +
            `Check Slack authentication and ensure bot has 'files:read' permission.`
          );
        }
        // Might be a valid image format we don't check for, so log warning but don't fail
        console.warn(`Warning: Downloaded file ${filename} doesn't match common image headers. Header: ${Array.from(header).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
      }
      
      console.log(`Downloaded image: ${filename} (${(stats.size / 1024).toFixed(2)} KB, verified as valid image)`);
      
      return {
        success: true,
        path: filePath,
        relativePath: `../images/${threadTs.replace(/\./g, '-')}/${filename}`,
        filename: filename,
        size: stats.size,
        cached: false
      };
    } catch (error) {
      console.error(`Error downloading image ${image.id}:`, error.message);
      return {
        success: false,
        imageId: image.id,
        error: error.message
      };
    }
  }

  /**
   * Download all images from a message
   * @param {Object} message - Slack message object
   * @param {string} threadTs - Thread timestamp
   * @returns {Promise<Array>} Array of download results
   */
  async downloadMessageImages(message, threadTs) {
    const images = this.extractImages(message);
    
    if (images.length === 0) {
      return [];
    }
    
    const downloadPromises = images.map((image, index) =>
      this.downloadImage(image, threadTs, message.ts, index)
    );
    
    return await Promise.all(downloadPromises);
  }

  /**
   * Download all images from multiple messages in parallel
   * @param {Array} messages - Array of Slack message objects
   * @param {string} threadTs - Thread timestamp
   * @returns {Promise<Array>} Array of download results grouped by message
   */
  async downloadThreadImages(messages, threadTs) {
    const downloadPromises = messages.map(async (message) => {
      const results = await this.downloadMessageImages(message, threadTs);
      return {
        messageTs: message.ts,
        images: results,
        success: results.every(r => r.success !== false)
      };
    });
    
    return await Promise.all(downloadPromises);
  }

  /**
   * Get image markdown reference
   * @param {Object} downloadResult - Result from downloadImage
   * @param {string} altText - Alt text for image
   * @returns {string} Markdown image syntax
   */
  getImageMarkdown(downloadResult, altText = '') {
    if (!downloadResult.success) {
      return '';
    }
    
    const alt = altText || downloadResult.filename || 'Image';
    return `![${alt}](${downloadResult.relativePath})`;
  }
}

module.exports = ImageDownloader;

