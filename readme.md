# 🦜 Pocket Parrot - Mobile Sensor Platform

A browser-based data capture and visualization app that runs entirely client-side with offline support. Capture sensor data, take photos with object detection, record audio, and visualize everything on an interactive map.

https://jonmccon.github.io/pocket-parrot/

## Features

### 📱 Sensor Integration
- **GPS**: Latitude, longitude, altitude, speed, accuracy
- **Device Orientation**: Alpha, beta, gamma angles and compass heading  
- **Motion Sensors**: Accelerometer data (X, Y, Z axes)
- **Camera**: Photo capture with TensorFlow.js object detection (COCO-SSD)
- **Microphone**: Audio recording in WAV format

### 🌤️ External Data
- **Weather API**: Automatic weather data from Open-Meteo
  - Temperature, humidity, wind speed/direction
  - Precipitation and cloud cover
  - Current conditions description

### 💾 Local Storage
- **IndexedDB**: All data stored locally in browser
- **Offline Support**: Works without internet connection
- **Schema**: `{ id, timestamp, gps, orientation, motion, weather, objectsDetected, photoBlob, audioBlob }`

### 📊 Data Visualization
- **Interactive Map**: Leaflet.js with data point markers
- **Data Table**: Browse all captured records
- **Filtering**: By date and detected object types
- **Export**: Download all data as JSON file

### 🎨 User Interface
- **Responsive Design**: Mobile-first with Tailwind CSS
- **Progressive Web App**: Service Worker for offline caching
- **Real-time Updates**: Live sensor data display
- **Cross-platform**: Works on desktop and mobile browsers

## Quick Start

1. **Open the app**: Simply open `index.html` in any modern web browser
2. **Grant permissions**: Allow location, camera, and microphone access when prompted
3. **Start capturing**: Use "Capture Now" for single captures or "Start Continuous Capture" for automatic data collection
4. **View data**: Switch to "View Data" tab to see captured data on map and in table
5. **Export**: Use "Export Data" to download all captured data as JSON

## Usage

### Data Capture
- **Capture Now**: Instantly capture a single data point with all available sensors
- **Continuous Capture**: Automatically capture data at configurable intervals (default: 5 seconds)
  - **Recommended rates**: 1-10 seconds for most use cases
  - **High-frequency**: Use WebSocket streaming with `/orientation` endpoint for real-time data (sub-second)
  - **Battery consideration**: Longer intervals (10-30 seconds) save battery life
- **Camera**: Start camera for photo capture with automatic object detection
- **Audio**: Record short audio snippets with start/stop controls

### Data Viewing
- **Map View**: See all GPS points plotted on an interactive map
- **Table View**: Browse data in a searchable table format  
- **Filters**: Filter by date or detected object types
- **Details**: Click any data point to see full details including media

### Data Export
- Export all captured data as a JSON file
- Includes base64-encoded images and audio
- Perfect for data analysis or backup

### 📡 Data Access API
- **JavaScript API**: Programmatic access to sensor data for same-origin integrations
- **WebSocket Push**: Real-time data streaming to external servers
- **Multi-User Support**: Multiple phones can stream to one server simultaneously
- **Passive Listeners**: Third-party apps can receive broadcast data without session participation
- **Event Mode**: Pre-configure for seamless event experiences - scan QR, start streaming!
- **Real-time Subscriptions**: Observer pattern for immediate data access
- **Flexible Filtering**: Query by date, GPS, media, and more

**Optimized Endpoints for Different Use Cases:**
- **`/orientation`** - Low-latency orientation data (< 1ms) for real-time 3D visualizations, AR/VR
- **`/bulk`** - Batched data delivery (GPS, weather, media) for efficient analytics and logging
- **`/listener`** - General-purpose passive listening for all sensor data
- **`/pocket-parrot`** - Primary endpoint for mobile clients sending data

**Documentation:**
- **See [DATA_ACCESS_API.md](docs/DATA_ACCESS_API.md) for complete API documentation**
- **See [MULTI_USER_GUIDE.md](docs/MULTI_USER_GUIDE.md) for multi-user streaming setup**
- **See [EVENT_DEPLOYMENT_GUIDE.md](docs/EVENT_DEPLOYMENT_GUIDE.md) for event deployments**
- **See [server/README.md](server/README.md) for endpoint specifications and protocols**

