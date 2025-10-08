# Deploying Multi-User Server to Heroku

This guide explains how to deploy the Pocket Parrot multi-user WebSocket server to Heroku.

## Prerequisites

1. **Heroku Account** - Sign up at https://heroku.com
2. **Heroku CLI** - Install from https://devcenter.heroku.com/articles/heroku-cli
3. **Git** - Ensure git is installed

## Quick Deployment

### Step 1: Prepare Your Project

Create a new directory for the server:

```bash
mkdir pocket-parrot-server
cd pocket-parrot-server
```

Copy the server file:

```bash
# Copy from your pocket-parrot repository
cp /path/to/pocket-parrot/multi-user-server.js .
```

### Step 2: Create package.json

Create `package.json` in your server directory:

```json
{
  "name": "pocket-parrot-server",
  "version": "1.0.0",
  "description": "WebSocket server for Pocket Parrot events",
  "main": "multi-user-server.js",
  "scripts": {
    "start": "node multi-user-server.js"
  },
  "engines": {
    "node": "18.x"
  },
  "dependencies": {
    "ws": "^8.14.0"
  },
  "keywords": ["websocket", "sensor-data", "pocket-parrot"],
  "author": "",
  "license": "MIT"
}
```

### Step 3: Create Procfile

Create a file named `Procfile` (no extension):

```
web: node multi-user-server.js
```

### Step 4: Update Server for Heroku

Modify `multi-user-server.js` to use Heroku's PORT environment variable:

```javascript
// Change this line:
const port = process.argv[2] || 8080;

// To this:
const port = process.env.PORT || process.argv[2] || 8080;
```

### Step 5: Initialize Git Repository

```bash
git init
git add .
git commit -m "Initial commit - Pocket Parrot WebSocket server"
```

### Step 6: Create Heroku App

```bash
# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-app-name

# Or let Heroku generate a name
heroku create
```

Note the app URL (e.g., `https://your-app-name.herokuapp.com`)

### Step 7: Deploy to Heroku

```bash
git push heroku main
git subtree push --prefix backend heroku main
```

### Step 8: Verify Deployment

```bash
# Check logs
heroku logs --tail

# Check app status
heroku ps
```

You should see output like:
```
🦜 Multi-User Pocket Parrot WebSocket Server
==================================================
📡 Listening on port 12345
```

### Step 9: Get Your WebSocket URL

Your WebSocket URL will be:

```
wss://your-app-name.herokuapp.com/pocket-parrot
```

For dashboard:
```
wss://your-app-name.herokuapp.com/dashboard
```

**Note:** Heroku automatically provides HTTPS/WSS, so use `wss://` not `ws://`.

## Configuration

### Environment Variables

Set environment variables in Heroku:

```bash
# Set max users (optional, default is 25)
heroku config:set MAX_USERS=50

# View all config
heroku config
```

### Scaling

Heroku free tier limits:
- 1 web dyno
- Sleeps after 30 minutes of inactivity
- 550 free dyno hours per month

For production events, upgrade to a paid dyno:

```bash
# Upgrade to Hobby dyno ($7/month - no sleep)
heroku ps:scale web=1:hobby

# Upgrade to Standard dyno ($25/month - better performance)
heroku ps:scale web=1:standard-1x
```

## Event URL Configuration

Once deployed, create your event URL:

```
https://your-frontend.github.io/pocket-parrot/event.html?ws=wss://your-app-name.herokuapp.com/pocket-parrot&autoEnable=true&eventMode=true&eventName=My%20Event
```

Or with custom config:

```
https://your-frontend.com/event.html?ws=wss://your-app-name.herokuapp.com/pocket-parrot&autoEnable=true&eventMode=true&eventName=Conference%202024
```

## Monitoring

### View Logs

```bash
# Real-time logs
heroku logs --tail

# Last 500 lines
heroku logs -n 500

# Filter for errors
heroku logs --tail | grep ERROR
```

### Dashboard Access

Open the dashboard in your browser:

```
https://your-dashboard-host.com/dashboard.html?server=wss://your-app-name.herokuapp.com/dashboard
```

### Heroku Metrics

View metrics in Heroku dashboard:

```bash
# Open metrics page
heroku metrics --app your-app-name
```

## Troubleshooting

### Issue: App Sleeps (Free Tier)

