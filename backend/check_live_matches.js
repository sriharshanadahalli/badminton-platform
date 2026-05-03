const mongoose = require('mongoose');
const Match = require('./models/Match');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/badminton_scoring');
  const matches = await Match.find({}).lean();
  console.log('Live Match Records:');
  matches.forEach(m => {
    console.log(`ID: ${m._id}, courtId: "${m.courtId}", tmId: ${m.tournamentMatchId}`);
  });
  process.exit();
}
check();
