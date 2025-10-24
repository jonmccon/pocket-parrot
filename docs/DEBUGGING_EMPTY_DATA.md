# Debugging Empty/Zero Data Values in WebSocket Transmission

## Problem Description

When receiving data through WebSocket at an external application (like a p5.js sketch), all sensor values appear as zeros or empty:
- GPS: latitude=0, longitude=0
- Orientation: alpha=0, beta=0, gamma=0  
- Wind: speed=0, direction=0
- All other values are defaults

## Common Causes & Solutions

### 1. Sensors Not Actually Capturing Data (Most Common)

**Symptoms:**
- Data shows as zeros at both sender and receiver
- Console logs show sensor values as null or 0

**Causes:**
- **Browser permissions not granted** - GPS, DeviceOrientation, DeviceMotion require explicit permission
- **Page loaded over HTTP instead of HTTPS** - Many sensors require HTTPS on mobile
- **Device doesn't have sensors** - Desktop browsers often don't have orientation/motion sensors
- **Sensors not initialized** - Need to request permissions and wait for first data

**Solutions:**

1. **Check Browser Permissions:**
   ```javascript
   // In browser console on Pocket Parrot page:
   navigator.permissions.query({name: 'geolocation'}).then(result => {
     console.log('GPS permission:', result.state);
   });
   ```

2. **Request Permissions Explicitly:**
   - On iOS: Must interact with page (click button) before requesting permission
   - Make sure to click "Allow" when prompted for Location, Motion, Orientation

3. **Verify Sensors Are Working:**
   Open the diagnostic tool: `https://your-domain/diagnose-websocket.html`
   
   Watch the browser console while clicking "Run Full Diagnostic". Look for:
   ```
   🔍 [DEBUG] Original dataPoint before preparation: {
     gps: { latitude: 47.xxx, longitude: -122.xxx }  // Should have real values
   }
   ```

4. **Check Main Pocket Parrot Page:**
   - Open `index.html` or deployed app
   - Look at sensor values on the page
   - Values should update in real-time
   - If showing "--" or "0", sensors aren't providing data

### 2. Timing Issue - Data Not Yet Available

**Symptoms:**
- First few data points are zeros
- Later data points have real values

**Cause:**
- Sensors take time to initialize
- WebSocket connects before sensors ready
- Data captured before GPS lock obtained

**Solution:**

Add delay before starting capture:
```javascript
// Wait for sensors to stabilize
setTimeout(() => {
  app.startLiveStream(); // or other capture method
}, 3000); // 3 second delay
```

Or check sensor availability before capturing:
```javascript
// Only capture when GPS is available
if (app.currentPosition && app.currentPosition.coords.latitude !== 0) {
  // Capture data
}
```

### 3. Async/Await Issue (Already Fixed)

**Symptoms:**
- Data preparation not completing before transmission
- Console shows Promise objects instead of values

**Status:** ✅ Fixed in latest version

The `prepareSafeDataPoint` method is now properly awaited at all call sites:
- `notifySubscribers()` - awaits preparation
- `pushToWebSocket()` - awaits preparation  
- Data integrity is maintained through transmission chain

### 4. WebSocket Server Transform Issue

**Symptoms:**
- Pocket Parrot shows correct values in console
- But receiver gets zeros
- Server logs might show errors or transformations

**Debug Steps:**

1. **Check Pocket Parrot Console Logs:**
   Look for this log entry (with real values):
   ```
   📤 Preparing to push data to WebSocket: {
     gpsValues: { lat: 47.xxx, lon: -122.xxx }  // Should have real values
   }
   ```

2. **Check Server Logs:**
   If using the multi-user-server.js, check server console for:
   ```
   📊 Data from active sender user_xxx
   📍 GPS: 47.xxx, -122.xxx  // Should show real values
   ```

3. **Check Receiver Logs:**
   In p5 sketch console, log the raw WebSocket message:
   ```javascript
   ws.onmessage = (event) => {
     console.log('Raw message:', event.data);
     const data = JSON.parse(event.data);
     console.log('Parsed data:', data);
   };
   ```

### 5. Receiving End (p5 Sketch) Issue

**Symptoms:**
- Server receives correct data (check server logs)
- But p5 sketch shows zeros
- Issue is in externalData.js or sketch.js

**Common Causes:**

1. **Initialization with Defaults:**
   ```javascript
   // BAD - initializes with zeros
   let externalData = {
     gps: { latitude: 0, longitude: 0 },
     orientation: { alpha: 0, beta: 0, gamma: 0 }
   };
   
   // These zeros are never updated if WebSocket handler doesn't work
   ```

2. **WebSocket Message Handling:**
   ```javascript
   // Check if data is being extracted correctly
   ws.onmessage = (event) => {
     const message = JSON.parse(event.data);
     
     // VERIFY THIS LINE:
     if (message.type === 'sensor_data') {
       // Make sure you're accessing the right property
       externalData = message.data; // or message.sensorData or similar
       
       console.log('Updated externalData:', externalData);
     }
   };
   ```

3. **Data Structure Mismatch:**
   Server sends:
   ```json
   {
     "type": "sensor_data",
     "data": {
       "gps": { "latitude": 47.6 }
     }
   }
   ```
   
   But p5 sketch expects:
   ```json
   {
     "type": "sensor_data",
     "gps": { "latitude": 47.6 }
   }
   ```

## Debugging Workflow

### Step 1: Verify Sensors Are Capturing

1. Open Pocket Parrot main page (`index.html`)
2. Grant all permissions when prompted
3. Check sensor displays on page - should show real values
4. If showing "--" or zeros, sensors aren't working

### Step 2: Test Data Preparation

