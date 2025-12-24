# Slack Bot Permissions

This document lists all required Slack bot permissions for the Slack to WordPress sync application.

## Required Bot Token Scopes

The following scopes are **required** for the application to function:

### 1. `app_mentions:read`
- **Purpose**: View messages that directly mention @slack2wordpress in conversations that the app is in
- **Required**: Yes
- **Used for**: Detecting when the bot is mentioned (if implementing mention-based triggers in the future)

### 2. `channels:history`
- **Purpose**: View messages and other content in public channels that "slack2wordpress" has been added to
- **Required**: Yes
- **Used for**: Reading thread messages and replies from Slack channels

### 3. `channels:read`
- **Purpose**: View basic information about public channels in a workspace
- **Required**: Yes
- **Used for**: Listing available channels and validating channel access

### 4. `files:read`
- **Purpose**: View files shared in channels and conversations that "slack2wordpress" has been added to
- **Required**: Yes (for image downloads)
- **Used for**: Downloading images and files attached to Slack messages
- **Critical**: Without this permission, image downloads will fail with HTML error pages

### 5. `users:read`
- **Purpose**: View people in a workspace
- **Required**: Yes (for user name resolution)
- **Used for**: Resolving Slack user IDs (e.g., "U01EDD67F6C") to real names in markdown exports
- **Note**: Without this permission, markdown files will show user IDs instead of real names

## Optional Scopes

### `chat:write`
- **Purpose**: Send messages as the bot
- **Required**: No
- **Used for**: (Optional) Sending status messages or notifications

## How to Add Permissions

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Select your app
3. Navigate to **OAuth & Permissions** in the sidebar
4. Scroll to **Bot Token Scopes**
5. Click **Add an OAuth Scope**
6. Add each of the required scopes listed above
7. **Important**: After adding scopes, you must reinstall the app:
   - Scroll to the top of the OAuth & Permissions page
   - Click **Reinstall to Workspace** (or **Install to Workspace** if not yet installed)
   - Authorize the new permissions

## Verification

After adding permissions and reinstalling:

1. The bot should appear in your workspace
2. Invite the bot to your channel: `/invite @slack2wordpress`
3. Test the connection using the "Test Connections" button in the web interface
4. Verify that images can be downloaded (check the sync logs)

## Troubleshooting

### Images Not Downloading
- **Symptom**: Images are saved as HTML error pages instead of image files
- **Solution**: Ensure `files:read` scope is added and the app is reinstalled

### Channel Not Found
- **Symptom**: "channel_not_found" error
- **Solution**: 
  - Ensure `channels:read` and `channels:history` are enabled
  - Reinstall the app after adding scopes
  - Invite the bot to the channel

### Cannot Read Messages
- **Symptom**: Cannot fetch thread messages
- **Solution**: 
  - Verify `channels:history` is enabled
  - Ensure the bot is a member of the channel
  - Reinstall the app if scopes were recently added

## Current Configuration

As of the latest update, the application requires these exact scopes:
- ✅ `app_mentions:read`
- ✅ `channels:history`
- ✅ `channels:read`
- ✅ `files:read`
- ✅ `users:read`

Make sure all five are enabled for full functionality.

