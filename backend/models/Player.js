const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  profileId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true, set: v => v ? v.toUpperCase() : v }
}, { timestamps: true });

module.exports = mongoose.model('Player', PlayerSchema);
