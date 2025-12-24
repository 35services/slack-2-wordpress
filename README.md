# Slack to WordPress Integration

A tool that automatically syncs Slack channel threads to WordPress blog posts.

## Features

✅ **All features implemented:**

1. ✓ Slack tool that scans a channel and creates WordPress blog posts based on threads
2. ✓ Thread linking - each thread is linked to its WordPress post for updates
3. ✓ Persistent state stored in JSON file
4. ✓ WordPress authentication via username and application password
5. ✓ Web application that runs locally with a user-friendly interface
6. ✓ Slack Bot integration

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your Slack and WordPress credentials
```

3. Start the application:
```bash
npm start
```

4. Open `http://localhost:3000` in your browser

## Documentation

For detailed setup instructions, including how to configure Slack and WordPress, see [SETUP.md](SETUP.md).

## Requirements

- Node.js v14+
- Slack workspace with bot token
- WordPress site with REST API enabled

## How It Works

1. Scans configured Slack channel for threads
2. Converts threads to WordPress posts (drafts)
3. Maintains thread-to-post mappings in `state.json`
4. Updates existing posts when threads change

See [SETUP.md](SETUP.md) for complete documentation.
