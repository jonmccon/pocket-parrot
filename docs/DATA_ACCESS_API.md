# 📡 Pocket Parrot Data Access API

## Overview

The Pocket Parrot Data Access API enables external systems to integrate with and consume sensor data captured by the Pocket Parrot application. This document describes three integration methods:

1. **JavaScript API** - For same-origin browser integrations
2. **WebSocket Push** - For real-time data streaming to external servers
3. **Export API** - For batch data access and filtering

**Key Features:**
- **Immediate Orientation Broadcasting**: Device orientation (alpha, beta, gamma) is broadcast immediately when detected, before full sensor capture completes
- **Optimized Endpoints**: Choose from `/orientation`, `/bulk`, or `/listener` based on your latency and payload requirements
- **Real-time Subscriptions**: Get notified instantly when new data is captured
- **Flexible Filtering**: Query historical data by date, GPS, media presence, and more

## Architecture

The Data Access API maintains the client-side architecture of Pocket Parrot while enabling external data access:

- **No server required** - API runs entirely in the browser
- **Real-time subscriptions** - Observer pattern for immediate data access
- **Push to external servers** - WebSocket client for remote ingestion
- **Flexible filtering** - Query data by date, GPS, media, and more

---

## Orientation Data Handling

### Immediate Broadcasting

Pocket Parrot broadcasts device orientation data **immediately** when it changes, separate from the main sensor capture cycle. This enables ultra-low-latency orientation updates for real-time applications.

**How it works:**
1. Device orientation events are captured continuously via `deviceorientation` event listener
2. Each orientation change is immediately broadcast to WebSocket connections (if enabled)
3. Full sensor data (GPS, weather, etc.) is captured separately at the configured interval
4. This dual-stream approach minimizes latency for orientation-dependent visualizations

**Benefits:**
- **Sub-millisecond latency**: Orientation updates don't wait for GPS or weather data
- **High frequency**: Supports rapid device movements without queueing
- **Responsive UX**: 3D visualizations and AR applications feel immediate and natural

### Endpoint Selection for Orientation

**For Low-Latency Orientation (Recommended for 3D/AR/VR):**
```javascript
// Connect to specialized orientation endpoint
const ws = new WebSocket('ws://server:8080/orientation');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'orientation_data') {
    const { alpha, beta, gamma } = msg.orientation;
    // Update your 3D scene immediately
    updateCameraRotation(alpha, beta, gamma);
  }
};
```

**Message Format:**
```json
{
  "type": "orientation_data",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "userId": "user_123",
  "username": "Phone User",
  "orientation": {
    "alpha": 180.5,    // Compass heading (0-360°)
    "beta": 15.2,      // Front-to-back tilt (-180 to 180°)
    "gamma": -5.8      // Left-to-right tilt (-90 to 90°)
  }
}
```

**For Complete Data with Orientation:**
```javascript
// Use general listener or bulk endpoint for full data
const ws = new WebSocket('ws://server:8080/listener');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'sensor_data') {
    const data = msg.data;
    // Has orientation plus GPS, weather, motion, etc.
    console.log(data.orientation, data.gps, data.weather);
  }
};
```

### Understanding Orientation Values

**Alpha (Compass Heading):**
- Range: 0° to 360°
- 0° = North, 90° = East, 180° = South, 270° = West
- Represents rotation around Z-axis (perpendicular to screen)

**Beta (Tilt Front/Back):**
- Range: -180° to 180°
- 0° = Device flat, positive = tilted forward, negative = tilted back
- Represents rotation around X-axis (left to right edge)

**Gamma (Tilt Left/Right):**
- Range: -90° to 90°
- 0° = Device flat, positive = tilted right, negative = tilted left
- Represents rotation around Y-axis (top to bottom edge)

**Example Use Cases:**
- **Compass apps**: Use `alpha` for heading
- **Level/inclinometer**: Use `beta` and `gamma` for tilt
- **3D camera control**: Use all three for complete orientation
- **Motion detection**: Track changes over time for gesture recognition

