// server/websockets/index.js (sketch)
const Document = require('../models/Document');
const jwt = require('jsonwebtoken');

function hasDocAccess(doc, userId) {
  if (!doc || !userId) return false;
  if (String(doc.owner) === String(userId)) return true;
  return Array.isArray(doc.collaborators) && doc.collaborators.some((c) => String(c) === String(userId));
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) continue;
    const key = rawKey.trim();
    const value = rest.join('=').trim();
    if (!key) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function socketHandler(io) {
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake?.headers?.cookie;
      const cookies = parseCookies(cookieHeader);
      const token = cookies.sid;
      if (!token) return next(new Error('unauthorized'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      console.log('[socket] auth ok', { socketId: socket.id, userId: decoded?.id });
      return next();
    } catch (err) {
      console.warn('[socket] auth failed', { socketId: socket.id, error: err?.message });
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', socket => {
    console.log('[socket] connected', { socketId: socket.id, userId: socket.user?.id });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', { socketId: socket.id, userId: socket.user?.id, reason });
    });

    socket.on('join-document', async ({ documentId }) => {
      const room = `doc:${documentId}`;
      socket.join(room);
      console.log('[socket] join-document', { socketId: socket.id, userId: socket.user?.id, documentId });

      const doc = await Document.findById(documentId);
      if (!doc) {
        socket.emit('document-data', null);
        socket.emit('doc:error', { message: 'not_found', documentId });
        return;
      }

      if (!hasDocAccess(doc, socket.user?.id)) {
        await Document.updateOne(
          { _id: doc._id },
          { $addToSet: { collaborators: socket.user?.id } }
        );
      }

      const payload = {
        documentId,
        title: doc.title,
        data: doc.data,
        version: typeof doc.version === 'number' ? doc.version : 0,
        lastModified: doc.lastModified || doc.updatedAt,
      };

      socket.emit('doc:init', payload);
      socket.emit('document-data', { json: payload.data, version: payload.version });
      socket.emit('document-title', payload.title);
    });

    async function persistAndBroadcast({ documentId, json, baseVersion }) {
      const room = `doc:${documentId}`;
      const doc = await Document.findById(documentId);
      if (!doc) {
        socket.emit('doc:error', { message: 'not_found', documentId });
        return;
      }

      if (!hasDocAccess(doc, socket.user?.id)) {
        socket.emit('doc:error', { message: 'forbidden', documentId });
        return;
      }

      const currentVersion = typeof doc.version === 'number' ? doc.version : 0;
      if (typeof baseVersion === 'number' && baseVersion !== currentVersion) {
        const currentPayload = {
          documentId,
          title: doc.title,
          data: doc.data,
          version: currentVersion,
          lastModified: doc.lastModified || doc.updatedAt,
        };
        console.log('[socket] reject stale edit', {
          socketId: socket.id,
          userId: socket.user?.id,
          documentId,
          baseVersion,
          currentVersion,
        });
        socket.emit('doc:reject', { reason: 'stale', current: currentPayload });
        return;
      }

      doc.data = json;
      doc.version = currentVersion + 1;
      doc.lastModified = new Date();

      await doc.save();

      const persistedPayload = {
        documentId,
        title: doc.title,
        data: doc.data,
        version: doc.version,
        lastModified: doc.lastModified,
      };

      console.log('[socket] edit persisted', {
        socketId: socket.id,
        userId: socket.user?.id,
        documentId,
        newVersion: doc.version,
      });

      socket.emit('doc:ack', persistedPayload);
      socket.to(room).emit('doc:update', persistedPayload);

      socket.to(room).emit('remote-editor-update', { json: doc.data, from: socket.id, version: doc.version });
    }

    socket.on('editor-update', async ({ documentId, json, baseVersion }) => {
      try {
        await persistAndBroadcast({ documentId, json, baseVersion });
      } catch (err) {
        console.error('[socket] editor-update error', err);
        socket.emit('doc:error', { message: err?.message || 'unknown_error', documentId });
      }
    });

    socket.on('doc:edit', async ({ documentId, json, baseVersion }) => {
      try {
        await persistAndBroadcast({ documentId, json, baseVersion });
      } catch (err) {
        console.error('[socket] doc:edit error', err);
        socket.emit('doc:error', { message: err?.message || 'unknown_error', documentId });
      }
    });

    socket.on('save-document', async ({ documentId, data, baseVersion }) => {
      try {
        await persistAndBroadcast({ documentId, json: data, baseVersion });
        io.to(`doc:${documentId}`).emit('document-saved', { by: socket.id, time: Date.now() });
      } catch (err) {
        console.error('[socket] save-document error', err);
        socket.emit('doc:error', { message: err?.message || 'unknown_error', documentId });
      }
    });
  });
}

module.exports = { socketHandler };
