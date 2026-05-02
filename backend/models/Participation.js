const mongoose = require('mongoose');

const ParticipationSchema = new mongoose.Schema({
  categoryId: { type: String, required: true, set: v => v ? v.toUpperCase() : v },
  player1Id: { type: String, required: true },
  player2Id: { type: String, default: null }, // Optional for Singles
  seed: { type: Number, default: null }
}, { timestamps: true });

// Index for performance on resolution
ParticipationSchema.index({ categoryId: 1 });
ParticipationSchema.index({ player1Id: 1 });
ParticipationSchema.index({ player2Id: 1 });

module.exports = mongoose.model('Participation', ParticipationSchema);
