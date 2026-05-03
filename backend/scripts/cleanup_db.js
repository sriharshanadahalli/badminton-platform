const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/test";

async function migrate() {
    try {
        console.log(`Connecting to: ${MONGO_URI}`);
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully.\n");

        const db = mongoose.connection.db;

        // 1. Cleanup TournamentMatches
        console.log("Cleaning up 'tournamentmatches' collection...");
        const tmResult = await db.collection('tournamentmatches').updateMany(
            {},
            [
                { 
                    $rename: { "round": "roundNumber" } 
                },
                {
                    $unset: ["matchId"]
                }
            ]
        );
        console.log(`- Updated ${tmResult.modifiedCount} tournament matches.\n`);

        // 2. Cleanup Matches (Live Scoring)
        console.log("Cleaning up 'matches' collection...");
        const mResult = await db.collection('matches').updateMany(
            {},
            [
                { 
                    $rename: { 
                        "category": "categoryName",
                        "round": "roundName"
                    } 
                },
                {
                    $unset: ["matchId"]
                }
            ]
        );
        console.log(`- Updated ${mResult.modifiedCount} live match records.\n`);

        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
