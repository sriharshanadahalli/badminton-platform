const mongoose = require('mongoose');

const TournamentResultSchema = new mongoose.Schema({
  categoryId: { type: String, required: true, unique: true },
  categoryName: { type: String, required: true },
  winner: { type: String, default: '-' },
  runnerUp: { type: String, default: '-' },
  semi1: { type: String, default: '-' },
  semi2: { type: String, default: '-' },
  format: { type: String, enum: ['Knockout', 'RoundRobin'], required: true },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('TournamentResult', TournamentResultSchema);
