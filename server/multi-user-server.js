#!/usr/bin/env node

/**
 * Single Active User WebSocket Server for Pocket Parrot
 * 
 * Handles multiple concurrent connections but only allows one active data sender.
 * Other users become observers until the active sender disconnects or becomes inactive.
 * Also supports passive broadcast listeners that receive data without participating in sessions.
 * 
 * Features:
 * - Single active data sender with automatic promotion
 * - 30-second inactivity timeout for auto-promotion
 * - Device fingerprinting to detect reconnections
 * - Dashboard monitoring with session management
 * - Real-time stats broadcasting
 * - Passive broadcast listeners for data ingestion
 * 
 * Usage:
 *   node multi-user-server.js [port]
 * 
 * Default port: 8080
 * 
 * Endpoints:
 *   /pocket-parrot - Main data ingestion endpoint (users/observers)
 *   /dashboard - Monitoring dashboard endpoint
 *   /listener - Passive broadcast listener endpoint (data only, no session)
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const port = process.env.PORT || process.argv[2] || 8080;
const MAX_USERS = 25;
const SENDER_TIMEOUT = 30000; // 30 seconds of no data = inactive

// Batching configuration
const BATCH_INTERVAL = 1000; // Send bulk data batch every 1 second
const MAX_BATCH_SIZE = 10; // Maximum items per batch

// Store connected clients with metadata
const clients = new Map();
const dashboardClients = new Set();
const passiveListeners = new Set(); // Passive broadcast-only listeners
const orientationListeners = new Set(); // Low-latency orientation data listeners
const bulkDataListeners = new Set(); // Batched bulk data listeners
const deviceSessions = new Map(); // Track devices to prevent reconnections

// Bulk data batching queue
const bulkDataQueue = [];
let bulkDataBatchTimer = null;

// Active sender management
let activeDataSender = null;
let senderTimeoutId = null;

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

console.log('🦜 Single Active User Pocket Parrot WebSocket Server');
console.log('='.repeat(60));
console.log(`📡 Listening on port ${port}`);
console.log(`🔗 Data endpoint: ws://YOUR_IP:${port}/pocket-parrot`);
console.log(`📊 Dashboard endpoint: ws://YOUR_IP:${port}/dashboard`);
console.log(`📻 Listener endpoint: ws://YOUR_IP:${port}/listener`);
console.log(`🧭 Orientation endpoint: ws://YOUR_IP:${port}/orientation (low-latency)`);
console.log(`📦 Bulk data endpoint: ws://YOUR_IP:${port}/bulk (batched)`);
console.log(`👥 Max users: ${MAX_USERS} (single active sender)`);
console.log(`⏱️  Sender timeout: ${SENDER_TIMEOUT/1000}s`);
console.log(`📊 Batch interval: ${BATCH_INTERVAL}ms, max size: ${MAX_BATCH_SIZE}`);
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
        } else if (data.type === 'kickUser') {
          kickUser(data.userId);
        } else if (data.type === 'promoteUser') {
          promoteUser(data.userId);
        } else if (data.type === 'demoteUser') {
          demoteCurrentSender();
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
  
  // Passive listener connection - broadcast-only, no user/observer role
  if (pathname === '/listener') {
    console.log('📻 Passive listener connected');
    console.log(`   IP Address: ${req.socket.remoteAddress}`);
    console.log(`   Total listeners: ${passiveListeners.size + 1}`);
    console.log('');
    
    passiveListeners.add(ws);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'listener_connected',
      message: 'Connected as passive broadcast listener',
      timestamp: new Date().toISOString()
    }));
    
    ws.on('close', () => {
      console.log('📻 Passive listener disconnected');
      console.log(`   Total listeners: ${passiveListeners.size - 1}`);
      console.log('');
      passiveListeners.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('❌ Passive listener error:', error.message);
    });
    
    return;
  }
  
  // Orientation listener connection - low-latency orientation data only
  if (pathname === '/orientation') {
    console.log('🧭 Orientation listener connected');
    console.log(`   IP Address: ${req.socket.remoteAddress}`);
    console.log(`   Total orientation listeners: ${orientationListeners.size + 1}`);
    console.log('');
    
    orientationListeners.add(ws);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'orientation_listener_connected',
      message: 'Connected to low-latency orientation data stream',
      timestamp: new Date().toISOString()
    }));
    
    ws.on('close', () => {
      console.log('🧭 Orientation listener disconnected');
      console.log(`   Total orientation listeners: ${orientationListeners.size - 1}`);
      console.log('');
      orientationListeners.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('❌ Orientation listener error:', error.message);
    });
    
    return;
  }
  
  // Bulk data listener connection - batched data (GPS, weather, photos, etc.)
  if (pathname === '/bulk') {
    console.log('📦 Bulk data listener connected');
    console.log(`   IP Address: ${req.socket.remoteAddress}`);
    console.log(`   Total bulk data listeners: ${bulkDataListeners.size + 1}`);
    console.log('');
    
    bulkDataListeners.add(ws);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'bulk_listener_connected',
      message: 'Connected to batched bulk data stream',
      batchInterval: BATCH_INTERVAL,
      maxBatchSize: MAX_BATCH_SIZE,
      timestamp: new Date().toISOString()
    }));
    
    // Start batch timer if not already running
    if (!bulkDataBatchTimer && bulkDataListeners.size > 0) {
      startBulkDataBatchTimer();
    }
    
    ws.on('close', () => {
      console.log('📦 Bulk data listener disconnected');
      console.log(`   Total bulk data listeners: ${bulkDataListeners.size - 1}`);
      console.log('');
      bulkDataListeners.delete(ws);
      
      // Stop batch timer if no more listeners
      if (bulkDataListeners.size === 0 && bulkDataBatchTimer) {
        clearInterval(bulkDataBatchTimer);
        bulkDataBatchTimer = null;
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ Bulk data listener error:', error.message);
    });
    
    return;
  }
  
  // Data connection - check rate limit
  if (clients.size >= MAX_USERS) {
    console.log(`⚠️  Rate limit reached (${MAX_USERS} users), rejecting connection`);
    ws.send(JSON.stringify({
      type: 'rejected',
      message: 'Server capacity reached. Try again later.'
    }));
    ws.close();
    return;
  }
  
  // Generate unique client ID
  const clientId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let deviceId = null;
  
  // Store client metadata
  clients.set(clientId, {
    ws: ws,
    connectedAt: new Date(),
    ip: req.socket.remoteAddress,
    dataCount: 0,
    lastDataTime: null,
    username: null,
    deviceId: null,
    isActiveSender: false
  });
  
  console.log(`✅ New user connected: ${clientId}`);
  console.log(`   IP Address: ${req.socket.remoteAddress}`);
  console.log(`   Total users online: ${clients.size}/${MAX_USERS}`);
  
  // If there's already an active sender, this client becomes observer-only
  if (activeDataSender) {
    const activeSender = clients.get(activeDataSender);
    const activeName = activeSender?.username || activeDataSender;
    console.log(`   Status: Observer only (active sender: ${activeName})`);
    ws.send(JSON.stringify({
      type: 'observer_mode',
      message: 'Another user is currently sending data. You are in observer mode.',
      activeSender: activeName
    }));
  } else {
    console.log(`   Status: Ready to become active sender`);
  }
  
  console.log('');
  
  broadcastToDashboards({
    type: 'userConnected',
    userId: clientId,
    ip: req.socket.remoteAddress,
    isActiveSender: false
  });
  
  broadcastStats();
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const client = clients.get(clientId);
      
      if (data.type === 'handshake') {
        console.log(`🤝 Handshake from ${clientId}`);
        console.log(`   Client: ${data.client} ${data.version}`);
        console.log(`   Time: ${data.timestamp}`);
        
        // Get device ID from client
        deviceId = data.deviceId || `unknown_${clientId}`;
        client.deviceId = deviceId;
        
        // Check if this device was previously connected
        if (deviceSessions.has(deviceId)) {
          const lastSession = deviceSessions.get(deviceId);
          const timeSinceLastSession = Date.now() - lastSession.disconnectedAt;
          
          console.log(`   Device reconnection detected: ${deviceId}`);
          console.log(`   Last session: ${Math.round(timeSinceLastSession / 1000)}s ago`);
          
          // If reconnecting within 5 minutes, might be a drop/reconnect
          if (timeSinceLastSession < 300000) { // 5 minutes
            console.log(`   Treating as reconnection (within 5 min window)`);
            
            // If this device was the previous active sender and reconnecting quickly,
            // and current sender is inactive, promote this reconnection
            if (lastSession.wasActiveSender && timeSinceLastSession < 60000) {
              console.log(`   Previous active sender reconnecting - checking current status`);
              if (!activeDataSender || shouldPromoteReconnection()) {
                promoteToActiveSender(clientId);
              }
            }
          }
        }
        
        // Store username if provided
        if (data.username) {
          client.username = data.username;
          console.log(`   Username: ${data.username}`);
        }
        
        // Set as active sender if none exists
        if (!activeDataSender) {
          promoteToActiveSender(clientId);
        } else {
          ws.send(JSON.stringify({
            type: 'welcome',
            clientId: clientId,
            serverTime: new Date().toISOString(),
            message: 'Connected as observer',
            role: 'observer'
          }));
        }
        
        console.log('');
        
      } else if (data.type === 'data') {
        // Only accept data from the active sender
        if (clientId !== activeDataSender) {
          console.log(`🚫 Rejected data from non-active sender: ${clientId}`);
          ws.send(JSON.stringify({
            type: 'rejected',
            message: 'You are not the active data sender'
          }));
          return;
        }
        
        // Handle sensor data from active client
        client.dataCount++;
        client.lastDataTime = new Date();
        
        // Reset sender timeout
        resetSenderTimeout();
        
        const displayName = client.username || clientId;
        console.log(`📊 Data from active sender ${displayName} (#${client.dataCount})`);
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
        
        // Ingest the data
        ingestData(clientId, data.data, client);
        
        // Broadcast to specialized endpoints
        // 1. Send orientation data immediately (low-latency)
        if (data.data.orientation) {
          broadcastOrientationData(clientId, client.username, data.data.orientation);
        }
        
        // 2. Queue bulk data for batched delivery
        queueBulkData(clientId, client.username, data.data);
        
        // 3. Broadcast full sensor data to passive listeners (legacy behavior)
        broadcastToListeners({
          type: 'sensor_data',
          timestamp: new Date().toISOString(),
          userId: clientId,
          username: client.username,
          data: data.data
        });
        
        // Notify dashboards
        broadcastToDashboards({
          type: 'dataReceived',
          userId: clientId,
          pointNumber: client.dataCount
        });
        
        broadcastStats();
        
        // Send acknowledgment
        ws.send(JSON.stringify({
          type: 'ack',
          timestamp: new Date().toISOString(),
          received: data.data.id,
          clientId: clientId
        }));
        
      } else if (data.type === 'request_sender_role') {
        // Allow user to request to become the active sender
        console.log(`🙋 User ${clientId} requesting sender role`);
        if (canPromoteUser(clientId)) {
          promoteToActiveSender(clientId);
          console.log(`✅ Promoted ${clientId} to active sender`);
        } else {
          ws.send(JSON.stringify({
            type: 'rejected',
            message: 'Cannot promote at this time - current sender is active'
          }));
          console.log(`❌ Cannot promote ${clientId} - current sender is active`);
        }
      }
    } catch (error) {
      console.error(`❌ Error from ${clientId}:`, error.message);
    }
  });
  
  ws.on('close', () => {
    const client = clients.get(clientId);
    const displayName = client.username || clientId;
    const duration = Math.round((new Date() - client.connectedAt) / 1000);
    
    // Store device session info
    if (client.deviceId) {
      deviceSessions.set(client.deviceId, {
        disconnectedAt: Date.now(),
        lastClientId: clientId,
        username: client.username,
        dataCount: client.dataCount,
        wasActiveSender: clientId === activeDataSender
      });
    }
    
    console.log(`🔌 User disconnected: ${displayName}`);
    console.log(`   Session duration: ${duration}s`);
    console.log(`   Data points received: ${client.dataCount}`);
    
    // If this was the active sender, promote next user
    if (clientId === activeDataSender) {
      console.log(`   Active sender disconnected`);
      clearSenderTimeout();
      promoteNextSender();
    }
    
    console.log(`   Total users online: ${clients.size - 1}`);
    console.log('');
    
    clients.delete(clientId);
    
    broadcastToDashboards({
      type: 'userDisconnected',
      userId: clientId,
      dataCount: client.dataCount,
      wasActiveSender: clientId === activeDataSender
    });
    
    broadcastStats();
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error from ${clientId}:`, error.message);
  });
});

/**
 * Promote a user to active sender
 */
