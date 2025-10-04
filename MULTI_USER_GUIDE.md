# 📱 Multi-User WebSocket Streaming Guide

## Overview

This guide explains how to set up a WebSocket server that can receive real-time sensor data from multiple Pocket Parrot users simultaneously and ingest it into another application.

## Architecture

```
┌─────────────────┐
│  Phone User 1   │
│ Pocket Parrot   │──┐
└─────────────────┘  │
                     │
┌─────────────────┐  │    ┌──────────────────┐    ┌─────────────────┐
│  Phone User 2   │  │    │                  │    │                 │
│ Pocket Parrot   │──┼───▶│  WebSocket       │───▶│  Your App       │
└─────────────────┘  │    │  Server          │    │  (Data Ingest)  │
                     │    │                  │    │                 │
┌─────────────────┐  │    └──────────────────┘    └─────────────────┘
│  Phone User N   │  │
│ Pocket Parrot   │──┘
└─────────────────┘
```

Each user's phone runs Pocket Parrot in their browser, captures sensor data, and streams it to a central WebSocket server. The server then ingests and processes the data for your application.

---

## Step-by-Step Setup

### Step 1: Create the WebSocket Server

The server handles multiple concurrent connections from different users. Here's a complete example:

**`multi-user-websocket-server.js`**

```javascript
#!/usr/bin/env node

const WebSocket = require('ws');
const port = process.argv[2] || 8080;

// Store connected clients with metadata
const clients = new Map();

const wss = new WebSocket.Server({ port });

console.log(`🦜 Multi-User Pocket Parrot Server`);
console.log(`📡 Listening on port ${port}`);
console.log(`🔗 Users should connect to: ws://YOUR_SERVER_IP:${port}/pocket-parrot`);
console.log('');

