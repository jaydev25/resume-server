# WebSocket Server

A simple WebSocket server implementation using Node.js, Express, and ws package.

## Features

- Real-time bidirectional communication
- Viewer count broadcasting
- Heartbeat mechanism to detect stale connections
- CORS enabled
- Health check endpoint

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on port 3001 by default. You can change this by setting the PORT environment variable.

## WebSocket Events

- `connection`: Sent when a client successfully connects
- `viewerCount`: Broadcasts the current number of connected clients
- `ping/pong`: Heartbeat mechanism to keep connections alive
- `message`: Handle and broadcast messages to other clients

## HTTP Endpoints

- `GET /health`: Health check endpoint that returns status "ok"