function promoteToActiveSender(clientId) {
  // Demote current sender if exists
  if (activeDataSender && activeDataSender !== clientId) {
    demoteCurrentSender();
  }
  
  const client = clients.get(clientId);
  if (!client) return false;
  
  activeDataSender = clientId;
  client.isActiveSender = true;
  
  const displayName = client.username || clientId;
  console.log(`🆕 Promoted ${displayName} to active sender`);
  
  client.ws.send(JSON.stringify({
    type: 'promoted',
    message: 'You are now the active data sender',
    role: 'sender'
  }));
  
  // Start sender timeout monitoring
  resetSenderTimeout();
  
  // Notify all other clients
  clients.forEach((otherClient, otherId) => {
    if (otherId !== clientId) {
      otherClient.ws.send(JSON.stringify({
        type: 'sender_changed',
        message: `${displayName} is now the active data sender`,
        activeSender: displayName
      }));
    }
  });
  
  broadcastToDashboards({
    type: 'senderPromoted',
    userId: clientId,
    username: client.username
  });
  
  return true;
}

/**
 * Demote current active sender
 */
function demoteCurrentSender() {
  if (!activeDataSender) return;
  
  const client = clients.get(activeDataSender);
  if (client) {
    client.isActiveSender = false;
    client.ws.send(JSON.stringify({
      type: 'demoted',
      message: 'You are no longer the active data sender'
    }));
    
    console.log(`⬇️  Demoted ${activeDataSender} from active sender`);
  }
  
  clearSenderTimeout();
  activeDataSender = null;
}

