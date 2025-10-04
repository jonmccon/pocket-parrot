#!/usr/bin/env node

/**
 * Multi-User WebSocket Server for Pocket Parrot
 * 
 * Handles multiple concurrent connections from different Pocket Parrot users
 * and ingests their sensor data in real-time.
 * 
 * Usage:
 *   node multi-user-server.js [port]
 * 
 * Default port: 8080
 */

const WebSocket = require('ws');
const port = process.argv[2] || 8080;

// Store connected clients with metadata
const clients = new Map();

const wss = new WebSocket.Server({ port });

console.log('🦜 Multi-User Pocket Parrot WebSocket Server');
console.log('='.repeat(50));
console.log(`📡 Listening on port ${port}`);
console.log(`🔗 Configure users to connect to: ws://YOUR_IP:${port}/pocket-parrot`);
console.log('');
console.log('Waiting for connections...');
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
    lastDataTime: null,
    username: null
  });
  
  console.log(`✅ New user connected: ${clientId}`);
  console.log(`   IP Address: ${req.socket.remoteAddress}`);
  console.log(`   Total users online: ${clients.size}`);
  console.log('');
  
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
        
        // Ingest the data into your application
        ingestData(clientId, data.data, client);
        
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
    }
  });
  
  ws.on('close', () => {
    const client = clients.get(clientId);
    const displayName = client.username || clientId;
    const duration = Math.round((new Date() - client.connectedAt) / 1000);
    
    console.log(`🔌 User disconnected: ${displayName}`);
    console.log(`   Session duration: ${duration}s`);
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

// Status reporting - prints server statistics every minute
setInterval(() => {
  if (clients.size > 0) {
    console.log('📊 Server Status Report:');
    console.log(`   Connected users: ${clients.size}`);
    
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

// Error handling
wss.on('error', (error) => {
  console.error('❌ Server error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  console.log(`   Disconnecting ${clients.size} users...`);
  
  clients.forEach((client, id) => {
    client.ws.send(JSON.stringify({
      type: 'server_shutdown',
      message: 'Server is shutting down'
    }));
    client.ws.close();
  });
  
  wss.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});

console.log('✨ Server is ready!');
console.log('');
