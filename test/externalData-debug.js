/**
 * External Data WebSocket Receiver - Debug Version
 * 
 * Drop this into your p5.js sketch to help debug empty data issues.
 * This version includes extensive logging to trace where data gets lost.
 * 
 * Usage:
 * 1. Include this file in your HTML before your sketch
 * 2. The externalData object will be available globally
 * 3. Open browser console to see diagnostic messages
 */

// External data object with default values
let externalData = {
  connected: false,
  websocket: null,
  delayMs: 500,
  updateRate: 60,
  
  // Sensor data
  location: {
    latitude: 0,
    longitude: 0,
    timezone: 'UTC'
  },
  
  orientation: {
    alpha: 0,
    beta: 0,
    gamma: 0,
    buffered: {
      alpha: 0,
      beta: 0,
      gamma: 0
    }
  },
  
  time: {
    hour: 10,
    minute: 1,
    day: 4
  },
  
  wind: {
    speed: 0,
    direction: 0,
    gustSpeed: 0
  },
  
  effects: {
    orientationInfluence: 0.5,
    timeInfluence: 0.5,
    windScale: 1,
    imageReplaceMode: false
  },
  
  image: {
    available: false,
    data: null,
    width: 0,
    height: 0
  }
};

// Debug logging helper
function debugLog(category, message, data) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [${category}] ${message}`);
  if (data) {
    console.log(data);
  }
}

// Initialize WebSocket connection
function initExternalData(serverUrl) {
  debugLog('INIT', '🔌 Initializing WebSocket connection to: ' + serverUrl);
  
  try {
    const ws = new WebSocket(serverUrl);
    externalData.websocket = ws;
    
    ws.onopen = () => {
      debugLog('WEBSOCKET', '✅ WebSocket connected successfully');
      externalData.connected = true;
      
      // Send handshake if needed
      ws.send(JSON.stringify({
        type: 'handshake',
        client: 'p5js-sketch',
        timestamp: new Date().toISOString()
      }));
    };
    
    ws.onerror = (error) => {
      debugLog('WEBSOCKET', '❌ WebSocket error', error);
      externalData.connected = false;
    };
    
    ws.onclose = () => {
      debugLog('WEBSOCKET', '🔌 WebSocket disconnected');
      externalData.connected = false;
      
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        debugLog('WEBSOCKET', '🔄 Attempting to reconnect...');
        initExternalData(serverUrl);
      }, 5000);
    };
    
    ws.onmessage = (event) => {
      try {
        debugLog('MESSAGE', '📨 Raw message received');
        debugLog('MESSAGE', '   Size: ' + event.data.length + ' bytes');
        
        // Parse message
        const message = JSON.parse(event.data);
        debugLog('MESSAGE', '📋 Message type: ' + message.type);
        
        // Log message structure for debugging
        debugLog('MESSAGE', '   Message keys: ' + Object.keys(message).join(', '));
        
        // Handle different message types
        if (message.type === 'sensor_data' || message.type === 'data') {
          handleSensorData(message);
        } else if (message.type === 'listener_connected') {
          debugLog('MESSAGE', '✅ Confirmed as passive listener');
        } else if (message.type === 'stats') {
          debugLog('MESSAGE', '📊 Stats update received');
        } else {
          debugLog('MESSAGE', '⚠️  Unknown message type: ' + message.type);
        }
        
      } catch (error) {
        debugLog('ERROR', '❌ Failed to parse message', error);
        debugLog('ERROR', '   Raw data: ' + event.data.substring(0, 200));
      }
    };
    
  } catch (error) {
    debugLog('ERROR', '❌ Failed to create WebSocket', error);
  }
}

// Handle sensor data messages
function handleSensorData(message) {
  debugLog('DATA', '🔍 Processing sensor data message');
  
  // The data might be in message.data or directly in message
  const sensorData = message.data || message;
  
  debugLog('DATA', '   Data keys: ' + Object.keys(sensorData).join(', '));
  
  // Extract GPS data
  if (sensorData.gps) {
    debugLog('DATA', '📍 GPS data found:');
    debugLog('DATA', `   Latitude: ${sensorData.gps.latitude} (type: ${typeof sensorData.gps.latitude})`);
    debugLog('DATA', `   Longitude: ${sensorData.gps.longitude} (type: ${typeof sensorData.gps.longitude})`);
    
    if (sensorData.gps.latitude !== 0 || sensorData.gps.longitude !== 0) {
      externalData.location.latitude = sensorData.gps.latitude;
      externalData.location.longitude = sensorData.gps.longitude;
      debugLog('DATA', '   ✅ GPS values updated');
    } else {
      debugLog('DATA', '   ⚠️  GPS values are zero - sensor might not be active');
    }
  } else {
    debugLog('DATA', '   ❌ No GPS data in message');
  }
  
  // Extract orientation data
  if (sensorData.orientation) {
    debugLog('DATA', '🧭 Orientation data found:');
    debugLog('DATA', `   Alpha: ${sensorData.orientation.alpha}°`);
    debugLog('DATA', `   Beta: ${sensorData.orientation.beta}°`);
    debugLog('DATA', `   Gamma: ${sensorData.orientation.gamma}°`);
    
    if (sensorData.orientation.alpha !== 0 || 
        sensorData.orientation.beta !== 0 || 
        sensorData.orientation.gamma !== 0) {
      // Use smoothing/buffering
      externalData.orientation.buffered.alpha = sensorData.orientation.alpha;
      externalData.orientation.buffered.beta = sensorData.orientation.beta;
      externalData.orientation.buffered.gamma = sensorData.orientation.gamma;
      
      // Smooth update
      externalData.orientation.alpha = lerp(
        externalData.orientation.alpha,
        sensorData.orientation.alpha,
        0.1
      );
      externalData.orientation.beta = lerp(
        externalData.orientation.beta,
        sensorData.orientation.beta,
        0.1
      );
      externalData.orientation.gamma = lerp(
        externalData.orientation.gamma,
        sensorData.orientation.gamma,
        0.1
      );
      
      debugLog('DATA', '   ✅ Orientation values updated');
    } else {
      debugLog('DATA', '   ⚠️  Orientation values are zero - sensor might not be active');
    }
  } else {
    debugLog('DATA', '   ❌ No orientation data in message');
  }
  
  // Extract weather/wind data
  if (sensorData.weather) {
    debugLog('DATA', '🌤️  Weather data found:');
    debugLog('DATA', `   Wind speed: ${sensorData.weather.windSpeed} km/h`);
    debugLog('DATA', `   Wind direction: ${sensorData.weather.windDirection}°`);
    
    if (sensorData.weather.windSpeed !== undefined) {
      externalData.wind.speed = sensorData.weather.windSpeed;
      externalData.wind.direction = sensorData.weather.windDirection || 0;
      debugLog('DATA', '   ✅ Wind values updated');
    }
  } else {
    debugLog('DATA', '   ℹ️  No weather data in message');
  }
  
  // Extract time data (if timestamp provided)
  if (sensorData.timestamp) {
    const date = new Date(sensorData.timestamp);
    externalData.time.hour = date.getHours();
    externalData.time.minute = date.getMinutes();
    externalData.time.day = date.getDate();
    debugLog('DATA', `⏰ Time updated: ${externalData.time.hour}:${externalData.time.minute}`);
  }
  
  // Extract photo data (if available)
  if (sensorData.photoBase64) {
    debugLog('DATA', '📷 Photo data found');
    debugLog('DATA', `   Size: ${Math.round(sensorData.photoBase64.length / 1024)}KB`);
    externalData.image.available = true;
    externalData.image.data = sensorData.photoBase64;
    // Width and height would need to be parsed from the image
  }
  
  // Log final externalData state
  debugLog('DATA', '📊 Current externalData state:', {
    connected: externalData.connected,
    location: externalData.location,
    orientation: {
      alpha: externalData.orientation.alpha.toFixed(2),
      beta: externalData.orientation.beta.toFixed(2),
      gamma: externalData.orientation.gamma.toFixed(2)
    },
    wind: externalData.wind,
    time: externalData.time
  });
}

// Helper function for smooth transitions (if p5.js lerp not available)
function lerp(start, end, amt) {
  return start + (end - start) * amt;
}

// Auto-initialize if URL parameter provided
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const wsUrl = urlParams.get('ws') || urlParams.get('websocket');
  
  if (wsUrl) {
    debugLog('INIT', '🚀 Auto-initializing with URL parameter: ' + wsUrl);
    initExternalData(wsUrl);
  } else {
    // Default server URL - update this for your setup
    const defaultUrl = 'wss://pocket-parrot-backend-eb141a6427d7.herokuapp.com/listener';
    debugLog('INIT', '⚠️  No WebSocket URL in URL params, using default: ' + defaultUrl);
    debugLog('INIT', '   To specify: add ?ws=your-websocket-url to the URL');
    initExternalData(defaultUrl);
  }
});

// Make initExternalData available globally for manual connection
window.initExternalData = initExternalData;

debugLog('INIT', '📡 External Data WebSocket Receiver loaded (Debug Version)');
debugLog('INIT', '   This version includes extensive logging for debugging');
debugLog('INIT', '   Watch console for message flow and data updates');