/**
 * Promote next available sender
 */
function promoteNextSender() {
  if (clients.size === 0) {
    activeDataSender = null;
    console.log(`📭 No users available for promotion`);
    return;
  }
  
  // Find most recently connected user
  let nextSender = null;
  let mostRecent = 0;
  
  clients.forEach((client, id) => {
    if (client.connectedAt.getTime() > mostRecent) {
      nextSender = id;
      mostRecent = client.connectedAt.getTime();
    }
  });
  
  if (nextSender) {
    promoteToActiveSender(nextSender);
  } else {
    activeDataSender = null;
    console.log(`📭 No users available for promotion`);
  }
}

/**
 * Check if user can be promoted (current sender is inactive)
 */
function canPromoteUser(userId) {
  if (!activeDataSender) return true;
  
  const currentSender = clients.get(activeDataSender);
  if (!currentSender || !currentSender.lastDataTime) return true;
  
  const timeSinceLastData = Date.now() - currentSender.lastDataTime.getTime();
  return timeSinceLastData > SENDER_TIMEOUT;
}

/**
 * Check if reconnection should be promoted over current sender
 */
function shouldPromoteReconnection() {
  if (!activeDataSender) return true;
  
  const currentSender = clients.get(activeDataSender);
  if (!currentSender || !currentSender.lastDataTime) return true;
  
  const timeSinceLastData = Date.now() - currentSender.lastDataTime.getTime();
  return timeSinceLastData > 10000; // 10 seconds of inactivity
}

