// server/routes/documents.js
const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const auth = require('../middleware/auth'); // simple JWT middleware

 function hasDocAccess(doc, userId) {
   if (!doc || !userId) return false;
   if (String(doc.owner) === String(userId)) return true;
   return Array.isArray(doc.collaborators) && doc.collaborators.some((c) => String(c) === String(userId));
 }

// create document
router.post('/', auth, async (req, res) => {
  const { title } = req.body;
  const doc = new Document({ title: title || 'Untitled', owner: req.user.id });
  await doc.save();
  res.status(201).json(doc);
});

// get user's docs
router.get('/', auth, async (req, res) => {
  const docs = await Document.find({ $or: [{ owner: req.user.id }, { collaborators: req.user.id }] }).sort({ updatedAt: -1 });
  res.json(docs);
});

// get document by id
router.get('/:id', auth, async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if(!doc) return res.status(404).json({ error: 'Not found' });

  if (!hasDocAccess(doc, req.user.id)) {
    await Document.updateOne(
      { _id: doc._id },
      { $addToSet: { collaborators: req.user.id } }
    );
  }

  res.json(doc);
});

// update/save
router.put('/:id', auth, async (req, res) => {
  const { data, title } = req.body;
  const doc = await Document.findById(req.params.id);
  if(!doc) return res.status(404).json({ error: 'Not found' });

  if (!hasDocAccess(doc, req.user.id)) {
    await Document.updateOne(
      { _id: doc._id },
      { $addToSet: { collaborators: req.user.id } }
    );
  }

  if (data) doc.data = data;
  if (title) doc.title = title;
  await doc.save();
  res.json(doc);
});

module.exports = router;
