# Pocket Parrot Multi-User Server

WebSocket server for Pocket Parrot that manages multiple concurrent connections with single active sender session management and passive broadcast listeners.

## Features

- **Single Active Sender**: Only one user can send data at a time
- **Observer Mode**: Other users automatically become observers
- **Passive Listeners**: Third-party apps can receive broadcasts without session participation
- **Dashboard Monitoring**: Real-time admin interface
- **Device Fingerprinting**: Reconnection detection
- **Automatic Promotion**: Next user promoted when active sender disconnects
- **Inactivity Timeout**: 30-second timeout for automatic promotion

## Installation

```bash
npm install
```

## Usage

```bash
node multi-user-server.js [port]
```

Default port: 8080

## Endpoints

### 1. `/pocket-parrot` - User/Observer Data Endpoint

**Purpose**: Primary data ingestion from Pocket Parrot mobile clients

**Behavior**:
- One user designated as "active sender" who transmits data
- Other users become "observers" who receive broadcasts
- Automatic promotion when active sender disconnects or inactive
- Session management with device fingerprinting
- Rate limited to 25 concurrent users

**Messages Sent to Clients**:
- `observer_mode` - Notifies client they are in observer mode
- `promoted` - Notifies client they are now active sender
- `demoted` - Notifies client they are no longer active sender
- `sender_changed` - Notifies observers of new active sender
- `ack` - Acknowledges data receipt
- `welcome` - Welcome message after handshake
- `rejected` - Data rejected (not active sender or rate limited)
- `kicked` - Disconnected by admin
- `server_shutdown` - Server shutting down

**Messages Received from Clients**:
- `handshake` - Initial connection with device/user info
- `data` - Sensor data transmission (active sender only)
- `request_sender_role` - Request to become active sender

### 2. `/dashboard` - Admin Monitoring Endpoint

**Purpose**: Administrative monitoring and control interface

**Behavior**:
- Receives real-time statistics and connection events
- Can kick users, promote users, or demote active sender
- Not counted against user limits
- No data transmission capability

**Messages Sent to Dashboards**:
- `stats` - Server statistics (users, data rate, uptime)
- `userConnected` - User connection event
- `userDisconnected` - User disconnection event
- `senderPromoted` - Active sender promotion event
- `dataReceived` - Data point received event

**Messages Received from Dashboards**:
- `getStats` - Request current statistics
- `kickUser` - Kick a specific user
- `promoteUser` - Promote a user to active sender
- `demoteUser` - Demote current active sender

### 3. `/listener` - Passive Broadcast Listener Endpoint ⭐ NEW

**Purpose**: Third-party integrations that only need to receive data

**Behavior**:
- **Receive only**: Gets sensor data broadcasts and statistics
- **No session participation**: Not assigned user/observer roles
- **No session messages**: Does not receive user-specific messages
- **Unlimited connections**: Not counted against user limits
- **No interference**: Does not affect user/observer sessions

**Messages Sent to Listeners**:
- `listener_connected` - Welcome message on connection
- `sensor_data` - Real-time sensor data from active sender
- `stats` - Server statistics
- `server_shutdown` - Server shutting down

**Messages NOT Sent to Listeners**:
- `promoted` / `demoted` / `observer_mode`
- `sender_changed` / `ack` / `rejected`
- Any user/session-specific messages

**Use Cases**:
- Real-time visualization dashboards (p5.js sketches)
- Data analytics and monitoring systems
- External logging applications
- Third-party integrations requiring read-only access

### 4. `/orientation` - Low-Latency Orientation Data Endpoint ⚡ NEW

**Purpose**: High-frequency, low-latency orientation data stream for real-time applications

**Behavior**:
- **Immediate delivery**: Orientation data sent as soon as received (no batching)
- **Minimal overhead**: Only orientation data (alpha, beta, gamma) - no GPS, weather, or media
- **High frequency**: Supports rapid updates for responsive applications
- **Read-only**: Listeners cannot send data
- **Unlimited connections**: Not counted against user limits

**Messages Sent to Listeners**:
- `orientation_listener_connected` - Welcome message on connection
- `orientation_data` - Immediate orientation data with minimal payload
- `server_shutdown` - Server shutting down

**Message Format** (`orientation_data`):
```json
{
  "type": "orientation_data",
  "timestamp": "2025-10-14T04:43:21.504Z",
  "userId": "user_123",
  "username": "optional_name",
  "orientation": {
    "alpha": 90.5,
    "beta": 15.2,
    "gamma": -5.8
  }
}
```

**Use Cases**:
- Real-time 3D visualizations requiring low-latency orientation
- Interactive installations responding to device orientation
- AR/VR experiences
- Motion-controlled applications
- Live performance art installations

### 5. `/bulk` - Batched Bulk Data Endpoint 📦 NEW

**Purpose**: Efficient delivery of non-time-critical data (GPS, weather, photos, audio)

**Behavior**:
- **Batched delivery**: Data queued and sent in batches at regular intervals
- **Configurable batching**: Batch interval (default: 1s) and max batch size (default: 10)
- **Optimized bandwidth**: Reduces message overhead for bulk data
- **Excludes orientation**: Orientation data not included (use `/orientation` endpoint)
- **Read-only**: Listeners cannot send data
- **Unlimited connections**: Not counted against user limits

**Messages Sent to Listeners**:
- `bulk_listener_connected` - Welcome message with batch configuration
- `bulk_data_batch` - Batched data array
- `server_shutdown` - Server shutting down

