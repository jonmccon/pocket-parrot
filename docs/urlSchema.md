

# Base app url
https://pocket-parrot-backend-eb141a6427d7.herokuapp.com/


# Dashboard access
https://jonmccon.github.io/pocket-parrot/dashboard.html?server=wss:///pocket-parrot-backend-eb141a6427d7.herokuapp.com/dashboard


# Full Example Event URL:  
https://jonmccon.github.io/pocket-parrot/?ws=wss%3A%2F%2F/pocket-parrot-backend-eb141a6427d7.herokuapp.com%2Fevent&autoEnable=true&eventMode=true&eventName=SeaAiWk&autoStart=true



---------------------------------------------------------------------------------------------

## Streaming Server

# Basic event streaming (GPS-only, 5-second intervals)
https://your-app.com/?ws=wss://server.com/data&autoEnable=true&eventMode=true

# High-frequency research study (all sensors, 2-second intervals)
https://your-app.com/?ws=wss://server.com/study&interval=2000&dataMode=full&autoStart=true

# Battery-efficient tracking (GPS-only, 30-second intervals)
https://your-app.com/?ws=wss://server.com/track&interval=30000&dataMode=gps&eventName=Field Study

# Conference/event setup with branding
https://your-app.com/?ws=wss://conf.com/sensors&eventName=AI Conference 2024&autoStart=true&eventMode=true



📡 Listening on port 4544
🔗 Data endpoint: ws://YOUR_IP:4544/pocket-parrot
📊 Dashboard endpoint: ws://YOUR_IP:4544/dashboard
📻 Listener endpoint: ws://YOUR_IP:4544/listener