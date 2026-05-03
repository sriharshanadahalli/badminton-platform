const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupIndices() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
        console.log("Connected.");

        const db = mongoose.connection.db;
        const collection = db.collection('matches');

        console.log("Checking indices on 'matches' collection...");
        const indices = await collection.listIndexes().toArray();
        console.log("Current indices:", indices.map(i => i.name));

        const indexToDrop = 'matchId_1';
        if (indices.some(i => i.name === indexToDrop)) {
            console.log(`Dropping legacy index: ${indexToDrop}...`);
            await collection.dropIndex(indexToDrop);
            console.log("Index dropped successfully.");
        } else {
            console.log(`Index ${indexToDrop} not found or already removed.`);
        }

        // Also check for courtNumber_1 as we renamed it to courtId
        const legacyCourtIndex = 'courtNumber_1';
        if (indices.some(i => i.name === legacyCourtIndex)) {
            console.log(`Dropping legacy index: ${legacyCourtIndex}...`);
            await collection.dropIndex(legacyCourtIndex);
            console.log("Index dropped successfully.");
        }

        console.log("Cleanup complete.");
        process.exit(0);
    } catch (err) {
        console.error("Cleanup failed:", err);
        process.exit(1);
    }
}

cleanupIndices();
