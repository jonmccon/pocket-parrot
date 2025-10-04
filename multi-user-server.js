#!/usr/bin/env node

/**
 * Multi-User WebSocket Server for Pocket Parrot
 * 
 * Handles multiple concurrent connections from different Pocket Parrot users
 * and ingests their sensor data in real-time.
 * 
 * Features:
 * - Rate limiting: Maximum 25 concurrent users
 * - Dashboard monitoring endpoint at /dashboard
 * - Real-time stats broadcasting
 * - Oldest connection eviction when limit reached
 * 
 * Usage:
 *   node multi-user-server.js [port]
 * 
 * Default port: 8080
 * 
 * Endpoints:
 *   /pocket-parrot - Main data ingestion endpoint
 *   /dashboard - Monitoring dashboard endpoint
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const port = process.env.PORT || process.argv[2] || 8080;
const MAX_USERS = 25;

// Store connected clients with metadata
const clients = new Map();
const dashboardClients = new Set();

// Statistics
let totalDataPoints = 0;
let dataPointsLastMinute = 0;
let lastMinuteReset = Date.now();
const serverStartTime = Date.now();

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Pocket Parrot WebSocket Server\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log('🦜 Multi-User Pocket Parrot WebSocket Server');
console.log('='.repeat(50));
console.log(`📡 Listening on port ${port}`);
console.log(`🔗 Data endpoint: ws://YOUR_IP:${port}/pocket-parrot`);
console.log(`📊 Dashboard endpoint: ws://YOUR_IP:${port}/dashboard`);
console.log(`👥 Max users: ${MAX_USERS} (with auto-eviction)`);
console.log('');
console.log('Waiting for connections...');
console.log('');

wss.on('connection', (ws, req) => {
  const pathname = url.parse(req.url).pathname;
  
  // Dashboard connection
  if (pathname === '/dashboard') {
    console.log('📊 Dashboard connected');
    dashboardClients.add(ws);
    
    // Send initial stats
    broadcastStats();
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'getStats') {
          sendStatsToClient(ws);
        }
      } catch (error) {
        console.error('Dashboard message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('📊 Dashboard disconnected');
      dashboardClients.delete(ws);
    });
    
    return;
  }
  
  // Data connection - check rate limit
  if (clients.size >= MAX_USERS) {
    console.log(`⚠️  Rate limit reached (${MAX_USERS} users), evicting oldest connection`);
    evictOldestClient();
  }
  
  // Generate unique client ID
  const clientId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store client metadata
  clients.set(clientId, {
    ws: ws,
    connectedAt: new Date(),
    ip: req.socket.remoteAddress,
    dataCount: 0,
    lastDataTime: null,
    username: null
  });
  
  console.log(`✅ New user connected: ${clientId}`);
  console.log(`   IP Address: ${req.socket.remoteAddress}`);
  console.log(`   Total users online: ${clients.size}/${MAX_USERS}`);
  console.log('');
  
  // Notify dashboards
  broadcastToDashboards({
    type: 'userConnected',
    userId: clientId,
    ip: req.socket.remoteAddress
  });
  
  broadcastStats();
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const client = clients.get(clientId);
      
      if (data.type === 'handshake') {
        // Handle handshake from client
        console.log(`🤝 Handshake from ${clientId}`);
        console.log(`   Client: ${data.client} ${data.version}`);
        console.log(`   Time: ${data.timestamp}`);
        
        // Store username if provided
        if (data.username) {
          client.username = data.username;
          console.log(`   Username: ${data.username}`);
        }
        
        console.log('');
        
        // Send welcome message back to client
        ws.send(JSON.stringify({
          type: 'welcome',
          clientId: clientId,
          serverTime: new Date().toISOString(),
          message: 'Connected to multi-user server'
        }));
        
      } else if (data.type === 'data') {
        // Handle sensor data from client
        client.dataCount++;
        client.lastDataTime = new Date();
        
        const displayName = client.username || clientId;
        console.log(`📊 Data from ${displayName} (#${client.dataCount})`);
        console.log(`   Timestamp: ${data.data.timestamp}`);
        
        // Log GPS data
        if (data.data.gps) {
          console.log(`   📍 GPS: ${data.data.gps.latitude.toFixed(6)}, ${data.data.gps.longitude.toFixed(6)}`);
          console.log(`   🎯 Accuracy: ${data.data.gps.accuracy}m`);
          if (data.data.gps.altitude) {
            console.log(`   ⛰️  Altitude: ${data.data.gps.altitude.toFixed(1)}m`);
          }
        }
        
        // Log orientation
        if (data.data.orientation) {
          console.log(`   🧭 Orientation: α=${data.data.orientation.alpha.toFixed(1)}° β=${data.data.orientation.beta.toFixed(1)}° γ=${data.data.orientation.gamma.toFixed(1)}°`);
        }
        
        // Log motion
        if (data.data.motion) {
          console.log(`   🏃 Motion: X=${data.data.motion.accelerationX.toFixed(2)} Y=${data.data.motion.accelerationY.toFixed(2)} Z=${data.data.motion.accelerationZ.toFixed(2)}`);
        }
        
        // Log weather
        if (data.data.weather) {
          console.log(`   🌤️  Weather: ${data.data.weather.temperature}°C, ${data.data.weather.humidity}% humidity, Wind: ${data.data.weather.windSpeed}km/h`);
        }
        
        // Log detected objects
        if (data.data.objectsDetected && data.data.objectsDetected.length > 0) {
          const objects = data.data.objectsDetected.map(o => `${o.class} (${(o.score * 100).toFixed(1)}%)`).join(', ');
          console.log(`   👁️  Objects: ${objects}`);
        }
        
        // Log media info
        if (data.data.photoBase64) {
          console.log(`   📷 Photo: ${Math.round(data.data.photoBase64.length / 1024)}KB`);
        }
        if (data.data.audioBase64) {
          console.log(`   🎤 Audio: ${Math.round(data.data.audioBase64.length / 1024)}KB`);
        }
        
        console.log('');
        
        // Update statistics
        totalDataPoints++;
        dataPointsLastMinute++;
        
        // Ingest the data into your application
        ingestData(clientId, data.data, client);
        
        // Notify dashboards
        broadcastToDashboards({
          type: 'dataReceived',
          userId: clientId,
          pointNumber: client.dataCount
        });
        
        broadcastStats();
        
        // Send acknowledgment back to client
        ws.send(JSON.stringify({
          type: 'ack',
          timestamp: new Date().toISOString(),
          received: data.data.id,
          clientId: clientId
        }));
      }
    } catch (error) {
      console.error(`❌ Error from ${clientId}:`, error.message);
      broadcastToDashboards({
        type: 'error',
        message: `Error from ${clientId}: ${error.message}`
      });
    }
  });
  
  ws.on('close', () => {
    const client = clients.get(clientId);
    const displayName = client.username || clientId;
    const duration = Math.round((new Date() - client.connectedAt) / 1000);
    
    console.log(`🔌 User disconnected: ${displayName}`);
    console.log(`   Session duration: ${duration}s`);
    console.log(`   Data points received: ${client.dataCount}`);
    console.log(`   Total users online: ${clients.size - 1}/${MAX_USERS}`);
    console.log('');
    
    clients.delete(clientId);
    
    // Notify dashboards
    broadcastToDashboards({
      type: 'userDisconnected',
      userId: clientId,
      dataCount: client.dataCount
    });
    
    broadcastStats();
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error from ${clientId}:`, error.message);
  });
});

/**
 * Ingest data into your application
 * 
 * This is where you would:
 * - Store data in a database
 * - Forward to another API
 * - Trigger real-time processing
 * - Send to analytics services
 * - Update dashboards
 * 
 * @param {string} userId - Unique user identifier
 * @param {Object} sensorData - Complete sensor data object
 * @param {Object} clientInfo - Client metadata (IP, username, etc.)
 */
