const express = require('express');
const { createServer } = require('https');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const url = require('url');

const app = express();
const port = process.env.PORT || 443;

// SSL options
const sslOptions = {
  cert: fs.readFileSync(path.join(__dirname, '..', 'certificate.pem')),
  key: fs.readFileSync(path.join(__dirname, '..', 'private-key.pem'))
};

// Enable CORS with specific options
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create HTTPS server
const server = createServer(sslOptions, app);

// Initialize WebSocket server with client tracking
const wss = new WebSocketServer({ 
  server,
  clientTracking: true,
  // Verify client connection
  verifyClient: ({ origin, req, secure }) => {
    // Ensure connection is secure
    if (!secure) {
      console.log('Rejected insecure connection attempt');
      return false;
    }
    
    // Check origin if ALLOWED_ORIGINS is set
    if (process.env.ALLOWED_ORIGINS) {
      const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
      if (!allowedOrigins.includes(origin)) {
        console.log(`Rejected connection from unauthorized origin: ${origin}`);
        return false;
      }
    }
    
    return true;
  }
});

// Track connected clients
const clients = new Set();

// Broadcast viewer count to all clients
function broadcastViewerCount() {
  const count = clients.size;
  const message = JSON.stringify({ type: 'viewerCount', count });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function heartbeat() {
  this.isAlive = true;
}

// Ping clients every 30 seconds to check connection
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Client connection terminated due to inactivity');
      clients.delete(ws);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('New WSS connection established');
  
  // Set initial state
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  
  // Add client to tracking set
  clients.add(ws);
  broadcastViewerCount();
  
  // Send initial connection confirmation
  ws.send(JSON.stringify({ 
    type: 'connected',
    message: 'Secure WebSocket connection established'
  }));
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      // Handle message types here
      console.log('Received message:', message);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
    broadcastViewerCount();
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
    broadcastViewerCount();
  });
});

// Clean up on server shutdown
server.on('close', () => {
  clearInterval(interval);
  wss.clients.forEach((ws) => {
    ws.terminate();
  });
});

// Start server
server.listen(port, () => {
  console.log(`Secure server running on port ${port}`);
  console.log(`WSS endpoint available at wss://hostname:${port}`);
});
