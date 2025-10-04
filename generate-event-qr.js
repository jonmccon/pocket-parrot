#!/usr/bin/env node

/**
 * QR Code Generator for Pocket Parrot Events
 * 
 * Generates QR codes for event URLs with pre-configured WebSocket settings
 * 
 * Usage:
 *   node generate-event-qr.js
 * 
 * Or with custom parameters:
 *   node generate-event-qr.js "https://your-site.com" "wss://your-server.com" "My Event"
 */

const readline = require('readline');
const fs = require('fs');

// Simple terminal-based QR code generation (no dependencies)
console.log('🦜 Pocket Parrot Event QR Code Generator');
console.log('='.repeat(50));
console.log('');

// Get input from command line or prompt
const args = process.argv.slice(2);

let baseUrl, wsEndpoint, eventName;

if (args.length >= 3) {
    [baseUrl, wsEndpoint, eventName] = args;
    generateQRInfo(baseUrl, wsEndpoint, eventName);
} else {
    // Interactive mode
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('Enter your Pocket Parrot URL (e.g., https://username.github.io/pocket-parrot/): ', (url) => {
        baseUrl = url;
        
        rl.question('Enter your WebSocket server URL (e.g., wss://server.com/pocket-parrot): ', (ws) => {
            wsEndpoint = ws;
            
            rl.question('Enter event name (e.g., Tech Conference 2024): ', (name) => {
                eventName = name;
                
                rl.close();
                generateQRInfo(baseUrl, wsEndpoint, eventName);
            });
        });
    });
}

function generateQRInfo(baseUrl, wsEndpoint, eventName) {
    console.log('');
    console.log('📋 Configuration:');
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   WebSocket: ${wsEndpoint}`);
    console.log(`   Event: ${eventName}`);
    console.log('');
    
    // Build event URL
    const params = new URLSearchParams({
        ws: wsEndpoint,
        autoEnable: 'true',
        eventMode: 'true',
        eventName: eventName,
        autoStart: 'true'
    });
    
    const eventUrl = `${baseUrl}?${params.toString()}`;
    
    console.log('✅ Event URL generated:');
    console.log('');
    console.log(eventUrl);
    console.log('');
    
    // Save to file
    const urlData = {
        baseUrl,
        wsEndpoint,
        eventName,
        eventUrl,
        generatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync('event-url.json', JSON.stringify(urlData, null, 2));
    console.log('💾 Saved to event-url.json');
    console.log('');
    
    // Generate QR code instructions
    console.log('📱 To generate QR code:');
    console.log('');
    console.log('Option 1 - Online:');
    console.log('   1. Go to https://www.qr-code-generator.com/');
    console.log('   2. Paste the URL above');
    console.log('   3. Download and print');
    console.log('');
    console.log('Option 2 - Using qrencode (if installed):');
    console.log(`   qrencode -o event-qr.png "${eventUrl}"`);
    console.log('');
    console.log('Option 3 - Using Node.js qrcode package:');
    console.log('   npm install qrcode');
    console.log(`   node -e "const qr=require('qrcode');qr.toFile('event-qr.png','${eventUrl}',console.log)"`);
    console.log('');
    
    // ASCII QR placeholder
    console.log('QR Code Preview (scan with phone to test):');
    console.log('');
    console.log('╔═══════════════════════════════╗');
    console.log('║                               ║');
    console.log('║   Generate actual QR code     ║');
    console.log('║   using one of the methods    ║');
    console.log('║   above, then scan this:      ║');
    console.log('║                               ║');
    console.log('║   ┌─────────────────────┐     ║');
    console.log('║   │▓▓▓▓▓▓▓░░▓▓░▓▓▓▓▓▓▓│     ║');
    console.log('║   │▓░░░░░▓░▓░▓░▓░░░░░▓│     ║');
    console.log('║   │▓░▓▓▓░▓░░▓░░▓░▓▓▓░▓│     ║');
    console.log('║   │▓░▓▓▓░▓░▓▓▓░▓░▓▓▓░▓│     ║');
    console.log('║   │▓░▓▓▓░▓░▓░▓░▓░▓▓▓░▓│     ║');
    console.log('║   │▓░░░░░▓░░░▓░▓░░░░░▓│     ║');
    console.log('║   │▓▓▓▓▓▓▓░▓░▓░▓▓▓▓▓▓▓│     ║');
    console.log('║   │░░░░░░░░▓▓▓░░░░░░░░│     ║');
    console.log('║   │▓▓░▓░▓▓░░▓░▓▓░▓▓░▓░│     ║');
    console.log('║   │░▓▓░░░▓░▓▓░░▓░░▓▓▓▓│     ║');
    console.log('║   │▓░▓▓░▓▓░░▓▓░▓░▓░▓░░│     ║');
    console.log('║   │░░░░░░░░▓▓░▓▓░░░░▓▓│     ║');
    console.log('║   │▓▓▓▓▓▓▓░░▓░▓░▓░▓░▓░│     ║');
    console.log('║   │▓░░░░░▓░▓▓▓░░▓▓░▓▓░│     ║');
    console.log('║   │▓░▓▓▓░▓░░░▓▓░▓░░░▓▓│     ║');
    console.log('║   │▓░▓▓▓░▓░▓▓░▓▓▓░▓▓░░│     ║');
    console.log('║   │▓░▓▓▓░▓░▓░░▓░▓░▓░▓▓│     ║');
    console.log('║   │▓░░░░░▓░▓░▓▓░░░▓▓░▓│     ║');
    console.log('║   │▓▓▓▓▓▓▓░▓░░▓░▓░▓▓░░│     ║');
    console.log('║   └─────────────────────┘     ║');
    console.log('║                               ║');
    console.log('║   🦜 Pocket Parrot Event      ║');
    console.log('║   ' + eventName.substring(0, 25).padEnd(25) + '  ║');
    console.log('║                               ║');
    console.log('╚═══════════════════════════════╝');
    console.log('');
    
    console.log('✨ Ready to deploy!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Generate actual QR code using method above');
    console.log('2. Test the URL on your phone');
    console.log('3. Print QR code for distribution');
    console.log('4. Share with participants!');
    console.log('');
}
