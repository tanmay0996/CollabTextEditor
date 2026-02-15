const express = require('express');
const http = require('http');
const cors = require('cors');
const socketio = require('socket.io');

function createServer(options = {}) {
    const app = express();
    app.use(cors({ origin: '*' }));
    app.use(express.json());

    app.get('/healthz', (_req, res) => {
        res.json({ ok: true });
    });

    const server = http.createServer(app);

    const io = socketio(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    // auth middleware
    if (options.skipAuth) {
        io.use((socket, next) => {
            socket.user = { id: 'test-user-' + socket.id };
            next();
        });
    } else {
        const jwt = require('jsonwebtoken');

        function parseCookies(cookieHeader) {
            const out = {};
            if (!cookieHeader || typeof cookieHeader !== 'string') return out;
            for (const part of cookieHeader.split(';')) {
                const [rawKey, ...rest] = part.trim().split('=');
                if (!rawKey) continue;
                out[rawKey.trim()] = decodeURIComponent(rest.join('=').trim());
            }
            return out;
        }

        io.use((socket, next) => {
            try {
                const cookies = parseCookies(socket.handshake?.headers?.cookie);
                const token = cookies.sid;
                if (!token) return next(new Error('unauthorized'));
                socket.user = jwt.verify(token, process.env.JWT_SECRET);
                return next();
            } catch {
                return next(new Error('unauthorized'));
            }
        });
    }

    // socket event handlers
    io.on('connection', (socket) => {
        socket.on('join-document', ({ documentId }) => {
            const room = `doc:${documentId}`;
            socket.join(room);
            socket.emit('join-ack', { documentId, room });
        });

        // text-change → broadcast to others in the same room
        socket.on('text-change', ({ documentId, delta }) => {
            const room = `doc:${documentId}`;
            socket.to(room).emit('remote-text-change', { documentId, delta });
        });

        // editor-update → broadcast without DB persistence (for testing)
        socket.on('editor-update', ({ documentId, json, baseVersion }) => {
            const room = `doc:${documentId}`;
            socket.to(room).emit('remote-editor-update', {
                json,
                from: socket.id,
                version: (baseVersion || 0) + 1,
            });
        });
    });

    return { server, io, app };
}

module.exports = { createServer };