wss.on('connection', (ws, req) => {
  // Generate unique client ID
  const clientId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store client metadata
  clients.set(clientId, {
    ws: ws,
    connectedAt: new Date(),
    ip: req.socket.remoteAddress,
    dataCount: 0,
    lastDataTime: null
  });
  
  console.log(`✅ New user connected: ${clientId}`);
  console.log(`   IP: ${req.socket.remoteAddress}`);
  console.log(`   Total users online: ${clients.size}`);
  console.log('');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const client = clients.get(clientId);
      
      if (data.type === 'handshake') {
        console.log(`🤝 Handshake from ${clientId}`);
        console.log(`   Client: ${data.client} ${data.version}`);
        
        // Send welcome message back to client
        ws.send(JSON.stringify({
          type: 'welcome',
          clientId: clientId,
          message: 'Connected to multi-user server'
        }));
        
      } else if (data.type === 'data') {
        // Update client stats
        client.dataCount++;
        client.lastDataTime = new Date();
        
        console.log(`📊 Data from ${clientId}:`);
        console.log(`   Record #${client.dataCount}`);
        console.log(`   Timestamp: ${data.data.timestamp}`);
        
        if (data.data.gps) {
          console.log(`   📍 GPS: ${data.data.gps.latitude}, ${data.data.gps.longitude}`);
        }
        
        // Process the data for your application
        ingestData(clientId, data.data);
        
        // Send acknowledgment
        ws.send(JSON.stringify({
          type: 'ack',
          timestamp: new Date().toISOString(),
          received: data.data.id,
          clientId: clientId
        }));
      }
    } catch (error) {
      console.error(`❌ Error from ${clientId}:`, error.message);
    }
  });
  
  ws.on('close', () => {
    const client = clients.get(clientId);
    console.log(`🔌 User disconnected: ${clientId}`);
    console.log(`   Session duration: ${Math.round((new Date() - client.connectedAt) / 1000)}s`);
    console.log(`   Data points received: ${client.dataCount}`);
    console.log(`   Total users online: ${clients.size - 1}`);
    console.log('');
    clients.delete(clientId);
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error from ${clientId}:`, error.message);
  });
});

/**
 * Ingest data into your application
 * This is where you process, store, or forward the data
 */
function ingestData(userId, sensorData) {
  // Example: Store in database
  // db.collection('sensor_data').insert({
  //   userId: userId,
  //   timestamp: sensorData.timestamp,
  //   gps: sensorData.gps,
  //   orientation: sensorData.orientation,
  //   motion: sensorData.motion,
  //   weather: sensorData.weather,
  //   objects: sensorData.objectsDetected
  // });
  
  // Example: Send to analytics service
  // analytics.track(userId, 'sensor_data_received', sensorData);
  
  // Example: Trigger real-time updates
  // eventEmitter.emit('new_data', { userId, data: sensorData });
  
  // Example: Forward to another service
  // httpClient.post('https://your-api.com/ingest', {
  //   userId: userId,
  //   data: sensorData
  // });
  
  console.log(`   ✅ Data ingested for ${userId}`);
}

// Status endpoint - shows connected users
setInterval(() => {
  if (clients.size > 0) {
    console.log(`\n📊 Server Status:`);
    console.log(`   Connected users: ${clients.size}`);
    clients.forEach((client, id) => {
      console.log(`   - ${id}: ${client.dataCount} records`);
    });
    console.log('');
  }
}, 60000); // Every minute

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  clients.forEach((client, id) => {
    client.ws.close();
  });
  wss.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
```

### Step 2: Deploy the Server

#### Option A: Local Network (Testing)

1. **Start the server on your computer:**
```bash
node multi-user-websocket-server.js 8080
```

2. **Find your computer's IP address:**
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` or `ip addr` (look for inet)
   - Example: `192.168.1.100`

3. **Users connect to:** `ws://192.168.1.100:8080/pocket-parrot`

**Note:** All devices must be on the same WiFi network.

#### Option B: Cloud Server (Production)

1. **Deploy to a cloud provider:**
   - AWS EC2, Google Cloud, DigitalOcean, Heroku, etc.
   - Install Node.js on the server
   - Upload `multi-user-websocket-server.js`

2. **Configure firewall:**
   - Open port 8080 for WebSocket connections
   - Allow inbound TCP traffic

3. **Start the server:**
```bash
# Using pm2 for production
npm install -g pm2
pm2 start multi-user-websocket-server.js --name pocket-parrot-server

# Or using systemd service
sudo systemctl start pocket-parrot-server
```

4. **Use secure WebSocket (WSS) with SSL:**
```javascript
const https = require('https');
const fs = require('fs');

const server = https.createServer({
  cert: fs.readFileSync('/path/to/certificate.crt'),
  key: fs.readFileSync('/path/to/private.key')
});

const wss = new WebSocket.Server({ server });
server.listen(443);
```

5. **Users connect to:** `wss://your-domain.com/pocket-parrot`

### Step 3: Configure Each User's Phone

Each user follows these steps on their phone:

1. **Open Pocket Parrot** in their browser (Chrome, Safari, Firefox)
   - Go to your Pocket Parrot URL
   - Or open `index.html` directly

2. **Navigate to Settings** (click Settings button)

3. **Configure WebSocket Connection:**
   - Enter WebSocket endpoint:
     - Local: `ws://192.168.1.100:8080/pocket-parrot`
     - Cloud: `wss://your-domain.com/pocket-parrot`
   - Click "Save Configuration"

4. **Test Connection** (optional but recommended)
   - Click "Test Connection" button
   - Should see "✅ Connection successful!"

5. **Enable WebSocket**
   - Click "Enable WebSocket" button
   - Status should change to "Enabled"

6. **Start Capturing Data**
   - Go back to Capture page
   - Click "Capture Sensor Data" or enable continuous capture
   - Data automatically streams to server

### Step 4: Verify Multi-User Connections

On the server console, you should see:

```
✅ New user connected: user_1704652800123_abc123
   IP: 192.168.1.101
   Total users online: 1

🤝 Handshake from user_1704652800123_abc123
   Client: PocketParrot 1.0

✅ New user connected: user_1704652800456_def456
   IP: 192.168.1.102
   Total users online: 2

📊 Data from user_1704652800123_abc123:
   Record #1
   📍 GPS: 37.7749, -122.4194
   ✅ Data ingested

📊 Data from user_1704652800456_def456:
   Record #1
   📍 GPS: 37.7750, -122.4195
   ✅ Data ingested
```

---

## Integration Examples

### Example 1: Real-Time Dashboard

Display all users' locations on a single map:

```javascript
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store latest data from each user
const userData = new Map();

// WebSocket for Pocket Parrot clients
wss.on('connection', (ws) => {
  let clientId = null;
  
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'handshake') {
      clientId = `user_${Date.now()}`;
    } else if (data.type === 'data') {
      // Store latest data
      userData.set(clientId, {
        gps: data.data.gps,
        timestamp: data.data.timestamp
      });
      
      // Broadcast to dashboard clients
      broadcastToDashboard();
    }
  });
  
  ws.on('close', () => {
    userData.delete(clientId);
  });
});

// Serve dashboard
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Multi-User Dashboard</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      </head>
      <body>
        <h1>Live User Locations</h1>
        <div id="map" style="height: 600px;"></div>
        <div id="users"></div>
        <script>
          const map = L.map('map').setView([37.7749, -122.4194], 10);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
          
          const ws = new WebSocket('ws://localhost:8080/dashboard');
          const markers = {};
          
          ws.onmessage = (event) => {
            const users = JSON.parse(event.data);
            
            // Update markers for each user
            users.forEach(user => {
              if (user.gps) {
                if (markers[user.id]) {
                  markers[user.id].setLatLng([user.gps.latitude, user.gps.longitude]);
                } else {
                  markers[user.id] = L.marker([user.gps.latitude, user.gps.longitude])
                    .addTo(map)
                    .bindPopup(user.id);
                }
              }
            });
          };
        </script>
      </body>
    </html>
  `);
});

