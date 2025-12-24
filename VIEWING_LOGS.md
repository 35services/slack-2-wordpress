# Viewing Application Logs

This guide explains how to view logs for the Slack to WordPress sync application.

## Using Docker (Recommended)

### View Logs in Real-Time

```bash
# Follow logs (updates automatically)
docker-compose logs -f

# Follow logs with timestamps
docker-compose logs -f -t

# Follow logs for specific service
docker-compose logs -f slack-to-wordpress
```

### View Recent Logs

```bash
# Last 100 lines
docker-compose logs --tail=100

# Last 50 lines with timestamps
docker-compose logs --tail=50 -t

# Last 200 lines, then follow
docker-compose logs --tail=200 -f
```

### View Logs for Specific Time Period

```bash
# Logs since a specific time
docker-compose logs --since 10m    # Last 10 minutes
docker-compose logs --since 1h    # Last hour
docker-compose logs --since 2024-01-01T00:00:00
```

### Save Logs to File

```bash
# Save logs to file
docker-compose logs > logs.txt

# Save with timestamps
docker-compose logs -t > logs-with-timestamps.txt

# Append to existing file
docker-compose logs >> logs.txt
```

## Using Node.js (Direct)

If running with `npm start`, logs appear directly in the terminal where you started the application.

### Redirect Logs to File

```bash
# Save logs to file
npm start > logs.txt 2>&1

# View logs in terminal AND save to file
npm start | tee logs.txt
```

## What to Look For in Logs

### Successful Operations
- `Found X threads in channel` - Threads discovered
- `Downloaded image: filename.jpg` - Image download successful
- `Thread X synced: Post Title` - WordPress sync successful
- `Markdown export complete: X files exported` - Markdown files created

### Errors to Watch For
- `Error downloading image` - Image download failed
- `WordPress authentication failed` - WordPress credentials issue
- `Channel not found` - Slack channel access problem
- `Received HTML error page instead of image` - File download permission issue

### Debug Information
- `WordPress service initialized for: URL` - WordPress connection setup
- `Password length: X characters` - Application password format check
- `Testing WordPress authentication...` - Authentication process
- `WordPress authentication successful! User: username` - Successful login

## Common Log Commands

```bash
# Watch logs while syncing
docker-compose logs -f | grep -E "(Error|Downloaded|synced|image)"

# Find all errors
docker-compose logs | grep -i error

# Find image download issues
docker-compose logs | grep -i "image\|download"

# Find WordPress errors
docker-compose logs | grep -i "wordpress\|401\|403"

# Clear screen and follow logs
clear && docker-compose logs -f
```

## Log Levels

The application logs:
- **Info**: Normal operations (sync progress, file downloads)
- **Warn**: Non-critical issues (missing optional data)
- **Error**: Failures (authentication, download errors)

## Troubleshooting with Logs

1. **Start the application**:
   ```bash
   docker-compose up -d
   ```

2. **Follow logs in real-time**:
   ```bash
   docker-compose logs -f
   ```

3. **Trigger a sync** from the web interface

4. **Watch for errors** in the logs

5. **Check specific errors**:
   ```bash
   docker-compose logs | grep -i "error\|failed"
   ```

## Tips

- Use `-f` flag to follow logs in real-time (like `tail -f`)
- Use `-t` flag to see timestamps for each log line
- Combine with `grep` to filter for specific information
- Save logs to file for later analysis or sharing