function ingestData(userId, sensorData, clientInfo) {
  // Example 1: Log summary
  const summary = {
    userId: userId,
    username: clientInfo.username,
    timestamp: sensorData.timestamp,
    hasGPS: !!sensorData.gps,
    hasPhoto: !!sensorData.photoBase64,
    hasAudio: !!sensorData.audioBase64,
    objectCount: sensorData.objectsDetected?.length || 0
  };
  console.log(`   ✅ Ingested:`, JSON.stringify(summary));
  
  // Example 2: Store in database (uncomment to use)
  /*
  const db = require('./database'); // Your database module
  db.collection('sensor_data').insert({
    userId: userId,
    username: clientInfo.username,
    ip: clientInfo.ip,
    timestamp: new Date(sensorData.timestamp),
    gps: sensorData.gps,
    orientation: sensorData.orientation,
    motion: sensorData.motion,
    weather: sensorData.weather,
    objectsDetected: sensorData.objectsDetected,
    colorPalette: sensorData.colorPalette,
    hasPhoto: !!sensorData.photoBase64,
    hasAudio: !!sensorData.audioBase64,
    capturedAt: new Date()
  }).then(() => {
    console.log(`   💾 Stored in database`);
  });
  */
  
  // Example 3: Forward to another API (uncomment to use)
  /*
  const axios = require('axios');
  axios.post('https://your-api.com/ingest', {
    userId: userId,
    data: sensorData,
    metadata: {
      ip: clientInfo.ip,
      username: clientInfo.username
    }
  }, {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  }).then(() => {
    console.log(`   📤 Forwarded to API`);
  }).catch(err => {
    console.error(`   ❌ Failed to forward: ${err.message}`);
  });
  */
  
  // Example 4: Broadcast to other services (uncomment to use)
  /*
  const eventEmitter = require('./events'); // Your event system
  eventEmitter.emit('new_sensor_data', {
    userId: userId,
    data: sensorData,
    client: clientInfo
  });
  */
}

