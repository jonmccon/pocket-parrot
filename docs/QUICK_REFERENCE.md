# 🎯 Quick Reference: Event Setup

## One-Page Guide for Event Organizers

### 1️⃣ Deploy WebSocket Server
```bash
node multi-user-server.js 8080
```
**Tip:** Use `pm2` for production: `pm2 start multi-user-server.js --name event`

### 2️⃣ Build Event URL

**Template:**
```
https://your-site.com/pocket-parrot/?ws=wss://your-server.com/event&autoEnable=true&eventMode=true&eventName=YOUR_EVENT_NAME
```

**Parameters:**
- `ws` - Your WebSocket server URL (use **wss://** for cellular)
- `autoEnable=true` - Auto-connect on load
- `eventMode=true` - Hide Settings, simplified UI
- `eventName` - Your event name (URL encode spaces as `%20`)

**Example:**
```
https://mysite.com/pocket-parrot/?ws=wss://server.com/event&autoEnable=true&eventMode=true&eventName=Tech%20Conference%202024
```

### 3️⃣ Generate QR Code

**Quick Online:** https://www.qr-code-generator.com/
1. Paste your URL
2. Download PNG
3. Print!

**CLI Tool:**
```bash
node generate-event-qr.js
# Follow prompts
```

### 4️⃣ Share with Participants

- Print QR codes on name badges, posters, or flyers
- Email the URL directly
- Display on screens/projectors
- Include in event app

### 5️⃣ Participant Instructions

**Simple 3-Step Process:**
1. Scan QR code (or open URL)
2. Click "Request Permissions" → Grant access
3. Click "Capture Sensor Data" → Done!

Data automatically streams to your server. No configuration needed!

---

## URL Parameters Reference

| Parameter | Values | Purpose |
|-----------|--------|---------|
| `ws` or `wsEndpoint` | `wss://server.com/event` | WebSocket server URL |
| `autoEnable` | `true`/`false` | Auto-connect to server |
| `eventMode` | `true`/`false` | Hide Settings button |
| `autoStart` | `true`/`false` | Auto-start capture after permissions |
| `eventName` or `event` | `Your Event` | Event display name |

---

## Network Setup

### WiFi Events (Local Network)
```
?ws=ws://192.168.1.100:8080/event&autoEnable=true&eventMode=true
```
- Provide WiFi credentials to participants
- Server can be on local network
- Higher bandwidth, more stable

### Cellular Data Events (Anywhere)
```
?ws=wss://your-domain.com/event&autoEnable=true&eventMode=true
```
- **Must use WSS (secure WebSocket)**
- Requires SSL certificate on server
- Works anywhere with cell signal
- Participants use own data

---

## Quick Troubleshooting

**Issue: Can't connect**
- ✅ Server is running: `pm2 status`
- ✅ Using WSS for cellular (not WS)
- ✅ Port is open in firewall

**Issue: Not streaming**
- ✅ Clicked "Request Permissions"
- ✅ Granted all permissions
- ✅ Clicked "Capture Sensor Data"

**Issue: High data usage**
- ✅ Increase capture interval
- ✅ Use WiFi instead of cellular
- ✅ Disable camera/audio capture

---

## Server-Side Data Processing

**Basic Example:**
```javascript
function ingestData(userId, sensorData) {
  // Store in database
  db.collection('sensor_data').insert({
    userId: userId,
    timestamp: sensorData.timestamp,
    gps: sensorData.gps,
    // ... other fields
  });
  
  // Or forward to API
  axios.post('https://your-api.com/ingest', {
    userId: userId,
    data: sensorData
  });
}
```

---

## Common Use Cases

### Conference Tracking
Track attendee movement, environmental conditions, and high-traffic areas.

### Sports Events
Real-time location tracking, speed data, and photo capture at checkpoints.

### Research Studies
Collect sensor data with participant consent for academic research.

### Scavenger Hunts
Location-based games with checkpoint verification and leaderboards.

---

## Data Usage Estimates

**Without Media:**
- ~50KB per capture
- 12 captures/minute = ~600KB/hour
- 10 users × 2 hours = ~12MB total

**With Photos:**
- ~500KB-2MB per capture
- Recommend WiFi for photo-heavy events

---

## Pre-Event Checklist

- [ ] Server deployed and running
- [ ] SSL certificate configured (for cellular)
- [ ] Event URL created and tested
- [ ] QR codes generated and printed
- [ ] Test with 2-3 devices
- [ ] Monitor server logs
- [ ] Have backup plan (WiFi credentials)

---

## During Event Monitoring

```bash
# View connected users
pm2 logs event

# Check server status
pm2 status

# Monitor resource usage
htop
```

---

## Full Documentation

- **[EVENT_DEPLOYMENT_GUIDE.md](EVENT_DEPLOYMENT_GUIDE.md)** - Complete guide
- **[MULTI_USER_GUIDE.md](MULTI_USER_GUIDE.md)** - Server setup
- **[DATA_ACCESS_API.md](DATA_ACCESS_API.md)** - API reference

---

**Ready to deploy? Your event participants will love the seamless experience!** 🚀🦜
