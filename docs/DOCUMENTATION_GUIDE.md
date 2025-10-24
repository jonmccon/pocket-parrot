# Documentation Guide

## Overview

This guide provides an overview of the Pocket Parrot documentation structure and helps you find the information you need for different use cases.

## Documentation Structure

### Main Documentation (`readme.md`)

The main README provides:
- **Quick Start**: Get up and running in minutes
- **Recommended Usage Patterns**: Data capture rate recommendations (1-60 seconds) based on use case, including battery impact
- **WebSocket Endpoint Selection**: Comparison of `/orientation`, `/bulk`, `/listener`, and `/pocket-parrot` endpoints with latency, payload, and frequency details
- **Performance Optimization**: Code examples showing how to use each endpoint effectively
- **Data Rate Estimation**: Bandwidth usage estimates for different capture rates and media types
- **Technical Details**: Architecture, browser support, and data schema

**Best For:** Getting started, understanding the system architecture, and making high-level decisions

### API Documentation (`docs/DATA_ACCESS_API.md`)

Comprehensive API reference covering:
- **Orientation Data Handling**: How device orientation (alpha, beta, gamma) is broadcast immediately with sub-millisecond latency
- **Endpoint Selection Guide**: Detailed comparison of all four WebSocket endpoints
- **Orientation Values**: Clear description of alpha, beta, gamma with ranges and use cases
- **Performance Considerations**: Optimization tips for orientation data streaming
- **JavaScript API**: Methods for same-origin integrations
- **WebSocket Push**: Real-time data streaming to external servers
- **Export API**: Batch data access and filtering

**Best For:** Developers integrating with Pocket Parrot programmatically

### Integration Guide (`docs/INTEGRATION_GUIDE.md`)

Quick start guide for integrations:
- **Endpoint Comparison Table**: Quick reference for choosing the right endpoint
- **Server Examples**: Working code for general listener, orientation listener, and bulk data listener
- **JavaScript API Examples**: Browser-based integrations
- **WebSocket Examples**: Remote server integrations
- **Export API Examples**: Batch processing

**Best For:** Developers getting started with integrations

### Quick Reference (`docs/QUICK_REFERENCE.md`)

One-page reference for event organizers:
- **Event Setup Steps**: Deploy server, build URL, generate QR codes
- **Server-Side Endpoint Selection**: Purpose and use cases for each endpoint
- **URL Parameters**: Quick reference for event URLs
- **Network Setup**: WiFi vs cellular considerations
- **Troubleshooting**: Common issues and solutions

**Best For:** Event organizers and quick reference

### Multi-User Guide (`docs/MULTI_USER_GUIDE.md`)

Complete guide for multi-user streaming:
- **Connection Types**: Documentation for all five connection types
- **Endpoint Decision Matrix**: Table comparing all endpoints by use case
- **Server Setup**: Step-by-step instructions
- **Data Rate Management**: Bandwidth and performance considerations
- **Deployment Options**: Local network vs cloud

**Best For:** Setting up multi-user streaming scenarios

## Key Concepts

### Orientation Data Handling

Pocket Parrot broadcasts device orientation data **immediately** when it changes, separate from the main sensor capture cycle:

- **Sub-millisecond latency**: Orientation updates don't wait for GPS or weather data
- **High frequency**: Supports rapid device movements (10-60 Hz)
- **Responsive**: 3D visualizations and AR applications feel immediate and natural
- **Angles explained**:
  - **Alpha (0-360°)**: Compass heading (0° = North, 90° = East, 180° = South, 270° = West)
  - **Beta (-180 to 180°)**: Front-to-back tilt (0° = flat, positive = forward, negative = back)
  - **Gamma (-90 to 90°)**: Left-to-right tilt (0° = flat, positive = right, negative = left)

**Use Cases:** 3D visualizations, AR/VR experiences, motion-controlled applications, interactive installations

### Bulk Data Batching Strategy

GPS, weather, motion, photos, and audio are queued and sent in batches for efficiency:

