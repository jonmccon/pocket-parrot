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
        this.objectDetectionModel = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.map = null;
        this.markers = [];
        
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
            const request = indexedDB.open('PocketParrotDB', 1);
            
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
        
        // Capture controls
        document.getElementById('startCaptureBtn').addEventListener('click', () => this.startContinuousCapture());
        document.getElementById('stopCaptureBtn').addEventListener('click', () => this.stopContinuousCapture());
        document.getElementById('captureNowBtn').addEventListener('click', () => this.captureDataPoint());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        
        // Camera controls
        document.getElementById('startCameraBtn').addEventListener('click', () => this.startCamera());
        document.getElementById('takePhotoBtn').addEventListener('click', () => this.takePhoto());
        document.getElementById('stopCameraBtn').addEventListener('click', () => this.stopCamera());
        
        // Audio controls
        document.getElementById('startRecordingBtn').addEventListener('click', () => this.startRecording());
        document.getElementById('stopRecordingBtn').addEventListener('click', () => this.stopRecording());
        
        // Viewer controls
        document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearFilters());
        document.getElementById('closeModalBtn').addEventListener('click', () => this.closeModal());
        
        // Filter changes
        document.getElementById('dateFilter').addEventListener('change', () => this.filterData());
        document.getElementById('objectFilter').addEventListener('change', () => this.filterData());
        
        // Device orientation and motion
        if (typeof DeviceOrientationEvent !== 'undefined') {
            window.addEventListener('deviceorientation', (event) => this.updateOrientationData(event));
        }
        
        if (typeof DeviceMotionEvent !== 'undefined') {
            window.addEventListener('devicemotion', (event) => this.updateMotionData(event));
        }
        
        // Permission request button
        document.getElementById('requestPermissionsBtn').addEventListener('click', () => this.requestPermissions());
    }

    /**
     * Request permissions for iOS devices
     */
    async requestPermissions() {
        this.updateStatus('Requesting sensor permissions...');
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
        }
    }

    /**
     * Start continuous data capture
     */
    async startContinuousCapture() {
        if (this.isCapturing) return;
        
        this.isCapturing = true;
        this.updateStatus('Capturing...');
        
        // Update UI
        document.getElementById('startCaptureBtn').classList.add('hidden');
        document.getElementById('stopCaptureBtn').classList.remove('hidden');
        
        // Start location watching
        this.startLocationWatch();
        
        // Capture data every 5 seconds
        this.captureInterval = setInterval(() => {
            this.captureDataPoint();
        }, 5000);
        
        // Initial capture
        await this.captureDataPoint();
    }

    /**
     * Stop continuous data capture
     */
    stopContinuousCapture() {
        if (!this.isCapturing) return;
        
        this.isCapturing = false;
        this.updateStatus('Ready');
        
        // Update UI
        document.getElementById('startCaptureBtn').classList.remove('hidden');
        document.getElementById('stopCaptureBtn').classList.add('hidden');
        
        // Clear interval
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
        
        // Stop location watching
        this.stopLocationWatch();
    }

    /**
     * Start watching location
     */
    startLocationWatch() {
        if (navigator.geolocation) {
            this.locationWatchId = navigator.geolocation.watchPosition(
                (position) => this.updateLocationData(position),
                (error) => console.error('Location error:', error),
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 1000
                }
            );
        }
    }

    /**
     * Stop watching location
     */
    stopLocationWatch() {
        if (this.locationWatchId) {
            navigator.geolocation.clearWatch(this.locationWatchId);
            this.locationWatchId = null;
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
     * Update orientation data display
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
     * Fetch weather data for current location
     */
    async fetchWeatherData(lat, lon) {
        try {
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover`
            );
            
            if (!response.ok) {
                throw new Error('Weather API request failed');
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
            
            // Update UI
            document.getElementById('temperature').textContent = weatherData.temperature;
            document.getElementById('humidity').textContent = weatherData.humidity;
            document.getElementById('windSpeed').textContent = weatherData.windSpeed;
            document.getElementById('conditions').textContent = this.getWeatherDescription(weatherData.weatherCode);
            
            return weatherData;
        } catch (error) {
            console.error('Error fetching weather data:', error);
            return null;
        }
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
                video: { facingMode: 'environment' }
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
                
                // Extract color palette from the image
                const colorPalette = this.extractColorPalette(canvas);
                
                // Display enhanced results
                this.displayEnhancedDetectionResults(detectedObjects, colorPalette);
                this.updateStatus('Ready');
            } catch (error) {
                console.error('Object detection error:', error);
                this.displayDetectionError();
            }
        }
        
        // Convert canvas to blob
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                resolve({ blob, detectedObjects });
            }, 'image/jpeg', 0.8);
        });
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
        
        // Sort by frequency and get top 3
        const sortedColors = Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
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
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/wav' });
                const audio = document.getElementById('audioPlayback');
                audio.src = URL.createObjectURL(blob);
                audio.classList.remove('hidden');
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            
            // Update UI
            document.getElementById('startRecordingBtn').classList.add('hidden');
            document.getElementById('stopRecordingBtn').classList.remove('hidden');
            document.getElementById('recordingStatus').textContent = 'Recording...';
            
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Could not access microphone. Please check permissions.');
        }
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
     * Capture a complete data point
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
            
            // Get current location
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
                
                // Fetch weather data
                dataPoint.weather = await this.fetchWeatherData(coords.latitude, coords.longitude);
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
            
            // Get photo and object detection if camera is active
            const video = document.getElementById('cameraPreview');
            if (!video.classList.contains('hidden') && video.srcObject) {
                const photoData = await this.takePhoto();
                dataPoint.photoBlob = photoData.blob;
                dataPoint.objectsDetected = photoData.detectedObjects;
            }
            
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
        // Initialize map if not already done
        if (!this.map) {
            this.map = L.map('mapContainer').setView([0, 0], 2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
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
            this.displayDataInTable(allData);
            this.populateObjectFilter(allData);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    /**
     * Get all data from IndexedDB
     */
    async getAllData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sensorData'], 'readonly');
            const store = transaction.objectStore('sensorData');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Display data points on map
     */
    displayDataOnMap(data) {
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
            <strong>Weather:</strong> ${point.weather ? point.weather.temperature + '°C' : 'N/A'}<br>
            <button onclick="app.showDataDetails(${point.id})" class="bg-blue-500 text-white px-2 py-1 rounded text-sm mt-2">
                View Details
            </button>
        `;
    }

    /**
     * Display data in table
     */
    displayDataInTable(data) {
        const tbody = document.getElementById('dataTableBody');
        tbody.innerHTML = '';
        
        data.forEach(point => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            
            const timestamp = new Date(point.timestamp).toLocaleString();
            const location = point.gps 
                ? `${point.gps.latitude.toFixed(4)}, ${point.gps.longitude.toFixed(4)}`
                : 'N/A';
            const weather = point.weather 
                ? `${point.weather.temperature}°C, ${point.weather.humidity}%`
                : 'N/A';
            const objects = point.objectsDetected.length > 0
                ? point.objectsDetected.map(obj => obj.class).join(', ')
                : 'None';
            const media = [];
            if (point.photoBlob) media.push('📷');
            if (point.audioBlob) media.push('🎤');
            
            row.innerHTML = `
                <td class="px-4 py-2 border text-sm">${timestamp}</td>
                <td class="px-4 py-2 border text-sm">${location}</td>
                <td class="px-4 py-2 border text-sm">${weather}</td>
                <td class="px-4 py-2 border text-sm">${objects}</td>
                <td class="px-4 py-2 border text-sm">${media.join(' ')}</td>
                <td class="px-4 py-2 border text-sm">
                    <button onclick="app.showDataDetails(${point.id})" class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs">
                        View
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
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
        
        if (point.weather) {
            html += `
                <div>
                    <h4 class="font-semibold">Weather</h4>
                    <p class="text-sm text-gray-600">
                        Temperature: ${point.weather.temperature}°C<br>
                        Humidity: ${point.weather.humidity}%<br>
                        Wind: ${point.weather.windSpeed} km/h
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
     * Close modal
     */
    closeModal() {
        document.getElementById('dataModal').classList.add('hidden');
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
            this.displayDataInTable(filteredData);
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
     * Export all data as JSON
     */
    async exportData() {
        try {
            this.updateStatus('Exporting data...');
            const allData = await this.getAllData();
            
            // Convert blobs to base64 for JSON export
            const exportData = await Promise.all(allData.map(async point => {
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
            this.updateStatus('Data exported successfully');
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
}

// Global app instance
let app;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new PocketParrot();
    // Make app globally available for onclick handlers
    window.app = app;
});