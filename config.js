/**
 * Configuration file for Pocket Parrot
 * 
 * This file allows pre-configuration of the WebSocket endpoint for event-based deployments.
 * 
 * Configuration Priority (highest to lowest):
 * 1. URL parameter: ?wsEndpoint=wss://your-server.com/pocket-parrot
 * 2. This config file: WEBSOCKET_ENDPOINT constant
 * 3. User manual configuration in Settings
 * 
 * For event-based deployments:
 * - Set WEBSOCKET_ENDPOINT to your server URL
 * - Set AUTO_ENABLE_WEBSOCKET to true
 * - Deploy to your hosting
 * - Users just open the URL and click "Start"
 */

// # Dashboard on domain
// https://live.theplotquickens.today/dashboard.html?server=wss://data.theplotquickens.today/dashboard

const PocketParrotConfig = {
    /**
     * Pre-configured WebSocket endpoint
     * Set this to your WebSocket server URL for automatic configuration
     * Leave as null for manual user configuration
     * 
     * Examples:
     *   'wss://your-server.com/pocket-parrot'
     *   'ws://192.168.1.100:8080/pocket-parrot'
     */
    WEBSOCKET_ENDPOINT: 'wss://data.theplotquickens.today/',
    
    /**
     * Automatically enable WebSocket on app load
     * When true, WebSocket connection starts automatically if endpoint is configured
     * Best for event-based experiences where all users should stream immediately
     */
    AUTO_ENABLE_WEBSOCKET: true,
    
    /**
     * Hide Settings button and WebSocket configuration UI
     * When true, users cannot change WebSocket settings (event mode)
     * When false, users can configure and control WebSocket manually
     */
    EVENT_MODE: false,
    
    /**
     * Auto-start capture after permissions are granted
     * When true, begins capturing sensor data immediately after user grants permissions
     * Useful for streamlined event experiences
     */
    AUTO_START_CAPTURE: true,
    
    /**
     * Default capture interval in milliseconds
     * How often to automatically capture sensor data
     * Set to 0 to disable continuous capture
     */
    CAPTURE_INTERVAL: 100, // 5 seconds
    
    /**
     * Show welcome/instruction message on first load
     * Helpful for guiding event participants
     */
    SHOW_WELCOME_MESSAGE: false,
    
    /**
     * Custom welcome message for event participants
     */
    WELCOME_MESSAGE: 'Welcome to the event! Click "Start Event" to begin streaming your sensor data.',
    
    /**
     * Event name to display (optional)
     */
    EVENT_NAME: null
};

// Export for use in app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PocketParrotConfig;
}
