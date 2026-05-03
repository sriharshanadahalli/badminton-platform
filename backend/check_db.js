const mongoose = require('mongoose');
const TournamentMatch = require('./models/TournamentMatch');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/badminton_scoring');
  const matches = await TournamentMatch.find({ courtId: { $ne: null } }).lean();
  console.log('Matches with courtId:');
  matches.forEach(m => {
    console.log(`MatchID: ${m._id}, courtId: "${m.courtId}" (Length: ${m.courtId ? m.courtId.length : 0})`);
  });
  process.exit();
}
check();