**Message Format** (`bulk_data_batch`):
```json
{
  "type": "bulk_data_batch",
  "timestamp": "2025-10-14T04:43:21.504Z",
  "batchSize": 5,
  "data": [
    {
      "timestamp": "2025-10-14T04:43:20.123Z",
      "userId": "user_123",
      "username": "optional_name",
      "gps": { "latitude": 47.6, "longitude": -122.3, ... },
      "motion": { "accelerationX": 0.5, ... },
      "weather": { "temperature": 20, ... },
      "objectsDetected": [...],
      "photoBase64": "...",
      "audioBase64": "...",
      "colorPalette": [...]
    },
    // ... more data points
  ]
}
```

**Use Cases**:
- Data logging and archival systems
- Analytics requiring GPS and weather data
- Photo/audio processing pipelines
- Non-real-time visualizations
- Efficient data collection for large-scale deployments

**Configuration**:
- `BATCH_INTERVAL`: Time between batch sends (default: 1000ms)
- `MAX_BATCH_SIZE`: Maximum items per batch (default: 10)
- Batches sent immediately if max size reached, regardless of interval


## Example: Connecting as Passive Listener

```javascript
const ws = new WebSocket('ws://your-server.com:8080/listener');

ws.onopen = () => {
  console.log('Connected as passive listener');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'sensor_data') {
    const data = message.data;
    console.log('GPS:', data.gps);
    console.log('Orientation:', data.orientation);
    // Update your visualization, analytics, etc.
  }
  
  if (message.type === 'stats') {
    console.log('Active users:', message.data.activeUsers);
    console.log('Passive listeners:', message.data.passiveListeners);
  }
};
```

## Example: Connecting to Orientation Endpoint (Low-Latency)

```javascript
const ws = new WebSocket('ws://your-server.com:8080/orientation');

ws.onopen = () => {
  console.log('Connected to orientation stream');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'orientation_data') {
    const { alpha, beta, gamma } = message.orientation;
    
    // Update 3D visualization immediately
    updateCameraRotation(alpha, beta, gamma);
    
    // Log for debugging
    console.log(`Orientation: α=${alpha}° β=${beta}° γ=${gamma}°`);
  }
};
```

## Example: Connecting to Bulk Data Endpoint (Batched)

```javascript
const ws = new WebSocket('ws://your-server.com:8080/bulk');

ws.onopen = () => {
  console.log('Connected to bulk data stream');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'bulk_listener_connected') {
    console.log(`Batch interval: ${message.batchInterval}ms`);
    console.log(`Max batch size: ${message.maxBatchSize}`);
  }
  
  if (message.type === 'bulk_data_batch') {
    console.log(`Received batch of ${message.batchSize} data points`);
    
    message.data.forEach(dataPoint => {
      // Process GPS data
      if (dataPoint.gps) {
        saveToDatabase(dataPoint.gps);
      }
      
      // Process weather data
      if (dataPoint.weather) {
        updateWeatherAnalytics(dataPoint.weather);
      }
      
      // Process photos
      if (dataPoint.photoBase64) {
        processImage(dataPoint.photoBase64);
      }
    });
  }
};
```

## Performance Optimization: Combined Approach

For applications requiring both real-time orientation and periodic bulk data:

```javascript
// Connect to both endpoints
const orientationWs = new WebSocket('ws://your-server.com:8080/orientation');
const bulkWs = new WebSocket('ws://your-server.com:8080/bulk');

// Handle low-latency orientation for real-time interaction
orientationWs.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'orientation_data') {
    // Immediate response - update UI/3D scene
    updateOrientation(message.orientation);
  }
};

// Handle bulk data for analysis and logging
bulkWs.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'bulk_data_batch') {
    // Batch processing - save to database, update analytics
    processBatch(message.data);
  }
};
```


## Configuration

- `MAX_USERS`: Maximum concurrent users (default: 25)
- `SENDER_TIMEOUT`: Inactivity timeout in ms (default: 30000 = 30s)
- `BATCH_INTERVAL`: Bulk data batch interval in ms (default: 1000 = 1s)
- `MAX_BATCH_SIZE`: Maximum items per bulk data batch (default: 10)
- `PORT`: Server port (default: 8080, override with env var or CLI arg)

## Statistics

The server tracks and broadcasts:
- `activeUsers` - Number of connected users/observers
- `passiveListeners` - Number of connected passive listeners
- `orientationListeners` - Number of connected orientation listeners
- `bulkDataListeners` - Number of connected bulk data listeners
- `activeSender` - ID of current active sender
- `totalDataPoints` - Total data points received since start
- `dataRate` - Data points per minute
- `bulkQueueSize` - Current size of bulk data batch queue
- `uptime` - Server uptime in seconds
- `users` - Array of connected user details

## Deployment

### Local Testing

```bash
node multi-user-server.js 8080
```

### Production (Heroku)

The server includes a `Procfile` for Heroku deployment:

```bash
heroku create my-pocket-parrot-server
git push heroku main
```

### Production (PM2)

```bash
npm install -g pm2
pm2 start multi-user-server.js --name pocket-parrot-server
pm2 save
pm2 startup
```

## Testing

Run the included test script:

```bash
node test-listener.js
```

This tests:
- Passive listener connection
- User/observer session management
- Sensor data broadcasting
- Message routing
- Statistics accuracy

## Related Files

- `dashboard.html` - Web-based monitoring dashboard
- `listener-example.html` - Example passive listener client
- `../docs/MULTI_USER_GUIDE.md` - Complete guide
- `../docs/DATA_ACCESS_API.md` - API documentation

## License

MIT
