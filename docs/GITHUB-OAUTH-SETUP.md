# GitHub OAuth Setup Guide

## Overview

GitHub OAuth authentication has been configured for the MCP Demo application.

## Configuration

### Current Settings (wrangler.toml)

```toml
[vars]
REQUIRE_AUTH = "true"
GITHUB_CLIENT_ID = "Ov23lifWJUKyL5kMFIsg"
ALLOWED_USERS = "cheapredwine"
```

### GitHub OAuth App

**App Name**: MCP Demo  
**Client ID**: Ov23lifWJUKyL5kMFIsg  
**Callback URL**: https://mcp-demo.jsherron.com/auth/callback

## Required Secret

The `GITHUB_CLIENT_SECRET` must be set as an encrypted secret. **DO NOT commit this to git.**

## Setting the Secret

### Option 1: GitHub Actions (Recommended)

1. Go to: https://github.com/cheapredwine/mcp-demo-cloudflare/settings/secrets/actions
2. Click **New repository secret**
3. Name: `GITHUB_CLIENT_SECRET`
4. Value: `eb7efbce69e9941fa585a4290c909bcf975b340f`
5. Click **Add secret**

The GitHub Actions workflow will automatically use this secret during deployment.

### Option 2: Wrangler CLI

```bash
cd packages/ai-orchestrator
wrangler secret put GITHUB_CLIENT_SECRET
# Enter: eb7efbce69e9941fa585a4290c909bcf975b340f
```

### Option 3: Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com/
2. Navigate to **Workers & Pages** → **mcp-demo-ai-orchestrator**
3. Click **Settings** → **Variables and Secrets**
4. Add secret:
   - Name: `GITHUB_CLIENT_SECRET`
   - Value: `eb7efbce69e9941fa585a4290c909bcf975b340f`
   - Mark as: **Encrypted**

## Authentication Flow

1. User visits https://mcp-demo.jsherron.com
2. If not logged in, shows "Login with GitHub" button
3. User clicks button → Redirected to GitHub OAuth
4. User authorizes the app on GitHub
5. GitHub redirects to `/auth/callback`
6. App exchanges code for access token
7. App fetches user info from GitHub API
8. If user is in `ALLOWED_USERS` list, create session
9. Set session cookie and redirect to app
10. User is now authenticated!

## Logout

Users can logout by visiting: https://mcp-demo.jsherron.com/auth/logout

## Security Notes

- Sessions are stored in KV namespace `mcp-demo` (7-day expiration)
- Session cookies are HttpOnly, Secure, and SameSite=Lax
- Only users in `ALLOWED_USERS` can access the app
- Client Secret is never exposed to the client

## Troubleshooting

### "OAuth error: Failed to exchange code"

- Check that `GITHUB_CLIENT_SECRET` is set correctly
- Verify the callback URL matches exactly in GitHub app settings

### "Access denied. User is not authorized."

- Make sure the GitHub username is in the `ALLOWED_USERS` list
- Usernames are case-insensitive

### Session not persisting

- Check that the KV namespace `SESSIONS` is bound correctly
- Verify KV namespace ID is correct in wrangler.toml

## Test Credentials

**Allowed User**: cheapredwine  
**App URL**: https://mcp-demo.jsherron.com

## Rollback

To disable authentication:

1. Edit `wrangler.toml`:
   ```toml
   [vars]
   REQUIRE_AUTH = "false"
   ```

2. Commit and push, or redeploy:
   ```bash
   wrangler deploy
   ```