function broadcastToDashboard() {
  const users = Array.from(userData.entries()).map(([id, data]) => ({
    id: id,
    gps: data.gps,
    timestamp: data.timestamp
  }));
  
  // Send to all dashboard clients
  // Implementation depends on your setup
}

server.listen(8080);
```

### Example 2: Database Storage

Store data from all users in a database:

```javascript
const { MongoClient } = require('mongodb');

// Connect to MongoDB
const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const db = client.db('pocket_parrot');
const collection = db.collection('sensor_data');

function ingestData(userId, sensorData) {
  // Store in MongoDB with user identification
  collection.insertOne({
    userId: userId,
    timestamp: new Date(sensorData.timestamp),
    gps: sensorData.gps,
    orientation: sensorData.orientation,
    motion: sensorData.motion,
    weather: sensorData.weather,
    objectsDetected: sensorData.objectsDetected,
    colorPalette: sensorData.colorPalette,
    capturedAt: new Date()
  });
  
  console.log(`✅ Stored data for ${userId} in database`);
}

// Query data from specific user
async function getUserData(userId) {
  return await collection.find({ userId }).toArray();
}

// Query data from all users in time range
async function getDataInRange(startTime, endTime) {
  return await collection.find({
    timestamp: {
      $gte: startTime,
      $lte: endTime
    }
  }).toArray();
}
```

### Example 3: Forward to Another API

Forward data to your existing application:

```javascript
const axios = require('axios');

async function ingestData(userId, sensorData) {
  try {
    // Forward to your API
    await axios.post('https://your-app.com/api/sensor-data', {
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      data: {
        userId: userId,
        timestamp: sensorData.timestamp,
        location: sensorData.gps,
        deviceOrientation: sensorData.orientation,
        motion: sensorData.motion,
        weather: sensorData.weather,
        detectedObjects: sensorData.objectsDetected
      }
    });
    
    console.log(`✅ Forwarded data for ${userId} to API`);
  } catch (error) {
    console.error(`❌ Failed to forward data: ${error.message}`);
  }
}
```

---

## User Identification

### Method 1: Automatic (Server-Assigned)

The server automatically assigns a unique ID to each connection:

```javascript
const clientId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

**Pros:** Simple, works immediately  
**Cons:** New ID each session, can't track same user across sessions

### Method 2: User Login (Custom)

Have users provide identification:

**On the client (add to Pocket Parrot):**
```javascript
// Store user identifier
const username = prompt("Enter your username:");
localStorage.setItem('pocket_parrot_user', username);

// Include in handshake
ws.send(JSON.stringify({
  type: 'handshake',
  client: 'PocketParrot',
  version: '1.0',
  username: username
}));
```

**On the server:**
```javascript
if (data.type === 'handshake' && data.username) {
  clientId = `user_${data.username}`;
  console.log(`User identified as: ${data.username}`);
}
```

### Method 3: Device ID (Persistent)

Use a persistent device identifier:

```javascript
// Generate or retrieve device ID
let deviceId = localStorage.getItem('pocket_parrot_device_id');
if (!deviceId) {
  deviceId = `device_${Date.now()}_${navigator.userAgent.substring(0, 20)}`;
  localStorage.setItem('pocket_parrot_device_id', deviceId);
}

// Include in all messages
ws.send(JSON.stringify({
  type: 'handshake',
  deviceId: deviceId
}));
```

---

## Scaling Considerations

### Handling Many Users

**Connection Limits:**
- Node.js WebSocket: ~10,000 concurrent connections per server
- For more users, use a load balancer with multiple servers

**Load Balancing:**
```
                    ┌─────────────────┐
                    │ Load Balancer   │
                    │   (nginx)       │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼─────┐ ┌─────▼──────┐ ┌────▼───────┐
    │  WS Server 1  │ │ WS Server 2│ │ WS Server 3│
    └───────────────┘ └────────────┘ └────────────┘
```

