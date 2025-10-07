# 🎉 Event Deployment Guide

## Overview

This guide explains how to deploy Pocket Parrot for event-based experiences where participants simply scan a QR code, open the URL, and start streaming sensor data with minimal setup.

## Quick Start for Events

### Option 1: URL Parameters (Recommended)

The simplest way to deploy for events is using URL parameters. No code changes needed!

**Example URL:**
```
https://your-site.com/pocket-parrot/?wsEndpoint=wss://your-server.com/event&autoEnable=true&eventMode=true&eventName=My%20Event
```

**URL Parameters:**
- `wsEndpoint` or `ws` - Your WebSocket server URL
- `autoEnable` - Set to `true` to auto-connect (default: false)
- `eventMode` - Set to `true` to hide Settings and simplify UI (default: false)
- `autoStart` - Set to `true` to auto-start capture after permissions (default: false)
- `eventName` or `event` - Display name for your event

**Complete Event URL:**
```
https://your-site.com/pocket-parrot/?ws=wss://event-server.com/stream&autoEnable=true&eventMode=true&eventName=Tech%20Conference%202024&autoStart=true
```

### Option 2: Configuration File

For permanent deployments, edit `config.js`:

```javascript
const PocketParrotConfig = {
    // Your WebSocket server URL
    WEBSOCKET_ENDPOINT: 'wss://your-server.com/pocket-parrot',
    
    // Auto-connect on load
    AUTO_ENABLE_WEBSOCKET: true,
    
    // Hide Settings button (event mode)
    EVENT_MODE: true,
    
    // Auto-start capture after permissions
    AUTO_START_CAPTURE: true,
    
    // Capture interval (milliseconds)
    CAPTURE_INTERVAL: 5000,
    
    // Show welcome message
    SHOW_WELCOME_MESSAGE: true,
    WELCOME_MESSAGE: 'Welcome! Click "Start Event" to begin.',
    
    // Event name
    EVENT_NAME: 'My Awesome Event'
};
```

---

## Complete Event Setup

### Step 1: Deploy WebSocket Server

Use the provided `multi-user-server.js`:

```bash
# On your server
node multi-user-server.js 8080
```

**For production**, use PM2 or systemd:
```bash
pm2 start multi-user-server.js --name pocket-parrot-event
```

**Important:** Ensure your server has a public IP or domain and the port is accessible.

### Step 2: Configure SSL (Recommended for Cellular)

For users on cellular data, use **WSS** (secure WebSocket):

