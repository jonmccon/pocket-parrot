# Photo Transmission Troubleshooting Guide

## Quick Debugging Steps

### 1. Check WebSocket Configuration
Open the main app and look at the browser console. When you take a photo, you should see:

```
📡 Data API Status after photo capture: { wsEnabled: true, wsConnected: true, ... }
✅ WebSocket is enabled and connected - photo should be transmitted
```

If you see warnings instead, the WebSocket isn't properly configured.

### 2. Check Photo Processing
When you take a photo, look for these console messages:

```
🔍 [DEBUG] Converting photo blob to base64...
🔍 [DEBUG] Photo blob details: { size: 45231, type: "image/jpeg", isValid: true }
🔍 [DEBUG] Photo conversion complete, size: 67892
✅ Photo successfully converted and will be transmitted
```

### 3. Check WebSocket Transmission
Look for this message to confirm transmission:

```
📤 Preparing to push data to WebSocket: { ..., hasPhoto: true, photoSize: "66KB", ... }
✅ Data pushed to WebSocket successfully
```

## Common Issues and Solutions

### Issue 1: WebSocket Not Configured
**Symptoms:** `⚠️ Data API not available` or `⚠️ WebSocket not enabled`

**Solution:**
1. Go to Settings tab
2. Enter WebSocket endpoint (e.g., `ws://localhost:8080/pocket-parrot`)
3. Click "Save Configuration"
4. Click "Enable WebSocket"
5. Verify connection shows "Connected"

### Issue 2: includeMedia Setting
**Symptoms:** `🔍 [DEBUG] Photo blob present but excluded by includeMedia setting`

**Solution:**
- Check the Data API configuration: `window.pocketParrotAPI.config.includeMedia`
- Should be `true` by default
- User photos (`captureMethod: 'user_photo_capture'`) should be included regardless

### Issue 3: Photo Blob Invalid
**Symptoms:** `❌ Failed to convert photo to base64: Invalid photo blob provided`

**Solution:**
1. Check camera permissions
2. Verify camera is working (video preview shows)
3. Check canvas element exists and is functional

### Issue 4: Image Loading Timeout
**Symptoms:** `❌ Failed to convert photo to base64: Photo loading timeout`

**Solution:**
- Photo processing timeout (10 seconds) - might indicate browser performance issues
- Try smaller photo resolution
- Check browser console for other errors

## Debug Commands

Run these in the browser console:

### Check Data API Status
```javascript
window.pocketParrotAPI.getStatus()
```

### Check Configuration
```javascript
window.pocketParrotAPI.config
```

### Enable Debug Mode
```javascript
window.pocketParrotAPI.configure({ debugMode: true })
```

### Check Recent Data
```javascript
window.pocketParrotAPI.getAllData({ limit: 5 }).then(data => console.log(data))
```

### Test WebSocket Connection
```javascript
window.pocketParrotAPI.testConnection()
```

## Using the Debug Tool

Open `debug-photo-transmission.html` in your browser:

1. Enter your WebSocket endpoint
2. Click "Connect" 
3. Click "Test Photo Transmission"
4. Check the log for detailed transmission info

This will help isolate whether the issue is:
- Photo creation/conversion
- WebSocket connection  
- Server-side processing

## Expected Flow for Photo Transmission

1. **User clicks camera button** → `takePhoto()`
2. **Canvas captures video frame** → creates blob
3. **Photo saved to IndexedDB** → `savePhotoDataPoint()`
4. **Data API notified** → `notifySubscribers()`
5. **Photo converted to base64** → `prepareSafeDataPoint()`
6. **Data sent via WebSocket** → `pushToWebSocket()`
7. **Server receives data** → queued for bulk endpoint

## Verification Checklist

- [ ] WebSocket endpoint configured
- [ ] WebSocket connection established  
- [ ] Camera permissions granted
- [ ] Photo blob created successfully
- [ ] Photo conversion to base64 successful
- [ ] WebSocket transmission successful
- [ ] Server receiving photo data
- [ ] Photo appears in bulk data endpoint

## Server-Side Verification

Check your server logs for:
- WebSocket connection messages
- Incoming data messages with photo data
- Bulk data endpoint responses containing photos

The photos should appear in the bulk endpoint as `photoBase64` fields with data URI format:
```json
{
  "photoBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```