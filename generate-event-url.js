// Base URL
const baseUrl = 'https://jonmccon.github.io/pocket-parrot/';

// WebSocket endpoint (use wss:// for cellular compatibility)
const wsEndpoint = 'wss://pocket-parrot-server-dbba4de2cef6.herokuapp.com/event';

// Event details
const eventName = 'SeaAiWk';

// Build URL
const eventUrl = `${baseUrl}?ws=${encodeURIComponent(wsEndpoint)}&autoEnable=true&eventMode=true&eventName=${encodeURIComponent(eventName)}&autoStart=true`;

console.log(eventUrl);


