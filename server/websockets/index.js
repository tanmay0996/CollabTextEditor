// server/websockets/index.js
const Document = require('../models/Document');

function socketHandler(io) {
  io.on('connection', socket => {
    console.log('socket connected', socket.id);

    socket.on('join-document', async ({ documentId, user }) => {
      socket.join(documentId);
      socket.to(documentId).emit('user-joined', { userId: user.id, name: user.name });
      // send current doc content
      const doc = await Document.findById(documentId);
      if (doc) socket.emit('document-data', doc.data);
    });

    socket.on('text-change', ({ documentId, delta }) => {
      // broadcast delta to other clients
      socket.to(documentId).emit('remote-text-change', delta);
      // optionally buffer deltas and autosave at intervals
    });

    socket.on('cursor-move', ({ documentId, cursor }) => {
      socket.to(documentId).emit('remote-cursor-move', cursor);
    });

    socket.on('save-document', async ({ documentId, data }) => {
      // quick save
      await Document.findByIdAndUpdate(documentId, { data }, { new: true });
      io.to(documentId).emit('document-saved', { by: socket.id, timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      console.log('socket disconnected', socket.id);
    });
  });
}

module.exports = { socketHandler };
