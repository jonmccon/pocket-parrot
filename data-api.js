/**
 * Pocket Parrot Data Access API
 * Provides methods for external systems to access and subscribe to sensor data
 */

class PocketParrotDataAPI {
    constructor(pocketParrotInstance) {
        this.app = pocketParrotInstance;
        this.subscribers = new Set();
        this.wsConnections = new Set();
        this.wsEnabled = false;
        this.wsEndpoint = null;
        this.autoReconnect = true;
        this.reconnectDelay = 5000;
        
        // Listen for data updates
        this.setupDataListener();
    }

    /**
     * Set up listener for new data points
     */
    setupDataListener() {
        // Override the original saveDataPoint to notify subscribers
        const originalSaveDataPoint = this.app.saveDataPoint.bind(this.app);
        
        this.app.saveDataPoint = async (dataPoint) => {
            const result = await originalSaveDataPoint(dataPoint);
            
            // Notify all subscribers (await to ensure data is prepared)
            await this.notifySubscribers(dataPoint);
            
            // Push to WebSocket if enabled
            if (this.wsEnabled && this.wsEndpoint) {
                await this.pushToWebSocket(dataPoint);
            }
            
            return result;
        };
    }

    /**
     * Subscribe to real-time data updates
     * @param {Function} callback - Function to call when new data is captured
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        
        this.subscribers.add(callback);
        console.log('📡 New subscriber added. Total subscribers:', this.subscribers.size);
        
        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
            console.log('📡 Subscriber removed. Total subscribers:', this.subscribers.size);
        };
    }

    /**
     * Notify all subscribers of new data
     */
    async notifySubscribers(dataPoint) {
        console.log('🔍 [DEBUG] notifySubscribers called with:', {
            timestamp: dataPoint.timestamp,
            gps: dataPoint.gps,
            orientation: dataPoint.orientation,
            motion: dataPoint.motion,
            weather: dataPoint.weather
        });
        
        // Create a safe copy without blob data for notifications
        const safeDataPoint = await this.prepareSafeDataPoint(dataPoint);
        
        console.log('📢 Notifying subscribers with data:', {
            timestamp: safeDataPoint.timestamp,
            hasGPS: !!safeDataPoint.gps,
            gpsValues: safeDataPoint.gps ? {
                lat: safeDataPoint.gps.latitude,
                lon: safeDataPoint.gps.longitude
            } : null,
            hasOrientation: !!safeDataPoint.orientation,
            hasMotion: !!safeDataPoint.motion,
            hasWeather: !!safeDataPoint.weather,
            hasPhoto: !!safeDataPoint.photoBase64
        });
        
        this.subscribers.forEach(callback => {
            try {
                callback(safeDataPoint);
            } catch (error) {
                console.error('Error in subscriber callback:', error);
            }
        });
    }

    /**
     * Prepare data point for transmission (convert blobs to base64)
     */
    async prepareSafeDataPoint(dataPoint) {
        console.log('🔍 [DEBUG] prepareSafeDataPoint input:', {
            timestamp: dataPoint.timestamp,
            gps: dataPoint.gps,
            orientation: dataPoint.orientation,
            motion: dataPoint.motion,
            weather: dataPoint.weather,
            hasPhotoBlob: !!dataPoint.photoBlob,
            hasAudioBlob: !!dataPoint.audioBlob
        });
        
        const safe = { ...dataPoint };
        
        if (dataPoint.photoBlob) {
            console.log('🔍 [DEBUG] Converting photo blob to base64...');
            // Downsample photo before converting to base64
            safe.photoBase64 = await this.downsampleAndConvertPhoto(dataPoint.photoBlob);
            delete safe.photoBlob;
            console.log('🔍 [DEBUG] Photo conversion complete, size:', safe.photoBase64 ? safe.photoBase64.length : 0);
        }
        
        // Remove audio from transmission - not needed for events
        delete safe.audioBlob;
        
        console.log('🔍 [DEBUG] prepareSafeDataPoint output:', {
            timestamp: safe.timestamp,
            gps: safe.gps,
            orientation: safe.orientation,
            motion: safe.motion,
            weather: safe.weather,
            hasPhotoBase64: !!safe.photoBase64
        });
        
        return safe;
    }

    /**
     * Downsample photo to reduce size before transmission
     * @param {Blob} photoBlob - Original photo blob
     * @returns {Promise<string>} Base64 encoded downsampled photo
     */
    async downsampleAndConvertPhoto(photoBlob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(photoBlob);
            
            img.onload = () => {
                // Create canvas for downsampling
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 800px width)
                const maxWidth = 800;
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw downsampled image
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to base64 with compression (0.7 quality for JPEG)
                const base64 = canvas.toDataURL('image/jpeg', 0.7);
                
                URL.revokeObjectURL(url);
                resolve(base64);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image for downsampling'));
            };
            
