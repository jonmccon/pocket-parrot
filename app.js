/**
 * Pocket Parrot - Mobile Sensor Platform
 * A browser-based data capture and visualization app
 */

class PocketParrot {
    constructor() {
        this.db = null;
        this.isCapturing = false;
        this.captureInterval = null;
        this.currentPosition = null;
        this.locationWatchId = null;
        this.objectDetectionModel = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.map = null;
        this.markers = [];
        this.hasRequestedPermissions = false; // Track if permissions have been requested
        
        // Live streaming properties
        this.isLiveStreaming = false;
        this.streamingInterval = null;
        this.captureIntervalMs = 5000; // Default 5 seconds
        this.samplesSent = 0;
        this.autoStartCapture = false; // Will be set by URL params or config
        
        this.init();
    }

    async init() {
        console.log('🦜 Initializing Pocket Parrot...');
        
        // Initialize IndexedDB
        await this.initDB();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize navigation
        this.showPage('capture');
        
        // Update record count
        await this.updateRecordCount();
        
        // Register service worker
        this.registerServiceWorker();
        
        console.log('✅ Pocket Parrot initialized successfully');
    }

    /**
     * Initialize IndexedDB database
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PocketParrotDB', 2);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create main data store
                if (!db.objectStoreNames.contains('sensorData')) {
                    const store = db.createObjectStore('sensorData', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('latitude', 'gps.latitude', { unique: false });
                    store.createIndex('longitude', 'gps.longitude', { unique: false });
                }
            };
        });
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Navigation
        document.getElementById('captureBtn').addEventListener('click', () => this.showPage('capture'));
        document.getElementById('viewBtn').addEventListener('click', () => this.showPage('viewer'));
        document.getElementById('settingsBtn').addEventListener('click', () => this.showPage('settings'));
        
        // Live streaming controls
        document.getElementById('startLiveStreamBtn').addEventListener('click', () => this.startLiveStream());
        document.getElementById('stopLiveStreamBtn').addEventListener('click', () => this.stopLiveStream());
        
        // Modular capture controls
        document.getElementById('captureSensorDataBtn').addEventListener('click', () => this.captureSensorData());
        
        // Camera controls
        document.getElementById('startCameraBtn').addEventListener('click', () => this.startCamera());
        document.getElementById('takePhotoBtn').addEventListener('click', () => this.takePhoto());
        document.getElementById('stopCameraBtn').addEventListener('click', () => this.stopCamera());
        
        // Audio controls
        document.getElementById('startRecordingBtn').addEventListener('click', () => this.startRecording());
        document.getElementById('stopRecordingBtn').addEventListener('click', () => this.stopRecording());
        
        // Viewer controls
        document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearFilters());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('deleteAllBtn').addEventListener('click', () => this.deleteAllData());
        
        // Filter changes
        document.getElementById('dateFilter').addEventListener('change', () => this.filterData());
        document.getElementById('objectFilter').addEventListener('change', () => this.filterData());
        
        // Settings controls
        document.getElementById('saveWsConfigBtn').addEventListener('click', () => this.saveWebSocketConfig());
        document.getElementById('enableWsBtn').addEventListener('click', () => this.enableWebSocket());
        document.getElementById('disableWsBtn').addEventListener('click', () => this.disableWebSocket());
        document.getElementById('testWsBtn').addEventListener('click', () => this.testWebSocketConnection());
        document.getElementById('refreshStatusBtn').addEventListener('click', () => this.refreshAPIStatus());
        
        // Streaming configuration controls
        document.getElementById('saveStreamingConfigBtn').addEventListener('click', () => this.saveStreamingConfig());
        document.getElementById('resetStreamingConfigBtn').addEventListener('click', () => this.resetStreamingConfig());
        document.getElementById('captureInterval').addEventListener('change', () => this.updateDataUsageEstimate());
        document.getElementById('dataMode').addEventListener('change', () => this.updateDataUsageEstimate());
        
        // Device orientation and motion
        if (typeof DeviceOrientationEvent !== 'undefined') {
            window.addEventListener('deviceorientation', (event) => this.updateOrientationData(event));
        }
        
        if (typeof DeviceMotionEvent !== 'undefined') {
            window.addEventListener('devicemotion', (event) => this.updateMotionData(event));
        }
        
        // Permission request button (if it exists)
        const permissionsBtn = document.getElementById('requestPermissionsBtn');
        if (permissionsBtn) {
            permissionsBtn.addEventListener('click', () => this.requestPermissions());
        }
    }

    /**
     * Request permissions for iOS devices
     */
    async requestPermissions() {
        this.updateStatus('Requesting sensor permissions...');
        this.hasRequestedPermissions = true; // Mark that permissions have been requested
        let permissionsGranted = 0;
        let permissionsTotal = 0;
        
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            permissionsTotal++;
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                console.log('Device orientation permission:', permission);
                if (permission === 'granted') permissionsGranted++;
            } catch (error) {
                console.log('Could not request device orientation permission:', error);
            }
        }
        
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            permissionsTotal++;
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                console.log('Device motion permission:', permission);
                if (permission === 'granted') permissionsGranted++;
            } catch (error) {
                console.log('Could not request device motion permission:', error);
            }
        }
        
        // Request geolocation permission
        if (navigator.geolocation) {
            permissionsTotal++;
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('GPS permission timeout')), 5000);
                });
                
                const gpsPromise = new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            permissionsGranted++;
                            console.log('GPS permission granted');
                            this.updateLocationData(position);
                            this.startLocationTracking();
                            resolve(position);
                        },
                        (error) => {
                            console.log('GPS permission denied or not available:', error);
                            reject(error);
                        },
                        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
                    );
                });
                
                await Promise.race([gpsPromise, timeoutPromise]);
            } catch (error) {
                console.log('GPS permission denied or not available:', error);
            }
        }

        // Request camera and microphone permissions
        try {
            permissionsTotal++;
            await navigator.mediaDevices.getUserMedia({ video: true });
            permissionsGranted++;
            console.log('Camera permission granted');
        } catch (error) {
            console.log('Camera permission denied or not available:', error);
        }
        
        try {
            permissionsTotal++;
            await navigator.mediaDevices.getUserMedia({ audio: true });
            permissionsGranted++;
            console.log('Microphone permission granted');
        } catch (error) {
            console.log('Microphone permission denied or not available:', error);
        }
        
        // Update status based on results
        if (permissionsTotal === 0) {
            this.updateStatus('Sensor permissions not required on this device');
        } else if (permissionsGranted === permissionsTotal) {
            this.updateStatus('All sensor permissions granted! 🎉');
        } else if (permissionsGranted > 0) {
            this.updateStatus(`${permissionsGranted}/${permissionsTotal} sensor permissions granted`);
        } else {
            this.updateStatus('Sensor permissions denied. Some features may not work.');
        }
    }

    /**
     * Show specific page
     */
    showPage(pageName) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
        
        // Show selected page
        const pageElement = document.getElementById(pageName + 'Page');
        if (pageElement) {
            pageElement.classList.remove('hidden');
        }
        
        // Initialize page-specific functionality
        if (pageName === 'viewer') {
            this.initViewer();
        } else if (pageName === 'settings') {
            this.initSettings();
        }
    }

    /**
     * Update location data display
     */
    updateLocationData(position) {
        this.currentPosition = position;
        
        const coords = position.coords;
        document.getElementById('latitude').textContent = coords.latitude.toFixed(6);
        document.getElementById('longitude').textContent = coords.longitude.toFixed(6);
        document.getElementById('altitude').textContent = coords.altitude ? coords.altitude.toFixed(1) : '--';
        document.getElementById('speed').textContent = coords.speed ? coords.speed.toFixed(1) : '--';
        document.getElementById('accuracy').textContent = coords.accuracy.toFixed(1);
    }

    /**
     * Start continuous location tracking
     */
    startLocationTracking() {
        if (!navigator.geolocation) {
            console.log('Geolocation is not supported by this browser');
            return;
        }

        // Watch position for continuous updates
        this.locationWatchId = navigator.geolocation.watchPosition(
            (position) => {
                this.updateLocationData(position);
            },
            (error) => {
                console.log('Location tracking error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            }
        );
        
        console.log('Location tracking started');
    }

    /**
     * Update orientation data display and broadcast to WebSocket if enabled
     */
    updateOrientationData(event) {
        document.getElementById('alpha').textContent = event.alpha ? event.alpha.toFixed(1) : '--';
        document.getElementById('beta').textContent = event.beta ? event.beta.toFixed(1) : '--';
        document.getElementById('gamma').textContent = event.gamma ? event.gamma.toFixed(1) : '--';
        
        // Calculate compass heading
        if (event.alpha !== null) {
            const compass = (360 - event.alpha) % 360;
            document.getElementById('compass').textContent = compass.toFixed(1);
            
            // Update visual orientation indicator
            this.updateOrientationVisual(event.alpha, event.beta, event.gamma);
            
            // Broadcast orientation data immediately to WebSocket if enabled
            if (window.pocketParrotAPI && window.pocketParrotAPI.getStatus().wsEnabled) {
                this.broadcastOrientationToWebSocket({
                    alpha: event.alpha,
                    beta: event.beta,
                    gamma: event.gamma
                });
            }
        }
    }

    // Broadcast orientation data to WebSocket immediately
    broadcastOrientationToWebSocket(orientationData) {
        // Only broadcast if we have valid data
        if (orientationData.alpha === null || orientationData.beta === null || orientationData.gamma === null) {
            return;
        }
        
        const message = {
            type: 'data',
            timestamp: new Date().toISOString(),
            data: {
                timestamp: new Date().toISOString(),
                orientation: orientationData
            }
        };
        
        // Send via Data API WebSocket (to main /pocket-parrot endpoint)
        if (window.pocketParrotAPI && window.pocketParrotAPI.wsConnections) {
            window.pocketParrotAPI.wsConnections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(message));
                }
            });
        }
    }

    /**
     * Update visual orientation indicator
     */
    updateOrientationVisual(alpha, beta, gamma) {
        const deviceRect = document.getElementById('deviceRect');
        const compassNeedle = document.getElementById('compassNeedle');
        
        if (!deviceRect || !compassNeedle) return;
        
        // Rotate device rectangle based on gamma (device roll)
        const deviceRotation = gamma || 0;
        deviceRect.setAttribute('transform', `rotate(${deviceRotation} 40 40)`);
        
        // Rotate compass needle based on alpha (device heading)
        const compassRotation = alpha ? (360 - alpha) % 360 : 0;
        compassNeedle.setAttribute('transform', `rotate(${compassRotation} 40 40)`);
        
        // Update device rect color based on tilt (beta)
        const tilt = Math.abs(beta || 0);
        if (tilt > 45) {
            deviceRect.setAttribute('fill', '#dc2626'); // red for extreme tilt
        } else if (tilt > 15) {
            deviceRect.setAttribute('fill', '#f59e0b'); // yellow for moderate tilt
        } else {
            deviceRect.setAttribute('fill', '#4b5563'); // gray for level
        }
    }

    /**
     * Update motion data display
     */
    updateMotionData(event) {
        if (event.accelerationIncludingGravity) {
            const accel = event.accelerationIncludingGravity;
            document.getElementById('accelX').textContent = accel.x ? accel.x.toFixed(2) : '--';
            document.getElementById('accelY').textContent = accel.y ? accel.y.toFixed(2) : '--';
            document.getElementById('accelZ').textContent = accel.z ? accel.z.toFixed(2) : '--';
        }
    }

    /**
     * Fetch weather data for current location with enhanced status reporting
     */
    async fetchWeatherData(lat, lon, locationSource = 'gps') {
        const startTime = Date.now();
        
        // Validate input parameters
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
            const result = {
                data: null,
                status: 'missing_location',
                message: 'Missing or invalid location coordinates',
                accuracy: 'none',
                locationSource: locationSource,
                timestamp: new Date().toISOString()
            };
            this.updateWeatherUI(result);
            return result;
        }
        
        try {
            // Add timeout to fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Weather API request failed: ${response.status} ${response.statusText}`);
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
            
            const result = {
                data: weatherData,
                status: 'success',
                message: 'Weather data retrieved successfully',
                accuracy: locationSource === 'gps' ? 'high' : 'medium',
                locationSource: locationSource,
                responseTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
            
            this.updateWeatherUI(result);
            return result;
            
        } catch (error) {
            let status, message;
            
            if (error.name === 'AbortError') {
                status = 'timeout';
                message = 'Weather request timed out';
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                status = 'network_error';
                message = 'Network connection failed';
            } else if (error.message.includes('Weather API request failed')) {
                status = 'api_error';
                message = error.message;
            } else {
                status = 'unknown_error';
                message = 'Unknown error occurred';
            }
            
            console.error('Error fetching weather data:', error);
            
            const result = {
                data: null,
                status: status,
                message: message,
                accuracy: 'none',
                locationSource: locationSource,
                responseTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
            
            this.updateWeatherUI(result);
            return result;
        }
    }

    /**
     * Update weather UI with result data and status
     */
    updateWeatherUI(result) {
        const statusElement = document.getElementById('weatherStatus');
        const accuracyElement = document.getElementById('weatherAccuracy');
        
        if (result.data) {
            // Update weather data displays
            document.getElementById('temperature').textContent = result.data.temperature;
            document.getElementById('humidity').textContent = result.data.humidity;
            document.getElementById('windSpeed').textContent = result.data.windSpeed;
            document.getElementById('conditions').textContent = this.getWeatherDescription(result.data.weatherCode);
            
            // Update status indicators
            if (statusElement) {
                statusElement.textContent = `✓ ${result.message}`;
                statusElement.className = 'text-xs text-green-600';
            }
            
            if (accuracyElement) {
                const accuracyText = result.locationSource === 'gps' ? 'GPS Location' : 'IP Location';
                accuracyElement.textContent = accuracyText;
                accuracyElement.className = result.accuracy === 'high' ? 'text-xs text-green-600' : 'text-xs text-yellow-600';
            }
        } else {
            // Clear weather data on error
            document.getElementById('temperature').textContent = '--';
            document.getElementById('humidity').textContent = '--';
            document.getElementById('windSpeed').textContent = '--';
            document.getElementById('conditions').textContent = '--';
            
            // Update status with error
            if (statusElement) {
                statusElement.textContent = `⚠ ${result.message}`;
                statusElement.className = 'text-xs text-red-600';
            }
            
            if (accuracyElement) {
                accuracyElement.textContent = 'No Data';
                accuracyElement.className = 'text-xs text-gray-500';
            }
        }
    }

    /**
     * Get approximate location from IP address as fallback
     */
    async getFallbackLocation() {
        try {
            const response = await fetch('https://ipapi.co/json/', {
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            if (!response.ok) {
                throw new Error('IP geolocation request failed');
            }
            
            const data = await response.json();
            
            if (data.latitude && data.longitude) {
                return {
                    latitude: parseFloat(data.latitude),
                    longitude: parseFloat(data.longitude),
                    city: data.city,
                    country: data.country_name,
                    accuracy: 50000 // IP-based location is typically accurate to ~50km
                };
            } else {
                throw new Error('No location data available from IP');
            }
        } catch (error) {
            console.error('Error getting fallback location:', error);
            return null;
        }
    }

    /**
     * Get weather with fallback location if GPS is unavailable
     */
    async getWeatherWithFallback(gpsLocation = null) {
        // Try GPS location first
        if (gpsLocation && gpsLocation.latitude && gpsLocation.longitude) {
            return await this.fetchWeatherData(gpsLocation.latitude, gpsLocation.longitude, 'gps');
        }
        
        // Fallback to IP-based location
        console.log('GPS location unavailable, trying IP-based fallback...');
        const fallbackLocation = await this.getFallbackLocation();
        
        if (fallbackLocation) {
            return await this.fetchWeatherData(fallbackLocation.latitude, fallbackLocation.longitude, 'ip');
        }
        
        // No location available
        return {
            data: null,
            status: 'no_location',
            message: 'No location available for weather data',
            accuracy: 'none',
            locationSource: 'none',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get weather description from weather code
     */
    getWeatherDescription(code) {
        const descriptions = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Fog',
            48: 'Rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            71: 'Slight snow',
            73: 'Moderate snow',
            75: 'Heavy snow',
            95: 'Thunderstorm'
        };
        
        return descriptions[code] || 'Unknown';
    }

    /**
     * Start camera for photo capture
     */
    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' } // Use front-facing camera for events
            });
            
            const video = document.getElementById('cameraPreview');
            video.srcObject = stream;
            video.play();
            
            // Show/hide buttons
            video.classList.remove('hidden');
            document.getElementById('startCameraBtn').classList.add('hidden');
            document.getElementById('takePhotoBtn').classList.remove('hidden');
            document.getElementById('stopCameraBtn').classList.remove('hidden');
            
            // Load object detection model if not already loaded
            if (!this.objectDetectionModel) {
                this.updateStatus('Loading object detection model...');
                this.objectDetectionModel = await cocoSsd.load();
                this.updateStatus('Ready');
            }
            
        } catch (error) {
            console.error('Error starting camera:', error);
            alert('Could not access camera. Please check permissions.');
        }
    }

    /**
     * Stop camera
     */
    stopCamera() {
        const video = document.getElementById('cameraPreview');
        if (video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            video.srcObject = null;
        }
        
        // Show/hide buttons
        video.classList.add('hidden');
        document.getElementById('startCameraBtn').classList.remove('hidden');
        document.getElementById('takePhotoBtn').classList.add('hidden');
        document.getElementById('stopCameraBtn').classList.add('hidden');
        
        // Clear detection results
        document.getElementById('detectionResults').classList.add('hidden');
    }

    /**
     * Take photo and run object detection
     */
    async takePhoto() {
        const video = document.getElementById('cameraPreview');
        const canvas = document.getElementById('photoCanvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0);
        
        // Show captured photo to user
        const capturedPhotoDisplay = document.getElementById('capturedPhotoDisplay');
        const capturedPhotoImage = document.getElementById('capturedPhotoImage');
        canvas.toBlob(blob => {
            capturedPhotoImage.src = URL.createObjectURL(blob);
            capturedPhotoDisplay.classList.remove('hidden');
        });
        
        // Extract color palette from the image
        const colorPalette = this.extractColorPalette(canvas);
        
        // Run object detection
        let detectedObjects = [];
        if (this.objectDetectionModel) {
            try {
                this.updateStatus('Detecting objects...');
                const predictions = await this.objectDetectionModel.detect(video);
                detectedObjects = predictions.map(pred => ({
                    class: pred.class,
                    score: pred.score,
                    bbox: pred.bbox
                }));
                
                // Display enhanced results
                this.displayEnhancedDetectionResults(detectedObjects, colorPalette);
                this.updateStatus('Ready');
            } catch (error) {
                console.error('Object detection error:', error);
                this.displayDetectionError();
            }
        }
        
        // Convert canvas to blob and save photo as a data point
        return new Promise(resolve => {
            canvas.toBlob(async blob => {
                // Save photo to database with all current sensor data
                await this.savePhotoDataPoint(blob, detectedObjects, colorPalette);
                
                // Also return the photo data for backward compatibility
                resolve({ blob, detectedObjects, colorPalette });
            }, 'image/jpeg', 0.8);
        });
    }

    /**
     * Save a photo as a complete data point with current sensor readings
     */
    async savePhotoDataPoint(photoBlob, detectedObjects, colorPalette) {
        try {
            const timestamp = new Date().toISOString();
            const dataPoint = {
                timestamp,
                captureMethod: 'user_photo_capture', // Indicates this was a user-initiated photo
                gps: null,
                orientation: null,
                motion: null,
                weather: null,
                objectsDetected: detectedObjects || [],
                colorPalette: colorPalette || [],
                photoBlob: photoBlob,
                audioBlob: null
            };
            
            // Include current GPS location if available
            if (this.currentPosition) {
                const coords = this.currentPosition.coords;
                dataPoint.gps = {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    altitude: coords.altitude,
                    accuracy: coords.accuracy,
                    speed: coords.speed,
                    heading: coords.heading
                };
            }
            
            // Include current orientation data if available
            if (window.DeviceOrientationEvent) {
                const alphaEl = document.getElementById('alpha');
                const betaEl = document.getElementById('beta');
                const gammaEl = document.getElementById('gamma');
                
                if (alphaEl && alphaEl.textContent !== '--') {
                    dataPoint.orientation = {
                        alpha: parseFloat(alphaEl.textContent),
                        beta: parseFloat(betaEl.textContent),
                        gamma: parseFloat(gammaEl.textContent)
                    };
                }
            }
            
            // Include current motion data if available
            if (window.DeviceMotionEvent) {
                const accelXEl = document.getElementById('accelX');
                const accelYEl = document.getElementById('accelY');
                const accelZEl = document.getElementById('accelZ');
                
                if (accelXEl && accelXEl.textContent !== '--') {
                    dataPoint.motion = {
                        accelerationX: parseFloat(accelXEl.textContent),
                        accelerationY: parseFloat(accelYEl.textContent),
                        accelerationZ: parseFloat(accelZEl.textContent)
                    };
                }
            }
            
            // Save to IndexedDB
            await this.saveDataPoint(dataPoint);
            await this.updateRecordCount();
            
            this.updateStatus('Photo captured and saved');
            console.log('📸 Photo captured by user and saved to database');
            
        } catch (error) {
            console.error('Error saving photo data point:', error);
            this.updateStatus('Failed to save photo');
        }
    }


    /**
     * Extract dominant colors from canvas image
     */
    extractColorPalette(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Sample pixels (every 10th pixel for performance)
        const colorMap = new Map();
        for (let i = 0; i < data.length; i += 40) { // RGBA, so skip by 40 to get every 10th pixel
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Skip very dark or very light colors
            const brightness = (r + g + b) / 3;
            if (brightness < 30 || brightness > 240) continue;
            
            // Round colors to reduce variations
            const roundedR = Math.round(r / 16) * 16;
            const roundedG = Math.round(g / 16) * 16;
            const roundedB = Math.round(b / 16) * 16;
            
            const colorKey = `${roundedR},${roundedG},${roundedB}`;
            colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
        }
        
        // Sort by frequency and get top 5
        const sortedColors = Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([color]) => {
                const [r, g, b] = color.split(',').map(Number);
                return { r, g, b, hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}` };
            });
        
        return sortedColors;
    }

    /**
     * Display enhanced detection results with objects and color palette
     */
    displayEnhancedDetectionResults(detectedObjects, colorPalette) {
        const resultsContainer = document.getElementById('detectionResults');
        const objectsContainer = document.getElementById('objectsContainer');
        const colorPaletteContainer = document.getElementById('colorPalette');
        const statusElement = document.getElementById('detectionStatus');
        
        // Clear previous results
        objectsContainer.innerHTML = '';
        colorPaletteContainer.innerHTML = '';
        
        // Display detected objects
        if (detectedObjects.length > 0) {
            detectedObjects.forEach(obj => {
                const objectTag = document.createElement('span');
                objectTag.className = 'inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full';
                objectTag.textContent = `${obj.class} (${(obj.score * 100).toFixed(1)}%)`;
                objectsContainer.appendChild(objectTag);
            });
            statusElement.textContent = `Found ${detectedObjects.length} object${detectedObjects.length > 1 ? 's' : ''}`;
        } else {
            statusElement.textContent = 'No objects detected';
        }
        
        // Display color palette
        if (colorPalette.length > 0) {
            colorPalette.forEach((color, index) => {
                const colorSwatch = document.createElement('div');
                colorSwatch.className = 'w-8 h-8 rounded border-2 border-gray-300';
                colorSwatch.style.backgroundColor = color.hex;
                colorSwatch.title = `Color ${index + 1}: ${color.hex}`;
                colorPaletteContainer.appendChild(colorSwatch);
            });
        }
        
        // Show results container
        resultsContainer.classList.remove('hidden');
    }

    /**
     * Display detection error
     */
    displayDetectionError() {
        const resultsContainer = document.getElementById('detectionResults');
        const statusElement = document.getElementById('detectionStatus');
        
        statusElement.textContent = 'Object detection failed';
        statusElement.className = 'text-sm text-red-600';
        resultsContainer.classList.remove('hidden');
    }

    /**
     * Start audio recording
     */
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            // Set up audio visualization
            this.setupAudioVisualization(stream);
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/wav' });
                const audio = document.getElementById('audioPlayback');
                audio.src = URL.createObjectURL(blob);
                audio.classList.remove('hidden');
                
                // Hide waveform visualization
                document.getElementById('audioWaveform').classList.add('hidden');
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            
            // Update UI
            document.getElementById('startRecordingBtn').classList.add('hidden');
            document.getElementById('stopRecordingBtn').classList.remove('hidden');
            document.getElementById('recordingStatus').textContent = 'Recording...';
            document.getElementById('audioWaveform').classList.remove('hidden');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    }

    /**
     * Set up audio visualization
     */
    setupAudioVisualization(stream) {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        microphone.connect(analyser);
        
        const canvas = document.getElementById('waveformCanvas');
        const ctx = canvas.getContext('2d');
        
        const draw = () => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                analyser.getByteFrequencyData(dataArray);
                
                ctx.fillStyle = '#f3f4f6';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const barWidth = (canvas.width / bufferLength) * 2.5;
                let barHeight;
                let x = 0;
                
                for (let i = 0; i < bufferLength; i++) {
                    barHeight = (dataArray[i] / 255) * canvas.height;
                    
                    const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
                    gradient.addColorStop(0, '#3b82f6');
                    gradient.addColorStop(1, '#1d4ed8');
                    ctx.fillStyle = gradient;
                    
                    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1;
                }
                
                requestAnimationFrame(draw);
            }
        };
        
        draw();
    }

    /**
     * Stop audio recording
     */
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            
            // Update UI
            document.getElementById('startRecordingBtn').classList.remove('hidden');
            document.getElementById('stopRecordingBtn').classList.add('hidden');
            document.getElementById('recordingStatus').textContent = 'Recording stopped';
        }
    }

    /**
     * Capture sensor data only (GPS, orientation, motion, weather, camera, audio)
     */
    async captureSensorData() {
        try {
            this.updateStatus('Capturing sensor data...');
            
            const timestamp = new Date().toISOString();
            const dataPoint = {
                timestamp,
                captureMethod: 'modular_sensor_capture', // Indicates this was captured via the modular approach
                modules: {
                    permissionsRequested: this.hasRequestedPermissions || false,
                    gpsEnabled: !!this.currentPosition,
                    orientationEnabled: !!window.DeviceOrientationEvent,
                    motionEnabled: !!window.DeviceMotionEvent,
                    weatherEnabled: true,
                    cameraEnabled: !document.getElementById('cameraPreview').classList.contains('hidden'),
                    audioEnabled: this.audioChunks.length > 0
                },
                gps: null,
                orientation: null,
                motion: null,
                weather: null,
                objectsDetected: [],
                photoBlob: null,
                audioBlob: null
            };
            
            // Get current location and weather
            if (this.currentPosition) {
                const coords = this.currentPosition.coords;
                dataPoint.gps = {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    altitude: coords.altitude,
                    accuracy: coords.accuracy,
                    speed: coords.speed,
                    heading: coords.heading
                };
                
                // Fetch weather data with GPS location
                const weatherResult = await this.getWeatherWithFallback({
                    latitude: coords.latitude,
                    longitude: coords.longitude
                });
                dataPoint.weather = weatherResult;
            } else {
                // No GPS available, try IP-based weather fallback
                const weatherResult = await this.getWeatherWithFallback(null);
                dataPoint.weather = weatherResult;
            }
            
            // Get orientation data
            if (window.DeviceOrientationEvent) {
                // We'll capture the last known orientation values
                const alphaEl = document.getElementById('alpha');
                const betaEl = document.getElementById('beta');
                const gammaEl = document.getElementById('gamma');
                
                if (alphaEl.textContent !== '--') {
                    dataPoint.orientation = {
                        alpha: parseFloat(alphaEl.textContent),
                        beta: parseFloat(betaEl.textContent),
                        gamma: parseFloat(gammaEl.textContent)
                    };
                }
            }
            
            // Get motion data
            if (window.DeviceMotionEvent) {
                const accelXEl = document.getElementById('accelX');
                const accelYEl = document.getElementById('accelY');
                const accelZEl = document.getElementById('accelZ');
                
                if (accelXEl.textContent !== '--') {
                    dataPoint.motion = {
                        accelerationX: parseFloat(accelXEl.textContent),
                        accelerationY: parseFloat(accelYEl.textContent),
                        accelerationZ: parseFloat(accelZEl.textContent)
                    };
                }
            }
            
            // Note: Photos are now only captured when user explicitly presses "Take Photo" button
            // Removed automatic photo capture to prevent unintended photo streaming
            
            // Get audio if recording
            if (this.audioChunks.length > 0) {
                dataPoint.audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.audioChunks = []; // Clear for next recording
            }
            
            // Save to IndexedDB
            await this.saveDataPoint(dataPoint);
            await this.updateRecordCount();
            
            this.updateStatus('Sensor data captured');
            
        } catch (error) {
            console.error('Error capturing sensor data:', error);
            this.updateStatus('Sensor capture failed');
        }
    }

    /**
     * Start live streaming of sensor data
     */
    async startLiveStream() {
        try {
            this.updateStatus('Starting live stream...');
            
            // First request permissions if not already done
            if (!this.hasRequestedPermissions) {
                await this.requestPermissions();
            }
            
            // Configure WebSocket if not already connected
            if (window.pocketParrotAPI && !window.pocketParrotAPI.getStatus().wsEnabled) {
                // Check if endpoint is configured
                const wsEndpoint = localStorage.getItem('pocketParrot_wsEndpoint');
                if (wsEndpoint) {
                    try {
                        await window.pocketParrotAPI.enableWebSocket();
                        this.updateStatus('Connected to server...');
                    } catch (error) {
                        console.warn('WebSocket connection failed, continuing with local storage only:', error);
                    }
                } else {
                    console.log('No WebSocket endpoint configured, data will be stored locally only');
                }
            }
            
            // Start continuous GPS tracking
            this.startLocationTracking();
            
            // Set streaming state
            this.isLiveStreaming = true;
            this.samplesSent = 0;
            
            // Update UI
            this.updateStreamingUI();
            
            // Capture first sample immediately
            await this.captureStreamingSample();
            
            // Start continuous capture
            this.streamingInterval = setInterval(async () => {
                if (this.isLiveStreaming) {
                    await this.captureStreamingSample();
                }
            }, this.captureIntervalMs);
            
            this.updateStatus(`Live streaming started (${this.captureIntervalMs/1000}s interval)`);
            
        } catch (error) {
            console.error('Error starting live stream:', error);
            this.updateStatus('Failed to start live stream');
            this.stopLiveStream();
        }
    }

    /**
     * Stop live streaming
     */
    stopLiveStream() {
        this.isLiveStreaming = false;
        
        if (this.streamingInterval) {
            clearInterval(this.streamingInterval);
            this.streamingInterval = null;
        }
        
        // Stop location tracking
        if (this.locationWatchId) {
            navigator.geolocation.clearWatch(this.locationWatchId);
            this.locationWatchId = null;
        }
        
        // Update UI
        this.updateStreamingUI();
        
        this.updateStatus(`Live streaming stopped (${this.samplesSent} samples sent)`);
        console.log(`📊 Live streaming session complete: ${this.samplesSent} samples sent`);
    }

    /**
     * Capture a lightweight sensor sample for streaming
     */
    async captureStreamingSample() {
        try {
            const timestamp = new Date().toISOString();
            
            // Get streaming configuration
            const config = this.getStreamingConfig();
            
            const dataPoint = {
                timestamp,
                captureMethod: 'live_streaming',
                streamingSession: true,
                dataMode: config.dataMode,
                gps: null,
                orientation: null,
                motion: null,
                weather: null,
                objectsDetected: [],
                photoBlob: null,
                audioBlob: null
            };
            
            // Get GPS data if available
            if (this.currentPosition) {
                const coords = this.currentPosition.coords;
                dataPoint.gps = {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    altitude: coords.altitude,
                    accuracy: coords.accuracy,
                    speed: coords.speed,
                    heading: coords.heading
                };
            }
            
            // Get orientation and motion data based on configuration
            if (config.dataMode === 'sensors' || config.dataMode === 'full') {
                // Get orientation data
                if (window.DeviceOrientationEvent) {
                    const alphaEl = document.getElementById('alpha');
                    const betaEl = document.getElementById('beta');
                    const gammaEl = document.getElementById('gamma');
                    
                    if (alphaEl && alphaEl.textContent !== '--') {
                        dataPoint.orientation = {
                            alpha: parseFloat(alphaEl.textContent),
                            beta: parseFloat(betaEl.textContent),
                            gamma: parseFloat(gammaEl.textContent)
                        };
                    }
                }
                
                // Get motion data
                if (window.DeviceMotionEvent) {
                    const accelXEl = document.getElementById('accelX');
                    const accelYEl = document.getElementById('accelY');
                    const accelZEl = document.getElementById('accelZ');
                    
                    if (accelXEl && accelXEl.textContent !== '--') {
                        dataPoint.motion = {
                            accelerationX: parseFloat(accelXEl.textContent),
                            accelerationY: parseFloat(accelYEl.textContent),
                            accelerationZ: parseFloat(accelZEl.textContent)
                        };
                    }
                }
            }
            
            // Get weather data based on configuration (less frequently to reduce API calls)
            if (config.includeWeather && (config.dataMode === 'full' || this.samplesSent % 12 === 0) && this.currentPosition) {
                const weatherResult = await this.getWeatherWithFallback({
                    latitude: this.currentPosition.coords.latitude,
                    longitude: this.currentPosition.coords.longitude
                });
                dataPoint.weather = weatherResult;
            }
            
            // Note: Photos are now only captured when user explicitly presses "Take Photo" button
            // The includeMedia setting no longer automatically captures photos during streaming
            // This prevents creating a near-live video stream and respects user intent
            
            // Get audio if recording (audio can still be included in streaming)
            if (config.includeMedia && this.audioChunks.length > 0) {
                dataPoint.audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.audioChunks = []; // Clear for next recording
            }
            
            // Save to IndexedDB
            await this.saveDataPoint(dataPoint);
            
            // Increment counter and update UI
            this.samplesSent++;
            this.updateStreamingStats();
            
            console.log(`📡 Streaming sample ${this.samplesSent}:`, dataPoint);
            
        } catch (error) {
            console.error('Error capturing streaming sample:', error);
        }
    }

    /**
     * Get current streaming configuration
     */
    getStreamingConfig() {
        try {
            const saved = localStorage.getItem('pocketParrot_streamingConfig');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading streaming config:', error);
        }
        
        // Return defaults
        return {
            captureInterval: 5000,
            dataMode: 'gps',
            includeWeather: true,
            includeMedia: false,
            highAccuracyGPS: true
        };
    }

    /**
     * Update streaming UI elements
     */
    updateStreamingUI() {
        const startBtn = document.getElementById('startLiveStreamBtn');
        const stopBtn = document.getElementById('stopLiveStreamBtn');
        const streamingStatus = document.getElementById('streamingStatus');
        const streamingStatusText = document.getElementById('streamingStatusText');
        
        if (this.isLiveStreaming) {
            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            streamingStatus.classList.remove('hidden');
            if (streamingStatusText) streamingStatusText.textContent = 'Active';
        } else {
            startBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
            streamingStatus.classList.add('hidden');
            if (streamingStatusText) streamingStatusText.textContent = 'Inactive';
        }
    }

    /**
     * Update streaming statistics
     */
    updateStreamingStats() {
        const samplesSentEl = document.getElementById('samplesSent');
        const streamingRateEl = document.getElementById('streamingRate');
        const connectionStatusEl = document.getElementById('connectionStatus');
        
        if (samplesSentEl) samplesSentEl.textContent = this.samplesSent;
        if (streamingRateEl) streamingRateEl.textContent = `Every ${this.captureIntervalMs/1000}s`;
        
        if (connectionStatusEl && window.pocketParrotAPI) {
            const status = window.pocketParrotAPI.getStatus();
            connectionStatusEl.textContent = status.wsEnabled && status.wsConnections > 0 ? '● Connected' : '○ Local Only';
            connectionStatusEl.className = status.wsEnabled && status.wsConnections > 0 ? 
                'text-xl font-bold text-green-400' : 'text-xl font-bold text-yellow-400';
        }
    }

    /**
     * Start location tracking for live streaming
     */
    startLocationTracking() {
        if ('geolocation' in navigator && !this.locationWatchId) {
            this.locationWatchId = navigator.geolocation.watchPosition(
                (position) => {
                    this.currentPosition = position;
                    this.updateLocationData(position);
                },
                (error) => {
                    console.warn('Location tracking error:', error);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 30000,
                    timeout: 15000
                }
            );
            console.log('Location tracking started for live streaming');
        }
    }

    /**
     * Capture a complete data point (legacy function - kept for backward compatibility)
     */
    async captureDataPoint() {
        try {
            this.updateStatus('Capturing data point...');
            
            const timestamp = new Date().toISOString();
            const dataPoint = {
                timestamp,
                gps: null,
                orientation: null,
                motion: null,
                weather: null,
                objectsDetected: [],
                photoBlob: null,
                audioBlob: null
            };
            
            // Get current location and weather
            if (this.currentPosition) {
                const coords = this.currentPosition.coords;
                dataPoint.gps = {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    altitude: coords.altitude,
                    accuracy: coords.accuracy,
                    speed: coords.speed,
                    heading: coords.heading
                };
                
                // Fetch weather data with GPS location
                const weatherResult = await this.getWeatherWithFallback({
                    latitude: coords.latitude,
                    longitude: coords.longitude
                });
                dataPoint.weather = weatherResult;
            } else {
                // No GPS available, try IP-based weather fallback
                const weatherResult = await this.getWeatherWithFallback(null);
                dataPoint.weather = weatherResult;
            }
            
            // Get orientation data
            if (window.DeviceOrientationEvent) {
                // We'll capture the last known orientation values
                const alphaEl = document.getElementById('alpha');
                const betaEl = document.getElementById('beta');
                const gammaEl = document.getElementById('gamma');
                
                if (alphaEl.textContent !== '--') {
                    dataPoint.orientation = {
                        alpha: parseFloat(alphaEl.textContent),
                        beta: parseFloat(betaEl.textContent),
                        gamma: parseFloat(gammaEl.textContent)
                    };
                }
            }
            
            // Get motion data
            if (window.DeviceMotionEvent) {
                const accelXEl = document.getElementById('accelX');
                const accelYEl = document.getElementById('accelY');
                const accelZEl = document.getElementById('accelZ');
                
                if (accelXEl.textContent !== '--') {
                    dataPoint.motion = {
                        accelerationX: parseFloat(accelXEl.textContent),
                        accelerationY: parseFloat(accelYEl.textContent),
                        accelerationZ: parseFloat(accelZEl.textContent)
                    };
                }
            }
            
            // Note: Photos are now only captured when user explicitly presses "Take Photo" button
            // Removed automatic photo capture to prevent unintended photo streaming
            
            // Get audio if recording
            if (this.audioChunks.length > 0) {
                dataPoint.audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.audioChunks = []; // Clear for next recording
            }
            
            // Save to IndexedDB
            await this.saveDataPoint(dataPoint);
            await this.updateRecordCount();
            
            this.updateStatus('Data point captured');
            
        } catch (error) {
            console.error('Error capturing data point:', error);
            this.updateStatus('Capture failed');
        }
    }

    /**
     * Save data point to IndexedDB
     */
    async saveDataPoint(dataPoint) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sensorData'], 'readwrite');
            const store = transaction.objectStore('sensorData');
            const request = store.add(dataPoint);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update record count display
     */
    async updateRecordCount() {
        try {
            const count = await this.getRecordCount();
            document.getElementById('recordCount').textContent = count;
        } catch (error) {
            console.error('Error updating record count:', error);
        }
    }

    /**
     * Get total record count
     */
    async getRecordCount() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sensorData'], 'readonly');
            const store = transaction.objectStore('sensorData');
            const request = store.count();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update status display
     */
    updateStatus(status) {
        document.getElementById('statusText').textContent = status;
    }

    /**
     * Initialize data viewer
     */
    async initViewer() {
        // Initialize map if not already done and Leaflet is available
        if (!this.map && typeof L !== 'undefined') {
            try {
                this.map = L.map('mapContainer').setView([0, 0], 2);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.map);
            } catch (error) {
                console.warn('Could not initialize map:', error);
                document.getElementById('mapContainer').innerHTML = '<div class="p-4 text-center text-gray-600">Map unavailable (Leaflet CDN blocked)</div>';
            }
        } else if (typeof L === 'undefined') {
            // Handle case where Leaflet CDN is blocked
            document.getElementById('mapContainer').innerHTML = '<div class="p-4 text-center text-gray-600">Map unavailable (Leaflet CDN blocked)</div>';
        }
        
        // Load and display data
        await this.loadAndDisplayData();
    }

    /**
     * Load and display all data
     */
    async loadAndDisplayData() {
        try {
            const allData = await this.getAllData();
            this.displayDataOnMap(allData);
            this.displayDataInAccordion(allData);
            this.populateObjectFilter(allData);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    /**
     * Get all data from IndexedDB, ordered newest first
     */
    async getAllData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sensorData'], 'readonly');
            const store = transaction.objectStore('sensorData');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const data = request.result;
                // Sort by timestamp in descending order (newest first)
                data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                resolve(data);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Display data points on map
     */
    displayDataOnMap(data) {
        // Skip if map is not available
        if (!this.map || typeof L === 'undefined') {
            console.log('Map not available, skipping map display');
            return;
        }
        
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        
        // Add markers for data points with GPS
        data.forEach(point => {
            if (point.gps && point.gps.latitude && point.gps.longitude) {
                const marker = L.marker([point.gps.latitude, point.gps.longitude])
                    .bindPopup(this.createPopupContent(point))
                    .addTo(this.map);
                
                this.markers.push(marker);
            }
        });
        
        // Fit map to show all markers
        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    /**
     * Create popup content for map marker
     */
    createPopupContent(point) {
        const timestamp = new Date(point.timestamp).toLocaleString();
        const objects = point.objectsDetected.length > 0 
            ? point.objectsDetected.map(obj => obj.class).join(', ')
            : 'None';
        
        return `
            <strong>Timestamp:</strong> ${timestamp}<br>
            <strong>Objects:</strong> ${objects}<br>
            <strong>Weather:</strong> ${point.weather && point.weather.data ? point.weather.data.temperature + '°C' : 'N/A'}
        `;
    }

    /**
     * Display data in accordion style instead of table
     */
    displayDataInAccordion(data) {
        const accordion = document.getElementById('dataAccordion');
        accordion.innerHTML = '';
        
        if (data.length === 0) {
            accordion.innerHTML = '<div class="text-center text-gray-500 py-8">No data captured yet</div>';
            return;
        }
        
        data.forEach((point, index) => {
            const accordionItem = this.createAccordionItem(point, index);
            accordion.appendChild(accordionItem);
        });
    }

    /**
     * Create an accordion item for a data point
     */
    createAccordionItem(point, index) {
        const timestamp = new Date(point.timestamp).toLocaleString();
        const location = point.gps 
            ? `${point.gps.latitude.toFixed(4)}, ${point.gps.longitude.toFixed(4)}`
            : 'N/A';
        const weather = point.weather && point.weather.data
            ? `${point.weather.data.temperature}°C, ${point.weather.data.humidity}%`
            : 'N/A';
        const objects = point.objectsDetected.length > 0
            ? point.objectsDetected.map(obj => obj.class).join(', ')
            : 'None';
        const media = [];
        if (point.photoBlob) media.push('📷');
        if (point.audioBlob) media.push('🎤');
        
        const item = document.createElement('div');
        item.className = 'bg-white border border-gray-200 rounded-lg shadow-sm';
        
        // Create summary header (always visible)
        const header = document.createElement('div');
        header.className = 'p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center';
        header.innerHTML = `
            <div class="flex-1">
                <div class="font-medium text-gray-900">${timestamp}</div>
                <div class="text-sm text-gray-600 mt-1">
                    📍 ${location} | 🌤️ ${weather} | 🔍 ${objects} ${media.join(' ')}
                </div>
            </div>
            <div class="flex items-center gap-2 ml-4">
                <svg class="accordion-chevron w-5 h-5 text-gray-400 transform transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </div>
        `;
        
        // Create details section (initially hidden)
        const details = document.createElement('div');
        details.className = 'accordion-content hidden border-t border-gray-200 p-4 bg-gray-50';
        details.innerHTML = this.createDetailedViewForAccordion(point);
        
        // Add click handler to toggle details
        header.addEventListener('click', () => {
            const isExpanded = !details.classList.contains('hidden');
            details.classList.toggle('hidden');
            header.querySelector('.accordion-chevron').style.transform = isExpanded ? '' : 'rotate(180deg)';
        });
        
        item.appendChild(header);
        item.appendChild(details);
        
        return item;
    }

    /**
     * Create detailed view content for accordion (similar to modal content but formatted for accordion)
     */
    createDetailedViewForAccordion(point) {
        let html = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        
        // Timestamp and basic info
        html += `
            <div>
                <h4 class="font-semibold text-gray-700 mb-2">📅 Timestamp</h4>
                <p class="text-sm text-gray-600">${new Date(point.timestamp).toLocaleString()}</p>
            </div>
        `;
        
        if (point.gps) {
            html += `
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">📍 GPS Location</h4>
                    <div class="text-sm text-gray-600">
                        <div>Lat: ${point.gps.latitude.toFixed(6)}</div>
                        <div>Lon: ${point.gps.longitude.toFixed(6)}</div>
                        <div>Alt: ${point.gps.altitude ? point.gps.altitude.toFixed(1) + 'm' : 'N/A'}</div>
                        <div>Accuracy: ${point.gps.accuracy.toFixed(1)}m</div>
                    </div>
                </div>
            `;
        }
        
        if (point.orientation) {
            const deviceRotation = point.orientation.gamma || 0;
            const compassRotation = point.orientation.alpha ? (360 - point.orientation.alpha) % 360 : 0;
            const tilt = Math.abs(point.orientation.beta || 0);
            const deviceColor = tilt > 45 ? '#dc2626' : tilt > 15 ? '#f59e0b' : '#4b5563';
            
            html += `
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">🧭 Device Orientation</h4>
                    <div class="flex gap-3">
                        <div class="text-sm text-gray-600 flex-1">
                            <div>Alpha: ${point.orientation.alpha.toFixed(1)}°</div>
                            <div>Beta: ${point.orientation.beta.toFixed(1)}°</div>
                            <div>Gamma: ${point.orientation.gamma.toFixed(1)}°</div>
                            <div>Compass: ${((360 - point.orientation.alpha) % 360).toFixed(1)}°</div>
                        </div>
                        <div>
                            <svg width="50" height="50" viewBox="0 0 80 80" class="border rounded bg-white">
                                <rect x="30" y="20" width="20" height="40" rx="3" fill="${deviceColor}" stroke="#374151" stroke-width="1" transform="rotate(${deviceRotation} 40 40)"/>
                                <g transform="rotate(${compassRotation} 40 40)">
                                    <line x1="40" y1="40" x2="40" y2="25" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
                                    <circle cx="40" cy="40" r="2" fill="#ef4444"/>
                                </g>
                                <text x="40" y="12" text-anchor="middle" font-size="6" fill="#6b7280">N</text>
                                <text x="68" y="44" text-anchor="middle" font-size="6" fill="#6b7280">E</text>
                                <text x="40" y="72" text-anchor="middle" font-size="6" fill="#6b7280">S</text>
                                <text x="12" y="44" text-anchor="middle" font-size="6" fill="#6b7280">W</text>
                            </svg>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (point.motion) {
            html += `
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">🏃 Motion Data</h4>
                    <div class="text-sm text-gray-600">
                        <div>Accel X: ${point.motion.accelerationX.toFixed(2)}</div>
                        <div>Y: ${point.motion.accelerationY.toFixed(2)}</div>
                        <div>Z: ${point.motion.accelerationZ.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }
        
        if (point.weather && point.weather.data) {
            html += `
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">🌤️ Weather</h4>
                    <div class="text-sm text-gray-600">
                        <div>Temperature: ${point.weather.data.temperature}°C</div>
                        <div>Humidity: ${point.weather.data.humidity}%</div>
                        <div>Wind: ${point.weather.data.windSpeed} km/h</div>
                        <div class="text-xs text-gray-500 mt-1">
                            Status: ${point.weather.message} (${point.weather.locationSource})
                        </div>
                    </div>
                </div>
            `;
        } else if (point.weather) {
            html += `
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">🌤️ Weather</h4>
                    <div class="text-sm text-red-600">
                        ${point.weather.message || 'Weather data unavailable'}
                    </div>
                </div>
            `;
        }
        
        if (point.objectsDetected.length > 0) {
            html += `
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">🔍 Detected Objects</h4>
                    <div class="flex flex-wrap gap-1">
                        ${point.objectsDetected.map(obj => 
                            `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">${obj.class} (${(obj.score * 100).toFixed(1)}%)</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }
        
        html += `</div>`; // Close grid
        
        // Media section (full width)
        if (point.photoBlob || point.audioBlob) {
            html += `<div class="mt-4 pt-4 border-t border-gray-200">`;
            
            if (point.photoBlob) {
                const imageUrl = URL.createObjectURL(point.photoBlob);
                html += `
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-700 mb-2">📷 Photo</h4>
                        <img src="${imageUrl}" alt="Captured photo" class="max-w-full h-auto rounded border mb-2">
                `;
                
                // Add color palette if available
                if (point.colorPalette && point.colorPalette.length > 0) {
                    html += `
                        <div class="mt-2">
                            <h5 class="text-sm font-medium text-gray-600 mb-1">Extracted Colors:</h5>
                            <div class="flex gap-2">
                    `;
                    point.colorPalette.forEach((color, index) => {
                        html += `
                            <div class="w-8 h-8 rounded border-2 border-gray-300" 
                                 style="background-color: ${color.hex}" 
                                 title="Color ${index + 1}: ${color.hex}">
                            </div>
                        `;
                    });
                    html += `</div></div>`;
                }
                
                html += `</div>`;
            }
            
            if (point.audioBlob) {
                const audioUrl = URL.createObjectURL(point.audioBlob);
                html += `
                    <div>
                        <h4 class="font-semibold text-gray-700 mb-2">🎤 Audio</h4>
                        <audio controls class="w-full">
                            <source src="${audioUrl}" type="audio/wav">
                            Your browser does not support audio playback.
                        </audio>
                    </div>
                `;
            }
            
            html += `</div>`;
        }
        
        // Add delete button aligned to the right
        html += `
            <div class="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                <button class="delete-btn px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors" onclick="event.stopPropagation(); app.deleteDataEntry(${point.id}).then(() => app.loadAndDisplayData())">
                    🗑️ Delete Entry
                </button>
            </div>
        `;
        
        return html;
    }

    /**
     * Populate object filter dropdown
     */
    populateObjectFilter(data) {
        const objectFilter = document.getElementById('objectFilter');
        const objects = new Set();
        
        data.forEach(point => {
            point.objectsDetected.forEach(obj => objects.add(obj.class));
        });
        
        // Clear existing options (except "All Objects")
        objectFilter.innerHTML = '<option value="">All Objects</option>';
        
        // Add unique objects
        Array.from(objects).sort().forEach(obj => {
            const option = document.createElement('option');
            option.value = obj;
            option.textContent = obj;
            objectFilter.appendChild(option);
        });
    }

    /**
     * Show detailed view of a data point
     */
    async showDataDetails(id) {
        try {
            const dataPoint = await this.getDataPoint(id);
            if (!dataPoint) return;
            
            const modal = document.getElementById('dataModal');
            const content = document.getElementById('modalContent');
            
            content.innerHTML = await this.createDetailedView(dataPoint);
            modal.classList.remove('hidden');
        } catch (error) {
            console.error('Error showing data details:', error);
        }
    }

    /**
     * Get specific data point by ID
     */
    async getDataPoint(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sensorData'], 'readonly');
            const store = transaction.objectStore('sensorData');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Create detailed view of data point
     */
    async createDetailedView(point) {
        let html = `
            <div class="space-y-4">
                <div>
                    <h4 class="font-semibold">Timestamp</h4>
                    <p class="text-sm text-gray-600">${new Date(point.timestamp).toLocaleString()}</p>
                </div>
        `;
        
        if (point.gps) {
            html += `
                <div>
                    <h4 class="font-semibold">GPS Location</h4>
                    <p class="text-sm text-gray-600">
                        Lat: ${point.gps.latitude.toFixed(6)}, 
                        Lon: ${point.gps.longitude.toFixed(6)}<br>
                        Alt: ${point.gps.altitude ? point.gps.altitude.toFixed(1) + 'm' : 'N/A'}, 
                        Accuracy: ${point.gps.accuracy.toFixed(1)}m
                    </p>
                </div>
            `;
        }
        
        if (point.orientation) {
            const deviceRotation = point.orientation.gamma || 0;
            const compassRotation = point.orientation.alpha ? (360 - point.orientation.alpha) % 360 : 0;
            const tilt = Math.abs(point.orientation.beta || 0);
            const deviceColor = tilt > 45 ? '#dc2626' : tilt > 15 ? '#f59e0b' : '#4b5563';
            
            html += `
                <div>
                    <h4 class="font-semibold">Device Orientation</h4>
                    <div class="flex gap-4 items-start">
                        <div class="text-sm text-gray-600 flex-1">
                            Alpha: ${point.orientation.alpha.toFixed(1)}°<br>
                            Beta: ${point.orientation.beta.toFixed(1)}°<br>
                            Gamma: ${point.orientation.gamma.toFixed(1)}°<br>
                            Compass: ${((360 - point.orientation.alpha) % 360).toFixed(1)}°
                        </div>
                        <div class="flex-shrink-0">
                            <svg width="60" height="60" viewBox="0 0 80 80" class="border rounded bg-white">
                                <rect x="30" y="20" width="20" height="40" rx="3" fill="${deviceColor}" stroke="#374151" stroke-width="1" transform="rotate(${deviceRotation} 40 40)"/>
                                <g transform="rotate(${compassRotation} 40 40)">
                                    <line x1="40" y1="40" x2="40" y2="25" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
                                    <circle cx="40" cy="40" r="2" fill="#ef4444"/>
                                </g>
                                <text x="40" y="12" text-anchor="middle" font-size="8" fill="#6b7280">N</text>
                                <text x="68" y="44" text-anchor="middle" font-size="8" fill="#6b7280">E</text>
                                <text x="40" y="72" text-anchor="middle" font-size="8" fill="#6b7280">S</text>
                                <text x="12" y="44" text-anchor="middle" font-size="8" fill="#6b7280">W</text>
                            </svg>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (point.motion) {
            html += `
                <div>
                    <h4 class="font-semibold">Motion Data</h4>
                    <p class="text-sm text-gray-600">
                        Accel X: ${point.motion.accelerationX.toFixed(2)}, 
                        Y: ${point.motion.accelerationY.toFixed(2)}, 
                        Z: ${point.motion.accelerationZ.toFixed(2)}
                    </p>
                </div>
            `;
        }
        
        if (point.weather && point.weather.data) {
            html += `
                <div>
                    <h4 class="font-semibold">Weather</h4>
                    <p class="text-sm text-gray-600">
                        Temperature: ${point.weather.data.temperature}°C<br>
                        Humidity: ${point.weather.data.humidity}%<br>
                        Wind: ${point.weather.data.windSpeed} km/h<br>
                        <span class="text-xs text-gray-500">
                            Status: ${point.weather.message} (${point.weather.locationSource})
                        </span>
                    </p>
                </div>
            `;
        } else if (point.weather) {
            html += `
                <div>
                    <h4 class="font-semibold">Weather</h4>
                    <p class="text-sm text-red-600">
                        ${point.weather.message || 'Weather data unavailable'}
                    </p>
                </div>
            `;
        }
        
        if (point.objectsDetected.length > 0) {
            html += `
                <div>
                    <h4 class="font-semibold">Detected Objects</h4>
                    <p class="text-sm text-gray-600">
                        ${point.objectsDetected.map(obj => `${obj.class} (${(obj.score * 100).toFixed(1)}%)`).join(', ')}
                    </p>
                </div>
            `;
        }
        
        if (point.photoBlob) {
            const imageUrl = URL.createObjectURL(point.photoBlob);
            html += `
                <div>
                    <h4 class="font-semibold">Photo</h4>
                    <img src="${imageUrl}" alt="Captured photo" class="max-w-full h-auto rounded">
                </div>
            `;
        }
        
        if (point.audioBlob) {
            const audioUrl = URL.createObjectURL(point.audioBlob);
            html += `
                <div>
                    <h4 class="font-semibold">Audio</h4>
                    <audio controls class="w-full">
                        <source src="${audioUrl}" type="audio/wav">
                        Your browser does not support audio playback.
                    </audio>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Filter data based on current filter settings
     */
    async filterData() {
        try {
            const allData = await this.getAllData();
            const dateFilter = document.getElementById('dateFilter').value;
            const objectFilter = document.getElementById('objectFilter').value;
            
            let filteredData = allData;
            
            // Filter by date
            if (dateFilter) {
                const filterDate = new Date(dateFilter);
                filteredData = filteredData.filter(point => {
                    const pointDate = new Date(point.timestamp);
                    return pointDate.toDateString() === filterDate.toDateString();
                });
            }
            
            // Filter by object type
            if (objectFilter) {
                filteredData = filteredData.filter(point => {
                    return point.objectsDetected.some(obj => obj.class === objectFilter);
                });
            }
            
            this.displayDataOnMap(filteredData);
            this.displayDataInAccordion(filteredData);
        } catch (error) {
            console.error('Error filtering data:', error);
        }
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        document.getElementById('dateFilter').value = '';
        document.getElementById('objectFilter').value = '';
        this.loadAndDisplayData();
    }

    /**
     * Delete a single data entry
     */
    async deleteDataEntry(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sensorData'], 'readwrite');
            const store = transaction.objectStore('sensorData');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete all data entries
     */
    async deleteAllData() {
        if (confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
            try {
                const transaction = this.db.transaction(['sensorData'], 'readwrite');
                const store = transaction.objectStore('sensorData');
                await store.clear();
                
                this.updateStatus('All data deleted');
                await this.updateRecordCount();
                this.loadAndDisplayData();
            } catch (error) {
                console.error('Error deleting all data:', error);
                this.updateStatus('Delete failed');
            }
        }
    }

    /**
     * Export all data as JSON with modular structure
     */
    async exportData() {
        try {
            this.updateStatus('Exporting data...');
            
            // Get all sensor data
            const sensorData = await this.getAllData();
            
            // Convert blobs to base64 for JSON export
            const exportSensorData = await Promise.all(sensorData.map(async point => {
                const exportPoint = { ...point };
                
                if (point.photoBlob) {
                    exportPoint.photoBase64 = await this.blobToBase64(point.photoBlob);
                    delete exportPoint.photoBlob;
                }
                
                if (point.audioBlob) {
                    exportPoint.audioBase64 = await this.blobToBase64(point.audioBlob);
                    delete exportPoint.audioBlob;
                }
                
                return exportPoint;
            }));
            
            // Create export structure
            const exportData = {
                exportInfo: {
                    exportDate: new Date().toISOString(),
                    appVersion: "Pocket Parrot v1.0",
                    dataStructure: "modular",
                    totalSensorRecords: exportSensorData.length
                },
                sensorData: exportSensorData,
                modules: {
                    permissions: {
                        description: "Device sensor permission management",
                        relatedData: ["sensorData"]
                    },
                    sensorCapture: {
                        description: "GPS, orientation, motion, weather, camera, and audio data capture",
                        relatedData: ["sensorData"]
                    }
                }
            };
            
            const jsonData = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = `pocket-parrot-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            this.updateStatus(`Data exported successfully (${exportSensorData.length} sensor records)`);
        } catch (error) {
            console.error('Error exporting data:', error);
            this.updateStatus('Export failed');
        }
    }

    /**
     * Convert blob to base64
     */
    async blobToBase64(blob) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Register service worker for offline support
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered successfully');
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }
    }

    /**
     * Initialize settings page
     */
    initSettings() {
        // Load current WebSocket configuration
        const savedEndpoint = localStorage.getItem('pocketParrot_wsEndpoint');
        if (savedEndpoint) {
            document.getElementById('wsEndpoint').value = savedEndpoint;
        }
        
        // Load streaming configuration
        this.loadStreamingConfig();
        this.updateDataUsageEstimate();
        
        // Update API status
        this.refreshAPIStatus();
        
        // Update button states
        this.updateWebSocketButtonStates();
    }

    /**
     * Save WebSocket configuration
     */
    saveWebSocketConfig() {
        const endpoint = document.getElementById('wsEndpoint').value.trim();
        
        if (!endpoint) {
            alert('Please enter a WebSocket endpoint');
            return;
        }
        
        if (!endpoint.startsWith('ws://') && !endpoint.startsWith('wss://')) {
            alert('WebSocket endpoint must start with ws:// or wss://');
            return;
        }
        
        try {
            if (window.pocketParrotAPI) {
                window.pocketParrotAPI.configureWebSocket(endpoint);
                this.updateStatus('WebSocket configuration saved');
                
                // Show status
                document.getElementById('wsStatus').classList.remove('hidden');
                document.getElementById('wsStatusText').textContent = `Configured: ${endpoint}`;
            }
        } catch (error) {
            console.error('Error saving WebSocket config:', error);
            alert('Failed to save configuration: ' + error.message);
        }
    }

    /**
     * Enable WebSocket
     */
    async enableWebSocket() {
        try {
            if (window.pocketParrotAPI) {
                await window.pocketParrotAPI.enableWebSocket();
                this.updateStatus('WebSocket enabled');
                this.updateWebSocketButtonStates();
                this.refreshAPIStatus();
                
                // Update status display
                document.getElementById('wsStatus').classList.remove('hidden');
                document.getElementById('wsStatusText').textContent = 'Connecting...';
                
                // Check connection after a delay
                setTimeout(() => {
                    const status = window.pocketParrotAPI.getStatus();
                    if (status.wsConnections > 0) {
                        document.getElementById('wsStatusText').textContent = `✅ Connected (${status.wsConnections} connection${status.wsConnections > 1 ? 's' : ''})`;
                        document.getElementById('wsStatusText').className = 'text-green-400';
                    } else {
                        document.getElementById('wsStatusText').textContent = '⚠️ Connection failed - check endpoint and try again';
                        document.getElementById('wsStatusText').className = 'text-yellow-400';
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('Error enabling WebSocket:', error);
            alert('Failed to enable WebSocket: ' + error.message);
        }
    }

    /**
     * Disable WebSocket
     */
    disableWebSocket() {
        try {
            if (window.pocketParrotAPI) {
                window.pocketParrotAPI.disableWebSocket();
                this.updateStatus('WebSocket disabled');
                this.updateWebSocketButtonStates();
                this.refreshAPIStatus();
                
                // Update status display
                document.getElementById('wsStatus').classList.remove('hidden');
                document.getElementById('wsStatusText').textContent = 'Disabled';
                document.getElementById('wsStatusText').className = 'text-gray-400';
            }
        } catch (error) {
            console.error('Error disabling WebSocket:', error);
            alert('Failed to disable WebSocket: ' + error.message);
        }
    }

    /**
     * Test WebSocket connection
     */
    async testWebSocketConnection() {
        const endpoint = document.getElementById('wsEndpoint').value.trim();
        
        if (!endpoint) {
            alert('Please enter a WebSocket endpoint');
            return;
        }
        
        this.updateStatus('Testing WebSocket connection...');
        document.getElementById('wsStatus').classList.remove('hidden');
        document.getElementById('wsStatusText').textContent = 'Testing connection...';
        document.getElementById('wsStatusText').className = 'text-yellow-400';
        
        try {
            const ws = new WebSocket(endpoint);
            
            const timeout = setTimeout(() => {
                ws.close();
                document.getElementById('wsStatusText').textContent = '❌ Connection timeout';
                document.getElementById('wsStatusText').className = 'text-red-400';
                this.updateStatus('Connection test failed: timeout');
            }, 5000);
            
            ws.onopen = () => {
                clearTimeout(timeout);
                document.getElementById('wsStatusText').textContent = '✅ Connection successful!';
                document.getElementById('wsStatusText').className = 'text-green-400';
                this.updateStatus('Connection test successful');
                ws.close();
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                document.getElementById('wsStatusText').textContent = '❌ Connection failed';
                document.getElementById('wsStatusText').className = 'text-red-400';
                this.updateStatus('Connection test failed');
                console.error('WebSocket test error:', error);
            };
        } catch (error) {
            document.getElementById('wsStatusText').textContent = '❌ Invalid endpoint';
            document.getElementById('wsStatusText').className = 'text-red-400';
            this.updateStatus('Invalid WebSocket endpoint');
            console.error('WebSocket test error:', error);
        }
    }

    /**
     * Refresh API status display
     */
    async refreshAPIStatus() {
        if (window.pocketParrotAPI) {
            const status = window.pocketParrotAPI.getStatus();
            const recordCount = await window.pocketParrotAPI.getRecordCount();
            
            document.getElementById('apiSubscribers').textContent = status.subscribers;
            document.getElementById('apiWsStatus').textContent = status.wsEnabled ? 'Enabled' : 'Disabled';
            document.getElementById('apiWsStatus').className = status.wsEnabled ? 'text-2xl font-bold text-green-400' : 'text-2xl font-bold text-gray-400';
            document.getElementById('apiRecordCount').textContent = recordCount;
            document.getElementById('apiWsConnections').textContent = status.wsConnections;
        }
    }

    /**
     * Update WebSocket button states
     */
    updateWebSocketButtonStates() {
        if (window.pocketParrotAPI) {
            const status = window.pocketParrotAPI.getStatus();
            
            if (status.wsEnabled) {
                document.getElementById('enableWsBtn').classList.add('hidden');
                document.getElementById('disableWsBtn').classList.remove('hidden');
            } else {
                document.getElementById('enableWsBtn').classList.remove('hidden');
                document.getElementById('disableWsBtn').classList.add('hidden');
            }
        }
    }

    /**
     * Save streaming configuration
     */
    saveStreamingConfig() {
        try {
            const captureInterval = parseInt(document.getElementById('captureInterval').value);
            const dataMode = document.getElementById('dataMode').value;
            const includeWeather = document.getElementById('includeWeather').checked;
            const includeMedia = document.getElementById('includeMedia').checked;
            const highAccuracyGPS = document.getElementById('highAccuracyGPS').checked;
            
            const config = {
                captureInterval,
                dataMode,
                includeWeather,
                includeMedia,
                highAccuracyGPS
            };
            
            // Save to localStorage
            localStorage.setItem('pocketParrot_streamingConfig', JSON.stringify(config));
            
            // Apply configuration
            this.captureIntervalMs = captureInterval;
            
            this.updateStatus('Streaming configuration saved');
            console.log('📊 Streaming configuration saved:', config);
            
        } catch (error) {
            console.error('Error saving streaming config:', error);
            this.updateStatus('Failed to save streaming configuration');
        }
    }

    /**
     * Load streaming configuration
     */
    loadStreamingConfig() {
        try {
            // Check if URL parameters were used (they take precedence)
            const urlParams = new URLSearchParams(window.location.search);
            const hasUrlConfig = urlParams.has('interval') || urlParams.has('captureInterval') || 
                                urlParams.has('dataMode') || urlParams.has('mode');
            
            const saved = localStorage.getItem('pocketParrot_streamingConfig');
            if (saved) {
                const config = JSON.parse(saved);
                
                // Apply to UI
                document.getElementById('captureInterval').value = config.captureInterval || 5000;
                document.getElementById('dataMode').value = config.dataMode || 'gps';
                document.getElementById('includeWeather').checked = config.includeWeather !== false;
                document.getElementById('includeMedia').checked = config.includeMedia || false;
                document.getElementById('highAccuracyGPS').checked = config.highAccuracyGPS !== false;
                
                // Only apply to app if no URL config was used
                if (!hasUrlConfig) {
                    this.captureIntervalMs = config.captureInterval || 5000;
                }
                
                console.log('📊 Streaming configuration loaded:', config);
                console.log(`📊 Current capture interval: ${this.captureIntervalMs}ms`);
            }
        } catch (error) {
            console.error('Error loading streaming config:', error);
        }
    }

    /**
     * Reset streaming configuration to defaults
     */
    resetStreamingConfig() {
        document.getElementById('captureInterval').value = 5000;
        document.getElementById('dataMode').value = 'gps';
        document.getElementById('includeWeather').checked = true;
        document.getElementById('includeMedia').checked = false;
        document.getElementById('highAccuracyGPS').checked = true;
        
        this.captureIntervalMs = 5000;
        
        // Remove saved config
        localStorage.removeItem('pocketParrot_streamingConfig');
        
        this.updateDataUsageEstimate();
        this.updateStatus('Streaming configuration reset to defaults');
    }

    /**
     * Update data usage estimate
     */
    updateDataUsageEstimate() {
        const interval = parseInt(document.getElementById('captureInterval').value);
        const dataMode = document.getElementById('dataMode').value;
        const includeWeather = document.getElementById('includeWeather').checked;
        const includeMedia = document.getElementById('includeMedia').checked;
        
        // Base data sizes (in bytes per sample)
        const baseSizes = {
            gps: 200,        // GPS coordinates + timestamp
            sensors: 400,    // GPS + orientation + motion
            full: 600        // GPS + sensors + weather
        };
        
        let baseSize = baseSizes[dataMode] || baseSizes.gps;
        if (includeWeather && dataMode !== 'full') baseSize += 200;
        
        // Calculate samples per hour
        const samplesPerHour = 3600000 / interval; // 3600000ms = 1 hour
        const bytesPerHour = samplesPerHour * baseSize;
        const kbPerHour = Math.round(bytesPerHour / 1024);
        
        const estimateEl = document.getElementById('dataUsageEstimate');
        if (estimateEl) {
            let html = `<div>Current config: ~${kbPerHour}KB/hour (${samplesPerHour} samples)</div>`;
            
            if (includeMedia) {
                html += `<div class="text-yellow-400">+ Media: 500KB-2MB per capture</div>`;
            }
            
            // Add comparison
            if (interval <= 2000) {
                html += `<div class="text-red-400">⚠️ High frequency - may drain battery quickly</div>`;
            } else if (interval >= 30000) {
                html += `<div class="text-green-400">✓ Low frequency - battery friendly</div>`;
            }
            
            estimateEl.innerHTML = html;
        }
    }
}

// Global app instance
let app;
let dataAPI;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    app = new PocketParrot();
    // Make app globally available for onclick handlers
    window.app = app;
    
    // Initialize Data Access API after app is ready
    if (typeof PocketParrotDataAPI !== 'undefined') {
        dataAPI = new PocketParrotDataAPI(app);
        dataAPI.loadConfiguration();
        window.pocketParrotAPI = dataAPI;
        console.log('📡 Data Access API initialized and available globally as window.pocketParrotAPI');
        
        // Apply configuration from config.js or URL parameters
        await applyConfiguration();
    }
});

/**
 * Apply configuration from config.js file and URL parameters
 * URL parameters override config file settings
 */
async function applyConfiguration() {
    const config = typeof PocketParrotConfig !== 'undefined' ? PocketParrotConfig : {};
    const urlParams = new URLSearchParams(window.location.search);
    
    // Get WebSocket endpoint from URL parameter or config file
    const wsEndpoint = urlParams.get('wsEndpoint') || urlParams.get('ws') || config.WEBSOCKET_ENDPOINT;
    
    // Get auto-enable setting from URL parameter or config file
    const autoEnable = urlParams.has('autoEnable') 
        ? urlParams.get('autoEnable') !== 'false'
        : config.AUTO_ENABLE_WEBSOCKET;
    
    // Get event mode setting
    const eventMode = urlParams.has('eventMode')
        ? urlParams.get('eventMode') !== 'false'
        : config.EVENT_MODE;
    
    // Get auto-start capture setting
    const autoStartCapture = urlParams.has('autoStart')
        ? urlParams.get('autoStart') !== 'false'
        : config.AUTO_START_CAPTURE;
    
    // Get streaming configuration from URL parameters
    const captureInterval = urlParams.get('interval') || urlParams.get('captureInterval') || config.CAPTURE_INTERVAL || 5000;
    const dataMode = urlParams.get('dataMode') || urlParams.get('mode') || 'gps';
    const includeWeather = urlParams.has('weather') ? urlParams.get('weather') !== 'false' : true;
    const includeMedia = urlParams.has('media') ? urlParams.get('media') === 'true' : false;
    const highAccuracyGPS = urlParams.has('highGPS') ? urlParams.get('highGPS') !== 'false' : true;
    
    // Get event name
    const eventName = urlParams.get('eventName') || urlParams.get('event') || config.EVENT_NAME;
    
    console.log('📋 Configuration applied:', {
        wsEndpoint,
        autoEnable,
        eventMode,
        autoStartCapture,
        streamingConfig: {
            captureInterval: parseInt(captureInterval),
            dataMode,
            includeWeather,
            includeMedia,
            highAccuracyGPS
        },
        eventName
    });
    
    // ALWAYS apply streaming configuration if ANY parameters are provided (URL or config file)
    const hasStreamingConfig = urlParams.has('interval') || urlParams.has('captureInterval') || 
                              urlParams.has('dataMode') || urlParams.has('mode') || 
                              config.CAPTURE_INTERVAL || config.EVENT_MODE;
    
    if (hasStreamingConfig) {
        const streamingConfig = {
            captureInterval: parseInt(captureInterval),
            dataMode,
            includeWeather,
            includeMedia,
            highAccuracyGPS
        };
        
        // Save to localStorage to persist the configuration
        localStorage.setItem('pocketParrot_streamingConfig', JSON.stringify(streamingConfig));
        
        // Apply to app instance IMMEDIATELY
        if (app) {
            app.captureIntervalMs = parseInt(captureInterval);
            console.log(`📊 Capture interval set to: ${app.captureIntervalMs}ms`);
        }
        
        // Also update UI if settings page is loaded
        const intervalInput = document.getElementById('captureInterval');
        if (intervalInput) {
            intervalInput.value = captureInterval;
            app.updateDataUsageEstimate();
        }
    }
    
    // Apply event mode styling
    if (eventMode) {
        applyEventMode(eventName);
    }
    
    // Configure WebSocket if endpoint is provided
    if (wsEndpoint && dataAPI) {
        console.log(`🔌 Auto-configuring WebSocket: ${wsEndpoint}`);
        dataAPI.configureWebSocket(wsEndpoint, {
            autoReconnect: true,
            reconnectDelay: 5000
        });
        
        // Pre-fill the Settings page input if it exists
        const wsInput = document.getElementById('wsEndpoint');
        if (wsInput) {
            wsInput.value = wsEndpoint;
        }
        
        // Auto-enable WebSocket if configured
        if (autoEnable) {
            try {
                await dataAPI.enableWebSocket();
                console.log('✅ WebSocket auto-enabled');
                
                // Update UI
                if (app && app.updateWebSocketButtonStates) {
                    app.updateWebSocketButtonStates();
                }
                
                // Show connection status to user
                app.updateStatus('Connected to event server');
            } catch (error) {
                console.error('❌ Failed to auto-enable WebSocket:', error);
                app.updateStatus('Failed to connect to server');
            }
        }
    }
    
    // Show welcome message if configured
    if (config.SHOW_WELCOME_MESSAGE && (eventName || config.WELCOME_MESSAGE)) {
        showWelcomeMessage(config.WELCOME_MESSAGE, eventName);
    }
    
    // Auto-start capture if configured
    if (autoStartCapture) {
        console.log('🚀 Auto-start capture enabled');
        // Set flag for auto-start after permissions
        window.autoStartCaptureEnabled = true;
        
        // If in event mode, auto-start streaming immediately
        if (eventMode) {
            setTimeout(async () => {
                try {
                    await app.startLiveStream();
                } catch (error) {
                    console.error('Failed to auto-start streaming:', error);
                }
            }, 2000); // Delay to ensure app is ready
        }
    }
}

/**
 * Apply event mode styling and hide Settings button
 */
function applyEventMode(eventName) {
    console.log('🎉 Event mode enabled');
    
    // Hide Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.style.display = 'none';
    }
    
    // Update page title if event name is provided
    if (eventName) {
        document.title = `${eventName} - Pocket Parrot`;
        const titleElement = document.querySelector('h1');
        if (titleElement) {
            titleElement.textContent = `🦜 ${eventName}`;
        }
    }
    
    // Simplify UI for event experience
    const statusDisplay = document.getElementById('statusDisplay');
    if (statusDisplay) {
        statusDisplay.classList.add('bg-green-900', 'border-green-800');
    }
}

/**
 * Show welcome message to event participants
 */
function showWelcomeMessage(message, eventName) {
    const welcomeDiv = document.createElement('div');
    welcomeDiv.id = 'welcomeMessage';
    welcomeDiv.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    welcomeDiv.innerHTML = `
        <div class="bg-gray-800 p-8 rounded-lg border-2 border-green-600 max-w-md text-center">
            <h2 class="text-3xl font-bold mb-4 text-green-400">🦜 Welcome!</h2>
            ${eventName ? `<h3 class="text-xl mb-4 text-gray-200">${eventName}</h3>` : ''}
            <p class="text-gray-300 mb-6">${message}</p>
            <button onclick="document.getElementById('welcomeMessage').remove()" 
                    class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-lg">
                Let's Go! 🚀
            </button>
        </div>
    `;
    document.body.appendChild(welcomeDiv);
}

// Add this to test configuration loading
window.debugConfig = function() {
    const urlParams = new URLSearchParams(window.location.search);
    console.log('🔍 Debug Configuration:');
    console.log('URL interval param:', urlParams.get('interval') || urlParams.get('captureInterval'));
    console.log('App captureIntervalMs:', app.captureIntervalMs);
    console.log('localStorage config:', localStorage.getItem('pocketParrot_streamingConfig'));
    console.log('Settings UI value:', document.getElementById('captureInterval')?.value);
};