- **Batching**: Default is 1 batch per second or when 10 items accumulate
- **Efficiency**: Reduces message overhead by ~10x
- **Optimization**: Better for analytics, logging, and archival systems
- **Excludes orientation**: Orientation is sent immediately via `/orientation` endpoint

**Use Cases:** Data analytics, logging systems, photo/audio processing, archival, research

### Endpoint Selection

Four specialized endpoints for different use cases:

| Endpoint | Latency | Payload | Best For |
|----------|---------|---------|----------|
| `/orientation` | < 1ms | Minimal (orientation only) | 3D/AR/VR, real-time visualization |
| `/bulk` | ~1 second | Complete (GPS, weather, media) | Analytics, logging, archival |
| `/listener` | Immediate | Complete (all data types) | General-purpose, development |
| `/pocket-parrot` | Immediate | Complete + session | Pocket Parrot clients only |

**Decision Guide:**
- Need low-latency orientation? → Use `/orientation`
- Need efficient batch processing? → Use `/bulk`
- Need all data in simple format? → Use `/listener`
- Building a Pocket Parrot client? → Use `/pocket-parrot`
- Need both real-time UI and background logging? → Use `/orientation` + `/bulk`

### Recommended Data Rates

Choose capture intervals based on your use case:

| Interval | Use Case | Battery Impact | Bandwidth |
|----------|----------|----------------|-----------|
| 1-5 seconds | Live tracking | Medium | ~600 KB/hour |
| 5-10 seconds | General monitoring (default) | Low-Medium | ~300 KB/hour |
| 10-30 seconds | Analytics/research | Low | ~100 KB/hour |
| 30-60 seconds | Battery conservation | Very Low | ~50 KB/hour |
| High frequency (10-60 Hz) | Use `/orientation` endpoint | Minimal | ~5-10 KB/hour (orientation only) |

**Note:** Bandwidth estimates are without media. With photos, expect 10-20x higher usage. With audio, expect 5-10x higher usage.

### Performance Optimization

**Dual-Endpoint Strategy** (recommended for advanced applications):
```javascript
// Real-time orientation for UI
const orientWs = new WebSocket('ws://server:8080/orientation');
orientWs.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'orientation_data') {
    updateUIImmediately(msg.orientation);
  }
};

// Background data logging
const bulkWs = new WebSocket('ws://server:8080/bulk');
bulkWs.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'bulk_data_batch') {
    processInBackground(msg.data);
  }
};
```

**Benefits:**
- Responsive UI with low-latency orientation
- Efficient data logging through batching
- Best of both worlds for demanding applications

## Finding Information

### For New Users
1. Start with **readme.md** Quick Start section
2. Review **Recommended Usage Patterns** for your use case
3. Follow **Integration Guide** for your chosen approach

### For Developers
1. Read **DATA_ACCESS_API.md** for comprehensive API reference
2. Review endpoint selection guide to choose optimal endpoints
3. Use code examples as starting templates

### For Event Organizers
1. Follow **QUICK_REFERENCE.md** for one-page setup guide
2. Choose endpoint based on event requirements (likely `/listener` or `/bulk`)
3. Deploy server and generate QR codes per instructions

### For Researchers
1. Review **MULTI_USER_GUIDE.md** for multi-user server setup
2. Consider `/bulk` endpoint for efficient data collection
3. Check data rate estimation tables for bandwidth planning

## Additional Documentation

- **EVENT_DEPLOYMENT_GUIDE.md**: Complete guide for event-based deployments
- **HEROKU_DEPLOYMENT.md**: Deploy server to Heroku
- **Server README** (`server/README.md`): Server-specific documentation and protocols
- **Implementation Summaries**: Technical implementation details in docs folder

## Getting Help

- **Troubleshooting**: Check QUICK_REFERENCE.md for common issues
- **API Questions**: Refer to DATA_ACCESS_API.md
- **Server Issues**: See server/README.md
- **Event Setup**: Follow EVENT_DEPLOYMENT_GUIDE.md

---

**Note:** All documentation assumes you're using the latest version of Pocket Parrot. For specific version requirements or compatibility, check the main readme.md file.
