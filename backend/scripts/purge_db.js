const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/test";

async function purge() {
    try {
        console.log(`Connecting to: ${MONGO_URI}`);
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully.\n");

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        console.log("Starting full database purge...");

        for (const name of collectionNames) {
            // Skip system collections if any
            if (name.startsWith('system.')) continue;
            
            console.log(`- Dropping collection: ${name}`);
            await db.collection(name).drop().catch(err => {
                console.log(`  (Note: Could not drop ${name}, it may already be empty)`);
            });
        }

        console.log("\nPurge completed! The database is now empty.");
        process.exit(0);
    } catch (err) {
        console.error("Purge failed:", err);
        process.exit(1);
    }
}

purge();
