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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', docRoutes);
app.use('/api/ai', aiRoutes);

const server = http.createServer(app);
const io = socketio(server, { cors: { origin: true, methods: ['GET','POST'] } });
socketHandler(io);

// connect to mongo
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true })
  .then(()=> console.log('Mongo connected'))
  .catch(err=> console.error('Mongo connect error', err));

const PORT = process.env.PORT || 8000;
server.listen(PORT, ()=> console.log(`Server running on ${PORT}`));
