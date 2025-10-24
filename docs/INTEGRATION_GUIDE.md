# 🦜 Pocket Parrot Data Access - Quick Start Guide

## Overview

This guide will help you quickly integrate with Pocket Parrot's data access API to consume sensor data in your own applications.

> **📱 Multi-User Streaming:** For instructions on setting up multiple phones to stream to one server, see [MULTI_USER_GUIDE.md](MULTI_USER_GUIDE.md)

## Choose Your Integration Method

### 1. JavaScript API (Same-Origin)
**Best for:** Browser-based dashboards, analytics tools, custom UIs

**Setup Time:** 2 minutes

**Steps:**
1. Open Pocket Parrot in your browser
2. In your application, access the global API:
```javascript
const api = window.pocketParrotAPI;
```
3. Start using the API immediately

**Example:**
```javascript
// Subscribe to real-time updates
api.subscribe((dataPoint) => {
  console.log('New data:', dataPoint);
  updateYourDashboard(dataPoint);
});

// Query historical data
const data = await api.getAllData({ limit: 100 });
```

### 2. WebSocket Push (Remote Server)
**Best for:** Cloud storage, data pipelines, remote monitoring

**Setup Time:** 5 minutes

**Choose Your Endpoint:**

**Option A: General Listener** (simplest, good for getting started)
- Endpoint: `ws://your-server.com:8080/listener`
- Receives all sensor data immediately
- No session management complexity

**Option B: Low-Latency Orientation** (for 3D/AR/VR apps)
- Endpoint: `ws://your-server.com:8080/orientation`
- Receives only orientation data (alpha, beta, gamma)
- < 1ms latency, supports high frequency (10-60 Hz)
- Perfect for real-time visualizations

**Option C: Batched Bulk Data** (for analytics/logging)
- Endpoint: `ws://your-server.com:8080/bulk`
- Receives GPS, weather, motion, media in batches
- ~1 second latency, efficient for processing
- Batches up to 10 data points per message

**Steps:**
1. Create a WebSocket server (see examples below)
2. Open Pocket Parrot → Settings
3. Enter your WebSocket endpoint
4. Click "Enable WebSocket"
5. Data flows automatically!

**Example Server - General Listener (Node.js):**
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'data') {
      console.log('Received:', data.data);
      // Process and store the data
    }
  });
});
```

**Example Server - Orientation Listener (Node.js):**
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
  const pathname = url.parse(req.url).pathname;
  
  if (pathname === '/orientation') {
    ws.on('message', (message) => {
      const msg = JSON.parse(message);
      if (msg.type === 'orientation_data') {
        const { alpha, beta, gamma } = msg.orientation;
        // Update 3D visualization immediately
        update3DScene(alpha, beta, gamma);
      }
    });
  }
});
```

**Example Server - Bulk Data Listener (Node.js):**
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
  const pathname = url.parse(req.url).pathname;
  
  if (pathname === '/bulk') {
    ws.on('message', (message) => {
      const msg = JSON.parse(message);
      if (msg.type === 'bulk_data_batch') {
        // Process batch of data points efficiently
        msg.data.forEach(dataPoint => {
          saveToDatabase(dataPoint);
        });
      }
    });
  }
});
```

### 3. Export API (Batch Processing)
**Best for:** Data analysis, backups, periodic exports

**Setup Time:** 1 minute

**Steps:**
1. Access the API in browser console or your script
2. Call exportJSON with filters:
```javascript
const json = await window.pocketParrotAPI.exportJSON({
  startDate: '2024-01-01',
  hasGPS: true,
  includeMedia: false
});
console.log(json);
```

## Quick Reference

### Choosing the Right Endpoint

| Endpoint | Best For | Latency | Payload | Frequency |
|----------|----------|---------|---------|-----------|
| `/listener` | General use, getting started | Immediate | Complete data | Per capture |
| `/orientation` | 3D/AR/VR, real-time visuals | < 1ms | Orientation only | High (10-60 Hz) |
| `/bulk` | Analytics, logging, archival | ~1 second | GPS, weather, media | Batched |
| `/pocket-parrot` | Pocket Parrot clients only | Immediate | Complete + session | Per capture |

### JavaScript API Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `getAllData(options)` | Query with filters | `api.getAllData({ hasGPS: true, limit: 50 })` |
| `getDataById(id)` | Get specific record | `api.getDataById(123)` |
| `subscribe(callback)` | Real-time updates | `api.subscribe(data => console.log(data))` |
| `exportJSON(options)` | Export as JSON | `api.exportJSON({ includeMedia: true })` |
| `getStatus()` | Check API status | `api.getStatus()` |
| `getRecordCount()` | Count records | `await api.getRecordCount()` |

### Filter Options

```javascript
{
  startDate: '2024-01-01',      // ISO 8601 date string
  endDate: '2024-12-31',        // ISO 8601 date string
  hasGPS: true,                 // Only records with GPS
  hasPhoto: true,               // Only records with photos
  hasAudio: true,               // Only records with audio
  limit: 100,                   // Max number of records
  includeMedia: false           // Include base64 media (export only)
}
```

### WebSocket Message Format

**Handshake (sent on connect):**
```json
{
  "type": "handshake",
  "client": "PocketParrot",
  "version": "1.0",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Data (sent on capture):**
```json
{
  "type": "data",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "id": 123,
    "timestamp": "2024-01-01T12:00:00.000Z",
    "gps": { "latitude": 37.7749, "longitude": -122.4194 },
    "orientation": { "alpha": 180, "beta": 10, "gamma": -5 },
    "motion": { "accelerationX": 0.1, "accelerationY": 0.2, "accelerationZ": 9.8 },
    "weather": { "temperature": 18.5, "humidity": 65 },
    "objectsDetected": [{ "class": "person", "score": 0.95 }],
    "photoBase64": "data:image/jpeg;base64,...",
    "audioBase64": "data:audio/wav;base64,..."
  }
}
```

## Examples Provided

1. **`integration-example.html`** - Beautiful real-time dashboard
2. **`websocket-server-example.js`** - Complete WebSocket server
3. **`test-api.html`** - API testing suite

## Next Steps

1. **Read the full docs:** [DATA_ACCESS_API.md](DATA_ACCESS_API.md)
2. **Try the examples:** Open `integration-example.html` in your browser
3. **Test the API:** Use `test-api.html` to verify functionality
4. **Build your integration:** Use the method that fits your needs

## Support

- Full documentation: [DATA_ACCESS_API.md](DATA_ACCESS_API.md)
- In-app help: Settings page has code examples
- GitHub Issues: Report problems or request features

---

**Happy integrating!** 🦜✨
