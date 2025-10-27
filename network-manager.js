/**
 * Network Manager for Pocket Parrot
 * Handles network quality detection, caching, and adaptive data strategies
 */

class NetworkManager {
    constructor() {
        this.connectionQuality = 'unknown';
        this.effectiveType = 'unknown';
        this.downlink = null;
        this.rtt = null;
        this.weatherCache = new Map();
        this.weatherCacheDuration = 5 * 60 * 1000; // 5 minutes
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.maxRetries = 3;
        this.retryDelay = 2000;
        
        this.init();
    }

    /**
     * Initialize network manager
     */
    init() {
        // Detect network quality if available
        this.detectNetworkQuality();
        
        // Listen for connection changes
        if ('connection' in navigator) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                connection.addEventListener('change', () => this.detectNetworkQuality());
            }
        }

        // Listen for online/offline events
        window.addEventListener('online', () => {
            console.log('📡 Network connection restored');
            this.connectionQuality = 'online';
            this.processQueue();
        });

        window.addEventListener('offline', () => {
            console.log('📡 Network connection lost');
            this.connectionQuality = 'offline';
        });
    }

    /**
     * Detect current network quality
     */
    detectNetworkQuality() {
        if (!navigator.onLine) {
            this.connectionQuality = 'offline';
            this.effectiveType = 'offline';
            return;
        }

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            this.effectiveType = connection.effectiveType || 'unknown';
            this.downlink = connection.downlink;
            this.rtt = connection.rtt;

            // Classify connection quality
            if (connection.effectiveType === '4g' || (connection.downlink && connection.downlink > 5)) {
                this.connectionQuality = 'good';
            } else if (connection.effectiveType === '3g' || (connection.downlink && connection.downlink > 1)) {
                this.connectionQuality = 'moderate';
            } else if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                this.connectionQuality = 'poor';
            } else {
                this.connectionQuality = 'unknown';
            }

            console.log(`📡 Network quality: ${this.connectionQuality} (${this.effectiveType}, ${connection.downlink}Mbps, ${connection.rtt}ms RTT)`);
        } else {
            // Fallback: assume good if online
            this.connectionQuality = navigator.onLine ? 'good' : 'offline';
        }
    }

    /**
     * Get current network status
     */
    getStatus() {
        return {
            quality: this.connectionQuality,
            effectiveType: this.effectiveType,
            downlink: this.downlink,
            rtt: this.rtt,
            isOnline: navigator.onLine,
            isSlow: this.connectionQuality === 'poor' || this.connectionQuality === 'moderate'
        };
    }

    /**
     * Fetch weather data with caching and retry logic
     */
    async fetchWeatherData(lat, lon, locationSource = 'gps') {
        // Check cache first
        const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
        const cached = this.weatherCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.weatherCacheDuration) {
            console.log('🌤️ Using cached weather data');
            return {
                ...cached.data,
                cached: true,
                cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000)
            };
        }

        // Skip if offline
        if (!navigator.onLine || this.connectionQuality === 'offline') {
            console.log('🌤️ Offline - skipping weather fetch');
            return {
                data: null,
                status: 'offline',
                message: 'Offline - using cached data or skipping',
                accuracy: 'none',
                locationSource: locationSource,
                timestamp: new Date().toISOString()
            };
        }

        // Adjust timeout based on connection quality
        let timeout = 10000; // Default 10 seconds
        if (this.connectionQuality === 'poor') {
            timeout = 20000; // 20 seconds for poor connections
        } else if (this.connectionQuality === 'moderate') {
            timeout = 15000; // 15 seconds for moderate connections
        }

        const startTime = Date.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Weather API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            const current = data.current_weather;
            const hourly = data.hourly;
            
            const weatherData = {
                temperature: current.temperature,
                windSpeed: current.windspeed,
                windDirection: current.winddirection,
                weatherCode: current.weathercode,
                humidity: hourly.relative_humidity_2m[0],
                precipitation: hourly.precipitation[0],
                cloudCover: hourly.cloud_cover[0]
            };
            
            // Cache the result
            this.weatherCache.set(cacheKey, {
                data: weatherData,
                timestamp: Date.now()
            });

            const result = {
                data: weatherData,
                status: 'success',
                message: 'Weather data retrieved successfully',
                accuracy: locationSource === 'gps' ? 'high' : 'medium',
                locationSource: locationSource,
                responseTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                cached: false
            };
            
            return result;
            
        } catch (error) {
            let status, message;
            
            if (error.name === 'AbortError') {
                status = 'timeout';
                message = 'Weather request timed out - slow connection';
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                status = 'network_error';
                message = 'Network connection failed';
            } else {
                status = 'api_error';
                message = error.message;
            }
            
            console.error('Error fetching weather data:', error);
            
            // Return cached data if available even if stale
            if (cached) {
                console.log('🌤️ Using stale cached weather data due to error');
                return {
                    ...cached.data,
                    cached: true,
                    stale: true,
                    cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000)
                };
            }
            
            return {
                data: null,
                status: status,
                message: message,
                accuracy: 'none',
                locationSource: locationSource,
                responseTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Queue a network request for processing
     */
    queueRequest(request) {
        this.requestQueue.push(request);
        this.processQueue();
    }

    /**
     * Process queued requests
     */
    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0 && navigator.onLine) {
            const request = this.requestQueue.shift();
            
            try {
                await this.executeRequest(request);
            } catch (error) {
                console.error('Error processing queued request:', error);
                
                // Re-queue if retries available
                if (request.retries < this.maxRetries) {
                    request.retries = (request.retries || 0) + 1;
                    this.requestQueue.push(request);
                    
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * Execute a queued request
     */
    async executeRequest(request) {
        if (request.type === 'websocket' && request.data) {
            // Send via WebSocket
            if (request.websocket && request.websocket.readyState === WebSocket.OPEN) {
                request.websocket.send(JSON.stringify(request.data));
                console.log('✅ Queued request sent via WebSocket');
            } else {
                throw new Error('WebSocket not open');
            }
        }
    }

    /**
     * Get adaptive configuration based on network quality
     */
    getAdaptiveConfig() {
        const status = this.getStatus();
        
        if (status.quality === 'offline') {
            return {
                captureInterval: 30000, // 30 seconds
                includeWeather: false,
                includePhotos: false,
                photoQuality: 0.3,
                maxPhotoWidth: 400
            };
        } else if (status.quality === 'poor') {
            return {
                captureInterval: 15000, // 15 seconds
                includeWeather: false, // Reduce API calls
                includePhotos: false,
                photoQuality: 0.4,
                maxPhotoWidth: 600
            };
        } else if (status.quality === 'moderate') {
            return {
                captureInterval: 10000, // 10 seconds
                includeWeather: true, // But cached
                includePhotos: false,
                photoQuality: 0.6,
                maxPhotoWidth: 800
            };
        } else {
            // Good or unknown (optimistic)
            return {
                captureInterval: 5000, // 5 seconds
                includeWeather: true,
                includePhotos: true,
                photoQuality: 0.7,
                maxPhotoWidth: 800
            };
        }
    }

    /**
     * Clear weather cache
     */
    clearWeatherCache() {
        this.weatherCache.clear();
        console.log('🌤️ Weather cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            weatherCacheSize: this.weatherCache.size,
            queueLength: this.requestQueue.length
        };
    }
}

// Export as global for use by main app
if (typeof window !== 'undefined') {
    window.NetworkManager = NetworkManager;
}