---

## 1. JavaScript API Access

### Overview

The JavaScript API provides programmatic access to Pocket Parrot data for same-origin integrations. This is ideal for:
- Building custom dashboards
- Creating data analysis tools
- Integrating with other browser-based applications

### Getting Started

The API is globally available as `window.pocketParrotAPI` once the application is initialized.

```javascript
// Access the global API instance
const api = window.pocketParrotAPI;
```

### Core Methods

#### `getAllData(options)`

Get all data points from IndexedDB with optional filtering.

**Parameters:**
- `options` (Object, optional):
  - `startDate` (String): ISO 8601 date string - filter from this date
  - `endDate` (String): ISO 8601 date string - filter until this date
  - `hasGPS` (Boolean): Only return records with GPS data
  - `hasPhoto` (Boolean): Only return records with photos
  - `hasAudio` (Boolean): Only return records with audio
  - `limit` (Number): Maximum number of records to return

**Returns:** `Promise<Array>` - Array of data point objects

**Example:**
```javascript
// Get all data
const allData = await api.getAllData();

// Get data with GPS from last 7 days
const recentGPS = await api.getAllData({
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  hasGPS: true
});

// Get last 10 records with photos
const recentPhotos = await api.getAllData({
  hasPhoto: true,
  limit: 10
});
```

#### `getDataById(id)`

Retrieve a specific data point by its ID.

**Parameters:**
- `id` (Number): The data point ID

**Returns:** `Promise<Object>` - The data point object

**Example:**
```javascript
const dataPoint = await api.getDataById(123);
console.log(dataPoint.timestamp, dataPoint.gps);
```

#### `getRecordCount()`

Get the total number of captured records.

**Returns:** `Promise<Number>` - Count of records

**Example:**
```javascript
const count = await api.getRecordCount();
console.log(`Total records: ${count}`);
```

#### `subscribe(callback)`

Subscribe to real-time data updates. Your callback will be invoked whenever new data is captured.

**Parameters:**
- `callback` (Function): Function to call with new data point

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
// Subscribe to real-time updates
const unsubscribe = api.subscribe((dataPoint) => {
  console.log('New data captured:', dataPoint);
  console.log('GPS:', dataPoint.gps);
  console.log('Objects detected:', dataPoint.objectsDetected);
});

// Later, to unsubscribe:
unsubscribe();
```

#### `exportJSON(options)`

Export data as JSON string with optional filtering.

**Parameters:**
- `options` (Object, optional):
  - All options from `getAllData()`
  - `includeMedia` (Boolean): Convert blobs to base64 (default: false)

**Returns:** `Promise<String>` - JSON string

**Example:**
```javascript
// Export without media (smaller)
const json = await api.exportJSON({
  startDate: '2024-01-01',
  hasGPS: true
});

// Export with media included as base64
const jsonWithMedia = await api.exportJSON({
  includeMedia: true,
  limit: 100
});

// Save to file
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'pocket-parrot-data.json';
a.click();
```

#### `getStatus()`

Get the current status of the API.

**Returns:** `Object` - Status object with:
- `subscribers` (Number): Number of active subscriptions
- `wsEnabled` (Boolean): Whether WebSocket is enabled
- `wsEndpoint` (String): Configured WebSocket endpoint
- `wsConnections` (Number): Number of active WebSocket connections
- `wsConnectionStates` (Array): Details of each WebSocket connection

**Example:**
```javascript
const status = api.getStatus();
console.log('Active subscribers:', status.subscribers);
console.log('WebSocket enabled:', status.wsEnabled);
console.log('Active connections:', status.wsConnections);
```

### Complete Example

```javascript
// Initialize connection
const api = window.pocketParrotAPI;

