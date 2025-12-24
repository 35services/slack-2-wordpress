const MarkdownExporter = require('../../src/modules/markdownExporter');
const fs = require('fs').promises;
const path = require('path');

describe('MarkdownExporter', () => {
  let markdownExporter;
  let testOutputDir;

  beforeEach(() => {
    testOutputDir = path.join(__dirname, '../fixtures', `test-markdown-${Date.now()}`);
    markdownExporter = new MarkdownExporter(testOutputDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore
    }
  });

  describe('extractTitle', () => {
    test('should extract title from first line', () => {
      const text = 'This is the title\nThis is more content';
      const title = markdownExporter.extractTitle(text);
      expect(title).toBe('This is the title');
    });

    test('should remove markdown headers', () => {
      const text = '## This is a header\nMore content';
      const title = markdownExporter.extractTitle(text);
      expect(title).toBe('This is a header');
    });

    test('should truncate long titles', () => {
      const longText = 'a'.repeat(150);
      const title = markdownExporter.extractTitle(longText);
      expect(title).toHaveLength(103); // 100 chars + '...'
      expect(title.endsWith('...')).toBe(true);
    });

    test('should return "Untitled" for empty text', () => {
      const title = markdownExporter.extractTitle('');
      expect(title).toBe('Untitled');
    });
  });

  describe('formatMessageText', () => {
    test('should preserve line breaks', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const formatted = markdownExporter.formatMessageText(text);
      expect(formatted).toContain('\n');
    });

    test('should convert Slack user mentions', () => {
      const text = 'Hello <@U1234567890|johndoe>';
      const formatted = markdownExporter.formatMessageText(text);
      expect(formatted).toBe('Hello @johndoe');
    });

    test('should convert Slack channel mentions', () => {
      const text = 'See <#C1234567890|general>';
      const formatted = markdownExporter.formatMessageText(text);
      expect(formatted).toBe('See #general');
    });

    test('should convert Slack URLs', () => {
      const text = '<https://example.com|Example Site>';
      const formatted = markdownExporter.formatMessageText(text);
      expect(formatted).toBe('[Example Site](https://example.com)');
    });

    test('should preserve code blocks', () => {
      const text = '```console.log("test")```';
      const formatted = markdownExporter.formatMessageText(text);
      expect(formatted).toContain('```');
    });
  });

  describe('generateFilename', () => {
    test('should generate safe filename', () => {
      const filename = markdownExporter.generateFilename('Test Title!', '1234567890.123456');
      expect(filename).toMatch(/^1234567890-123456-test-title\.md$/);
    });

    test('should handle special characters', () => {
      const filename = markdownExporter.generateFilename('Test@#$%Title', '1234567890.123456');
      expect(filename).toMatch(/^1234567890-123456-test-title\.md$/);
    });

    test('should truncate long titles in filename', () => {
      const longTitle = 'a'.repeat(100);
      const filename = markdownExporter.generateFilename(longTitle, '1234567890.123456');
      expect(filename.length).toBeLessThan(100);
    });
  });

  describe('formatThreadAsMarkdown', () => {
    test('should format thread with basic messages', () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Original post', user: 'U1234567890' },
        { ts: '1234567891.123457', text: 'First reply', user: 'U0987654321' }
      ];
      const threadTs = '1234567890.123456';

      const markdown = markdownExporter.formatThreadAsMarkdown(messages, threadTs);
      
      expect(markdown).toContain('# Original post');
      expect(markdown).toContain('**Thread ID:** 1234567890.123456');
      expect(markdown).toContain('**Messages:** 2');
      expect(markdown).toContain('## Original Post');
      expect(markdown).toContain('## Reply 1');
      expect(markdown).toContain('Original post');
      expect(markdown).toContain('First reply');
    });

    test('should include user information when userMap is provided', () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Test message', user: 'U1234567890' }
      ];
      const threadTs = '1234567890.123456';
      const userMap = new Map([['U1234567890', 'John Doe']]);

      const markdown = markdownExporter.formatThreadAsMarkdown(messages, threadTs, null, userMap);
      
      expect(markdown).toContain('**User:** John Doe');
    });

    test('should fallback to user ID when userMap is not provided', () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Test message', user: 'U1234567890' }
      ];
      const threadTs = '1234567890.123456';

      const markdown = markdownExporter.formatThreadAsMarkdown(messages, threadTs);
      
      expect(markdown).toContain('**User:** U1234567890');
    });

    test('should include images when imageDownloads are provided', () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Message with image', user: 'U1234567890' }
      ];
      const threadTs = '1234567890.123456';
      const imageDownloads = {
        0: {
          images: [
            {
              success: true,
              filename: 'test-image.jpg',
              relativePath: '../images/thread-123/test-image.jpg'
            }
          ]
        }
      };

      const markdown = markdownExporter.formatThreadAsMarkdown(messages, threadTs, imageDownloads);
      
      expect(markdown).toContain('![test-image.jpg](../images/thread-123/test-image.jpg)');
    });

    test('should throw error for empty messages', () => {
      expect(() => markdownExporter.formatThreadAsMarkdown([], '1234567890.123456'))
        .toThrow('No messages to format');
    });
  });

  describe('exportThread', () => {
    test('should export thread to markdown file', async () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Test message', user: 'U1234567890' }
      ];
      const threadTs = '1234567890.123456';

      const result = await markdownExporter.exportThread(messages, threadTs);
      
      expect(result.success).toBeUndefined(); // Only returned on error
      expect(result.path).toBeDefined();
      expect(result.filename).toMatch(/\.md$/);
      expect(result.threadTs).toBe(threadTs);
      expect(result.title).toBe('Test message');

      // Verify file was created
      const fileExists = await fs.access(result.path).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify content
      const content = await fs.readFile(result.path, 'utf8');
      expect(content).toContain('Test message');
    });

    test('should create output directory if it does not exist', async () => {
      const messages = [
        { ts: '1234567890.123456', text: 'Test', user: 'U1234567890' }
      ];

      await markdownExporter.exportThread(messages, '1234567890.123456');
      
      const dirExists = await fs.access(testOutputDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });
  });

  describe('exportThreadsParallel', () => {
    test('should export multiple threads in parallel', async () => {
      const threads = [
        {
          messages: [{ ts: '1111111111.111111', text: 'Thread 1', user: 'U1' }],
          threadTs: '1111111111.111111'
        },
        {
          messages: [{ ts: '2222222222.222222', text: 'Thread 2', user: 'U2' }],
          threadTs: '2222222222.222222'
        }
      ];

      const results = await markdownExporter.exportThreadsParallel(threads);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].threadTs).toBe('1111111111.111111');
      expect(results[1].threadTs).toBe('2222222222.222222');
    });

    test('should handle failures gracefully', async () => {
      const threads = [
        {
          messages: [{ ts: '1111111111.111111', text: 'Good thread', user: 'U1' }],
          threadTs: '1111111111.111111'
        },
        {
          messages: [], // This will cause an error
          threadTs: '2222222222.222222'
        }
      ];

      const results = await markdownExporter.exportThreadsParallel(threads);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });

    test('should return all results even if some fail', async () => {
      const threads = [
        {
          messages: null, // Will fail
          threadTs: '1111111111.111111'
        },
        {
          messages: [{ ts: '2222222222.222222', text: 'Good', user: 'U2' }],
          threadTs: '2222222222.222222'
        },
        {
          messages: [], // Will fail
          threadTs: '3333333333.333333'
        }
      ];

      const results = await markdownExporter.exportThreadsParallel(threads);
      
      expect(results).toHaveLength(3);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      expect(successCount).toBe(1);
      expect(failureCount).toBe(2);
    });
  });
});
