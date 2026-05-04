async function test() {
    try {
        const res = await fetch('http://localhost:4000/api/scheduler/bracket-view/10');
        const json = await res.json();
        if (!json.success) {
            console.log("API Error:", json.message);
            return;
        }
        
        const firstMatch = json.data[0];
        if (!firstMatch) {
            console.log("No matches found for category 10");
            return;
        }
        
        console.log("Match 1 Team 1 Players:");
        firstMatch.teams.team1.players.forEach(p => {
            console.log(`- ${p.fullName}: lastPlayedAt = ${p.lastPlayedAt}`);
        });
        
        const allPlayers = json.data.flatMap(m => [
            ...(m.teams?.team1?.players || []),
            ...(m.teams?.team2?.players || [])
        ]);
        const withLastPlayed = allPlayers.filter(p => p.lastPlayedAt);
        console.log(`\nFound ${withLastPlayed.length} players with lastPlayedAt field.`);
        if (withLastPlayed.length > 0) {
            console.log("Sample:", withLastPlayed[0].fullName, withLastPlayed[0].lastPlayedAt);
        }
    } catch (err) {
        console.error("Fetch failed:", err.message);
    }
}

test();
