# Slack to WordPress Integration

A tool that automatically syncs Slack channel threads to WordPress blog posts. This application scans a Slack channel, identifies threads, and creates or updates WordPress posts based on the thread content.

## Features

✅ **Implemented:**
1. ✓ Slack tool that scans a channel and creates WordPress blog posts based on threads
2. ✓ Thread linking - each thread is linked to its WordPress post for updates
3. ✓ Persistent state stored in JSON file (state.json)
4. ✓ WordPress authentication via username and application password
5. ✓ Web application that runs locally with a user-friendly interface
6. ✓ Slack Bot integration (requires setup - see below)

## Prerequisites

- **Option 1 (Recommended):** Docker and Docker Compose
- **Option 2:** Node.js (v14 or higher)
- A Slack workspace with admin access
- A WordPress site with REST API enabled
- WordPress Application Password (see setup instructions)

## Slack Bot Permissions

**Required Scopes:**
- `app_mentions:read` - View messages that mention the bot
- `channels:history` - Read messages from channels
- `channels:read` - View channel information
- `files:read` - **Required** for downloading images
- `users:read` - **Required** for resolving user IDs to real names in markdown exports

See [SLACK_PERMISSIONS.md](SLACK_PERMISSIONS.md) for detailed permission documentation.

## Installation

### Option 1: Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/35services/slack-2-wordpress.git
cd slack-2-wordpress
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure your environment variables in `.env` (see Configuration section below)

4. Start the application with Docker Compose:
```bash
docker-compose up -d
```

5. The application will be available at `http://localhost:3000`

6. To view logs:
```bash
# View all logs (follow mode - updates in real-time)
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100

# View logs for specific service
docker-compose logs -f slack-to-wordpress

# View logs with timestamps
docker-compose logs -f -t
```

7. To stop the application:
```bash
docker-compose down
```

The state file will be persisted in the `./data` directory on your host machine.

### Option 2: Using Node.js

1. Clone the repository:
```bash
git clone https://github.com/35services/slack-2-wordpress.git
cd slack-2-wordpress
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env` (see Configuration section below)

## Configuration

### Environment Variables

Edit the `.env` file with your credentials:

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_CHANNEL_ID=C1234567890

# WordPress Configuration
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=your-username
WORDPRESS_PASSWORD=your-application-password

# Server Configuration
PORT=3000
```

### Setting Up Slack Bot

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "WordPress Sync") and select your workspace
4. Navigate to "OAuth & Permissions"
5. Add the following Bot Token Scopes (all required):
   - `app_mentions:read` - View messages that directly mention the bot in conversations
   - `channels:history` - Read messages and other content from public channels the bot is added to
   - `channels:read` - View basic information about public channels in a workspace
   - `files:read` - **Required** to download images and files from messages
   - `users:read` - **Required** to resolve user IDs to real names in markdown exports
   - `chat:write` - (Optional) Send messages as the bot
6. Install the app to your workspace
7. Copy the "Bot User OAuth Token" (starts with `xoxb-`)
8. Paste this token into your `.env` file as `SLACK_BOT_TOKEN`
9. Invite the bot to your channel: `/invite @YourBotName`
10. Get your channel ID:
   - Right-click on the channel name
   - Select "Copy link"
   - Extract the ID from the URL (e.g., `C1234567890`)
   - Paste into `.env` as `SLACK_CHANNEL_ID`

### Setting Up WordPress

1. Log in to your WordPress admin panel
2. Go to Users → Your Profile
3. Scroll down to "Application Passwords"
4. Create a new application password:
   - Name it "Slack Sync" or similar
   - Click "Add New Application Password"
   - Copy the generated password (it will only be shown once)
5. Paste your WordPress username and the application password into `.env`

**Note:** Your WordPress site must have the REST API enabled (enabled by default in WordPress 4.7+)

## Usage

### Starting the Application

**With Docker:**
```bash
docker-compose up -d
```

**With Node.js:**
```bash
npm start
```

The application will start on `http://localhost:3000` (or the port specified in your `.env` file)

### Using the Web Interface

1. Open your browser and navigate to `http://localhost:3000`
2. Click "Test Connections" to verify Slack and WordPress connectivity
3. Click "Sync All Threads" to scan the channel and sync threads to WordPress
4. View the thread mappings to see which Slack threads are linked to which WordPress posts

### API Endpoints

The application exposes the following REST API endpoints:

- `GET /api/test` - Test connections to Slack and WordPress
- `GET /api/status` - Get current sync status and mappings
- `POST /api/sync` - Sync all threads from the channel
- `POST /api/sync/:threadTs` - Sync a specific thread by timestamp

### State Persistence

All thread-to-post mappings are stored in `state.json` in the following format:

