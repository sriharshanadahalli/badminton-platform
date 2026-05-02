const mongoose = require('mongoose');

const RoundRobinStandingSchema = new mongoose.Schema({
  categoryId: { type: String, required: true },
  playerId: { type: String, required: true }, // Profile ID
  playerName: { type: String, required: true },
  points: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  matchesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  gamesLost: { type: Number, default: 0 },
  pointDifference: { type: Number, default: 0 }, // Sum of (myScore - oppScore) across all points
  rank: { type: Number, default: 0 }
}, { timestamps: true });

// Ensure unique entry per player per category
RoundRobinStandingSchema.index({ categoryId: 1, playerId: 1 }, { unique: true });

module.exports = mongoose.model('RoundRobinStanding', RoundRobinStandingSchema);