/**
 * Reset sender timeout
 */
function resetSenderTimeout() {
  clearSenderTimeout();
  
  senderTimeoutId = setTimeout(() => {
    if (activeDataSender) {
      console.log(`⏰ Active sender ${activeDataSender} inactive for ${SENDER_TIMEOUT/1000}s`);
      demoteCurrentSender();
      promoteNextSender();
    }
  }, SENDER_TIMEOUT);
}

/**
 * Clear sender timeout
 */
function clearSenderTimeout() {
  if (senderTimeoutId) {
    clearTimeout(senderTimeoutId);
    senderTimeoutId = null;
  }
}

/**
 * Dashboard function: Kick a user
 */
function kickUser(userId) {
  const client = clients.get(userId);
  if (!client) {
    console.log(`❌ Cannot kick ${userId} - user not found`);
    return;
  }
  
  console.log(`👢 Dashboard kicked user: ${userId}`);
  
  client.ws.send(JSON.stringify({
    type: 'kicked',
    message: 'You have been disconnected by an administrator'
  }));
  
  client.ws.close();
}

/**
 * Dashboard function: Promote a user to active sender
 */
function promoteUser(userId) {
  const client = clients.get(userId);
  if (!client) {
    console.log(`❌ Cannot promote ${userId} - user not found`);
    return;
  }
  
  console.log(`👑 Dashboard promoting user: ${userId}`);
  promoteToActiveSender(userId);
}