```json
{
  "mappings": {
    "1234567890.123456": {
      "postId": 123,
      "title": "Post Title",
      "lastUpdated": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

This allows the application to:
- Track which threads have already been converted to posts
- Update existing posts when threads are updated
- Maintain sync history

## How It Works

1. **Scanning**: The application scans the configured Slack channel for threads (messages with replies)
2. **Formatting**: Each thread is formatted into a blog post:
   - The first message becomes the post title and main content
   - Replies are added as additional content sections
3. **Markdown Export**: Automatically exports threads to markdown files:
   - Main markdown file with complete thread content and images
   - AI summary template file with image placeholders (never overwritten)
4. **LLM Prompt Generation**: Creates AI-ready prompts from thread conversations
5. **Mapping**: Thread timestamps are mapped to WordPress post IDs in `state.json`
6. **Syncing**: 
   - New threads create new WordPress posts (as drafts)
   - Existing threads update their corresponding posts
7. **Persistence**: All mappings and LLM prompts are saved to ensure consistency across runs

## Using LLM Prompts

The application includes a powerful feature to generate prompts for AI assistants like ChatGPT or Claude.

### How to Use LLM Prompts

1. After syncing threads, navigate to the "Thread Mappings" section
2. Each mapped thread has a "🤖 View Prompt" button
3. Click the button to open a modal with the generated prompt
4. Click "📋 Copy to Clipboard" to copy the prompt
5. Open your preferred AI assistant (ChatGPT, Claude, etc.)
6. Paste the prompt and let the AI generate a polished blog post
7. Copy the AI-generated content and use it in your WordPress post

### What's in the Prompt?

Each LLM prompt includes:
- The complete thread conversation (original post + all replies)
- Clear formatting and structure
- Instructions for creating a professional blog post
- Guidelines for proper HTML formatting
- Suggestions for tone and style

The prompts are stored in `state.json` alongside your thread mappings for quick access.

## Using AI Summary Templates

The application automatically creates AI summary template files alongside the main thread markdown files.

### What are Summary Templates?

When threads are exported to markdown (in the `./data/posts` directory), two files are created for each thread:

1. **Main markdown file**: Contains the complete thread with all messages and images
   - Example: `1234567890-123456-thread-title.md`

2. **AI summary template**: A companion file for writing AI-generated summaries
   - Example: `1234567890-123456-thread-title-summary-template.md`

### Features of Summary Templates

- **Image Placeholders**: All images from the thread are included as markdown references
- **Never Overwritten**: Templates are created only once and never overwritten, preserving your edits
- **AI-Ready Structure**: Pre-formatted sections for adding summaries from AI tools like Gemini, ChatGPT, or Claude

### How to Use Summary Templates

1. After syncing threads, find the template files in `./data/posts/`
2. Open the `-summary-template.md` file
3. You have two options:
   - **Option A**: Copy the thread content and images to your AI tool (e.g., Gemini) and generate a summary
   - **Option B**: Write your own summary manually
4. Paste the summary into the template file's "Summary" section
5. The images are already referenced, so you can mention them in your summary
6. Use the completed template as a polished summary document or integrate it with the main markdown file

### Template Structure

```markdown
# AI Summary Template for: Thread Title

**Thread ID:** 1234567890.123456
**Date:** 2024-01-01
**Messages:** 5

---

## Summary

<!-- Add your AI-generated summary or write your own summary here -->

---

## Referenced Images

<!-- These images are from the thread. You can reference them in your summary above -->

![image-1.png](../images/1234567890-123456/image-1.png)

![image-2.jpg](../images/1234567890-123456/image-2.jpg)
```

### Template Persistence

- Templates are **never overwritten** - they are created only once
- If you sync the same thread again, the template file is skipped
- This allows you to edit and customize templates without losing your work
- To regenerate a template, simply delete it and sync again

## Development

### Project Structure

```
slack-2-wordpress/
├── src/
│   ├── index.js                 # Main Express server
│   └── modules/
│       ├── slackService.js      # Slack API integration
│       ├── wordpressService.js  # WordPress API integration
│       ├── stateManager.js      # JSON state persistence
│       └── syncService.js       # Orchestration logic
├── public/
│   └── index.html               # Web UI
├── .env.example                 # Environment template
├── .gitignore
├── package.json
└── README.md
```

### Running in Development Mode

```bash
npm run dev
```

## Troubleshooting

### Slack Connection Issues

- Verify your bot token is correct and starts with `xoxb-`
- Ensure the bot has been invited to the channel
- Check that all required scopes are enabled:
  - `app_mentions:read`
  - `channels:history`
  - `channels:read`
  - `files:read` (required for image downloads)
  - `users:read` (required for resolving user names)
- Verify the channel ID is correct
- After adding new scopes, reinstall the app to your workspace

### WordPress Connection Issues

- Ensure REST API is enabled (check `https://your-site.com/wp-json/`)
- Verify username and application password are correct
- Check that your WordPress user has permission to create posts
- Ensure WordPress URL doesn't have a trailing slash

### Posts Not Creating

- Check that the bot can read messages from the channel
- Verify there are threads (messages with replies) in the channel
- Check the console logs for detailed error messages
- Ensure WordPress is accessible from your network

## Security Notes

- Never commit your `.env` file to version control
- Use WordPress Application Passwords, not your main password
- Keep your Slack bot token secure
- The `state.json` file is excluded from git by default

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
