// server/src/yjs/setup.js
// Y.js WebSocket server — implements the y-websocket protocol manually
// because y-websocket v3 no longer ships bin/utils.js for Node 22.
const WebSocket = require('ws');
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');

// Message types (must match y-websocket client expectations)
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

/** In-memory map of roomName → { ydoc, awareness, conns } */
const rooms = new Map();

/**
 * Get or create a Y.js room for a document.
 */
function getRoom(docName) {
    if (rooms.has(docName)) return rooms.get(docName);

    const ydoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(ydoc);
    const conns = new Set();

    // When awareness changes, broadcast to all connections in the room
    awareness.on('update', ({ added, updated, removed }) => {
        const changedClients = [...added, ...updated, ...removed];
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
        );
        const msg = encoding.toUint8Array(encoder);
        broadcastToRoom(docName, msg, null);
    });

    const room = { ydoc, awareness, conns };
    rooms.set(docName, room);
    console.log('[yjs] room created:', docName);
    return room;
}

/**
 * Send a binary message to all connections in a room (optionally excluding one).
 */
function broadcastToRoom(docName, msg, exclude) {
    const room = rooms.get(docName);
    if (!room) return;
    room.conns.forEach((conn) => {
        if (conn !== exclude && conn.readyState === WebSocket.OPEN) {
            try {
                conn.send(msg);
            } catch (e) {
                room.conns.delete(conn);
            }
        }
    });
}

/**
 * Handle an incoming WebSocket message from a client.
 */
function handleMessage(conn, docName, data) {
    const room = rooms.get(docName);
    if (!room) return;

    try {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
            case MSG_SYNC: {
                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, MSG_SYNC);
                syncProtocol.readSyncMessage(decoder, encoder, room.ydoc, conn);

                const reply = encoding.toUint8Array(encoder);
                // Only send if there's actual content beyond the message type byte
                if (encoding.length(encoder) > 1) {
                    conn.send(reply);
                }

                // If it was a sync step 2 or update, broadcast to others
                // (the decoder has been consumed, so re-encode the update for broadcast)
                break;
            }
            case MSG_AWARENESS: {
                const update = decoding.readVarUint8Array(decoder);
                awarenessProtocol.applyAwarenessUpdate(room.awareness, update, conn);
                break;
            }
            default:
                console.warn('[yjs] unknown message type:', messageType);
        }
    } catch (err) {
        console.error('[yjs] message handling error:', err.message);
    }
}

/**
 * Set up a Y.js WebSocket connection for a specific document.
 */
function setupConnection(ws, docName) {
    const room = getRoom(docName);
    room.conns.add(ws);

    // Track clientIDs seen on THIS connection so we can clean up on close
    const proxiedClientIDs = new Set();

    // Listen for document updates and broadcast to all clients
    const onDocUpdate = (update, origin) => {
        if (origin === ws) return;
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.writeUpdate(encoder, update);
        broadcastToRoom(docName, encoding.toUint8Array(encoder), ws);
    };
    room.ydoc.on('update', onDocUpdate);

    // Filtered awareness broadcast for this connection
    const onAwarenessUpdate = ({ added, updated, removed }, origin) => {
        const changedClients = [...added, ...updated, ...removed];
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(room.awareness, changedClients));
        const msg = encoding.toUint8Array(encoder);
        // Broadcast to all (passing 'ws' if we wanted to exclude sender, but awareness usually echos)
        broadcastToRoom(docName, msg, null);
    };
    room.awareness.on('update', onAwarenessUpdate);

    // Send initial sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, room.ydoc);
    ws.send(encoding.toUint8Array(encoder));

    // Send current awareness state
    if (room.awareness.getStates().size > 0) {
        const awarenessEncoder = encoding.createEncoder();
        encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(
            awarenessEncoder,
            awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(room.awareness.getStates().keys()))
        );
        ws.send(encoding.toUint8Array(awarenessEncoder));
    }

    // Handle incoming messages
    ws.on('message', (data) => {
        try {
            const decoder = decoding.createDecoder(new Uint8Array(data));
            const messageType = decoding.readVarUint(decoder);
            switch (messageType) {
                case MSG_SYNC:
                    const encoder = encoding.createEncoder();
                    encoding.writeVarUint(encoder, MSG_SYNC);
                    syncProtocol.readSyncMessage(decoder, encoder, room.ydoc, ws);
                    if (encoding.length(encoder) > 1) {
                        ws.send(encoding.toUint8Array(encoder));
                    }
                    break;
                case MSG_AWARENESS:
                    const update = decoding.readVarUint8Array(decoder);
                    // Track clientIDs to clean up later
                    try {
                        const decoder2 = decoding.createDecoder(update);
                        const len = decoding.readVarUint(decoder2);
                        for (let i = 0; i < len; i++) {
                            const clientID = decoding.readVarUint(decoder2);
                            proxiedClientIDs.add(clientID);
                        }
                    } catch (e) { /* ignore parse errors */ }
                    awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
                    break;
            }
        } catch (err) {
            console.error('[yjs] message error:', err);
        }
    });

    // Handle disconnect
    ws.on('close', () => {
        room.conns.delete(ws);
        room.ydoc.off('update', onDocUpdate);
        room.awareness.off('update', onAwarenessUpdate);

        // CLEANUP: Remove awareness states for all clientIDs that were linked to this connection
        if (proxiedClientIDs.size > 0) {
            awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(proxiedClientIDs), null);
        }

        if (room.conns.size === 0) {
            setTimeout(() => {
                if (room.conns.size === 0 && rooms.get(docName) === room) {
                    room.ydoc.destroy();
                    rooms.delete(docName);
                    console.log('[yjs] room destroyed:', docName);
                }
            }, 10000);
        }
        console.log('[yjs] client disconnected:', docName, `(${room.conns.size} left)`);
    });

    console.log('[yjs] client connected:', docName, `(${room.conns.size} total)`);
}

/**
 * Attach a Y.js WebSocket server to the existing HTTP server.
 * Routes:  /yjs/{documentId}  →  Y.js CRDT sync
 *          /socket.io/        →  Socket.IO (AI, voice, etc.) — untouched
 */
function setupYjsWebSocket(server) {
    const wss = new WebSocket.Server({ noServer: true });

    wss.on('connection', (ws, req) => {
        // Extract document ID from URL: /yjs/abc123 → abc123
        let docName;
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            docName = url.pathname.replace(/^\/yjs\//, '') || 'default';
        } catch {
            docName = 'default';
        }

        setupConnection(ws, docName);
    });

    // Intercept HTTP upgrade requests destined for /yjs/
    server.on('upgrade', (request, socket, head) => {
        const { url } = request;
        if (url && url.startsWith('/yjs/')) {
            console.log('[yjs] intercepted upgrade:', url);
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        }
    });

    console.log('[yjs] WebSocket handler attached on /yjs/ path');
    return wss;
}

module.exports = { setupYjsWebSocket };
