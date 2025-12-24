const ImageDownloader = require('../../src/modules/imageDownloader');
const fs = require('fs').promises;
const path = require('path');

describe('ImageDownloader', () => {
  let imageDownloader;
  let mockSlackClient;
  let testBaseDir;

  beforeEach(() => {
    testBaseDir = path.join(__dirname, '../fixtures', `test-images-${Date.now()}`);
    
    // Create mock Slack client
    mockSlackClient = {
      files: {
        info: jest.fn()
      },
      options: {
        token: 'xoxb-test-token'
      }
    };

    imageDownloader = new ImageDownloader(mockSlackClient, testBaseDir, 'xoxb-test-token');
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore
    }
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(imageDownloader.slackClient).toBe(mockSlackClient);
      expect(imageDownloader.baseDir).toBe(testBaseDir);
      expect(imageDownloader.token).toBe('xoxb-test-token');
    });

    test('should extract token from client options', () => {
      const downloaderWithClientToken = new ImageDownloader(mockSlackClient, testBaseDir);
      expect(downloaderWithClientToken.token).toBe('xoxb-test-token');
    });
  });

  describe('extractImages', () => {
    test('should extract image files from message', () => {
      const message = {
        files: [
          {
            id: 'F123',
            name: 'test.jpg',
            mimetype: 'image/jpeg',
            url_private: 'https://files.slack.com/test.jpg',
            size: 12345
          },
          {
            id: 'F456',
            name: 'test.png',
            mimetype: 'image/png',
            url_private: 'https://files.slack.com/test.png',
            size: 67890
          }
        ]
      };

      const images = imageDownloader.extractImages(message);
      
      expect(images).toHaveLength(2);
      expect(images[0].id).toBe('F123');
      expect(images[0].name).toBe('test.jpg');
      expect(images[1].id).toBe('F456');
      expect(images[1].name).toBe('test.png');
    });

    test('should filter out non-image files', () => {
      const message = {
        files: [
          {
            id: 'F123',
            name: 'test.jpg',
            mimetype: 'image/jpeg',
            url_private: 'https://files.slack.com/test.jpg'
          },
          {
            id: 'F456',
            name: 'test.pdf',
            mimetype: 'application/pdf',
            url_private: 'https://files.slack.com/test.pdf'
          },
          {
            id: 'F789',
            name: 'test.txt',
            mimetype: 'text/plain',
            url_private: 'https://files.slack.com/test.txt'
          }
        ]
      };

      const images = imageDownloader.extractImages(message);
      
      expect(images).toHaveLength(1);
      expect(images[0].id).toBe('F123');
    });

    test('should return empty array when no files', () => {
      const message = {};
      const images = imageDownloader.extractImages(message);
      expect(images).toEqual([]);
    });

    test('should return empty array when files is not an array', () => {
      const message = { files: 'not-an-array' };
      const images = imageDownloader.extractImages(message);
      expect(images).toEqual([]);
    });
  });

  describe('getFileExtension', () => {
    test('should extract extension from filename', () => {
      const ext = imageDownloader.getFileExtension('image/jpeg', 'test.jpg');
      expect(ext).toBe('.jpg');
    });

    test('should map mimetype to extension when no filename', () => {
      expect(imageDownloader.getFileExtension('image/jpeg')).toBe('.jpg');
      expect(imageDownloader.getFileExtension('image/png')).toBe('.png');
      expect(imageDownloader.getFileExtension('image/gif')).toBe('.gif');
      expect(imageDownloader.getFileExtension('image/webp')).toBe('.webp');
    });

    test('should prefer filename extension over mimetype', () => {
      const ext = imageDownloader.getFileExtension('image/jpeg', 'test.png');
      expect(ext).toBe('.png');
    });

    test('should default to .jpg for unknown mimetype', () => {
      const ext = imageDownloader.getFileExtension('image/unknown');
      expect(ext).toBe('.jpg');
    });
  });

  describe('getImageMarkdown', () => {
    test('should generate markdown for successful download', () => {
      const downloadResult = {
        success: true,
        filename: 'test-image.jpg',
        relativePath: '../images/thread-123/test-image.jpg'
      };

      const markdown = imageDownloader.getImageMarkdown(downloadResult, 'Test Image');
      
      expect(markdown).toBe('![Test Image](../images/thread-123/test-image.jpg)');
    });

    test('should use filename as alt text when no alt text provided', () => {
      const downloadResult = {
        success: true,
        filename: 'test-image.jpg',
        relativePath: '../images/thread-123/test-image.jpg'
      };

      const markdown = imageDownloader.getImageMarkdown(downloadResult);
      
      expect(markdown).toBe('![test-image.jpg](../images/thread-123/test-image.jpg)');
    });

    test('should return empty string for failed download', () => {
      const downloadResult = {
        success: false,
        error: 'Download failed'
      };

      const markdown = imageDownloader.getImageMarkdown(downloadResult);
      
      expect(markdown).toBe('');
    });
  });

  describe('init', () => {
    test('should create images directory', async () => {
      await imageDownloader.init();
      
      const dirExists = await fs.access(imageDownloader.imagesDir)
        .then(() => true)
        .catch(() => false);
      
      expect(dirExists).toBe(true);
    });

    test('should create nested directories', async () => {
      const deepDownloader = new ImageDownloader(
        mockSlackClient, 
        path.join(testBaseDir, 'deep', 'nested', 'path')
      );
      
      await deepDownloader.init();
      
      const dirExists = await fs.access(deepDownloader.imagesDir)
        .then(() => true)
        .catch(() => false);
      
      expect(dirExists).toBe(true);
    });
  });

  describe('downloadMessageImages', () => {
    test('should return empty array for message without files', async () => {
      const message = { ts: '1234567890.123456', text: 'No images here' };
      
      const results = await imageDownloader.downloadMessageImages(message, '1234567890.123456');
      
      expect(results).toEqual([]);
    });

    test('should return empty array for message without image files', async () => {
      const message = {
        ts: '1234567890.123456',
        files: [
          {
            id: 'F123',
            mimetype: 'application/pdf',
            url_private: 'https://files.slack.com/test.pdf'
          }
        ]
      };
      
      const results = await imageDownloader.downloadMessageImages(message, '1234567890.123456');
      
      expect(results).toEqual([]);
    });
  });

  describe('downloadThreadImages', () => {
    test('should process multiple messages', async () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Message 1', files: [] },
        { ts: '1234567891.123457', text: 'Message 2', files: [] },
        { ts: '1234567892.123458', text: 'Message 3', files: [] }
      ];
      
      const results = await imageDownloader.downloadThreadImages(messages, '1234567890.123456');
      
      expect(results).toHaveLength(3);
      expect(results[0].messageTs).toBe('1234567890.123456');
      expect(results[1].messageTs).toBe('1234567891.123457');
      expect(results[2].messageTs).toBe('1234567892.123458');
    });

    test('should mark success true when no images to download', async () => {
      const messages = [
        { ts: '1234567890.123456', text: 'No images' }
      ];
      
      const results = await imageDownloader.downloadThreadImages(messages, '1234567890.123456');
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].images).toEqual([]);
    });
  });
});
