// server/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true }, // hashed
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
