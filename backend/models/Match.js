const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  gameNumber: { type: Number, required: true },
  durationMins: { type: Number, default: 0 },
  status: { type: String, enum: ['In Progress', 'Completed'], default: 'In Progress' },
  accumulatedScores: {
    team1: { type: Number, default: 0 },
    team2: { type: Number, default: 0 }
  },
  pointArrays: {
    type: Map,
    of: [Number], // E.g. { "PID_123": [1, 0, 0, 1] }
    default: {}
  }
}, { _id: false });

const MatchSchema = new mongoose.Schema({
  // Initial API Setup Data
  courtId: { type: String, required: true },
  matchType: { type: String, required: true }, // Singles or Doubles
  categoryName: { type: String, required: true },
  roundName: { type: String, required: true },
  gamesPerMatch: { type: Number, required: true },
  pointsPerGame: { type: Number, required: true },
  goldenPointAt: { type: Number, default: 0 },
  players: {
    team1: [{ type: String }], // Player Profile IDs
    team2: [{ type: String }]  // Player Profile IDs
  },

  // State populated during Toss
  tossWinner: { type: String, default: null }, // "1" or "2"
  servingPlayer: { type: String, default: null }, // Player profileId
  receivingPlayer: { type: String, default: null }, // Player profileId
  startTime: { type: Date, default: null },

  // Live Tracking
  games: { type: [GameSchema], default: [] },
  
  // Status Flags
  status: { 
    type: String, 
    enum: ['Assigned', 'Scheduled', 'In Progress', 'Completed'], 
    default: 'Assigned' 
  },
  goldenPointActive: { type: Boolean, default: false },
  currentGameIsOver: { type: Boolean, default: false },
  
  // Resolution Info
  matchResult: {
    winner: { type: String, default: null }, // "1" or "2"
    finalScore: { type: String, default: null },
    totalDurationMins: { type: Number, default: 0 }
  },

  // Link to Bracket System
  tournamentMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentMatch', default: null },

  // Lock Management
  lockedByDevice: { type: String, default: null }, // The active capturing Socket ID
  lockedByDeviceId: { type: String, default: null } // Browser LocalStorage ID to survive auto-reconnects
}, { timestamps: true });

module.exports = mongoose.model('Match', MatchSchema);
