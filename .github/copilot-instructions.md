# Pocket Parrot - Mobile Sensor Platform

**ALWAYS follow these instructions first and only fallback to additional search and context gathering if the information here is incomplete or found to be in error.**

Pocket Parrot is a browser-based Progressive Web App (PWA) that runs entirely client-side with no server or build process required. It captures sensor data, photos with object detection, audio recordings, and displays everything on an interactive map.

## Working Effectively

### Quick Start
- **Option 1 - Direct file**: Simply open `index.html` in any modern web browser (file:// protocol)
- **Option 2 - HTTP server**: `python3 -m http.server 8080` then navigate to `http://localhost:8080`
- **No build process required**: Works immediately without any compilation or bundling

### Core Architecture
- **Client-side only**: No server required, runs entirely in browser
- **CDN Dependencies**: Tailwind CSS, Leaflet.js, TensorFlow.js COCO-SSD (with fallback.css backup)
- **IndexedDB storage**: All data stored locally in browser
- **Service Worker**: Provides offline functionality and caching
- **Progressive Web App**: Can be installed on mobile devices

### File Structure
```
/
├── index.html          # Main HTML structure (13KB)
├── app.js             # Core application logic (37KB)
├── service-worker.js  # Offline support and caching
├── fallback.css       # Backup styling when CDNs fail
├── readme.md          # Comprehensive documentation
└── .gitignore         # Standard exclusions
```

### Development Commands
- **Start local server**: `python3 -m http.server 8080` - starts in ~1 second
- **Open browser**: Navigate to `http://localhost:8080` or open `index.html` directly
- **Test offline**: Disable network in browser dev tools
- **View console**: Use browser dev tools to see logs and errors

## Validation

### CRITICAL: Always Test These Scenarios
After making any changes, ALWAYS run through these complete user scenarios:

1. **Basic Data Capture Flow**:
   - Open `index.html` in browser
   - Click "Capture Now" button
   - Verify record count increases from 0 to 1
   - Verify status changes to "Data point captured"

2. **Data Viewing Flow**:
   - Click "View Data" tab
   - Verify data table shows captured records
   - Test date filtering if records exist
   - Check map loads (may show errors if CDNs blocked but should still render)

3. **Camera and Audio Features**:
   - Click "Start Camera" (requires camera permission)
   - Click "Start Recording" (requires microphone permission)
   - Verify permission dialogs appear appropriately

4. **Data Export**:
   - Click "Export Data" button
   - Verify JSON file downloads successfully
   - Check exported data contains expected fields

5. **Offline Functionality**:
   - Load app with internet
   - Disable network in browser dev tools
   - Verify app still works and data can be captured
   - Check service worker logs in console

### CDN Dependencies and Potential Issues
- **External CDNs may be blocked**: Tailwind CSS, Leaflet.js, TensorFlow.js
- **Fallback behavior**: App uses `fallback.css` when CDNs fail - styling still works well
- **Expected errors when CDNs blocked**: 
  - "Failed to load resource" 
  - "ReferenceError: L is not defined" (Leaflet map)
  - "ReferenceError: tailwind is not defined"
- **Still functional**: Core capture, storage, and export functionality works without CDNs
- **Visual impact**: With CDNs working, app has beautiful colorful buttons and modern styling

### Browser Requirements
- Chrome/Chromium 60+
- Firefox 55+  
- Safari 12+
- Edge 79+

### Permissions Required
- **Location**: For GPS coordinates
- **Camera**: For photo capture and object detection  
- **Microphone**: For audio recording
- **Storage**: For IndexedDB data persistence

## Common Development Tasks

### Testing Changes
- **Always refresh browser** after modifying files
- **Check browser console** for JavaScript errors
- **Test with CDNs blocked** to verify fallback behavior
- **Test on mobile device** for sensor functionality

### Key Code Areas
- **Sensor integration**: `app.js` lines 1-500 (GPS, orientation, motion)
- **Data storage**: `app.js` lines 500-700 (IndexedDB operations)
- **UI interactions**: `app.js` lines 700-1000 (event handlers, DOM updates)
- **Service Worker**: `service-worker.js` (caching, offline support)

### Data Schema
```javascript
{
  id: Number,                   // Auto-generated
  timestamp: Date,             // Capture time
  gps: {                       // GPS coordinates
    latitude: Number,
    longitude: Number,
    altitude: Number,
    speed: Number,
    accuracy: Number
  },
  orientation: {               // Device orientation
    alpha: Number,             // Z-axis rotation
    beta: Number,              // X-axis rotation  
    gamma: Number,             // Y-axis rotation
    compass: Number            // Computed compass heading
  },
  motion: {                    // Accelerometer data
    x: Number,
    y: Number,
    z: Number
  },
  weather: {                   // From Open-Meteo API
    temperature: Number,
    humidity: Number,
    windSpeed: Number,
    windDirection: Number,
    precipitation: Number,
    cloudCover: Number
  },
  objectsDetected: [           // From TensorFlow.js COCO-SSD
    {
      class: String,           // Object class name
      score: Number,           // Confidence score (0-1)
      bbox: [x, y, width, height]  // Bounding box
    }
  ],
  photoBlob: Blob,             // Photo data (if captured)
  audioBlob: Blob              // Audio data (if recorded)
}
```

## Debugging Common Issues

### "L is not defined" Error
- **Cause**: Leaflet.js CDN blocked
- **Expected**: App still works for data capture
- **Solution**: Not critical for core functionality

### "tailwind is not defined" Error  
- **Cause**: Tailwind CSS CDN blocked
- **Expected**: App uses fallback.css styling
- **Solution**: Verify fallback.css is loading

### Service Worker Issues
- **Check**: Browser dev tools > Application > Service Workers
- **Expected**: Should show "pocket-parrot-v1" as activated
- **Debug**: Check console for service worker logs

### Data Not Persisting
- **Check**: Browser dev tools > Application > IndexedDB > PocketParrotDB
- **Verify**: "sensorData" store exists with records
- **Clear**: Delete IndexedDB to reset for testing

## No Build Process Required

This app is intentionally designed with NO build process:
- **No npm/yarn**: No package.json or node_modules
- **No bundling**: No webpack, vite, or build tools
- **No transpilation**: Modern JavaScript runs directly
- **No CSS preprocessing**: Pure CSS with CDN Tailwind
- **Direct deployment**: Upload files directly to any web server

## Security and Privacy

- **Local storage only**: All data stays on user's device
- **No analytics**: No tracking or data collection
- **Permission-based**: Only accesses sensors with explicit permission
- **Offline capable**: Works without internet connection
- **No server communication**: Except for weather API (optional)

---

**Remember**: Always test the complete user flow after any changes. The app should work even with CDN blocking, demonstrating its robust fallback design.