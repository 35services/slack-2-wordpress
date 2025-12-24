require('dotenv').config();
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const SyncService = require('./modules/syncService');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize sync service
const syncService = new SyncService({
  slackToken: process.env.SLACK_BOT_TOKEN,
  channelId: process.env.SLACK_CHANNEL_ID,
  wordpressUrl: process.env.WORDPRESS_URL,
  wordpressUsername: process.env.WORDPRESS_USERNAME,
  wordpressPassword: process.env.WORDPRESS_PASSWORD,
  stateFile: 'state.json'
});

// Initialize state manager
let isInitialized = false;
async function ensureInitialized() {
  if (!isInitialized) {
    await syncService.init();
    isInitialized = true;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

/**
 * Test connections to Slack and WordPress
 */
app.get('/api/test', async (req, res) => {
  try {
    await ensureInitialized();
    const results = await syncService.testConnections();
    res.json({
      success: true,
      connections: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get current sync status
 */
app.get('/api/status', async (req, res) => {
  try {
    await ensureInitialized();
    const status = syncService.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Sync all threads
 */
app.post('/api/sync', async (req, res) => {
  try {
    await ensureInitialized();
    const results = await syncService.syncAll();
    res.json({
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Sync a specific thread
 */
app.post('/api/sync/:threadTs', async (req, res) => {
  try {
    await ensureInitialized();
    const { threadTs } = req.params;
    const result = await syncService.syncThread(threadTs);
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Slack-2-WordPress server running on http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT} to use the application`);
});

module.exports = app;