/**
 * Ingest data into your application
 */
function ingestData(userId, sensorData, clientInfo) {
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
 * Broadcast message to all passive listeners
 */
function broadcastToListeners(message) {
  const messageStr = JSON.stringify(message);
  passiveListeners.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

/**
 * Broadcast orientation data to orientation listeners (immediate, low-latency)
 */
function broadcastOrientationData(userId, username, orientationData) {
  if (orientationListeners.size === 0) return;
  
  const message = JSON.stringify({
    type: 'orientation_data',
    timestamp: new Date().toISOString(),
    userId: userId,
    username: username,
    orientation: orientationData
  });
  
  orientationListeners.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * Queue bulk data for batched delivery
 */
function queueBulkData(userId, username, sensorData) {
  // Extract bulk data (everything except orientation)
  const bulkData = {
    timestamp: new Date().toISOString(),
    userId: userId,
    username: username,
    gps: sensorData.gps || null,
    motion: sensorData.motion || null,
    weather: sensorData.weather || null,
    objectsDetected: sensorData.objectsDetected || [],
    photoBase64: sensorData.photoBase64 || null,
    audioBase64: sensorData.audioBase64 || null,
    colorPalette: sensorData.colorPalette || null
  };
  
  bulkDataQueue.push(bulkData);
  
  // If queue reaches max size, send immediately
  if (bulkDataQueue.length >= MAX_BATCH_SIZE) {
    sendBulkDataBatch();
  }
}

/**
 * Send batched bulk data to bulk listeners
 */
function sendBulkDataBatch() {
  if (bulkDataQueue.length === 0 || bulkDataListeners.size === 0) {
    return;
  }
  
  // Create batch message
  const batch = bulkDataQueue.splice(0, MAX_BATCH_SIZE);
  const message = JSON.stringify({
    type: 'bulk_data_batch',
    timestamp: new Date().toISOString(),
    batchSize: batch.length,
    data: batch
  });
  
  // Send to all bulk data listeners
  bulkDataListeners.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
  
  console.log(`📦 Sent bulk data batch: ${batch.length} items to ${bulkDataListeners.size} listeners`);
}

/**
 * Start bulk data batch timer
 */
function startBulkDataBatchTimer() {
  if (bulkDataBatchTimer) return;
  
  bulkDataBatchTimer = setInterval(() => {
    if (bulkDataQueue.length > 0) {
      sendBulkDataBatch();
    }
  }, BATCH_INTERVAL);
  
  console.log(`⏰ Started bulk data batch timer (${BATCH_INTERVAL}ms interval)`);
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
 * Broadcast stats to all dashboard clients and passive listeners
 */
function broadcastStats() {
  const stats = getStats();
  const statsMessage = {
    type: 'stats',
    data: stats
  };
  
  // Send to dashboards
  broadcastToDashboards(statsMessage);
  
  // Send to passive listeners
  broadcastToListeners(statsMessage);
}

/**
 * Get current server statistics
 */
function getStats() {
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
      username: client.username,
      isActiveSender: client.isActiveSender,
      deviceId: client.deviceId,
      ip: client.ip
    });
  });
  
  return {
    activeUsers: clients.size,
    passiveListeners: passiveListeners.size,
    orientationListeners: orientationListeners.size,
    bulkDataListeners: bulkDataListeners.size,
    activeSender: activeDataSender,
    totalDataPoints: totalDataPoints,
    dataRate: dataPointsLastMinute,
    bulkQueueSize: bulkDataQueue.length,
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    users: users
  };
}