// Subscribe to real-time updates
const unsubscribe = api.subscribe(async (newData) => {
  console.log('📊 New data point captured!');
  console.log('Time:', newData.timestamp);
  console.log('Location:', newData.gps);
  
  // Check if we have enough data
  const count = await api.getRecordCount();
  if (count >= 100) {
    console.log('Reached 100 records, stopping subscription');
    unsubscribe();
  }
});

// Query historical data
const historicalData = await api.getAllData({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  hasGPS: true,
  limit: 50
});

console.log(`Found ${historicalData.length} records with GPS`);

// Export filtered data
const exportData = await api.exportJSON({
  hasGPS: true,
  hasPhoto: true,
  includeMedia: false
});

console.log('Export size:', (exportData.length / 1024).toFixed(2), 'KB');
```

---

## 2. WebSocket Push Integration

### Overview

The WebSocket Push feature allows Pocket Parrot to send captured data to an external server in real-time. This is ideal for:
- Server-side data processing
- Cloud storage and backup
- Integration with existing data pipelines
- Real-time monitoring dashboards

### Endpoint Selection

The Pocket Parrot server provides specialized endpoints optimized for different use cases:

#### `/orientation` - Low-Latency Orientation Stream
**Best for:** Real-time 3D visualizations, AR/VR experiences, interactive installations

**Characteristics:**
- **Latency**: < 1ms (immediate transmission)
- **Payload**: Minimal (orientation data only)
- **Frequency**: High (10-60 Hz typical)
- **Data**: Alpha, beta, gamma angles only

**When to use:**
- Motion-controlled applications requiring immediate response
- 3D scene rendering that must feel natural and responsive
- Live performance art or interactive installations
- Any application where orientation latency is critical

#### `/bulk` - Batched Bulk Data Stream
**Best for:** Data analytics, logging systems, photo/audio processing, archival

**Characteristics:**
- **Latency**: ~1 second (configurable batching interval)
- **Payload**: Complete (GPS, weather, motion, media, objects)
- **Efficiency**: Batches up to 10 data points per message
- **Data**: Everything except orientation (which is on separate endpoint)

**When to use:**
- Background data collection for later analysis
- Systems that benefit from batch processing
- Database writes that perform better with bulk inserts
- Non-time-sensitive data aggregation

#### `/listener` - General Passive Listener
**Best for:** General-purpose data consumption, development/testing, mixed requirements

**Characteristics:**
- **Latency**: Immediate (no batching)
- **Payload**: Complete data points sent individually
- **Simplicity**: Single connection receives all data types
- **Data**: Full sensor data including orientation, GPS, weather, media

**When to use:**
- Prototyping and development
- Applications that need all data types
- When simplicity is more important than optimization
- Mixed use cases that don't fit specialized endpoints

#### `/pocket-parrot` - Primary Client Endpoint
**For:** Mobile Pocket Parrot clients only (not recommended for custom integrations)

**Characteristics:**
- **Session management**: Active sender, observer mode, promotion/demotion
- **User-specific**: Receives session control messages
- **Complexity**: Requires handling of role-based messages

**When to use:**
- Only when building a Pocket Parrot client application
- Not recommended for data consumption/integration

### Configuration

Configure the WebSocket endpoint through the UI (Settings page) or programmatically:

```javascript
const api = window.pocketParrotAPI;

// Configure endpoint
api.configureWebSocket('ws://your-server.com:8080/pocket-parrot', {
  autoReconnect: true,      // Automatically reconnect on disconnect
  reconnectDelay: 5000      // Delay before reconnect attempt (ms)
});

// Enable WebSocket push
await api.enableWebSocket();

// Check status
const status = api.getStatus();
console.log('WebSocket enabled:', status.wsEnabled);
console.log('Active connections:', status.wsConnections);