**Problem:** Free dynos sleep after 30 minutes of inactivity.

**Solution:** 
- Upgrade to Hobby dyno ($7/month)
- Or use a service like UptimeRobot to ping your app every 25 minutes

### Issue: WebSocket Connection Failed

**Problem:** Cannot connect to WebSocket

**Checklist:**
1. Verify app is running: `heroku ps`
2. Check logs: `heroku logs --tail`
3. Ensure using `wss://` not `ws://`
4. Verify URL path includes `/pocket-parrot`
5. Check firewall/network settings

### Issue: Out of Memory

**Problem:** App crashes with R14 (Memory quota exceeded)

**Solution:**
```bash
# Upgrade to larger dyno
heroku ps:scale web=1:standard-1x
```

### Issue: Too Many Connections

**Problem:** Reaching the 25-user limit frequently

**Solution:** Edit `multi-user-server.js` and increase MAX_USERS, then redeploy:

```javascript
const MAX_USERS = 50; // Increase limit
```

Then commit and push:
```bash
git add multi-user-server.js
git commit -m "Increase user limit to 50"
git push heroku main
```

## Cost Estimate

### Free Tier
- **Cost:** $0/month
- **Limits:** 550 dyno hours, sleeps after 30 min inactivity
- **Best for:** Testing, small events (<10 users)

### Hobby Tier ($7/month)
- **Cost:** $7/month per dyno
- **Limits:** No sleep, 512MB RAM
- **Best for:** Small to medium events (25-50 users)

### Standard Tier ($25-50/month)
- **Cost:** $25+/month per dyno
- **Limits:** No sleep, 512MB-2.5GB RAM, better performance
- **Best for:** Large events (50+ users)

## Alternative: Use ngrok for Local Development

For testing without deploying to Heroku:

```bash
# Install ngrok
npm install -g ngrok

# Run your server locally
node multi-user-server.js 8080

# In another terminal, expose it
ngrok http 8080

# Use the ngrok URL (e.g., https://abc123.ngrok.io)
```

Your WebSocket URL will be:
```
wss://abc123.ngrok.io/pocket-parrot
```

## Security Considerations

1. **Rate Limiting:** Server implements 25-user limit by default
2. **HTTPS/WSS:** Heroku provides SSL automatically
3. **No Authentication:** Current implementation has no auth - add if needed
4. **Data Privacy:** Data is not stored by default - configure as needed

## Adding Authentication (Optional)

To add basic token authentication, modify `multi-user-server.js`:

```javascript
wss.on('connection', (ws, req) => {
  const pathname = url.parse(req.url).pathname;
  const query = url.parse(req.url, true).query;
  
  // Check for auth token
  const token = query.token;
  if (!token || token !== process.env.AUTH_TOKEN) {
    ws.close(1008, 'Authentication required');
    return;
  }
  
  // Continue with normal connection handling...
});
```

Set the token:
```bash
heroku config:set AUTH_TOKEN=your-secret-token-here
```

Update your event URL:
```
?ws=wss://your-app.herokuapp.com/pocket-parrot?token=your-secret-token-here
```

## Database Integration (Optional)

To store data persistently, add a database:

```bash
# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Get database URL
heroku config:get DATABASE_URL
```

Install pg package:
```bash
npm install pg --save
git add package.json package-lock.json
git commit -m "Add PostgreSQL dependency"
git push heroku main
```

Update `ingestData()` function to store in database.

## Support

For issues:
- **Heroku Status:** https://status.heroku.com
- **Heroku Support:** https://help.heroku.com
- **Server Logs:** `heroku logs --tail`
- **Pocket Parrot Docs:** See repository README

## Complete Deployment Checklist

- [ ] Create Heroku account
- [ ] Install Heroku CLI
- [ ] Create `package.json` with dependencies
- [ ] Create `Procfile`
- [ ] Update server to use `process.env.PORT`
- [ ] Initialize git repository
- [ ] Create Heroku app
- [ ] Deploy: `git push heroku main`
- [ ] Verify: `heroku logs --tail`
- [ ] Get WebSocket URL (wss://...)
- [ ] Test connection with dashboard
- [ ] Create event URL with WebSocket endpoint
- [ ] Generate QR code for event
- [ ] Test with at least 2 phones
- [ ] Monitor during event

---

**You're ready to deploy!** 🚀🦜