## Recommended Usage Patterns

### Data Capture Rates

Choose the capture interval based on your use case:

| Use Case | Recommended Interval | Data Rate | Considerations |
|----------|---------------------|-----------|----------------|
| **Real-time visualization** | Use `/orientation` endpoint | High (10-60 Hz) | Immediate orientation updates for 3D/AR/VR |
| **Live tracking** | 1-5 seconds | Medium | Good balance of accuracy and battery life |
| **General monitoring** | 5-10 seconds | Low-Medium | Default setting, works well for most cases |
| **Battery conservation** | 30-60 seconds | Low | Extends battery life significantly |
| **Analytics/Research** | 10-30 seconds | Low | Sufficient for trends and patterns |

### WebSocket Endpoint Selection

Choose the right endpoint for your integration:

**`/orientation` - Low-latency Orientation Stream**
- **Best for**: Real-time 3D visualizations, AR/VR, interactive installations
- **Latency**: < 1ms (immediate delivery)
- **Payload**: Minimal (orientation data only: alpha, beta, gamma)
- **Frequency**: Supports high-frequency updates (10-60 Hz)

**`/bulk` - Batched Bulk Data Stream**
- **Best for**: Data analytics, logging, archival, photo/audio processing
- **Latency**: ~1 second (configurable batching interval)
- **Payload**: Complete (GPS, weather, motion, media, objects detected)
- **Efficiency**: Batches up to 10 data points per message

**`/listener` - General Passive Listener**
- **Best for**: General-purpose data consumption, mixed requirements
- **Latency**: Immediate (no batching)
- **Payload**: Complete data points sent individually
- **Use case**: Simpler integration when you need all data types

**`/pocket-parrot` - Primary Client Endpoint**
- **Best for**: Mobile Pocket Parrot clients sending data
- **Features**: Session management, active sender promotion, observer mode
- **Use case**: The app itself, not typically used for custom integrations

### Performance Optimization

**For Real-time Applications:**
```javascript
// Connect to orientation endpoint for minimal latency
const orientationWs = new WebSocket('ws://server:8080/orientation');
orientationWs.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'orientation_data') {
    update3DScene(msg.orientation); // Immediate update
  }
};
```

**For Analytics & Logging:**
```javascript
// Connect to bulk endpoint for efficient batch processing
const bulkWs = new WebSocket('ws://server:8080/bulk');
bulkWs.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'bulk_data_batch') {
    msg.data.forEach(dataPoint => {
      saveToDatabase(dataPoint); // Process batch
    });
  }
};
```

**Combined Approach (Best of Both):**
```javascript
// Use both endpoints simultaneously
const orientationWs = new WebSocket('ws://server:8080/orientation');
const bulkWs = new WebSocket('ws://server:8080/bulk');

// Real-time UI updates from orientation
orientationWs.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'orientation_data') {
    updateUIImmediately(msg.orientation);
  }
};

// Background data processing from bulk
bulkWs.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'bulk_data_batch') {
    processInBackground(msg.data);
  }
};
```

### Data Rate Estimation

Approximate bandwidth usage per device:

| Capture Rate | Without Media | With Photos | With Audio | With Both |
|--------------|--------------|-------------|------------|-----------|
| 1/minute | ~50 KB/hour | ~500 KB/hour | ~300 KB/hour | ~750 KB/hour |
| 1/5 seconds | ~600 KB/hour | ~6 MB/hour | ~3.6 MB/hour | ~9 MB/hour |
| 1/second | ~3 MB/hour | ~30 MB/hour | ~18 MB/hour | ~45 MB/hour |

**Orientation-only streaming** (via `/orientation` endpoint): ~5-10 KB/hour regardless of frequency

## Technical Details

### Architecture
- **Client-side Only**: No server required, runs entirely in browser
- **Progressive Web App**: Service Worker provides offline functionality
- **IndexedDB Storage**: Persistent local storage for large datasets
- **Modern Web APIs**: Geolocation, DeviceOrientation, MediaDevices

### Dependencies (CDN)
- **Tailwind CSS**: Styling and responsive design
- **Leaflet.js**: Interactive maps
- **TensorFlow.js**: Machine learning for object detection
- **COCO-SSD Model**: Pre-trained object detection

