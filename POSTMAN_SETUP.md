# Postman Collection for WordPress REST API

This Postman collection contains all the WordPress REST API endpoints used by the Slack to WordPress sync application.

## ⚠️ Maintenance Note

**This collection must be kept in sync with `src/modules/wordpressService.js`**

When adding or modifying WordPress API calls in the codebase:
1. Update the corresponding request in this Postman collection
2. Add new endpoints if new API calls are introduced
3. Update request bodies if the payload structure changes
4. Update descriptions to reflect any changes

The collection should mirror all WordPress API interactions made by the application.

## Import the Collection

1. Open Postman
2. Click **Import** button
3. Select the file `WordPress_API.postman_collection.json`
4. The collection will appear in your Postman workspace

## Setup Variables

Before using the collection, you need to set up environment variables:

### Option 1: Collection Variables (Recommended)

1. Right-click on the collection → **Edit**
2. Go to the **Variables** tab
3. Set the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `wp_url` | Your WordPress site URL (no trailing slash) | `https://your-site.com` |
| `wp_username` | WordPress username | `admin` |
| `wp_app_password` | Application password (with spaces) | `xxxx xxxx xxxx xxxx xxxx xxxx` |
| `post_id` | Post ID for testing (optional) | `1` |

### Option 2: Environment Variables

1. Create a new Environment in Postman
2. Add the same variables as above
3. Select the environment before making requests

## Authentication

All requests use **Basic Authentication** with:
- **Username**: Your WordPress username
- **Password**: Your WordPress Application Password (not your regular password)

The collection is pre-configured to use the variables `{{wp_username}}` and `{{wp_app_password}}`.

## Available Endpoints

### Authentication & User Info

1. **Get Current User (Test Authentication)**
   - `GET /wp-json/wp/v2/users/me`
   - Tests authentication and returns current user info including roles

2. **Test Connection (List Posts)**
   - `GET /wp-json/wp/v2/posts?per_page=1`
   - Tests basic API access

### Posts

1. **Create Post**
   - `POST /wp-json/wp/v2/posts`
   - Creates a new draft post
   - Body: `{ "title": "...", "content": "...", "status": "draft" }`

2. **Get Post by ID**
   - `GET /wp-json/wp/v2/posts/{id}`
   - Retrieves a specific post

3. **Update Post**
   - `PUT /wp-json/wp/v2/posts/{id}`
   - Updates an existing post
   - Body: `{ "title": "...", "content": "..." }`

4. **Delete Post (Force)**
   - `DELETE /wp-json/wp/v2/posts/{id}?force=true`
   - Permanently deletes a post

## Testing Authentication

1. Set up your variables (see above)
2. Run **"Get Current User (Test Authentication)"**
3. If successful, you'll see your user info including:
   - Username
   - Roles
   - Capabilities
   - Email

## Common Issues

### 401 Unauthorized
- Check that your username is correct
- Verify the application password is correct (not your regular password)
- Ensure the application password hasn't been revoked
- Make sure the password includes spaces (format: `xxxx xxxx xxxx xxxx xxxx xxxx`)

### 403 Forbidden
- Your user doesn't have permission to perform the action
- Required roles: Administrator, Editor, or Author
- Update your user role in WordPress Admin → Users

### 404 Not Found
- Check that your WordPress URL is correct
- Verify REST API is enabled (should be enabled by default in WordPress 4.7+)
- Test by visiting: `https://your-site.com/wp-json/`

## Example Request Flow

1. **Test Authentication**: Run "Get Current User" to verify credentials
2. **Create Post**: Create a test post
3. **Get Post**: Retrieve the created post (note the ID)
4. **Update Post**: Update the post using the ID
5. **Delete Post**: Clean up by deleting the test post

## Notes

- All posts are created as **drafts** by default
- The collection uses Basic Auth with Application Passwords
- Application passwords are shown only once when created in WordPress
- Make sure to copy the password immediately when creating it