**Using nginx:**
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /pocket-parrot {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Step 3: Deploy Pocket Parrot Frontend

**Option A: GitHub Pages**
1. Fork/clone this repository
2. Edit `config.js` with your settings (or use URL parameters)
3. Enable GitHub Pages in repository settings
4. Your URL: `https://username.github.io/pocket-parrot/`

**Option B: Your Own Server**
1. Upload all files to your web server
2. Edit `config.js` with your settings
3. Ensure HTTPS is enabled
4. Your URL: `https://your-domain.com/pocket-parrot/`

**Option C: Netlify/Vercel (One-Click)**
1. Connect your repository
2. No build command needed!
3. Set environment-specific config in `config.js`
4. Deploy

### Step 4: Create Event URL

Build your event URL with parameters:

```javascript
// Base URL
const baseUrl = 'https://your-site.com/pocket-parrot/';

// WebSocket endpoint (use wss:// for cellular compatibility)
const wsEndpoint = 'wss://your-server.com/event';

// Event details
const eventName = 'Tech Conference 2024';

// Build URL
const eventUrl = `${baseUrl}?ws=${encodeURIComponent(wsEndpoint)}&autoEnable=true&eventMode=true&eventName=${encodeURIComponent(eventName)}&autoStart=true`;

console.log(eventUrl);
```

Result:
https://your-site.com/pocket-parrot/?ws=wss%3A%2F%2Fyour-server.com%2Fevent&autoEnable=true&eventMode=true&eventName=Tech%20Conference%202024&autoStart=true


```javascript
// Base URL
const baseUrl = 'https://jonmccon.github.io/pocket-parrot/';

// WebSocket endpoint (use wss:// for cellular compatibility)
const wsEndpoint = 'wss://pocket-parrot-server-dbba4de2cef6.herokuapp.com/event';

// Event details
const eventName = 'SeaAiCon';

// Build URL
const eventUrl = `${baseUrl}?ws=${encodeURIComponent(wsEndpoint)}&autoEnable=true&eventMode=true&eventName=${encodeURIComponent(eventName)}&autoStart=true`;

console.log(eventUrl);
```


### Step 5: Generate QR Code

Use a QR code generator:
- **Online:** https://www.qr-code-generator.com/
- **CLI:** `qrencode -o event-qr.png "https://your-url..."`
- **Node.js:** `npm install qrcode` then:

```javascript
const QRCode = require('qrcode');
const eventUrl = 'https://your-site.com/pocket-parrot/?ws=...';

QRCode.toFile('event-qr.png', eventUrl, {
    width: 500,
    errorCorrectionLevel: 'H'
}, (err) => {
    if (err) throw err;
    console.log('QR code saved!');
});
```

### Step 6: Share with Participants

**Print materials:**
- Print QR codes on posters, name badges, or flyers
- Add instructions: "Scan to join the event"

**Digital sharing:**
- Send URL via email or messaging apps
- Share in event app or website
- Display QR code on screens/projectors

---

## User Experience Flow

When participants scan the QR code:

1. **Opens browser** - URL opens in their default browser
2. **Shows welcome** - "Welcome to [Event Name]!"
3. **Clicks "Let's Go!"** - Dismisses welcome message
4. **Clicks "Request Permissions"** - Grants location, camera, mic access
5. **Clicks "Capture Sensor Data"** - Starts streaming automatically
6. **That's it!** - Data flows to your server

**No manual configuration needed!** ✨

---

## Event Scenarios

### Scenario 1: Conference Tracking

**Use Case:** Track attendee movement and environmental conditions

**Setup:**
```
?ws=wss://conference.com/tracking&autoEnable=true&eventMode=true&eventName=Tech%20Conf%202024
```

**Server Processing:**
- Store GPS locations every 5 seconds
- Create heat maps of high-traffic areas
- Monitor temperature/humidity in rooms
- Analyze crowd density

### Scenario 2: Sports Event

**Use Case:** Capture athlete/spectator perspectives

**Setup:**
```
?ws=wss://sports-event.com/stream&autoEnable=true&eventMode=true&eventName=Marathon%202024&autoStart=true
```

**Server Processing:**
- Real-time location tracking
- Speed and acceleration data
- Photo capture at checkpoints
- Live dashboard for organizers

### Scenario 3: Research Study

**Use Case:** Collect sensor data for research

**Setup:**
```
?ws=wss://research.uni.edu/study&autoEnable=true&eventMode=true&eventName=Mobility%20Study
```

**Server Processing:**
- Anonymize user data
- Store in research database
- Generate participant IDs
- Export for analysis

### Scenario 4: Scavenger Hunt

**Use Case:** Interactive game with location tracking

**Setup:**
```
?ws=wss://hunt.com/game&autoEnable=true&eventMode=true&eventName=City%20Hunt&autoStart=true
```

**Server Processing:**
- Verify participants reach checkpoints (GPS)
- Detect objects at locations (object detection)
- Track time and distance
- Leaderboard updates

---

## Network Considerations

### WiFi Events

**Advantages:**
- Higher bandwidth
- More stable connections
- Lower latency

**Setup:**
- Use `ws://` (non-secure) if on local network
- Provide WiFi credentials to participants
- Server can be on local network

**Example:**
```
?ws=ws://192.168.1.100:8080/event&autoEnable=true&eventMode=true
```

### Cellular Data Events

**Advantages:**
- Works anywhere
- No WiFi setup needed
- Participants use own data

**Requirements:**
- **Must use WSS (secure WebSocket)**
- Server must have SSL certificate
- Public domain or IP

**Example:**
```
?ws=wss://events.yourdomain.com/pocket-parrot&autoEnable=true&eventMode=true
```

**Data Usage:**
- Without media: ~50KB per capture
- With photos: ~500KB-2MB per capture
- With audio: Additional ~200KB-1MB

**Tip:** Disable media for cellular to reduce data:
```javascript
// In config.js or modify app.js
CAPTURE_INTERVAL: 10000,  // Capture every 10 seconds instead of 5
```

---

## Advanced Configuration

### Custom Branding

Edit `index.html` and `config.js` to customize:

**Logo:**
```html
<!-- Replace emoji in <h1> -->
<h1 class="text-xl font-bold">🎯 Your Event Logo</h1>
```

**Colors:**
```html
<script>
tailwind.config = {
    theme: {
        extend: {
            colors: {
                primary: '#your-color',
                secondary: '#your-color'
            }
        }
    }
}
</script>
```

**Welcome Message:**
```javascript
WELCOME_MESSAGE: 'Welcome to [Your Event]! Follow these steps:\n1. Click "Request Permissions"\n2. Grant location and sensor access\n3. Click "Capture Sensor Data"\n4. Enjoy the event!'
```

### Rate Limiting

Prevent server overload:

**In `multi-user-server.js`:**
```javascript
const MAX_MESSAGES_PER_MINUTE = 50;
const rateLimits = new Map();

function checkRateLimit(clientId) {
    const now = Date.now();
    const limit = rateLimits.get(clientId) || { count: 0, reset: now + 60000 };
    
    if (now > limit.reset) {
        limit.count = 0;
        limit.reset = now + 60000;
    }
    
    limit.count++;
    rateLimits.set(clientId, limit);
    
    if (limit.count > MAX_MESSAGES_PER_MINUTE) {
        return false; // Rate limit exceeded
    }
    
    return true;
}
```

### User Authentication (Optional)

Add participant IDs:

**URL parameter:**
```
?ws=wss://server.com/event&autoEnable=true&userId=participant123
```

**In app.js, modify handshake:**
```javascript
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('userId');

// Include in handshake
ws.send(JSON.stringify({
    type: 'handshake',
    client: 'PocketParrot',
    version: '1.0',
    userId: userId || 'anonymous'
}));
```

---

## Testing Before Event

### Test Locally (WiFi)

1. Start server: `node multi-user-server.js 8080`
2. Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
3. Create test URL: `http://YOUR_IP:8080/pocket-parrot/?ws=ws://YOUR_IP:8080&autoEnable=true&eventMode=true`
4. Open on multiple phones on same WiFi
5. Verify data appears in server console

### Test Production (Cellular)

1. Deploy server with SSL
2. Deploy frontend to HTTPS host
3. Create production URL with `wss://`
4. Test on phone with WiFi **disabled**
5. Verify cellular connection works

### Load Testing

Test with expected number of participants:

```bash
# Install wscat
npm install -g wscat

# Simulate 10 users
for i in {1..10}; do
    wscat -c wss://your-server.com/event &
done
```

---

## Monitoring During Event

### Server Dashboard

The `multi-user-server.js` logs:
- Connected users count
- Data received per user
- Connection/disconnection events
- Errors and issues

### Check Server Health

```bash
# View running processes
pm2 status

# View logs
pm2 logs pocket-parrot-event

# Monitor resource usage
htop
```

### Database Check (if storing data)

```javascript
// MongoDB example
db.sensor_data.count({ timestamp: { $gte: new Date(Date.now() - 3600000) } })
// Returns count of records in last hour
```

---

## Troubleshooting

### Issue: Participants Can't Connect

**Symptoms:** WebSocket status shows "Disabled" or "Connection failed"

**Solutions:**
1. Verify server is running: `pm2 status`
2. Check firewall allows port
3. Verify WSS is used for cellular (not WS)
4. Test URL manually in browser
5. Check server logs for errors

### Issue: High Data Usage

**Symptoms:** Participants complaining about mobile data usage

**Solutions:**
1. Increase capture interval: `CAPTURE_INTERVAL: 10000`
2. Disable media capture for event
3. Use WiFi instead of cellular
4. Reduce image quality if needed

### Issue: Some Users Not Streaming

**Symptoms:** Not all participants appear in server logs

**Solutions:**
1. Check they clicked "Request Permissions"
2. Verify they granted all permissions
3. Check they clicked "Capture Sensor Data"
4. Look for browser console errors
5. Ensure cellular data is enabled
6. Try refreshing the page

### Issue: Server Overloaded

**Symptoms:** Slow responses, timeouts, crashes

**Solutions:**
1. Implement rate limiting (see above)
2. Increase server resources
3. Use load balancer for >100 users
4. Reduce capture frequency
5. Disable media if not needed

---

## Post-Event

### Data Export

**From MongoDB:**
```javascript
mongoexport --db=pocket_parrot --collection=sensor_data --out=event_data.json
```

**From PostgreSQL:**
```sql
COPY sensor_data TO '/path/event_data.csv' CSV HEADER;
```

### Analysis

Example Python analysis:

```python
import json
import pandas as pd
import matplotlib.pyplot as plt

# Load data
with open('event_data.json') as f:
    data = json.load(f)

# Convert to DataFrame
df = pd.DataFrame(data)

# Plot user locations
plt.scatter(df['gps.longitude'], df['gps.latitude'])
plt.title('Event Participant Locations')
plt.xlabel('Longitude')
plt.ylabel('Latitude')
plt.savefig('event_heatmap.png')
```

### Cleanup

```bash
# Stop server
pm2 stop pocket-parrot-event

# Remove if no longer needed
pm2 delete pocket-parrot-event

# Archive data
tar -czf event_data.tar.gz event_data.json
```

---

## Security Best Practices

1. **Use HTTPS/WSS** for all production deployments
2. **Rate limit** server connections
3. **Validate input** on server side
4. **Sanitize data** before storing
5. **Use authentication** for sensitive events
6. **Anonymize data** if required
7. **Comply with GDPR/privacy laws**
8. **Inform participants** about data collection
9. **Secure your server** (firewall, updates)
10. **Backup data** regularly

---

## Example: Complete Event Setup

Here's a complete example for a conference:

### 1. Server Setup
```bash
# On server: server.conf2024.com
ssh user@server.conf2024.com
cd /opt/pocket-parrot
node multi-user-server.js 443
pm2 start multi-user-server.js --name conf2024
```

### 2. Frontend Config
```javascript
// config.js
const PocketParrotConfig = {
    WEBSOCKET_ENDPOINT: 'wss://server.conf2024.com/pocket-parrot',
    AUTO_ENABLE_WEBSOCKET: true,
    EVENT_MODE: true,
    AUTO_START_CAPTURE: true,
    CAPTURE_INTERVAL: 10000,
    SHOW_WELCOME_MESSAGE: true,
    WELCOME_MESSAGE: 'Welcome to Tech Conference 2024! Your location and sensor data will help us improve the event experience.',
    EVENT_NAME: 'Tech Conference 2024'
};
```

### 3. Deploy Frontend
```bash
# Deploy to GitHub Pages
git add .
git commit -m "Configure for Tech Conference 2024"
git push origin main
```

### 4. Create QR Code
```bash
node generate-qr.js "https://username.github.io/pocket-parrot/"
```

### 5. Print & Distribute
- Print 100 copies of QR code
- Display on registration desk
- Include in welcome packet
- Show on event screens

### 6. Monitor During Event
```bash
pm2 logs conf2024
# Watch for connections and data
```

---

## Success Metrics

Track these during your event:

- **Connection rate:** % of participants who connect successfully
- **Active users:** Number of concurrent connections
- **Data points:** Total sensor readings captured
- **Uptime:** Server availability during event
- **Error rate:** % of failed captures or disconnections

---

## Support

For issues or questions:
- Check server logs first
- Review browser console for errors
- Test with a single device to isolate issues
- Verify network connectivity
- Check this guide's troubleshooting section

---

**You're ready to deploy Pocket Parrot for your event! 🎉🦜**