### Browser Support
- Chrome/Chromium 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Permissions Required
- **Location**: For GPS coordinates
- **Camera**: For photo capture and object detection
- **Microphone**: For audio recording
- **Storage**: For IndexedDB data persistence

## Data Schema

Each captured data point contains:

```javascript
{
  id: Number,                    // Auto-incrementing ID
  timestamp: String,             // ISO 8601 timestamp
  gps: {                        // GPS data (if available)
    latitude: Number,
    longitude: Number,
    altitude: Number,
    accuracy: Number,
    speed: Number,
    heading: Number
  },
  orientation: {                // Device orientation (if available)
    alpha: Number,              // Z-axis rotation (compass)
    beta: Number,               // X-axis rotation (tilt front/back)
    gamma: Number               // Y-axis rotation (tilt left/right)
  },
  motion: {                     // Motion sensor data (if available)
    accelerationX: Number,
    accelerationY: Number,
    accelerationZ: Number
  },
  weather: {                    // Weather data from API (if GPS available)
    temperature: Number,
    humidity: Number,
    windSpeed: Number,
    windDirection: Number,
    weatherCode: Number,
    precipitation: Number,
    cloudCover: Number
  },
  objectsDetected: [            // Detected objects from photos
    {
      class: String,            // Object class name
      score: Number,            // Confidence score (0-1)
      bbox: [x, y, width, height] // Bounding box coordinates
    }
  ],
  photoBlob: Blob,              // Photo data (if captured)
  audioBlob: Blob               // Audio data (if recorded)
}
```

## Self-Contained Design

The app is designed to be completely self-contained:

- **No Build Process**: Works by simply opening `index.html`
- **CDN Dependencies**: All libraries loaded from CDNs
- **Fallback Styling**: Local CSS provides styling if CDNs fail
- **Offline Capable**: Service Worker caches all resources
- **No Server Required**: Everything runs client-side

## Development

The app consists of:

- `index.html`: Main HTML structure and UI
- `app.js`: Core application logic and sensor integration
- `service-worker.js`: Offline support and caching
- `fallback.css`: Backup styling when CDN unavailable

## GitHub Actions Workflows

The repository uses GitHub Actions for automated deployment:

### 🚀 Production Deployment
- **Trigger**: Pushes to `main` branch
- **Workflow**: `.github/workflows/static.yml`
- **Deployment**: GitHub Pages at https://jonmccon.github.io/pocket-parrot/
- **Purpose**: Production deployment for stable releases

### 🔍 Preview Deployments
- **Trigger**: Pushes to branches matching `copilot-*` or `copilot/*` patterns
- **Workflow**: `.github/workflows/preview-deploy.yml`
- **Deployment**: GitHub Pages subdirectories with branch-specific URLs
- **Purpose**: Isolated preview builds for testing Copilot-generated changes

#### Branch Naming Convention
Use these patterns for Copilot-related branches to trigger preview builds:
- `copilot-feature-name`
- `copilot/feature-name`
- `copilot-fix-issue-123`
- `copilot/ui-improvements`

#### URL Structure
- **Main site**: `https://jonmccon.github.io/pocket-parrot/` (root)
- **Preview builds**: `https://jonmccon.github.io/pocket-parrot/branch-name/`
  - Example: `copilot-fix-17` → `https://jonmccon.github.io/pocket-parrot/copilot-fix-17/`
  - Example: `copilot/ui-updates` → `https://jonmccon.github.io/pocket-parrot/copilot-ui-updates/`

#### Accessing Preview Builds
1. Push to a `copilot-*` branch
2. GitHub Actions will deploy a live preview to a subdirectory on GitHub Pages
3. Access your preview directly at `https://jonmccon.github.io/pocket-parrot/branch-name/`
4. Direct URLs are provided in PR comments and Action summaries
5. Preview builds include a visual banner identifying them as previews
6. Main site remains unchanged at the root URL
7. No download or local setup required!

## Security & Privacy

- **Local Storage Only**: All data stays on your device
- **No Analytics**: No tracking or data collection
- **Permission-based**: Only accesses sensors with explicit permission
- **Offline Capable**: Works without internet connection

## License

Open source - feel free to use, modify, and distribute.

---

Built with ❤️ for mobile sensor data collection and visualization.
