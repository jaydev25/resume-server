const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 80;

// Enable CORS
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// Track connected clients
const clients = new Set();

// Broadcast viewer count to all clients
function broadcastViewerCount() {
  const count = clients.size;
  const message = JSON.stringify({ type: 'viewerCount', count });
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

function heartbeat() {
  this.isAlive = true;
}

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Client failed to respond to ping, terminating');
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

wss.on('connection', (ws, req) => {
  // Add client to set
  clients.add(ws);
  console.log('Client connected. Total clients:', clients.size);
  
  // Send initial viewer count
  broadcastViewerCount();

  ws.isAlive = true;
  ws.on('pong', heartbeat);
  
  console.log(`New client connected from ${req.socket.remoteAddress}`);

  // Send initial connection success message
  ws.send(JSON.stringify({ 
    type: 'connection', 
    status: 'connected' 
  }));

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        case 'message':
          // Broadcast message to all clients
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(JSON.stringify({
                type: 'message',
                data: message.data
              }));
            }
          });
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', (code, reason) => {
    clients.delete(ws);
    console.log('Client disconnected. Total clients:', clients.size);
    broadcastViewerCount();
    console.log(`Client disconnected. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
  });
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

// Start server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('WebSocket server is running');
});