// Later, to disable
api.disableWebSocket();
```

### WebSocket Message Protocol

#### Handshake Message (Sent on connection)

```json
{
  "type": "handshake",
  "client": "PocketParrot",
  "version": "1.0",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Data Message (Sent when data is captured)

```json
{
  "type": "data",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "id": 123,
    "timestamp": "2024-01-01T12:00:00.000Z",
    "captureMethod": "modular_sensor_capture",
    "gps": {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "altitude": 10.5,
      "accuracy": 20.0,
      "speed": 0,
      "heading": null
    },
    "orientation": {
      "alpha": 180.5,
      "beta": 10.2,
      "gamma": -5.1
    },
    "motion": {
      "accelerationX": 0.1,
      "accelerationY": 0.2,
      "accelerationZ": 9.8
    },
    "weather": {
      "temperature": 18.5,
      "humidity": 65,
      "windSpeed": 5.2,
      "windDirection": 180,
      "weatherCode": 0
    },
    "objectsDetected": [
      {
        "class": "person",
        "score": 0.95,
        "bbox": [100, 200, 150, 300]
      }
    ],
    "photoBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "audioBase64": "data:audio/wav;base64,UklGRiQAAABXQVZ..."
  }
}
```

### Server-Side Example (Node.js)

```javascript
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Pocket Parrot client connected');
  
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'handshake') {
      console.log('Handshake received:', data.client, data.version);
    } else if (data.type === 'data') {
      console.log('Data received:', data.data.timestamp);
      console.log('GPS:', data.data.gps);
      console.log('Objects:', data.data.objectsDetected);
      
      // Process and store the data
      processData(data.data);
      
      // Send acknowledgment (optional)
      ws.send(JSON.stringify({
        type: 'ack',
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

function processData(sensorData) {
  // Your data processing logic here
  // Save to database, trigger analytics, etc.
}

console.log('WebSocket server listening on port 8080');
```

### Server-Side Example (Python)

```python
import asyncio
import websockets
import json

async def handle_client(websocket, path):
    print("Pocket Parrot client connected")
    
    async for message in websocket:
        data = json.loads(message)
        
        if data['type'] == 'handshake':
            print(f"Handshake: {data['client']} {data['version']}")
        
        elif data['type'] == 'data':
            sensor_data = data['data']
            print(f"Data received: {sensor_data['timestamp']}")
            print(f"GPS: {sensor_data.get('gps')}")
            print(f"Objects: {len(sensor_data.get('objectsDetected', []))}")
            
            # Process and store the data
            process_data(sensor_data)
            
            # Send acknowledgment (optional)
            await websocket.send(json.dumps({
                'type': 'ack',
                'timestamp': datetime.utcnow().isoformat()
            }))

def process_data(sensor_data):
    # Your data processing logic here
    pass

async def main():
    async with websockets.serve(handle_client, "0.0.0.0", 8080):
        print("WebSocket server listening on port 8080")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
```

### Testing WebSocket Connection

Use the Settings page UI or test programmatically:

```javascript
// Test connection before enabling
const testWs = new WebSocket('ws://your-server.com:8080');

testWs.onopen = () => {
  console.log('✅ Connection successful');
  testWs.close();
};

testWs.onerror = (error) => {
  console.error('❌ Connection failed:', error);
};
```

---

## 3. Data Schema

### Data Point Object Structure

```javascript
{
  // Core Fields
  id: Number,                        // Auto-incrementing ID
  timestamp: String,                 // ISO 8601 timestamp
  captureMethod: String,             // "modular_sensor_capture"
  
  // Module Status
  modules: {
    permissionsRequested: Boolean,
    gpsEnabled: Boolean,
    orientationEnabled: Boolean,
    motionEnabled: Boolean,
    weatherEnabled: Boolean,
    cameraEnabled: Boolean,
    audioEnabled: Boolean
  },
  
  // GPS Data (null if unavailable)
  gps: {
    latitude: Number,
    longitude: Number,
    altitude: Number,                // meters
    accuracy: Number,                // meters
    speed: Number,                   // m/s
    heading: Number                  // degrees
  },
  
  // Device Orientation (null if unavailable)
  orientation: {
    alpha: Number,                   // Z-axis rotation (0-360)
    beta: Number,                    // X-axis rotation (-180 to 180)
    gamma: Number                    // Y-axis rotation (-90 to 90)
  },
  
  // Motion Data (null if unavailable)
  motion: {
    accelerationX: Number,           // m/s²
    accelerationY: Number,           // m/s²
    accelerationZ: Number            // m/s²
  },
  
  // Weather Data (null if unavailable)
  weather: {
    temperature: Number,             // Celsius
    humidity: Number,                // Percentage
    windSpeed: Number,               // km/h
    windDirection: Number,           // Degrees
    weatherCode: Number,             // WMO code
    precipitation: Number,           // mm
    cloudCover: Number              // Percentage
  },
  
  // Object Detection Results
  objectsDetected: [
    {
      class: String,                 // Object class name
      score: Number,                 // Confidence (0-1)
      bbox: [x, y, width, height]   // Bounding box
    }
  ],
  
  // Color Palette (if photo captured)
  colorPalette: [
    {
      r: Number,                     // Red (0-255)
      g: Number,                     // Green (0-255)
      b: Number,                     // Blue (0-255)
      hex: String                    // Hex color code
    }
  ],
  
  // Media (Blobs in IndexedDB, Base64 in exports/WebSocket)
  photoBlob: Blob,                   // In IndexedDB
  photoBase64: String,               // In exports/WebSocket
  audioBlob: Blob,                   // In IndexedDB
  audioBase64: String                // In exports/WebSocket
}
```

---

## Security Considerations

### Same-Origin Policy

The JavaScript API is subject to browser same-origin policies. For cross-origin access, consider:
- Using the WebSocket push method instead
- Hosting your integration on the same domain
- Using browser extensions with appropriate permissions

### WebSocket Security

For production deployments:

1. **Use WSS (WebSocket Secure)** - Encrypt data in transit
   ```javascript
   api.configureWebSocket('wss://your-server.com/pocket-parrot');
   ```

2. **Implement Authentication** - Add token-based auth to your server
   ```javascript
   // Client sends auth token in handshake
   // Server validates before accepting data
   ```

3. **Validate Data** - Server-side validation of received data
   ```python
   def validate_data(sensor_data):
       # Check required fields
       # Validate data types
       # Sanitize inputs
   ```

4. **Rate Limiting** - Prevent abuse on your server
   ```python
   # Limit connections per IP
   # Limit messages per connection
   ```

### Data Privacy

- All data is stored locally in IndexedDB
- No data is sent to external servers unless WebSocket is explicitly enabled
- Media files (photos/audio) are converted to base64 for transmission
- Users have full control over what data is shared

---

## Performance Considerations

### Orientation Data Performance

**Immediate Broadcasting:**
- Orientation updates are sent immediately, not queued
- Minimal overhead: ~100-200 bytes per orientation message
- High-frequency capable: tested at 10-60 Hz without issues
- No impact on other sensor capture cycles

**Optimization Tips:**
```javascript
// Good: Use specialized endpoint for orientation
const orientWs = new WebSocket('ws://server:8080/orientation');
// Only receives orientation data, minimal bandwidth

// Less optimal: Use general listener for orientation
const listenerWs = new WebSocket('ws://server:8080/listener');
// Receives all data including orientation, higher bandwidth
```

### IndexedDB Access

- Queries are asynchronous to avoid blocking UI
- Large datasets may take time to retrieve
- Use `limit` parameter to reduce query size

```javascript
// Efficient: Get only what you need
const recent = await api.getAllData({ limit: 100 });

// Inefficient: Getting all data when you only need some
const all = await api.getAllData();
const recent = all.slice(0, 100);
```

### WebSocket Push

- Data is pushed immediately when captured
- Blobs are converted to base64 (increases size by ~33%)
- Failed sends are not retried (data remains in IndexedDB)
- Consider implementing server-side queuing for high capture rates

**Endpoint-Specific Performance:**

**`/orientation` endpoint:**
- Lowest latency: < 1ms typical
- Smallest payload: ~200 bytes per message
- Highest frequency: 10-60 Hz typical
- Best for real-time interactivity

**`/bulk` endpoint:**
- Moderate latency: ~1 second (configurable)
- Variable payload: depends on batch size and media
- Efficient: reduces message overhead through batching
- Best for analytics and logging

**`/listener` endpoint:**
- Low latency: immediate (no batching)
- Full payload: complete data points
- Moderate efficiency: individual messages
- Best for general-purpose consumption

```javascript
// Monitor WebSocket buffer
const status = api.getStatus();
if (status.wsConnections > 0) {
  // Data is being pushed
} else {
  // Data is only stored locally
}
```

### Memory Management

- Large media files (photos/audio) can consume memory
- Export operations create copies in memory
- Unsubscribe from listeners when no longer needed

```javascript
// Good: Unsubscribe when done
const unsub = api.subscribe(handler);
// ... later
unsub();

// Bad: Never unsubscribing
api.subscribe(handler);
```

---

## Troubleshooting

### JavaScript API Not Available

**Problem:** `window.pocketParrotAPI` is undefined

**Solutions:**
- Wait for DOM to load: `document.addEventListener('DOMContentLoaded', ...)`
- Check browser console for errors
- Verify `data-api.js` is loaded before use

### WebSocket Connection Fails

**Problem:** Cannot connect to WebSocket server

**Solutions:**
- Verify server is running: `nc -zv your-server.com 8080`
- Check firewall rules
- Use correct protocol (ws:// vs wss://)
- Check CORS policies on server
- Test with browser console: `new WebSocket('ws://...')`

### No Data in Subscriptions

**Problem:** Subscription callback never fires

**Solutions:**
- Verify data is being captured (check IndexedDB)
- Ensure you're not unsubscribing too early
- Check browser console for errors
- Test with manual capture: click "Capture Now" button

### Export Timeout

**Problem:** Export hangs on large datasets

**Solutions:**
- Use filtering to reduce dataset size
- Set `includeMedia: false` to skip base64 conversion
- Export in smaller batches using date filters

---

## Examples

### Example 1: Real-Time Dashboard

```javascript
const api = window.pocketParrotAPI;

// Update dashboard when new data arrives
api.subscribe((data) => {
  // Update GPS position on map
  if (data.gps) {
    updateMapMarker(data.gps.latitude, data.gps.longitude);
  }
  
  // Update sensor readings
  if (data.orientation) {
    updateCompassHeading(data.orientation.alpha);
  }
  
  // Update object detection display
  if (data.objectsDetected.length > 0) {
    updateDetectedObjects(data.objectsDetected);
  }
});

// Load historical data on startup
const history = await api.getAllData({ limit: 100 });
renderHistoricalData(history);
```

### Example 2: Batch Export with Date Range

```javascript
const api = window.pocketParrotAPI;

async function exportLastWeek() {
  const endDate = new Date();
  const startDate = new Date(endDate - 7 * 24 * 60 * 60 * 1000);
  
  const json = await api.exportJSON({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    hasGPS: true,
    includeMedia: false
  });
  
  // Save to file
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pocket-parrot-${startDate.toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

exportLastWeek();
```

### Example 3: Cloud Backup via WebSocket

```javascript
const api = window.pocketParrotAPI;

// Configure cloud endpoint
api.configureWebSocket('wss://your-cloud.com/pocket-parrot-backup');

// Enable with auto-reconnect
await api.enableWebSocket();

console.log('✅ Cloud backup enabled');
console.log('All captured data will be automatically backed up');

// Monitor status
setInterval(() => {
  const status = api.getStatus();
  console.log('Backup status:', {
    connected: status.wsConnections > 0,
    subscribers: status.subscribers
  });
}, 60000); // Check every minute
```

---

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check the main README.md for general documentation
- Review browser console for error messages
- Test with the Settings page UI before programmatic use

---

**Built with ❤️ for mobile sensor data collection and integration**
