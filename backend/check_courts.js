const mongoose = require('mongoose');
const Court = require('./models/Court');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/badminton_scoring');
  const courts = await Court.find({}).lean();
  console.log('Courts:');
  courts.forEach(c => {
    console.log(`CourtID: "${c.courtId}", activeMatch: ${c.activeMatchId}, upcoming: ${c.upcomingMatchId}`);
  });
  process.exit();
}
check();
