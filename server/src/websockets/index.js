// server/websockets/index.js (sketch)
const Document = require('../models/Document');

function socketHandler(io) {
  io.on('connection', socket => {
    socket.on('join-document', async ({ documentId }) => {
      socket.join(documentId);
      const doc = await Document.findById(documentId);
      if (doc) {
        socket.emit('document-data', doc.data);
        socket.emit('document-title', doc.title);
      } else {
        socket.emit('document-data', null);
      }
    });

    socket.on('editor-update', ({ documentId, json }) => {
      socket.to(documentId).emit('remote-editor-update', { json, from: socket.id });
      // optionally buffer and persist
    });

    socket.on('save-document', async ({ documentId, data }) => {
      const doc = await Document.findById(documentId);
      if (!doc) return;
      doc.data = data;
      doc.updatedAt = Date.now();
      await doc.save();
      io.to(documentId).emit('document-saved', { by: socket.id, time: Date.now() });
    });
  });
}

module.exports = { socketHandler };
