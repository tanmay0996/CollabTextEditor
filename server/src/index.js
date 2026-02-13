// server/server.js
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const socketio = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const docRoutes = require('./routes/documents');
const aiRoutes = require('./routes/ai');
const { socketHandler } = require('./websockets');

const app = express();

// Trust the first reverse proxy (Render, Railway, etc.)
// Required so Express recognises HTTPS (via X-Forwarded-Proto) and
// correctly sets `secure` cookies behind a proxy.
app.set('trust proxy', 1);

/* -------------------- CORS CONFIG -------------------- */

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:3000'
  ];

const corsOptions = {
  origin: (origin, callback) => {
    // allow non-browser (curl, postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked from origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));   // ⭐ GLOBAL CORS HANDLER
app.use(cookieParser());
app.use(express.json());

/* Optional: health check */
app.get('/healthz', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), timestamp: Date.now() });
});

/* -------------------- API ROUTES -------------------- */
app.use('/api/auth', authRoutes);
app.use('/api/documents', docRoutes);
app.use('/api/ai', aiRoutes);

/* -------------------- SOCKET.IO -------------------- */
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});
socketHandler(io);

/* -------------------- DATABASE -------------------- */
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Mongo connected'))
  .catch(err => console.error('Mongo connection error', err));

/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed Origins:`, allowedOrigins);
});
