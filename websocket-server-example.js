#!/usr/bin/env node

/**
 * Simple WebSocket Server for Testing Pocket Parrot Data Access API
 * 
 * This server receives sensor data from Pocket Parrot and logs it to console.
 * 
 * Usage:
 *   node websocket-server-example.js [port]
 * 
 * Default port: 8081
 */

const WebSocket = require('ws');
const port = process.argv[2] || 8081;

const wss = new WebSocket.Server({ port });

console.log(`🦜 Pocket Parrot WebSocket Server listening on port ${port}`);
console.log(`📡 Configure Pocket Parrot to connect to: ws://localhost:${port}/pocket-parrot`);
console.log('');

wss.on('connection', (ws) => {
  console.log('✅ Client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'handshake') {
        console.log(`🤝 Handshake received: ${data.client} ${data.version}`);
        console.log(`   Time: ${data.timestamp}`);
        console.log('');
      } else if (data.type === 'data') {
        console.log('📊 Data received:');
        console.log(`   Timestamp: ${data.data.timestamp}`);
        
        if (data.data.gps) {
          console.log(`   📍 GPS: ${data.data.gps.latitude}, ${data.data.gps.longitude}`);
          console.log(`   🎯 Accuracy: ${data.data.gps.accuracy}m`);
        }
        
        if (data.data.orientation) {
          console.log(`   🧭 Orientation: α=${data.data.orientation.alpha}° β=${data.data.orientation.beta}° γ=${data.data.orientation.gamma}°`);
        }
        
        if (data.data.motion) {
          console.log(`   🏃 Motion: X=${data.data.motion.accelerationX} Y=${data.data.motion.accelerationY} Z=${data.data.motion.accelerationZ}`);
        }
        
        if (data.data.weather) {
          console.log(`   🌤️  Weather: ${data.data.weather.temperature}°C, ${data.data.weather.humidity}% humidity`);
        }
        
        if (data.data.objectsDetected && data.data.objectsDetected.length > 0) {
          console.log(`   👁️  Objects detected: ${data.data.objectsDetected.map(o => o.class).join(', ')}`);
        }
        
        if (data.data.photoBase64) {
          console.log(`   📷 Photo included: ${Math.round(data.data.photoBase64.length / 1024)}KB`);
        }
        
        if (data.data.audioBase64) {
          console.log(`   🎤 Audio included: ${Math.round(data.data.audioBase64.length / 1024)}KB`);
        }
        
        console.log('');
        
        // Send acknowledgment (optional)
        ws.send(JSON.stringify({
          type: 'ack',
          timestamp: new Date().toISOString(),
          received: data.data.id
        }));
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error.message);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Client disconnected');
    console.log('');
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
});

wss.on('error', (error) => {
  console.error('❌ Server error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  wss.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