**Example nginx config:**
```nginx
upstream websocket_backend {
    ip_hash;  # Sticky sessions
    server 127.0.0.1:8081;
    server 127.0.0.1:8082;
    server 127.0.0.1:8083;
}

server {
    listen 80;
    location /pocket-parrot {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Data Rate Management

Each user can generate significant data:
- **Low rate**: 1 sample/minute = ~50KB/hour
- **Medium rate**: 1 sample/5 seconds = ~600KB/hour
- **High rate**: 1 sample/second = ~3MB/hour

**With photos/audio:**
- Add ~500KB-2MB per capture

**Recommendations:**
- Set capture intervals based on your use case
- Disable media if not needed (`includeMedia: false`)
- Implement server-side rate limiting:

```javascript
const rateLimits = new Map();

function checkRateLimit(clientId) {
  const now = Date.now();
  const limit = rateLimits.get(clientId) || { count: 0, resetTime: now + 60000 };
  
  if (now > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + 60000;
  }
  
  limit.count++;
  rateLimits.set(clientId, limit);
  
  return limit.count <= 100; // Max 100 messages per minute
}
```

---

## Troubleshooting

### Users Can't Connect

**Check these:**
1. Server is running: `ps aux | grep node`
2. Port is open: `netstat -an | grep 8080`
3. Firewall allows connections: `sudo ufw status`
4. Correct IP/domain in Pocket Parrot settings
5. Using `ws://` for local, `wss://` for HTTPS sites

### Connection Drops

**Common causes:**
- Mobile browser goes to background → WebSocket closes
- Network switches (WiFi to cellular)
- Server timeout/restart

**Solution:** Auto-reconnect is built into `data-api.js`:
```javascript
api.configureWebSocket(endpoint, {
  autoReconnect: true,
  reconnectDelay: 5000  // 5 seconds
});
```

### Data Not Appearing

**Debug steps:**
1. Check server console for incoming messages
2. Verify WebSocket status in Pocket Parrot Settings
3. Check browser console for errors
4. Test with "Capture Sensor Data" button
5. Verify `ingestData()` function is being called

---

## Complete Setup Checklist

### Server Setup
- [ ] Create `multi-user-websocket-server.js`
- [ ] Install Node.js and dependencies
- [ ] Start server on port 8080 (or chosen port)
- [ ] Verify server is accessible from users' network
- [ ] Configure firewall rules
- [ ] (Optional) Set up SSL for wss://
- [ ] (Optional) Set up database for storage

### User Setup (Repeat for Each User)
- [ ] Open Pocket Parrot on their phone
- [ ] Go to Settings page
- [ ] Enter WebSocket endpoint
- [ ] Click "Save Configuration"
- [ ] Click "Test Connection" - verify success
- [ ] Click "Enable WebSocket"
- [ ] Go to Capture page
- [ ] Click "Request Permissions" (if needed)
- [ ] Start capturing data

### Verification
- [ ] Server console shows connections from all users
- [ ] Server console shows data from each user
- [ ] `ingestData()` is being called for each user
- [ ] Data is being stored/processed correctly
- [ ] Users can see "WebSocket Status: Enabled" in Settings

---

## Security Recommendations

### For Production Use:

1. **Use HTTPS/WSS**
```javascript
api.configureWebSocket('wss://your-domain.com/pocket-parrot');
```

2. **Add Authentication**
```javascript
// Client sends token
ws.send(JSON.stringify({
  type: 'handshake',
  token: 'user_auth_token'
}));

// Server validates
if (data.type === 'handshake') {
  if (!validateToken(data.token)) {
    ws.close(1008, 'Unauthorized');
    return;
  }
}
```

3. **Rate Limiting** (shown above)

4. **Input Validation**
```javascript
function isValidSensorData(data) {
  return data.timestamp &&
         typeof data.gps === 'object' &&
         data.gps.latitude >= -90 && data.gps.latitude <= 90;
}
```

5. **Monitor and Log**
- Log all connections and disconnections
- Monitor data rates per user
- Alert on suspicious patterns

---

## Summary

To enable multiple users to stream data:

1. **Deploy** the WebSocket server on an accessible host
2. **Share** the server URL with all users
3. **Each user configures** their Pocket Parrot with the WebSocket endpoint
4. **Each user enables** WebSocket push in Settings
5. **Server receives** real-time data from all users simultaneously
6. **Your app ingests** the data via the `ingestData()` function

The architecture is scalable to hundreds of users with proper server configuration. All data is streamed in real-time with automatic reconnection on network issues.

For testing, start with a local server and 2-3 users on the same network. Then move to a cloud deployment for production use with remote users.
