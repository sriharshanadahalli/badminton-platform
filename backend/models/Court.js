const mongoose = require('mongoose');

const CourtSchema = new mongoose.Schema({
  courtId: { type: String, required: true, unique: true }, // e.g. "01", "02"
  name: { type: String }, // e.g. "Court 1"
  status: { type: String, enum: ['Available', 'Occupied'], default: 'Available' },
  activeMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentMatch', default: null },
  upcomingMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentMatch', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Court', CourtSchema);
