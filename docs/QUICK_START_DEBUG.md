# 🔍 Empty Data Debugging - Quick Start

## Problem
Receiving empty/zero values through WebSocket? Start here!

## 🚀 Quick Diagnosis (5 minutes)

### Step 1: Check Sensors (1 min)
Open Pocket Parrot main page on **mobile device** with **HTTPS**:
- Grant all permissions (GPS, Motion, Orientation)
- Look at sensor displays on the page
- **If showing "--" or "0"** → Sensors aren't working (see below)
- **If showing real values** → Go to Step 2

### Step 2: Test Data Flow (2 min)
Open diagnostic tool: `https://your-domain/diagnose-websocket.html`
- Click "Test Data Preparation Only"
- Check "Data Inspection" section
- **If showing zeros** → Sensors not providing data (see Common Fixes)
- **If showing real values** → Problem is in transmission or receiving end

### Step 3: Test Transmission (2 min)
In diagnostic tool:
- Enter WebSocket endpoint
- Click "Configure WebSocket" then "Enable WebSocket"
- Click "Run Full Diagnostic"
- Check console for DEBUG logs
- **If logs show zeros** → Data capture issue
- **If logs show real values** → Problem is on receiving end

## 🔧 Common Fixes

### Sensors Not Working
**Symptoms:** Sensor displays show "--" or "0"

**Fixes:**
1. ✅ Use mobile device (not desktop)
2. ✅ Use HTTPS (not HTTP)
3. ✅ Refresh and grant ALL permissions
4. ✅ Wait 5 seconds for GPS lock
5. ✅ Check location services enabled on device

### Data Lost in Transmission
**Symptoms:** Pocket Parrot shows real values, but receiver gets zeros

**Fixes:**
1. ✅ Check WebSocket server logs - is it receiving real values?
2. ✅ Use `externalData-debug.js` on receiving end
3. ✅ Check data extraction: `message.data.gps.latitude` not `message.gps.latitude`
4. ✅ Verify data structure matches (see below)

## 📋 Data Structure

**Pocket Parrot sends:**
```json
{
  "type": "data",
  "data": {
    "gps": { "latitude": 47.6, "longitude": -122.3 },
    "orientation": { "alpha": 45, "beta": 30, "gamma": 15 }
  }
}
```

**Multi-user server forwards as:**
```json
{
  "type": "sensor_data",
  "userId": "user_xxx",
  "data": {
    "gps": { "latitude": 47.6, "longitude": -122.3 },
    "orientation": { "alpha": 45, "beta": 30, "gamma": 15 }
  }
}
```

**Receiving code should access:** `message.data.gps.latitude`

## 📚 Full Documentation

- **Comprehensive Guide:** `DEBUGGING_EMPTY_DATA.md`
- **Solution Analysis:** `SOLUTION_SUMMARY.md`
- **Diagnostic Tool:** `diagnose-websocket.html`
- **Debug Receiver:** `externalData-debug.js`

## 🆘 Still Need Help?

Gather this information:
1. Screenshot of Pocket Parrot sensor displays
2. Diagnostic tool test results
3. Browser console logs (with DEBUG messages)
4. Server console logs (if applicable)
5. Receiving end console logs

## ✅ Expected Behavior

When working correctly, you should see:
- **Pocket Parrot page:** Real sensor values updating in real-time
- **Diagnostic tool:** All tests pass with real values
- **Console logs:** DEBUG messages showing real GPS coordinates, orientation values
- **Receiving end:** Data object updating with real values

## 🔍 Debug Checklist

- [ ] Using mobile device (not desktop)
- [ ] Using HTTPS (not HTTP)
- [ ] All permissions granted (GPS, Motion, Orientation)
- [ ] Waited 5+ seconds for GPS lock
- [ ] Sensor displays show real values on main page
- [ ] Diagnostic tool shows real values in data preparation test
- [ ] Console DEBUG logs show real values
- [ ] WebSocket successfully connected
- [ ] Server logs show it's receiving real values (if applicable)
- [ ] Receiving end extracting from correct message properties

---

**TIP:** Start with the diagnostic tool - it will tell you exactly where the problem is!