/**
 * Evict the oldest connected client to make room for a new one
 */
function evictOldestClient() {
  let oldestClientId = null;
  let oldestTime = Date.now();
  
  clients.forEach((client, id) => {
    if (client.connectedAt < oldestTime) {
      oldestTime = client.connectedAt;
      oldestClientId = id;
    }
  });
  
  if (oldestClientId) {
    const client = clients.get(oldestClientId);
    console.log(`⚠️  Evicting oldest client: ${oldestClientId}`);
    console.log(`   Connected: ${Math.round((Date.now() - client.connectedAt) / 1000)}s ago`);
    console.log(`   Data points: ${client.dataCount}`);
    
    // Send notification to client
    client.ws.send(JSON.stringify({
      type: 'evicted',
      message: 'Server capacity reached - disconnecting oldest connection'
    }));
    
    client.ws.close();
    clients.delete(oldestClientId);
    console.log('');
  }
}

/**
 * Broadcast message to all dashboard clients
 */
function broadcastToDashboards(message) {
  const messageStr = JSON.stringify(message);
  dashboardClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

/**
 * Send stats to a specific client
 */
function sendStatsToClient(ws) {
  const stats = getStats();
  ws.send(JSON.stringify({
    type: 'stats',
    data: stats
  }));
}

/**
 * Broadcast stats to all dashboard clients
 */
function broadcastStats() {
  const stats = getStats();
  broadcastToDashboards({
    type: 'stats',
    data: stats
  });
}

/**
 * Get current server statistics
 */
function getStats() {
  // Calculate data rate (points per minute)
  const now = Date.now();
  if (now - lastMinuteReset >= 60000) {
    dataPointsLastMinute = 0;
    lastMinuteReset = now;
  }
  
  const users = [];
  clients.forEach((client, id) => {
    users.push({
      id: id,
      connectedAt: client.connectedAt.toISOString(),
      dataCount: client.dataCount,
      lastData: client.lastDataTime ? client.lastDataTime.toISOString() : null,
      username: client.username
    });
  });
  
  return {
    activeUsers: clients.size,
    maxUsers: MAX_USERS,
    totalDataPoints: totalDataPoints,
    dataRate: dataPointsLastMinute,
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    users: users
  };
}

// Status reporting - prints server statistics every minute
setInterval(() => {
  if (clients.size > 0) {
    console.log('📊 Server Status Report:');
    console.log(`   Connected users: ${clients.size}/${MAX_USERS}`);
    
    let totalData = 0;
    clients.forEach((client, id) => {
      const displayName = client.username || id;
      const timeSinceData = client.lastDataTime 
        ? Math.round((new Date() - client.lastDataTime) / 1000)
        : 'never';
      console.log(`   - ${displayName}: ${client.dataCount} records (last: ${timeSinceData}s ago)`);
      totalData += client.dataCount;
    });
    
    console.log(`   Total data points: ${totalData}`);
    console.log('');
  }
}, 60000); // Every 60 seconds

// Reset data rate counter every minute
setInterval(() => {
  dataPointsLastMinute = 0;
}, 60000);

// Error handling
wss.on('error', (error) => {
  console.error('❌ Server error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  console.log(`   Disconnecting ${clients.size} users and ${dashboardClients.size} dashboards...`);
  
  clients.forEach((client, id) => {
    client.ws.send(JSON.stringify({
      type: 'server_shutdown',
      message: 'Server is shutting down'
    }));
    client.ws.close();
  });
  
  dashboardClients.forEach(ws => {
    ws.close();
  });
  
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});

// Start HTTP server
server.listen(port, () => {
  console.log('✨ Server is ready!');
  console.log('');
});
