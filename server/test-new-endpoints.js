#!/usr/bin/env node

/**
 * Test script for new orientation and bulk data endpoints
 * 
 * This script:
 * 1. Connects to the main /pocket-parrot endpoint as a data sender
 * 2. Sends simulated sensor data with orientation and GPS
 * 3. Verifies data is properly separated to orientation and bulk endpoints
 */

const WebSocket = require('ws');

// Configuration
const SERVER_URL = 'ws://localhost:8080';
const SEND_INTERVAL = 100; // Send data every 100ms (10 Hz)
const TEST_DURATION = 10000; // Run test for 10 seconds

// Simulated sensor data
let dataPointCount = 0;
let alpha = 0;
let beta = 0;
let gamma = 0;

console.log('🧪 Testing New Endpoints');
console.log('='.repeat(60));
console.log(`Server: ${SERVER_URL}`);
console.log(`Send interval: ${SEND_INTERVAL}ms`);
console.log(`Test duration: ${TEST_DURATION}ms`);
console.log('');

// Connect to orientation endpoint to monitor
const orientationListener = new WebSocket(`${SERVER_URL}/orientation`);
let orientationMsgCount = 0;

orientationListener.on('open', () => {
    console.log('🧭 Connected to /orientation endpoint (listener)');
});

orientationListener.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.type === 'orientation_data') {
        orientationMsgCount++;
        console.log(`   🧭 Orientation message #${orientationMsgCount}: α=${message.orientation.alpha.toFixed(1)}°`);
    }
});

orientationListener.on('error', (error) => {
    console.error('❌ Orientation listener error:', error.message);
});

// Connect to bulk endpoint to monitor
const bulkListener = new WebSocket(`${SERVER_URL}/bulk`);
let bulkBatchCount = 0;
let bulkItemCount = 0;

bulkListener.on('open', () => {
    console.log('📦 Connected to /bulk endpoint (listener)');
    console.log('');
});

bulkListener.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.type === 'bulk_data_batch') {
        bulkBatchCount++;
        bulkItemCount += message.batchSize;
        console.log(`   📦 Bulk batch #${bulkBatchCount}: ${message.batchSize} items (total: ${bulkItemCount})`);
        
        // Show details of first item
        if (message.data.length > 0) {
            const item = message.data[0];
            const hasGps = item.gps ? `GPS(${item.gps.latitude.toFixed(2)}, ${item.gps.longitude.toFixed(2)})` : '';
            const hasWeather = item.weather ? `Weather(${item.weather.temperature}°C)` : '';
            console.log(`      First item: ${hasGps} ${hasWeather}`);
        }
    }
});

bulkListener.on('error', (error) => {
    console.error('❌ Bulk listener error:', error.message);
});

// Wait a bit for listeners to connect, then connect as data sender
setTimeout(() => {
    console.log('📤 Connecting as data sender...');
    console.log('');
    
    const sender = new WebSocket(`${SERVER_URL}/pocket-parrot`);
    
    sender.on('open', () => {
        console.log('✅ Connected to /pocket-parrot endpoint (sender)');
        
        // Send handshake
        sender.send(JSON.stringify({
            type: 'handshake',
            client: 'test-script',
            version: '1.0',
            timestamp: new Date().toISOString(),
            deviceId: 'test-device-001',
            username: 'Test Sender'
        }));
    });
    
    sender.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'promoted') {
            console.log('👑 Promoted to active sender - starting data transmission');
            console.log('');
            
            // Start sending data
            const sendInterval = setInterval(() => {
                // Update simulated values
                alpha = (alpha + 5) % 360;
                beta = Math.sin(Date.now() / 1000) * 45;
                gamma = Math.cos(Date.now() / 1000) * 45;
                
                dataPointCount++;
                
                const dataPoint = {
                    type: 'data',
                    data: {
                        id: dataPointCount,
                        timestamp: new Date().toISOString(),
                        gps: {
                            latitude: 47.6062 + (Math.random() - 0.5) * 0.01,
                            longitude: -122.3321 + (Math.random() - 0.5) * 0.01,
                            altitude: 50 + Math.random() * 10,
                            accuracy: 10,
                            speed: null,
                            heading: null
                        },
                        orientation: {
                            alpha: alpha,
                            beta: beta,
                            gamma: gamma,
                            compass: alpha
                        },
                        motion: {
                            accelerationX: (Math.random() - 0.5) * 2,
                            accelerationY: (Math.random() - 0.5) * 2,
                            accelerationZ: (Math.random() - 0.5) * 2
                        },
                        weather: {
                            temperature: 20 + Math.random() * 5,
                            humidity: 60 + Math.random() * 20,
                            windSpeed: 5 + Math.random() * 10,
                            windDirection: Math.random() * 360,
                            precipitation: 0,
                            cloudCover: 50
                        },
                        objectsDetected: []
                    }
                };
                
                sender.send(JSON.stringify(dataPoint));
                
                if (dataPointCount % 10 === 0) {
                    console.log(`📤 Sent ${dataPointCount} data points`);
                }
            }, SEND_INTERVAL);
            
            // Stop after test duration
            setTimeout(() => {
                clearInterval(sendInterval);
                console.log('');
                console.log('⏰ Test duration reached - stopping');
                console.log('');
                console.log('📊 Test Results:');
                console.log('='.repeat(60));
                console.log(`Data points sent: ${dataPointCount}`);
                console.log(`Orientation messages received: ${orientationMsgCount}`);
                console.log(`Bulk batches received: ${bulkBatchCount}`);
                console.log(`Bulk items received: ${bulkItemCount}`);
                console.log('');
                
                // Verify results
                const orientationSuccess = orientationMsgCount >= dataPointCount * 0.9; // Allow 10% loss
                const bulkSuccess = bulkItemCount >= dataPointCount * 0.9; // Allow 10% loss
                
                console.log('✅ Orientation endpoint:', orientationSuccess ? 'PASS' : 'FAIL');
                console.log('✅ Bulk endpoint:', bulkSuccess ? 'PASS' : 'FAIL');
                console.log('');
                
                // Clean up
                sender.close();
                orientationListener.close();
                bulkListener.close();
                
                setTimeout(() => {
                    process.exit(orientationSuccess && bulkSuccess ? 0 : 1);
                }, 1000);
            }, TEST_DURATION);
        }
    });
    
    sender.on('error', (error) => {
        console.error('❌ Sender error:', error.message);
        process.exit(1);
    });
}, 1000);
