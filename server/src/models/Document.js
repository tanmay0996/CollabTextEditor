// server/models/Document.js
const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  title: { type: String, required: true, default: 'Untitled' },
  data: { type: Object, default: { ops: [] } }, // store Quill delta
  version: { type: Number, default: 0 },
  lastModified: { type: Date, default: Date.now },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DocumentSchema.pre('save', function(next){ this.updatedAt = Date.now(); this.lastModified = Date.now(); next(); });

module.exports = mongoose.model('Document', DocumentSchema);