// Status reporting - prints server statistics every minute
setInterval(() => {
  if (clients.size > 0 || passiveListeners.size > 0 || orientationListeners.size > 0 || bulkDataListeners.size > 0) {
    console.log('📊 Server Status Report:');
    console.log(`   Connected users: ${clients.size}/${MAX_USERS}`);
    console.log(`   Passive listeners: ${passiveListeners.size}`);
    console.log(`   Orientation listeners: ${orientationListeners.size}`);
    console.log(`   Bulk data listeners: ${bulkDataListeners.size}`);
    console.log(`   Bulk queue size: ${bulkDataQueue.length}`);
    console.log(`   Active sender: ${activeDataSender || 'none'}`);
    
    let totalData = 0;
    clients.forEach((client, id) => {
      const displayName = client.username || id;
      const timeSinceData = client.lastDataTime 
        ? Math.round((new Date() - client.lastDataTime) / 1000)
        : 'never';
      const role = client.isActiveSender ? ' [ACTIVE]' : '';
      console.log(`   - ${displayName}${role}: ${client.dataCount} records (last: ${timeSinceData}s ago)`);
      totalData += client.dataCount;
    });
    
    console.log(`   Total data points: ${totalData}`);
    console.log('');
  }
}, 60000);

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
  console.log(`   Disconnecting ${clients.size} users, ${dashboardClients.size} dashboards, ${passiveListeners.size} listeners, ${orientationListeners.size} orientation listeners, and ${bulkDataListeners.size} bulk listeners...`);
  
  clearSenderTimeout();
  
  // Clear bulk data batch timer
  if (bulkDataBatchTimer) {
    clearInterval(bulkDataBatchTimer);
    bulkDataBatchTimer = null;
  }
  
  // Send any remaining bulk data
  if (bulkDataQueue.length > 0) {
    sendBulkDataBatch();
  }
  
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
  
  passiveListeners.forEach(ws => {
    ws.send(JSON.stringify({
      type: 'server_shutdown',
      message: 'Server is shutting down'
    }));
    ws.close();
  });
  
  orientationListeners.forEach(ws => {
    ws.send(JSON.stringify({
      type: 'server_shutdown',
      message: 'Server is shutting down'
    }));
    ws.close();
  });
  
  bulkDataListeners.forEach(ws => {
    ws.send(JSON.stringify({
      type: 'server_shutdown',
      message: 'Server is shutting down'
    }));
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
