// server/server.js
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const socketio = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const docRoutes = require('./routes/documents');
const aiRoutes = require('./routes/ai');
const { socketHandler } = require('./websockets');

const app = express();

// trust reverse proxy (important on hosts like Render)
app.set('trust proxy', true);

// Allowed origins (can set via env: comma-separated list)
// Example: ALLOWED_ORIGINS="https://collabtexteditor-cslg.onrender.com,http://localhost:5173"
const defaultFrontend = process.env.FRONTEND_URL || 'https://collabtexteditor-cslg.onrender.com';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || `${defaultFrontend},http://localhost:5173,http://localhost:3000`)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (curl, server-to-server, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
    return callback(new Error(msg), false);
  },
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept'],
  credentials: true,
  maxAge: 86400,
};

// preflight handler
app.options('*', cors(corsOptions));

// apply CORS and JSON body parsing
app.use(cors(corsOptions));
app.use(express.json());

// Health check (useful for the platform and for debugging)
app.get('/healthz', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', docRoutes);
app.use('/api/ai', aiRoutes);

// create server + socket.io with matching CORS config
const server = http.createServer(app);

const io = socketio(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET','POST'],
    credentials: true,
  }
});
socketHandler(io);

// connect to mongo
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true })
  .then(()=> console.log('Mongo connected'))
  .catch(err=> console.error('Mongo connect error', err));

const PORT = process.env.PORT || 8000;

// Listen on 0.0.0.0 so reverse proxies can connect (Render/Heroku/etc)
server.listen(PORT, '0.0.0.0', ()=> console.log(`Server running on port ${PORT}`));

// graceful shutdown (optional but useful on hosts)
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.disconnect();
    process.exit(0);
  });
});
