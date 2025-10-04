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
- **Continuous Capture**: Automatically capture data every 5 seconds
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

### 📡 Data Access API *(NEW)*
- **JavaScript API**: Programmatic access to sensor data for same-origin integrations
- **WebSocket Push**: Real-time data streaming to external servers
- **Real-time Subscriptions**: Observer pattern for immediate data access
- **Flexible Filtering**: Query by date, GPS, media, and more
- **See [DATA_ACCESS_API.md](DATA_ACCESS_API.md) for complete documentation**

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