1. Open diagnostic tool: `/diagnose-websocket.html`
2. Click "Test Data Preparation Only"
3. Check "Data Inspection" section
4. Verify "Original Data Point" has real values
5. Verify "Prepared Safe Data Point" maintains those values

### Step 3: Test WebSocket Transmission

1. In diagnostic tool, enter WebSocket endpoint
2. Click "Configure WebSocket" then "Enable WebSocket"
3. Click "Run Full Diagnostic"
4. Check console for:
   ```
   🔍 [DEBUG] Original dataPoint before preparation: { ... }
   🔍 [DEBUG] After prepareSafeDataPoint: { ... }
   📤 Message preview: { ... }
   ```
5. All should show real values, not zeros

### Step 4: Check Server Logs

1. If using multi-user-server.js, check server console
2. Look for data received logs
3. Should show real GPS coordinates and sensor values

### Step 5: Check Receiver (p5 Sketch)

1. Open browser console on p5 sketch page
2. Look for WebSocket message logs
3. Add logging if needed:
   ```javascript
   ws.onmessage = (event) => {
     console.log('=== RAW MESSAGE ===');
     console.log(event.data);
     
     const message = JSON.parse(event.data);
     console.log('=== PARSED MESSAGE ===');
     console.log(message);
     
     console.log('=== EXTRACTED DATA ===');
     console.log(message.data || message);
   };
   ```

## Enhanced Logging

The latest version includes enhanced debug logging. To see full data flow:

1. Open browser console (F12)
2. Filter for "[DEBUG]" to see detailed trace
3. Look for these key log messages:

```
🔍 [DEBUG] notifySubscribers called with: { ... }
🔍 [DEBUG] prepareSafeDataPoint input: { ... }
🔍 [DEBUG] prepareSafeDataPoint output: { ... }
🔍 [DEBUG] Original dataPoint before preparation: { ... }
🔍 [DEBUG] After prepareSafeDataPoint: { ... }
📤 Message preview: { ... }
```

All of these should show real values, not zeros.

## Production Debugging Checklist

When debugging in production (like at jonmccon/the-plot-quickens):

- [ ] Open Pocket Parrot page on mobile device
- [ ] Grant GPS, Motion, and Orientation permissions
- [ ] Verify sensor values are updating on the page (not showing "--")
- [ ] Open browser console (remote debugging for mobile)
- [ ] Look for DEBUG logs showing real values
- [ ] Check if WebSocket connects successfully
- [ ] Open p5 sketch page
- [ ] Open browser console on p5 page
- [ ] Verify WebSocket messages arriving with real values
- [ ] Check externalData object is being updated
- [ ] Verify sketch is reading from correct properties

## Quick Fix Checklist

If receiving zeros, try these in order:

1. **Refresh Pocket Parrot page and re-grant permissions**
2. **Wait 5 seconds for GPS lock before capturing**
3. **Check you're on HTTPS (required for mobile sensors)**
4. **Verify device has the sensors (mobile device, not desktop)**
5. **Check sensor displays on main page show real values**
6. **Add console logging to receiving end (p5 sketch)**
7. **Verify data structure matches between sender and receiver**

## Still Having Issues?

If following all steps above and still seeing zeros:

1. **Share these logs:**
   - Pocket Parrot console with DEBUG logs
   - Server console logs
   - p5 sketch console logs
   - Raw WebSocket message contents

2. **Test with the diagnostic tool:**
   - Run full diagnostic
   - Screenshot the results
   - Share the "Data Inspection" section

3. **Verify the data structure:**
   - Log `message.data` vs `message`
   - Check if server is wrapping data differently
   - Compare expected vs actual structure

## Technical Details

### Data Flow

```
1. Sensors → app.captureDataPoint()
   └─ Creates dataPoint with sensor values

2. app.saveDataPoint(dataPoint)
   └─ Overridden by data-api.js

3. data-api.setupDataListener()
   └─ Calls notifySubscribers(dataPoint)
       └─ await prepareSafeDataPoint(dataPoint)
   └─ Calls pushToWebSocket(dataPoint)  
       └─ await prepareSafeDataPoint(dataPoint)
       └─ JSON.stringify({ type: 'data', data: safeDataPoint })
       └─ ws.send(message)

4. WebSocket Server receives
   └─ Broadcasts to passive listeners
   └─ Forwards to observers

5. p5 Sketch receives
   └─ ws.onmessage handler
   └─ Updates externalData object
```

**Critical**: Data values are preserved at each step. If zeros appear, the root cause is either:
- Sensors returning zeros (Step 1)
- Receiving end not extracting data correctly (Step 5)

### Message Format

Pocket Parrot sends this structure:
```json
{
  "type": "data",
  "timestamp": "2025-10-09T...",
  "data": {
    "timestamp": "2025-10-09T...",
    "gps": {
      "latitude": 47.6062,
      "longitude": -122.3321,
      "altitude": 100,
      "accuracy": 10,
      "speed": 5,
      "heading": 90
    },
    "orientation": {
      "alpha": 45.5,
      "beta": 30.2,
      "gamma": 15.8
    },
    "motion": {
      "accelerationX": 0.5,
      "accelerationY": 0.3,
      "accelerationZ": 9.8
    },
    "weather": {
      "temperature": 15.5,
      "humidity": 70,
      "windSpeed": 10.2,
      "windDirection": 180,
      "precipitation": 0,
      "cloudCover": 50
    },
    "objectsDetected": []
  }
}
```

**Multi-user server transforms this to:**
```json
{
  "type": "sensor_data",
  "timestamp": "2025-10-09T...",
  "userId": "user_xxx",
  "username": "optional_name",
  "data": { /* same data structure as above */ }
}
```

**Passive listeners receive:**
The multi-user server format above (type: "sensor_data")

**Make sure your receiving code matches the expected format!**
