const mongoose = require('mongoose');

const TournamentMatchSchema = new mongoose.Schema({
  categoryId: { type: String, required: true, set: v => v ? v.toUpperCase() : v },
  roundNumber: { type: Number, required: true },
  roundName: { type: String, default: null },
  matchIndex: { type: Number, required: true },
  
  // Teams are linked to Participation IDs
  teams: {
    team1: { type: String, default: null }, // Participation ID
    team2: { type: String, default: null }  // Participation ID
  },
  
  // Rule Overrides
  parameters: {
    gamesPerMatch: { type: Number },
    pointsPerGame: { type: Number },
    goldenPointAt: { type: Number }
  },
  
  courtId: { type: String, default: null },
  games: { type: Array, default: [] },
  
  // Status & Progress
  status: { 
    type: String, 
    enum: ['TBD', 'Created', 'Assigned', 'Scheduled', 'In Progress', 'Completed', 'Forfeited', 'BYE'], 
    default: 'TBD' 
  },
  winnerMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentMatch', default: null },
  sourceMatch1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentMatch', default: null },
  sourceMatch2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentMatch', default: null },

  matchResult: {
    winner: { type: String, default: null }, // "1" or "2"
    finalScore: { type: String, default: null },
    totalDurationMins: { type: Number, default: 0 }
  }
}, { timestamps: true });

// Create indexes for fast retrieval of bracket structures
 TournamentMatchSchema.index({ categoryId: 1, roundNumber: 1, matchIndex: 1 });

module.exports = mongoose.model('TournamentMatch', TournamentMatchSchema);