            img.src = url;
        });
    }

    /**
     * Get all data points
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of data points
     */
    async getAllData(options = {}) {
        const allData = await this.app.getAllData();
        
        // Apply filters if provided
        let filtered = allData;
        
        if (options.startDate) {
            const startTime = new Date(options.startDate).getTime();
            filtered = filtered.filter(d => new Date(d.timestamp).getTime() >= startTime);
        }
        
        if (options.endDate) {
            const endTime = new Date(options.endDate).getTime();
            filtered = filtered.filter(d => new Date(d.timestamp).getTime() <= endTime);
        }
        
        if (options.hasGPS) {
            filtered = filtered.filter(d => d.gps && d.gps.latitude && d.gps.longitude);
        }
        
        if (options.hasPhoto) {
            filtered = filtered.filter(d => d.photoBlob);
        }
        
        if (options.hasAudio) {
            filtered = filtered.filter(d => d.audioBlob);
        }
        
        if (options.limit) {
            filtered = filtered.slice(0, options.limit);
        }
        
        return filtered;
    }

    /**
     * Get data point by ID
     * @param {Number} id - Data point ID
     * @returns {Promise<Object>} Data point
     */
    async getDataById(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.app.db.transaction(['sensorData'], 'readonly');
            const store = transaction.objectStore('sensorData');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get record count
     * @returns {Promise<Number>} Number of records
     */
    async getRecordCount() {
        return await this.app.getRecordCount();
    }

    /**
     * Configure WebSocket endpoint for data push
     * @param {String} endpoint - WebSocket URL (e.g., "ws://localhost:8080/data")
     * @param {Object} options - Configuration options
     */
    configureWebSocket(endpoint, options = {}) {
        this.wsEndpoint = endpoint;
        this.autoReconnect = options.autoReconnect !== false;
        this.reconnectDelay = options.reconnectDelay || 5000;
        
        console.log('📡 WebSocket configured:', endpoint);
        
        // Save to localStorage for persistence
        localStorage.setItem('pocketParrot_wsEndpoint', endpoint);
        localStorage.setItem('pocketParrot_wsEnabled', 'false'); // Don't auto-enable
    }

    /**
     * Enable WebSocket data push
     */
    async enableWebSocket() {
        if (!this.wsEndpoint) {
            throw new Error('WebSocket endpoint not configured. Call configureWebSocket() first.');
        }
        
        this.wsEnabled = true;
        await this.connectWebSocket();
        
        // Save state
        localStorage.setItem('pocketParrot_wsEnabled', 'true');
        
        console.log('✅ WebSocket enabled');
    }

    /**
     * Disable WebSocket data push
     */
    disableWebSocket() {
        this.wsEnabled = false;
        this.disconnectWebSocket();
        
        // Save state
        localStorage.setItem('pocketParrot_wsEnabled', 'false');
        
        console.log('🔌 WebSocket disabled');
    }

    /**
     * Connect to WebSocket server
     */
    async connectWebSocket() {
        if (!this.wsEndpoint || !this.wsEnabled) return;
        
        try {
            const ws = new WebSocket(this.wsEndpoint);
            
            ws.onopen = () => {
                console.log('✅ WebSocket connected:', this.wsEndpoint);
                this.wsConnections.add(ws);
                
                // Send initial handshake
                ws.send(JSON.stringify({
                    type: 'handshake',
                    client: 'PocketParrot',
                    version: '1.0',
                    timestamp: new Date().toISOString()
                }));
            };
            
            ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };
            
            ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.wsConnections.delete(ws);
                
                // Auto-reconnect if enabled
                if (this.wsEnabled && this.autoReconnect) {
                    console.log(`🔄 Reconnecting in ${this.reconnectDelay}ms...`);
                    setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
                }
            };
            
            ws.onmessage = (event) => {
                console.log('📥 WebSocket message received:', event.data);
                // Handle incoming messages if needed
            };
            
        } catch (error) {
            console.error('❌ Failed to connect WebSocket:', error);
        }
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnectWebSocket() {
        this.wsConnections.forEach(ws => {
            ws.close();
        });
        this.wsConnections.clear();
    }

    /**
     * Push data point to WebSocket server
     */
    async pushToWebSocket(dataPoint) {
        if (this.wsConnections.size === 0) {
            console.warn('⚠️ No active WebSocket connections');
            return;
        }
        
        try {
            // Log original data point BEFORE preparation to debug empty values
            console.log('🔍 [DEBUG] Original dataPoint before preparation:', {
                timestamp: dataPoint.timestamp,
                hasGPS: !!dataPoint.gps,
                gpsRaw: dataPoint.gps,
                hasOrientation: !!dataPoint.orientation,
                orientationRaw: dataPoint.orientation,
                hasMotion: !!dataPoint.motion,
                motionRaw: dataPoint.motion,
                hasWeather: !!dataPoint.weather,
                weatherRaw: dataPoint.weather
            });
            
            // Prepare safe data point
            const safeDataPoint = await this.prepareSafeDataPoint(dataPoint);
            
            // Log prepared data to see if values changed during preparation
            console.log('🔍 [DEBUG] After prepareSafeDataPoint:', {
                timestamp: safeDataPoint.timestamp,
                hasGPS: !!safeDataPoint.gps,
                gpsAfterPrep: safeDataPoint.gps,
                hasOrientation: !!safeDataPoint.orientation,
                orientationAfterPrep: safeDataPoint.orientation,
                hasMotion: !!safeDataPoint.motion,
                motionAfterPrep: safeDataPoint.motion,
                hasWeather: !!safeDataPoint.weather,
                weatherAfterPrep: safeDataPoint.weather
            });
            
            console.log('📤 Preparing to push data to WebSocket:', {
                timestamp: safeDataPoint.timestamp,
                hasGPS: !!safeDataPoint.gps,
                gpsValues: safeDataPoint.gps ? {
                    lat: safeDataPoint.gps.latitude,
                    lon: safeDataPoint.gps.longitude,
                    alt: safeDataPoint.gps.altitude,
                    accuracy: safeDataPoint.gps.accuracy
                } : null,
                hasOrientation: !!safeDataPoint.orientation,
                orientationValues: safeDataPoint.orientation ? {
                    alpha: safeDataPoint.orientation.alpha,
                    beta: safeDataPoint.orientation.beta,
                    gamma: safeDataPoint.orientation.gamma
                } : null,
                hasMotion: !!safeDataPoint.motion,
                motionValues: safeDataPoint.motion,
                hasWeather: !!safeDataPoint.weather,
                weatherValues: safeDataPoint.weather,
                hasPhoto: !!safeDataPoint.photoBase64,
                photoSize: safeDataPoint.photoBase64 ? `${Math.round(safeDataPoint.photoBase64.length / 1024)}KB` : 'N/A',
                objectCount: safeDataPoint.objectsDetected?.length || 0
            });
            
            const message = JSON.stringify({
                type: 'data',
                timestamp: new Date().toISOString(),
                data: safeDataPoint
            });
            
            // Log a sample of the actual JSON being sent to help debug on receiving end
            const messageSample = message.substring(0, 500);
            console.log('📤 Message size:', Math.round(message.length / 1024), 'KB');
            console.log('🔍 [DEBUG] Message preview (first 500 chars):', messageSample + '...');
            
            // Send to all active connections
            this.wsConnections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(message);
                    console.log('✅ Data pushed to WebSocket successfully');
                }
            });
        } catch (error) {
            console.error('❌ Failed to push data to WebSocket:', error);
            console.error('❌ Error stack:', error.stack);
        }
    }

    /**
     * Export data as JSON stream
     * @param {Object} options - Export options
     * @returns {Promise<String>} JSON string
     */
    async exportJSON(options = {}) {
        const data = await this.getAllData(options);
        
        // Convert blobs to base64 if requested
        if (options.includeMedia) {
            const exportData = await Promise.all(data.map(async point => {
                return await this.prepareSafeDataPoint(point);
            }));
            return JSON.stringify(exportData, null, 2);
        }
        
        // Exclude blobs for smaller export
        const exportData = data.map(point => {
            const { photoBlob, audioBlob, ...rest } = point;
            return rest;
        });
        
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Get API status
     */
    getStatus() {
        return {
            subscribers: this.subscribers.size,
            wsEnabled: this.wsEnabled,
            wsEndpoint: this.wsEndpoint,
            wsConnections: this.wsConnections.size,
            wsConnectionStates: Array.from(this.wsConnections).map(ws => ({
                readyState: ws.readyState,
                url: ws.url
            }))
        };
    }

    /**
     * Load saved WebSocket configuration
     */
    loadConfiguration() {
        const savedEndpoint = localStorage.getItem('pocketParrot_wsEndpoint');
        const savedEnabled = localStorage.getItem('pocketParrot_wsEnabled') === 'true';
        
        if (savedEndpoint) {
            this.wsEndpoint = savedEndpoint;
            console.log('📡 Loaded saved WebSocket endpoint:', savedEndpoint);
        }
        
        // Don't auto-enable on load, require manual enable
        if (savedEnabled && savedEndpoint) {
            console.log('ℹ️ WebSocket was previously enabled. Call enableWebSocket() to reconnect.');
        }
    }
}

// Make API globally available
window.PocketParrotDataAPI = PocketParrotDataAPI;
