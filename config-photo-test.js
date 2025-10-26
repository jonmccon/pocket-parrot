// Example configuration showing how data modes work with photo inclusion
const PocketParrotConfig = {
    // WebSocket endpoint for real-time data transmission
    WEBSOCKET_ENDPOINT: "ws://localhost:8080/pocket-parrot",
    
    // Auto-enable WebSocket connection on startup
    AUTO_ENABLE_WEBSOCKET: true,
    
    // Event mode - simplified UI for events
    EVENT_MODE: true,
    EVENT_NAME: "Photo Test Event",
    
    // Streaming configuration
    CAPTURE_INTERVAL: 3000, // 3 seconds
    
    // Data modes:
    // - "gps": GPS and basic sensor data only (no photos unless user-initiated)
    // - "sensors": GPS + orientation + motion (no photos unless user-initiated)  
    // - "full": Everything including weather (no photos unless user-initiated)
    DATA_MODE: "gps", // This doesn't affect photo inclusion anymore
    
    // INCLUDE_MEDIA controls automatic photo inclusion during streaming
    // - true: Include photos in streaming data automatically
    // - false: Only include photos when user explicitly takes them
    // User-initiated photos (camera button) are ALWAYS included regardless of this setting
    INCLUDE_MEDIA: false, // Default: only user photos, not automatic streaming photos
    
    // Auto-start capture when page loads
    AUTO_START_CAPTURE: false,
    
    // Show welcome message
    SHOW_WELCOME_MESSAGE: true,
    WELCOME_MESSAGE: "Test photo capture and data transmission",
    
    // Debug mode for verbose logging
    DEBUG_MODE: true
};

// URL parameter examples:
// ?media=true               - Include photos in streaming
// ?media=false              - Only user-initiated photos
// ?dataMode=full&media=true - Full sensor data + streaming photos
// ?interval=1000&media=true - 1-second capture with photos