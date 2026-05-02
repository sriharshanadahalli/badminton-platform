const result = require('dotenv').config();
if (result.error) {
  console.log("Dotenv load error:", result.error);
}
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const Category = require('./models/Category');
const Player = require('./models/Player');
const Participation = require('./models/Participation');
const TournamentMatch = require('./models/TournamentMatch');
const Match = require('./models/Match');
const Court = require('./models/Court');
const RoundRobinStanding = require('./models/RoundRobinStanding');
const TournamentResult = require('./models/TournamentResult');
const APP_CONFIG = require('../frontend/src/config.json');

const app = express();
app.use(cors());
app.use(express.json());

// Swagger Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /api/scheduler/courts:
 *   get:
 *     summary: Get all courts with their active and upcoming matches
 *     tags: [Scheduler]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Court' } }
 */
// API to get all courts for the Scheduler View
app.get('/api/scheduler/courts', async (req, res) => {
  try {
    const validCourts = APP_CONFIG.COURTS || [];
    const courts = await Court.find({ courtId: { $in: validCourts } })
      .collation({ locale: 'en', numericOrdering: true })
      .sort({ courtId: 1 }).lean();

    const resolvedCourts = await Promise.all(courts.map(async c => {
      let status = 'Available';
      if (c.activeMatchId && c.upcomingMatchId) {
        status = 'Unavailable';
      }

      const activeMatch = await mapMatchDataGlobal(c.activeMatchId);
      const upcomingMatch = await mapMatchDataGlobal(c.upcomingMatchId);

      if (activeMatch) {
        activeMatch.team1Name = activeMatch.players.team1.join(' / ');
        activeMatch.team2Name = activeMatch.players.team2.join(' / ');
        // roundName is now fetched from DB by mapMatchDataGlobal or set here
        activeMatch.roundName = activeMatch.roundName || `Round ${activeMatch.round}`;
      }
      if (upcomingMatch) {
        upcomingMatch.team1Name = upcomingMatch.players.team1.join(' / ');
        upcomingMatch.team2Name = upcomingMatch.players.team2.join(' / ');
        upcomingMatch.roundName = upcomingMatch.roundName || `Round ${upcomingMatch.round}`;
      }

      return { ...c, status, activeMatch, upcomingMatch };
    }));

    res.json({ success: true, data: resolvedCourts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// Global Helpers for Match Data Mapping
const resolvePlayer = (id, playerMap) => playerMap[id] || { id, fullName: id, firstName: id.split(' ')[0] };
const resolveCategory = (id, catMap) => catMap[id] || id;

const getPlayerDetailsGlobal = async (particId, playerMap, participationMap = null) => {
  if (!particId) return [];

  let partic;
  if (participationMap) {
    partic = participationMap[particId.toString()];
  } else {
    partic = await Participation.findById(particId).lean();
  }

  if (!partic) return [];
  const details = [resolvePlayer(partic.player1Id, playerMap)];
  if (partic.player2Id) details.push(resolvePlayer(partic.player2Id, playerMap));
  return details;
};

const mapMatchDataGlobal = async (matchInput, preFetchedData = null) => {
  if (!matchInput) return null;

  // Resolve match document if only ID is provided
  let tMatch = matchInput;
  if (typeof matchInput === 'string' || mongoose.Types.ObjectId.isValid(matchInput)) {
    tMatch = await TournamentMatch.findById(matchInput).lean();
    if (!tMatch) return null;
  }

  // --- FAST PATH: If we have pre-fetched data, do everything synchronously ---
  if (preFetchedData) {
    const playerMap = preFetchedData.playerMap || {};
    const catMap = preFetchedData.catMap || {};
    
    // Priority: Use pre-fetched live match if available
    const liveMatch = preFetchedData.liveMatchesMap?.[tMatch._id.toString()] || null;

    const resolvePlayer = (pId, map) => {
      const p = map[pId];
      return p ? { id: p.id, fullName: p.fullName, firstName: p.firstName } : null;
    };

    const resolveCategory = (cId, map) => map[cId] || 'Match';

    const getPlayerDetailsSync = (pId) => {
      if (!pId) return [];
      const partic = preFetchedData.participationsMap?.[pId.toString()];
      if (!partic) return [];
      return [resolvePlayer(partic.player1Id, playerMap), partic.player2Id ? resolvePlayer(partic.player2Id, playerMap) : null].filter(Boolean);
    };

    const team1Details = getPlayerDetailsSync(tMatch.teams?.team1);
    const team2Details = getPlayerDetailsSync(tMatch.teams?.team2);

    const gamesSource = liveMatch?.games || tMatch.games || [];
    let currentScores = { team1: 0, team2: 0 };
    if (gamesSource.length > 0) {
      currentScores = gamesSource[gamesSource.length - 1].accumulatedScores || currentScores;
    }

    return {
      _id: tMatch._id.toString(),
      dbId: tMatch._id.toString(),
      matchId: `TM${tMatch._id}`,
      matchIndex: tMatch.matchIndex,
      courtNumber: tMatch.courtId ? `court_${tMatch.courtId}` : 'court_TBD',
      courtId: tMatch.courtId,
      matchType: (team1Details.length > 1 || team2Details.length > 1) ? 'Doubles' : 'Singles',
      category: resolveCategory(tMatch.categoryId, catMap),
      categoryName: resolveCategory(tMatch.categoryId, catMap),
      categoryId: tMatch.categoryId,
      round: tMatch.roundName || (tMatch.round ? `Round ${tMatch.round}` : 'Round 1'),
      roundName: tMatch.roundName || (tMatch.round ? `Round ${tMatch.round}` : 'Round 1'),
      roundNumber: tMatch.round,
      status: liveMatch?.status || tMatch.status,
      winner: tMatch.winner,
      winnerMatchId: tMatch.winnerMatchId ? tMatch.winnerMatchId.toString() : null,
      sourceMatch1Id: tMatch.sourceMatch1Id ? tMatch.sourceMatch1Id.toString() : null,
      sourceMatch2Id: tMatch.sourceMatch2Id ? tMatch.sourceMatch2Id.toString() : null,
      players: {
        team1: team1Details.map(d => d.fullName),
        team2: team2Details.map(d => d.fullName)
      },
      teams: {
        team1: { players: team1Details },
        team2: { players: team2Details }
      },
      currentScores,
      scores: liveMatch?.scores || currentScores,
      games: gamesSource,
      parameters: tMatch.parameters || { gamesPerMatch: 3, pointsPerGame: 21, goldenPointAt: 20 },
      matchResult: tMatch.matchResult || { winner: null, finalScore: null, totalDurationMins: 0 },
      participation: tMatch.teams,
      gamesPerMatch: tMatch.parameters?.gamesPerMatch || 3,
      pointsPerGame: tMatch.parameters?.pointsPerGame || 21,
      goldenPointAt: tMatch.parameters?.goldenPointAt || 20,
      lockedByDevice: liveMatch?.lockedByDevice || null,
      lockedByDeviceId: liveMatch?.lockedByDeviceId || null
    };
  }

  // --- STANDARD PATH: No pre-fetched data, fetch what we need ---
  const [playersMapDoc, categoriesDoc, liveMatch] = await Promise.all([
    Player.find({}).lean(),
    Category.find({}).lean(),
    Match.findOne({ tournamentMatchId: tMatch._id }).lean()
  ]);

  const playerMap = playersMapDoc.reduce((acc, p) => {
    acc[p.profileId] = { id: p.profileId, fullName: p.fullName, firstName: p.fullName.split(' ')[0] };
    return acc;
  }, {});

  const catMap = categoriesDoc.reduce((acc, c) => {
    acc[c.categoryId] = c.categoryName;
    return acc;
  }, {});

  const team1Details = await getPlayerDetailsGlobal(tMatch.teams?.team1, playerMap);
  const team2Details = await getPlayerDetailsGlobal(tMatch.teams?.team2, playerMap);

  // Priority: Use Live 'Match' record for real-time state (Scores, Games, Serving)
  // Fallback: Use 'TournamentMatch' record for historical or static data
  const gamesSource = liveMatch?.games || tMatch.games || [];
  let currentScores = { team1: 0, team2: 0 };
  if (gamesSource.length > 0) {
    currentScores = gamesSource[gamesSource.length - 1].accumulatedScores || currentScores;
  }

  return {
    dbId: tMatch._id,
    matchId: `TM${tMatch._id}`,
    matchIndex: tMatch.matchIndex,
    courtNumber: tMatch.courtId ? `court_${tMatch.courtId}` : 'court_TBD',
    courtId: tMatch.courtId,
    matchType: (team1Details.length > 1 || team2Details.length > 1) ? 'Doubles' : 'Singles',
    category: resolveCategory(tMatch.categoryId, catMap),
    categoryName: resolveCategory(tMatch.categoryId, catMap),
    categoryId: tMatch.categoryId,
    round: tMatch.roundName || (tMatch.round ? `Round ${tMatch.round}` : 'Round 1'),
    roundNumber: tMatch.round,
    roundLabel: tMatch.roundName || (tMatch.round ? `Round ${tMatch.round}` : 'Round 1'),
    roundName: tMatch.roundName || (tMatch.round ? `Round ${tMatch.round}` : 'Round 1'),
    gamesPerMatch: tMatch.parameters?.gamesPerMatch || 3,
    pointsPerGame: tMatch.parameters?.pointsPerGame || 21,
    goldenPointAt: tMatch.parameters?.goldenPointAt || 20,
    players: {
      team1: team1Details.map(d => d.fullName),
      team2: team2Details.map(d => d.fullName)
    },
    playerIds: {
      team1: team1Details.map(d => d.id),
      team2: team2Details.map(d => d.id)
    },
    teams: {
      team1: { players: team1Details },
      team2: { players: team2Details }
    },
    status: liveMatch?.status || tMatch.status,
    games: gamesSource,
    scores: liveMatch?.scores || currentScores,
    servingPlayer: liveMatch?.servingPlayer || tMatch.servingPlayer,
    tossWinner: liveMatch?.tossWinner || tMatch.tossWinner,
    parameters: tMatch.parameters || { gamesPerMatch: 3, pointsPerGame: 21, goldenPointAt: 20 },
    matchResult: tMatch.matchResult || { winner: null, finalScore: null, totalDurationMins: 0 },
    winnerMatchId: tMatch.winnerMatchId,
    sourceMatch1Id: tMatch.sourceMatch1Id,
    sourceMatch2Id: tMatch.sourceMatch2Id,
    _id: tMatch._id,
    participation: tMatch.teams,
    lockedByDevice: liveMatch?.lockedByDevice || null,
    lockedByDeviceId: liveMatch?.lockedByDeviceId || null
  };
};

const broadcastCourtUpdate = async (courtId) => {
  if (!courtId) return;
  try {
    const court = await Court.findOne({ courtId })
      .populate('activeMatchId upcomingMatchId').lean();
    if (!court) return;

    const mappedMatch = await mapMatchDataGlobal(court.activeMatchId);
    const mappedNextMatch = await mapMatchDataGlobal(court.upcomingMatchId);

    let displayMatch = mappedMatch;
    if (displayMatch && !['Assigned', 'Scheduled', 'Started', 'In Progress', 'Completed', 'Forfeited'].includes(displayMatch.status)) {
      displayMatch = null;
    }
    const numericId = parseInt(String(courtId).replace('court_', ''));
    const lastMatch = await TournamentMatch.findOne({ 
      courtId: String(courtId).replace('court_', ''), 
      status: { $in: ['Completed', 'Forfeited'] } 
    }).sort({ updatedAt: -1 }).lean();
    const mappedLastMatch = lastMatch ? await mapMatchDataGlobal(lastMatch._id) : null;

    const roomName = `spectator_court_${numericId}`;
    io.to(roomName).emit('spectator_update', {
      match: displayMatch,
      nextMatch: mappedNextMatch,
      lastMatch: mappedLastMatch
    });
    console.log(`[Broadcast] Real-time state pushed to ${roomName}`);
  } catch (err) {
    console.error("Court Broadcast Error:", err);
  }
};

/**
 * @openapi
 * /api/court_status/{courtNumber}:
 *   get:
 *     summary: Get status of a specific court (Live Scoring App)
 *     tags: [Live Scoring]
 *     parameters:
 *       - in: path
 *         name: courtNumber
 *         required: true
 *         schema: { type: string }
 *         description: Court number or ID (e.g., court_1)
 *     responses:
 *       200:
 *         description: Success
 */
// REST Endpoint for live scoring app to fetch court data
app.get('/api/court_status/:courtNumber', async (req, res) => {
  try {
    const rawCourtId = req.params.courtNumber.replace('court_', '');
    const court = await Court.findOne({ courtId: rawCourtId })
      .populate('activeMatchId upcomingMatchId').lean();

    if (!court) return res.json({ success: false, message: 'Court not found' });

    let mappedMatch = await mapMatchDataGlobal(court.activeMatchId);
    const mappedNextMatch = await mapMatchDataGlobal(court.upcomingMatchId);

    // Provide visibility for Scheduled/Assigned/Forfeited matches
    if (mappedMatch && !['Assigned', 'Scheduled', 'Started', 'In Progress', 'Completed', 'Forfeited'].includes(mappedMatch.status)) {
      mappedMatch = null;
    }

    if (!mappedMatch) {
      const legacyMatch = await Match.findOne({ courtNumber: req.params.courtNumber }).sort({ createdAt: -1 });
      if (legacyMatch && ['Started', 'In Progress'].includes(legacyMatch.status)) {
        mappedMatch = legacyMatch;
      }
    }

    const lastMatch = await TournamentMatch.findOne({ 
      courtId: rawCourtId, 
      status: { $in: ['Completed', 'Forfeited'] } 
    }).sort({ updatedAt: -1 }).lean();
    const mappedLastMatch = lastMatch ? await mapMatchDataGlobal(lastMatch._id) : null;

    return res.json({ 
      success: true, 
      match: mappedMatch, 
      nextMatch: mappedNextMatch,
      lastMatch: mappedLastMatch
    });
  } catch (err) {
    res.status(500).json({ success: true, message: err.message });
  }
});

// Shared helper for calculating real-time player availability
async function calculateAvailability() {
  const [matches, players, categories, participations] = await Promise.all([
    TournamentMatch.find({}).lean(),
    Player.find({}).lean(),
    Category.find({}).lean(),
    Participation.find({}).lean()
  ]);

  const playerMap = players.reduce((acc, p) => { acc[p.profileId] = p.fullName; return acc; }, {});
  const catMap = categories.reduce((acc, c) => { acc[c.categoryId] = c.categoryName; return acc; }, {});
  const participationMap = participations.reduce((acc, p) => { acc[p._id.toString()] = p; return acc; }, {});

  const getPlayerIds = (partId) => {
    const p = participationMap[partId];
    if (!p) return [];
    return [p.player1Id, p.player2Id].filter(Boolean);
  };

  const busyPlayerIds = new Set();
  matches.forEach(m => {
    if (['Assigned', 'Scheduled', 'Started', 'In Progress'].includes(m.status)) {
      const p1 = getPlayerIds(m.teams?.team1);
      const p2 = getPlayerIds(m.teams?.team2);
      [...p1, ...p2].forEach(id => busyPlayerIds.add(id));
    }
  });

  const playerMatchCount = {};
  matches.forEach(m => {
    if (['Completed', 'Forfeited'].includes(m.status)) {
      const p1 = getPlayerIds(m.teams?.team1);
      const p2 = getPlayerIds(m.teams?.team2);
      [...p1, ...p2].forEach(id => {
        playerMatchCount[id] = (playerMatchCount[id] || 0) + 1;
      });
    }
  });

  const availableEntries = [];
  matches.forEach(m => {
    if (m.status === 'Created' && m.teams?.team1 && m.teams?.team2) {
      const t1Ids = getPlayerIds(m.teams.team1);
      const t2Ids = getPlayerIds(m.teams.team2);
      const allMatchPlayerIds = [...t1Ids, ...t2Ids];
      const isAnyBusy = allMatchPlayerIds.some(id => busyPlayerIds.has(id));

      if (!isAnyBusy) {
        const categoryName = catMap[m.categoryId] || m.categoryId;
        t1Ids.forEach((id, idx) => {
          availableEntries.push({
            playerId: id,
            playerName: playerMap[id] || id,
            categoryId: m.categoryId,
            categoryName,
            matchId: m._id,
            matchType: t1Ids.length > 1 ? 'Doubles' : 'Singles',
            partnerName: t1Ids.length > 1 ? (playerMap[t1Ids.find((_, i) => i !== idx)] || t1Ids.find((_, i) => i !== idx)) : null,
            matchesPlayed: playerMatchCount[id] || 0,
            roundName: m.roundName || `Round ${m.round}`
          });
        });
        t2Ids.forEach((id, idx) => {
          availableEntries.push({
            playerId: id,
            playerName: playerMap[id] || id,
            categoryId: m.categoryId,
            categoryName,
            matchId: m._id,
            matchType: t2Ids.length > 1 ? 'Doubles' : 'Singles',
            partnerName: t2Ids.length > 1 ? (playerMap[t2Ids.find((_, i) => i !== idx)] || t2Ids.find((_, i) => i !== idx)) : null,
            matchesPlayed: playerMatchCount[id] || 0,
            roundName: m.roundName || `Round ${m.round}`
          });
        });
      }
    }
  });
  return availableEntries;
}

/**
 * @openapi
 * /api/scheduler/player-availability:
 *   get:
 *     summary: Calculate real-time player availability based on active and upcoming matches
 *     tags: [Scheduler]
 *     responses:
 *       200:
 *         description: Success
 */
// Player Availability API
app.get('/api/scheduler/player-availability', async (req, res) => {
  try {
    const data = await calculateAvailability();
    data.sort((a, b) => a.playerName.localeCompare(b.playerName));
    res.json({ success: true, data });
  } catch (err) {
    console.error("Player Availability Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @openapi
 * /api/scheduler/upload/{type}:
 *   post:
 *     summary: Bulk upload data (players, categories, participation)
 *     tags: [Data]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [categories, players, participation] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: array, items: { type: object } }
 *     responses:
 *       200:
 *         description: Success
 */
// Tournament Scheduler API
app.post('/api/scheduler/upload/:type', async (req, res) => {
  const { type } = req.params;
  const data = req.body;

  try {
    let model;
    if (type === 'categories') model = Category;
    else if (type === 'players') model = Player;
    else if (type === 'participation') model = Participation;
    else return res.status(400).json({ success: false, message: 'Invalid upload type' });

    // Clear existing data as requested
    await model.deleteMany({});

    // Bulk Insert
    await model.insertMany(data);

    res.json({ success: true, message: `Successfully uploaded ${data.length} ${type}` });
  } catch (err) {
    console.error(`Upload error (${type}):`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/scheduler/view', async (req, res) => {
  try {
    const participations = await Participation.find({}).lean();

    // Resolve IDs manually for the view (or use aggregation)
    // For simplicity and speed for this phase:
    const categories = await Category.find({}).lean();
    const players = await Player.find({}).lean();

    const categoryMap = categories.reduce((acc, c) => { acc[c.categoryId] = c.categoryName; return acc; }, {});
    const playerMap = players.reduce((acc, p) => { acc[p.profileId] = p.fullName; return acc; }, {});

    const resolved = participations.map(p => ({
      _id: p._id,
      categoryName: categoryMap[p.categoryId] || p.categoryId,
      player1: playerMap[p.player1Id] || p.player1Id,
      player2: playerMap[p.player2Id] || (p.player2Id ? p.player2Id : '-'),
      raw: p
    }));

    res.json({ success: true, data: resolved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



/**
 * @openapi
 * /api/scheduler/summary:
 *   get:
 *     summary: Get summary statistics for all categories
 *     tags: [Scheduler]
 *     responses:
 *       200:
 *         description: Success
 */
// Summary Stats API for Landing Page
app.get('/api/scheduler/summary', async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ categoryName: 1 }).lean();
    const allAvailable = await calculateAvailability();
    
    const summary = await Promise.all(categories.map(async (cat) => {
      const allMatches = await TournamentMatch.find({ categoryId: cat.categoryId }).lean();
      const realMatches = allMatches.filter(m => m.status !== 'BYE');
      
      // Count unique available players for this category
      const catAvailable = allAvailable.filter(a => a.categoryId === cat.categoryId);
      const uniquePlayers = new Set(catAvailable.map(a => a.playerId));

      return {
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        total: realMatches.length,
        completed: realMatches.filter(m => m.status === 'Completed' || m.status === 'Forfeited').length,
        ongoing: realMatches.filter(m => m.status === 'In Progress').length,
        playersAvailable: uniquePlayers.size
      };
    }));
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/scheduler/results', async (req, res) => {
  try {
    const results = await TournamentResult.find({}).sort({ categoryName: 1 }).lean();
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.post('/api/test/simulate-bracket', async (req, res) => {
  try {
    const { numPlayers } = req.body;
    const N = parseInt(numPlayers);
    if (isNaN(N) || N < 2) return res.status(400).json({ success: false, message: "Minimum 2 players required" });

    // 1. Generate Seeded Order
    const seededOrder = getSeededOrder(N);

    // 2. Initial Teams (Round 1)
    let currentTeams = seededOrder.map(seed => {
      if (seed > N) return { type: 'bye', name: 'BYE', seed: 999999 };
      return { type: 'player', name: `Player ${seed}`, seed };
    });

    let allMatches = [];
    let round = 1;
    let totalMatchCounter = 0;

    // 3. Generate Rounds
    while (currentTeams.length > 1) {
      let nextRoundTeams = [];
      for (let i = 0; i < currentTeams.length; i += 2) {
        const team1 = currentTeams[i];
        const team2 = currentTeams[i + 1];
        const matchId = `SIM_${round}_${i / 2}`;

        // Simulation Rule: Better seed (lower number) always wins
        let winner;
        let status = 'Completed';
        if (team1.type === 'bye') { winner = team2; status = 'BYE'; }
        else if (team2.type === 'bye') { winner = team1; status = 'BYE'; }
        else winner = (team1.seed < team2.seed) ? team1 : team2;

        const match = {
          _id: matchId,
          matchId: matchId,
          round,
          matchIndex: (i / 2) + 1,
          status,
          team1Name: team1.name,
          team2Name: team2.name,
          matchResult: {
            winner: winner === team1 ? '1' : '2',
            finalScore: "21-0, 21-0"
          },
          // Temp tracking for linkage
          _tempSource1: team1.type === 'match' ? team1.id : null,
          _tempSource2: team2.type === 'match' ? team2.id : null,
          _tempWinner: winner
        };

        allMatches.push(match);
        nextRoundTeams.push({ type: 'match', id: matchId, name: winner.name, seed: winner.seed });
      }
      currentTeams = nextRoundTeams;
      round++;
    }

    // 4. Link Matches (WinnerMatchId)
    allMatches.forEach(m => {
      const parent = allMatches.find(am => am._tempSource1 === m._id || am._tempSource2 === m._id);
      if (parent) m.winnerMatchId = parent._id;
    });

    // 5. Assign Round Names
    const totalRounds = round - 1;
    allMatches.forEach(m => {
      let roundName = `Round ${m.round}`;
      const roundsFromFinal = totalRounds - m.round;
      if (roundsFromFinal === 0) roundName = "Final";
      else if (roundsFromFinal === 1) roundName = "Semi Final";
      else if (roundsFromFinal === 2) roundName = "Quarter Final";
      m.roundName = roundName;
    });

    res.json({ success: true, data: allMatches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// Standard Binary Seeded Pairing helper (e.g. 1 vs 64, 32 vs 33, etc.)
const getSeededOrder = (numTeams) => {
  // Find next power of 2
  const n = Math.pow(2, Math.ceil(Math.log2(numTeams)));
  let seeds = [1, 2];
  while (seeds.length < n) {
    let nextSeeds = [];
    for (let s of seeds) {
      nextSeeds.push(s);
      nextSeeds.push(2 * seeds.length + 1 - s);
    }
    seeds = nextSeeds;
  }
  return seeds;
};

// Helper to find next power of 2
const getNextPowerOfTwo = (n) => Math.pow(2, Math.ceil(Math.log2(n)));

// Internal function to generate brackets for a single category
// [EXPERIMENTAL] Core logic extracted for bulk usage
async function generateBracketsInternal(categoryId) {
  const teams = await Participation.find({ categoryId }).sort({ createdAt: 1 });
  const N = teams.length;
  if (N < 2) throw new Error(`Category ${categoryId}: At least 2 teams required (Found ${N})`);

  await TournamentMatch.deleteMany({ categoryId });
  const paramOverride = APP_CONFIG.DEFAULT_MATCH_PARAMS || { gamesPerMatch: 3, pointsPerGame: 21, goldenPointAt: 20 };

  // 1. Determine Power of 2 Structure
  const n = getNextPowerOfTwo(N);
  const seededOrder = getSeededOrder(n);

  // 2. Map Teams to their Seeded Positions
  const sortedTeams = [...teams].sort((a, b) => {
    const sA = a.seed != null ? a.seed : 9999;
    const sB = b.seed != null ? b.seed : 9999;
    if (sA !== sB) return sA - sB;
    return 0;
  });

  let currentTeams = seededOrder.map(seed => {
    const team = sortedTeams[seed - 1];
    if (team) return { id: team._id.toString(), type: 'team', seed: team.seed || seed };
    return { id: null, type: 'bye' };
  });

  let round = 1;
  let globalMatchIndex = 1;
  const allMatches = [];

  // 3. Generate Rounds using 2^n logic
  while (currentTeams.length > 1) {
    const nextRoundTeams = [];
    const numMatches = currentTeams.length / 2;

    for (let i = 0; i < numMatches; i++) {
      const team1 = currentTeams[i * 2];
      const team2 = currentTeams[i * 2 + 1];

      const match = new TournamentMatch({
        categoryId,
        round,
        matchIndex: globalMatchIndex++,
        status: 'Created',
        teams: {
          team1: team1.type === 'team' ? team1.id : (team1.winnerId || null),
          team2: team2.type === 'team' ? team2.id : (team2.winnerId || null)
        },
        parameters: paramOverride
      });

      let currentWinnerId = null;

      if (team1.type === 'bye' || team2.type === 'bye') {
        match.status = 'BYE';
        if (team1.type === 'team') currentWinnerId = team1.id;
        else if (team2.type === 'team') currentWinnerId = team2.id;
        else if (team1.winnerId) currentWinnerId = team1.winnerId;
        else if (team2.winnerId) currentWinnerId = team2.winnerId;
      }

      nextRoundTeams.push({
        type: 'match',
        id: match._id,
        winnerId: currentWinnerId
      });

      match._tempSource1 = team1.type === 'match' ? team1.id : null;
      match._tempSource2 = team2.type === 'match' ? team2.id : null;

      allMatches.push(match);
    }

    currentTeams = nextRoundTeams;
    round++;
  }

  // 4. Link Matches
  allMatches.forEach(m => {
    if (m._tempSource1) {
      const src = allMatches.find(am => am._id.toString() === m._tempSource1.toString());
      if (src) {
        src.winnerMatchId = m._id;
        m.sourceMatch1Id = m._tempSource1;
      }
    }
    if (m._tempSource2) {
      const src = allMatches.find(am => am._id.toString() === m._tempSource2.toString());
      if (src) {
        src.winnerMatchId = m._id;
        m.sourceMatch2Id = m._tempSource2;
      }
    }
  });

  // 5. Finalize Round Names
  const totalRounds = round - 1;
  allMatches.forEach(m => {
    let roundName = `Round ${m.round}`;
    const roundsFromFinal = totalRounds - m.round;
    if (roundsFromFinal === 0) roundName = "Final";
    else if (roundsFromFinal === 1) roundName = "Semi Final";
    else if (roundsFromFinal === 2) roundName = "Quarter Final";
    m.roundName = roundName;
  });

  // 6. Save All
  await Promise.all(allMatches.map(m => m.save()));
  return allMatches.length;
}


/**
 * @openapi
 * /api/scheduler/generate-bracket/{categoryId}:
 *   post:
 *     summary: Generate single-elimination bracket for a category
 *     tags: [Brackets]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
// Bracket Logic API
app.post('/api/scheduler/generate-bracket/:categoryId', async (req, res) => {
  const { categoryId } = req.params;
  try {
    const matchCount = await generateBracketsInternal(categoryId);
    io.emit('scheduler_update');
    res.json({ success: true, message: `Bracket generated with ${matchCount} matches` });
  } catch (err) {
    console.error("Bracket Gen Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// [EXPERIMENTAL] Bulk Bracket Generation
app.post('/api/scheduler/generate-all-brackets', async (req, res) => {
  try {
    const categories = await Category.find({ categoryId: { $not: /^RR_/ } }).sort({ categoryName: 1 });
    const results = [];

    for (const cat of categories) {
      try {
        const matchCount = await generateBracketsInternal(cat.categoryId);
        results.push({ 
          categoryId: cat.categoryId, 
          categoryName: cat.categoryName, 
          status: 'success', 
          message: `${matchCount} matches generated` 
        });
      } catch (err) {
        results.push({ 
          categoryId: cat.categoryId, 
          categoryName: cat.categoryName, 
          status: 'error', 
          message: err.message 
        });
      }
    }

    io.emit('scheduler_update');
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// [ROUND ROBIN] Standings API
app.get('/api/scheduler/round-robin/standings/:categoryId', async (req, res) => {
  const { categoryId } = req.params;
  try {
    const standings = await RoundRobinStanding.find({ categoryId }).sort({ points: -1, pointDifference: -1 }).lean();
    res.json({ success: true, data: standings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @openapi
 * /api/scheduler/generate-round-robin:
 *   post:
 *     summary: Generate round-robin league for a category
 *     tags: [Brackets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categoryName: { type: string }
 *               playerIds: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Success
 */
// [ROUND ROBIN] Bracket Generation
app.post('/api/scheduler/generate-round-robin', async (req, res) => {
  const { categoryName, playerIds } = req.body;
  if (!categoryName || !playerIds || playerIds.length < 2) {
    return res.status(400).json({ success: false, message: "Invalid category name or players list." });
  }

  try {
    const formattedName = `RR_${categoryName.toUpperCase()}`;
    const categoryId = formattedName.replace(/\s+/g, '_');
    
    // 1. Create or Update Category
    await Category.findOneAndUpdate(
      { categoryId },
      { $set: { categoryName: formattedName } }, // Set name with RR_ prefix
      { upsert: true }
    );

    // 2. Fetch Player Details
    const players = await Player.find({ profileId: { $in: playerIds } }).lean();
    const playerMap = players.reduce((acc, p) => { acc[p.profileId] = p.fullName; return acc; }, {});

    // 3. Resolve Participations (Tied to THIS categoryId)
    const participations = [];
    for (const pId of playerIds) {
      let partic = await Participation.findOne({ categoryId, player1Id: pId, player2Id: null });
      if (!partic) {
        partic = await Participation.create({ categoryId, player1Id: pId, player2Id: null });
      }
      participations.push({ pId, dbId: partic._id });
    }

    // 4. Generate All Combinations (Each pair plays once)
    const matches = [];
    let matchIndex = 0;
    // Clear old matches for this category to avoid duplicates on regen
    await TournamentMatch.deleteMany({ categoryId });
    
    for (let i = 0; i < participations.length; i++) {
      for (let j = i + 1; j < participations.length; j++) {
        const paramOverride = APP_CONFIG.DEFAULT_MATCH_PARAMS || { gamesPerMatch: 3, pointsPerGame: 21, goldenPointAt: 20 };
        matches.push(new TournamentMatch({
          categoryId,
          round: 1, 
          roundName: 'League',
          matchIndex: matchIndex++,
          status: 'Created',
          teams: {
            team1: participations[i].dbId,
            team2: participations[j].dbId
          },
          parameters: paramOverride
        }));
      }
    }

    // 5. Initialize Standings
    await RoundRobinStanding.deleteMany({ categoryId });
    const initialStandings = playerIds.map(pId => ({
      categoryId,
      playerId: pId,
      playerName: playerMap[pId] || 'Unknown Player'
    }));
    await RoundRobinStanding.insertMany(initialStandings);

    // 6. Save Matches
    await Promise.all(matches.map(m => m.save()));

    io.emit('scheduler_update');
    res.json({ success: true, message: `${formattedName} generated with ${matches.length} matches.`, categoryId });
  } catch (err) {
    console.error("RR Gen Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/scheduler/bracket-view/:categoryId', async (req, res) => {
  const { categoryId } = req.params;
  try {
    console.time(`[BracketView] ${categoryId}`);
    // 1. Fetch matches
    const matches = await TournamentMatch.find({ categoryId }).sort({ round: 1, matchIndex: 1 }).lean();
    if (matches.length === 0) {
      console.timeEnd(`[BracketView] ${categoryId}`);
      return res.json({ success: true, data: [] });
    }

    // 2. Identify required participations
    console.time(`[BracketView] ${categoryId} - CollectIDs`);
    const uniqueParticipationIds = new Set();
    matches.forEach(m => {
      if (m.teams?.team1) uniqueParticipationIds.add(m.teams.team1.toString());
      if (m.teams?.team2) uniqueParticipationIds.add(m.teams.team2.toString());
    });
    console.timeEnd(`[BracketView] ${categoryId} - CollectIDs`);

    // 3. Bulk fetch participations
    console.time(`[BracketView] ${categoryId} - FetchData`);
    const participations = await Participation.find({ _id: { $in: Array.from(uniqueParticipationIds) } }).lean();
    const participationsMap = participations.reduce((acc, p) => {
      acc[p._id.toString()] = p;
      return acc;
    }, {});

    // 4. Identify required players
    const uniqueProfileIds = new Set();
    participations.forEach(p => {
      if (p.player1Id) uniqueProfileIds.add(p.player1Id);
      if (p.player2Id) uniqueProfileIds.add(p.player2Id);
    });

    // 5. Bulk fetch shared data (TARGETED)
    const [players, category, liveMatches] = await Promise.all([
      Player.find({ profileId: { $in: Array.from(uniqueProfileIds) } }).lean(),
      Category.findOne({ categoryId }).lean(),
      Match.find({ tournamentMatchId: { $in: matches.map(m => m._id) } }).lean()
    ]);
    console.timeEnd(`[BracketView] ${categoryId} - FetchData`);

    // O(N) efficient maps
    console.time(`[BracketView] ${categoryId} - Mapping`);
    const playerMap = players.reduce((acc, p) => {
      acc[p.profileId] = { id: p.profileId, fullName: p.fullName, firstName: p.fullName.split(' ')[0] };
      return acc;
    }, {});
    const catMap = category ? { [category.categoryId]: category.categoryName } : {};
    const liveMatchesMap = liveMatches.reduce((acc, lm) => {
      acc[lm.tournamentMatchId.toString()] = lm;
      return acc;
    }, {});

    const preFetchedData = { playerMap, catMap, liveMatchesMap, participationsMap };

    // 6. Map matches in parallel
    const mappedMatches = await Promise.all(matches.map(async m => {
      const matchData = await mapMatchDataGlobal(m, preFetchedData);

      return {
        ...matchData,
        team1Name: matchData.players.team1.join(' / ') || (m.teams?.team1 ? "Unknown Team" : (m.sourceMatch1Id ? "TBD" : "BYE")),
        team2Name: matchData.players.team2.join(' / ') || (m.teams?.team2 ? "Unknown Team" : (m.sourceMatch2Id ? "TBD" : "BYE"))
      };
    }));
    console.timeEnd(`[BracketView] ${categoryId} - Mapping`);

    console.timeEnd(`[BracketView] ${categoryId}`);
    res.json({ success: true, data: mappedMatches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @openapi
 * /api/scheduler/match/{matchId}:
 *   patch:
 *     summary: Update a tournament match (assign court, teams, or status)
 *     tags: [Scheduler]
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Conflict or validation error
 */
app.patch('/api/scheduler/match/:matchId', async (req, res) => {
  const { matchId } = req.params;
  const updateData = req.body;

  try {
    const match = await TournamentMatch.findById(matchId);
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

    // Support both 'participation' and 'teams' keys for updates
    if (updateData.participation) {
      updateData.teams = updateData.participation;
    }

    // --- PLAYER CONFLICT VALIDATION ---
    // Trigger check if court is being assigned/changed OR if teams are being updated
    if (updateData.courtId || updateData.participation || updateData.teams) {
      const targetCourtId = updateData.courtId || match.courtId;

      if (targetCourtId) {
        // 1. Resolve players for the match being updated
        const getPlayers = async (tm) => {
          const p1 = [];
          const p2 = [];
          if (tm.teams?.team1) {
            const team1 = await Participation.findById(tm.teams.team1).lean();
            if (team1) p1.push(team1.player1Id, team1.player2Id);
          }
          if (tm.teams?.team2) {
            const team2 = await Participation.findById(tm.teams.team2).lean();
            if (team2) p2.push(team2.player1Id, team2.player2Id);
          }
          return [...new Set([...p1, ...p2])].filter(Boolean);
        };

        const finalTeams = updateData.participation || updateData.teams || match.participation || match.teams;
        const targetPlayerIds = await getPlayers({ teams: finalTeams });

        // 2. Find all other active matches (Assigned, Scheduled, In Progress)
        const activeMatches = await TournamentMatch.find({
          _id: { $ne: matchId },
          courtId: { $ne: null, $exists: true },
          status: { $in: ['Assigned', 'Scheduled', 'Started', 'In Progress'] }
        }).lean();

        // 3. Check for overlaps
        for (const am of activeMatches) {
          const amPlayerIds = await getPlayers(am);

          const conflictId = targetPlayerIds.find(id => amPlayerIds.includes(id));
          if (conflictId) {
            const player = await Player.findOne({ profileId: conflictId }).lean();
            const playerName = player ? player.fullName : conflictId;

            // Fetch category name for the conflicting match
            const category = await Category.findOne({ categoryId: am.categoryId }).lean();
            const categoryName = category ? category.categoryName : am.categoryId;

            const courtNo = String(am.courtId).padStart(2, '0');

            return res.status(400).json({
              success: false,
              message: `Player Not Available: '${playerName}' is already playing or scheduled to play next match in Court ${courtNo} under ${categoryName} category.`
            });
          }
        }
      }
    }
    // --- END VALIDATION ---

    // Lifecycle Transition Logic
    if (updateData.courtId || updateData.courtId === "") {
      const finalParticipation = updateData.participation || updateData.teams || match.participation || match.teams;
      const t1 = finalParticipation?.team1;
      const t2 = finalParticipation?.team2;

      if (updateData.courtId) {
        // Validate: Cannot assign court until both teams are known
        if (!t1 || !t2) {
          return res.status(400).json({ success: false, message: 'Cannot assign a court until both teams are known' });
        }
        updateData.status = 'Assigned';
        console.log(`Match ${matchId} -> Assigned (Court: ${updateData.courtId})`);
      } else if (updateData.courtId === "") {
        updateData.status = 'Created';
        console.log(`Match ${matchId} -> Created (Court removed)`);

        // Remove from Court queue if it was scheduled or assigned
        if (match.courtId) {
          await Court.updateOne(
            { courtId: match.courtId },
            {
              $unset: {
                ...(true ? {} : {}), // Cannot do conditional unset easily
              }
            }
          );
          // simpler to just nullify it if matches
          await Court.updateMany(
            { activeMatchId: match._id },
            { $set: { activeMatchId: null } }
          );
          await Court.updateMany(
            { upcomingMatchId: match._id },
            { $set: { upcomingMatchId: null } }
          );
        }
      }
    }

    // Handle Court Assignment (from Modal Save or Play Button)
    if (updateData.courtId && updateData.courtId !== match.courtId) {
      // 1. CLEANUP: If the match was previously assigned elsewhere, remove it from that court's slots
      if (match.courtId) {
        await Court.updateOne({ courtId: match.courtId, activeMatchId: match._id }, { $set: { activeMatchId: null } });
        await Court.updateOne({ courtId: match.courtId, upcomingMatchId: match._id }, { $set: { upcomingMatchId: null } });
      }

      // 2. ASSIGNMENT: Slot it into the new court
      const court = await Court.findOne({ courtId: updateData.courtId });
      if (!court) return res.status(404).json({ success: false, message: 'Court not found' });

      if (!court.activeMatchId || String(court.activeMatchId) === String(match._id)) {
        court.activeMatchId = match._id;
      } else if (!court.upcomingMatchId || String(court.upcomingMatchId) === String(match._id)) {
        // Strict rule removed

        court.upcomingMatchId = match._id;
      } else {
        return res.status(400).json({ success: false, message: `Court ${updateData.courtId} is fully occupied. Choose another or wait.` });
      }

      await court.save();
      // Automatically set status to Assigned if transitioning from Created
      if (!updateData.status && (match.status === 'Created' || !match.status)) {
        updateData.status = 'Assigned';
      }
      console.log(`[Scheduler] Match ${matchId} re-slotted into ${court.name}.`);
    }
    // NEW: Handle Queue-Jumping (If 'Play' is clicked on the 2nd match in the queue)
    if (updateData.status === 'Scheduled' && match.courtId) {
      const court = await Court.findOne({ courtId: match.courtId });
      if (court && String(court.upcomingMatchId) === String(match._id)) {
        const oldActiveId = court.activeMatchId;

        // PROTECTION: Cannot swap if the active match is already Live
        if (oldActiveId) {
          const oldMatch = await TournamentMatch.findById(oldActiveId);
          if (oldMatch && ['Started', 'In Progress'].includes(oldMatch.status)) {
            return res.status(400).json({
              success: false,
              message: `Cannot start match out of order while the active match is already Live on ${match.courtId}.`
            });
          }

          // Proceed with Swap
          console.log(`[QueueJump] Swapping positions for ${match.courtId}.`);
          court.activeMatchId = match._id;
          court.upcomingMatchId = oldActiveId;
          await court.save();

          // Status Logic: Revert demoted Scheduled match to Assigned
          if (oldMatch && oldMatch.status === 'Scheduled') {
            await TournamentMatch.findByIdAndUpdate(oldActiveId, { $set: { status: 'Assigned' } });
          }
          await syncTournamentMatchToLiveRecord(oldActiveId);
        } else {
          // No active match, just promote this one
          court.activeMatchId = match._id;
          court.upcomingMatchId = null;
          await court.save();
        }
      }
    }

    const oldCourtId = match.courtId;
    const updated = await TournamentMatch.findByIdAndUpdate(matchId, { $set: updateData }, { new: true });

    // SYNC: Create or Update the live 'Match' record for the Scoreboard/Umpire app
    await syncTournamentMatchToLiveRecord(matchId);

    // NEW: Trigger Real-time broadcast to BOTH old and new courts to avoid "ghost" matches
    if (updated.courtId) {
      await broadcastCourtUpdate(updated.courtId);
      io.to(`court_status_${updated.courtId}`).emit('court_reloaded');
    }

    // If the match moved, clear it from the old court's signage via broadcast
    if (oldCourtId && String(oldCourtId) !== String(updated.courtId)) {
      console.log(`[Reassignment] Match moved from ${oldCourtId} to ${updated.courtId}. Broadcasting cleanup to ${oldCourtId}.`);
      await broadcastCourtUpdate(oldCourtId);
      io.to(`court_status_${oldCourtId}`).emit('court_reloaded');
    }

    io.emit('scheduler_update');
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Centralized Sync: Updates or creates the live 'Match' record from a 'TournamentMatch' state
const syncTournamentMatchToLiveRecord = async (tmId) => {
  const tm = await TournamentMatch.findById(tmId).lean();
  if (!tm || !tm.courtId) {
    // If court was removed, we might want to flag the live match as suspended or delete it
    if (tm && !tm.courtId) {
      await Match.deleteOne({ tournamentMatchId: tm._id });
    }
    return;
  }

  // Resolve dependencies for the live match record
  const [players, categories] = await Promise.all([
    Player.find({}).lean(),
    Category.find({}).lean()
  ]);

  const playerMap = players.reduce((acc, p) => { acc[p.profileId] = p; return acc; }, {});
  const catMap = categories.reduce((acc, c) => { acc[c.categoryId] = c.categoryName; return acc; }, {});

  const fetchParticipationDetails = async (pId) => {
    if (!pId) return [];
    const p = await Participation.findById(pId).lean();
    if (!p) return [];
    return [p.player1Id, p.player2Id].filter(Boolean);
  };

  const team1Ids = await fetchParticipationDetails(tm.participation?.team1 || tm.teams?.team1);
  const team2Ids = await fetchParticipationDetails(tm.participation?.team2 || tm.teams?.team2);

  const matchPayload = {
    courtNumber: `court_${String(tm.courtId).padStart(2, '0')}`,
    matchId: `TM${tm._id}`,
    tournamentMatchId: tm._id,
    matchType: (team1Ids.length > 1 || team2Ids.length > 1) ? 'Doubles' : 'Singles',
    category: tm.categoryId, // STORE ID
    round: tm.roundName || `Round ${tm.round}`,
    gamesPerMatch: tm.parameters?.gamesPerMatch || 3,
    pointsPerGame: tm.parameters?.pointsPerGame || 21,
    goldenPointAt: tm.parameters?.goldenPointAt || 0,
    players: {
      team1: team1Ids,
      team2: team2Ids
    },
    // IMPORTANT: Inherit status flow. Assigned in Scheduler -> Assigned in Match. 
    // Play button clicks -> Scheduled.
    status: (tm.status === 'Scheduled' || tm.status === 'Started' || tm.status === 'In Progress' || tm.status === 'Completed' || tm.status === 'Forfeited')
      ? tm.status
      : 'Assigned'
  };

  const updatedLiveMatch = await Match.findOneAndUpdate(
    { tournamentMatchId: tm._id },
    { $set: matchPayload },
    { upsert: true, new: true, runValidators: true }
  );

  console.log(`[Sync] Live match record updated for TM${tm._id} (Status: ${matchPayload.status})`);
  return updatedLiveMatch;
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow Vite dev server
    methods: ["GET", "POST"]
  }
});

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("FATAL ERROR: MONGO_URI is not defined in environment variables.");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB Application Cluster");
    // Initialize Courts from Config
    try {
      const configCourts = APP_CONFIG.COURTS || [];
      for (const courtId of configCourts) {
        const existing = await Court.findOne({ courtId });
        if (!existing) {
          await Court.create({ courtId, name: `Court ${parseInt(courtId, 10)}` });
        }
      }
      console.log(`Initialized ${configCourts.length} Courts.`);
    } catch (err) {
      console.error("Court Initialization Error:", err);
    }
  })
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Helper to enrich match for spectators (Signage/Mobile)
const enrichMatchForSpectators = async (match) => {
  if (!match) return null;
  const matchObj = match.toObject ? match.toObject() : { ...match };

  // Resolve Names from IDs if necessary (for spectators who expect strings)
  const playersMapDoc = await Player.find({}).lean();
  const pMap = playersMapDoc.reduce((acc, p) => {
    acc[p.profileId] = {
      id: p.profileId,
      fullName: p.fullName,
      firstName: p.fullName.split(' ')[0]
    };
    return acc;
  }, {});
  const resolve = (id) => pMap[id] || { id, fullName: id, firstName: id.split(' ')[0] };

  if (matchObj.players) {
    const team1Details = (matchObj.players.team1 || []).map(resolve);
    const team2Details = (matchObj.players.team2 || []).map(resolve);

    // Keep legacy name arrays for simple displays
    matchObj.players = {
      team1: team1Details.map(d => d.fullName),
      team2: team2Details.map(d => d.fullName)
    };

    // Provide new enriched structure for robust business logic
    matchObj.teams = {
      team1: { players: team1Details },
      team2: { players: team2Details }
    };
  }

  // Resolve Categories from ID to Name
  const categories = await Category.find({}).lean();
  const catMap = categories.reduce((acc, c) => { acc[c.categoryId] = c.categoryName; return acc; }, {});

  matchObj.categoryName = catMap[matchObj.category] || matchObj.category;
  // COMPATIBILITY: Force 'category' to hold the name for older signage/mobile UI views
  matchObj.category = matchObj.categoryName;

  // Ensure round/roundName is available
  if (!matchObj.round && matchObj.tournamentMatchId) {
    const tm = await TournamentMatch.findById(matchObj.tournamentMatchId).lean();
    if (tm) matchObj.round = tm.roundName || `Round ${tm.round}`;
  }
  matchObj.roundName = matchObj.round;

  // Resolve IDs back to names for human-readable labels while preserving ID keys
  if (matchObj.servingPlayer) {
    const s = resolve(matchObj.servingPlayer);
    matchObj.servingPlayerId = s.id;
    matchObj.servingPlayer = s.fullName;
  }

  if (matchObj.receivingPlayer) {
    const s = resolve(matchObj.receivingPlayer);
    matchObj.receivingPlayerId = s.id;
    matchObj.receivingPlayer = s.fullName;
  }

  if (matchObj.tossWinner) {
    if (matchObj.tossWinner === "1" || matchObj.tossWinner === "2") {
      matchObj.tossWinnerId = matchObj.tossWinner;
      const teamKey = `team${matchObj.tossWinner}`;
      const players = matchObj.teams?.[teamKey]?.players || [];
      matchObj.tossWinnerName = players.map(p => p.fullName).join(' / ');
      // Legacy fallback
      matchObj.tossWinner = matchObj.tossWinnerName;
    } else {
      const s = resolve(matchObj.tossWinner);
      matchObj.tossWinnerId = s.id;
      matchObj.tossWinner = s.fullName;
    }
  }

  if (matchObj.matchResult?.winner) {
    const winner = matchObj.matchResult.winner;
    if (winner === "1" || winner === "2") {
      matchObj.matchResult.winnerId = winner;
      const teamKey = `team${winner}`;
      const players = matchObj.teams?.[teamKey]?.players || [];
      matchObj.matchResult.winnerName = players.map(p => p.fullName).join(' / ');
      // Legacy fallback
      matchObj.matchResult.winner = matchObj.matchResult.winnerName;
    } else {
      const s = resolve(winner);
      matchObj.matchResult.winnerId = s.id;
      matchObj.matchResult.winnerName = s.fullName;
      matchObj.matchResult.winner = s.fullName;
    }
  }

  // Ensure 'scores' exists at top level for mobile app compatibility
  if (matchObj.games && matchObj.games.length > 0) {
    matchObj.scores = matchObj.games[matchObj.games.length - 1].accumulatedScores || { team1: 0, team2: 0 };
  } else {
    matchObj.scores = { team1: 0, team2: 0 };
  }
  return matchObj;
};

const activeJoins = new Set();

io.on('connection', (socket) => {
  console.log(`Scorer Device Connected: ${socket.id}`);

  // Event 0: Passive Client Sync Configuration
  socket.on('spectate_court', ({ courtNumber }) => {
    const numericId = parseInt(String(courtNumber).replace('court_', ''));
    const roomName = `spectator_court_${numericId}`;
    socket.join(roomName);
    console.log(`[${socket.id}] Joined spectator room: ${roomName}`);
  });
  
  // Dedicated room for Umpire/Scoring apps to receive admin signals (reloads, assignments)
  socket.on('subscribe_to_court', ({ courtId }) => {
    if (!courtId) return;
    const numericId = parseInt(String(courtId).replace('court_', ''));
    const roomName = `court_status_${numericId}`;
    socket.join(roomName);
    console.log(`[${socket.id}] Subscribed to court status: ${roomName}`);
  });

  // Event 1: Attempt to take control of a Court Scoreboard
  socket.on('join_court', async ({ courtData }) => {
    // Basic Mutex: Prevent React Strict Mode double-firing creating identical twin match records
    // wait until the court clears initialization
    while (activeJoins.has(courtData.courtNumber)) {
      await new Promise(r => setTimeout(r, 50));
    }
    activeJoins.add(courtData.courtNumber);

    try {
      console.log(`[${socket.id}] Attempting join_court for ${courtData.courtNumber}...`);
      // Find the pre-created match record (Linked via tournamentMatchId)
      let match = await Match.findOne({
        tournamentMatchId: courtData.dbId
      });
      console.log(`[${socket.id}] Find match by tournamentMatchId result:`, !!match);

      if (!match) {
        console.log(`[${socket.id}] Match not found for TM${courtData.dbId}. Scheduler must assign court first.`);
        socket.emit('court_locked_error', { message: "Match record not found. Please ensure court is assigned in Scheduler." });
        return;
      }

      // Concurrency & Security Check: Has another device locked this match?
      console.log(`[${socket.id}] Lock check: existing lock is ${match.lockedByDevice}`);
      // Allow lock if no locker, OR if locked by exact same socket, OR if locked by identical browser persistent Device ID!
      if (match.lockedByDevice && match.lockedByDevice !== socket.id && match.lockedByDeviceId !== courtData.deviceId) {
        console.log(`[${socket.id}] Lock rejected.`);
        // A lock exists. We only block them if the status is still In Progress or Scheduled.
        // If they drop connection, the disconnect handler below handles clearing the lock.
        socket.emit('court_locked_error', {
          message: "Another device is currently scoring this match. Please wait for them to finish or disconnect."
        });
        return;
      }

      // Grant Control
      console.log(`[${socket.id}] Granting lock and saving...`);
      match.lockedByDevice = socket.id;
      match.lockedByDeviceId = courtData.deviceId;
      await match.save();

      console.log(`[${socket.id}] Emitting court_joined_success...`);
      socket.join(match.matchId);
      
      // Join a court-specific room to receive reloads/broadcasts even if matchId changes
      const numericId = parseInt(match.courtNumber.replace('court_', ''));
      socket.join(`court_status_${numericId}`);
      
      socket.emit('court_joined_success', { match });

    } catch (err) {
      console.error("Court Join Error:", err);
      socket.emit('sync_error', { message: "Internal DB Error on joining court." });
    } finally {
      activeJoins.delete(courtData.courtNumber);
    }
  });

  // Event 2: Toss Finished, Lock match in as Started
  socket.on('start_match', async ({ matchId, tossWinnerId, tossWinner, servingPlayerId, servingPlayer, receivingPlayerId, receivingPlayer }) => {
    console.log(`[${socket.id}] start_match triggered for matchId=${matchId}`);
    try {
      const match = await Match.findOne({ matchId, lockedByDevice: socket.id });
      console.log(`[${socket.id}] start_match find result:`, !!match);
      if (!match) {
        console.log(`[${socket.id}] COULD NOT FIND MATCH to update! matchId=${matchId}, lockedByDevice=${socket.id}. Verify the lock belongs to this socket.`);
        return;
      }

      match.status = 'In Progress';
      console.log(`[StartMatch] Assigning TossWinner=${tossWinnerId}, Serving=${servingPlayerId}, Receiving=${receivingPlayerId}`);
      match.tossWinner = tossWinnerId || tossWinner; // "1" or "2"
      match.servingPlayer = servingPlayerId || servingPlayer; // Prefer ID
      match.receivingPlayer = receivingPlayerId || receivingPlayer; // Prefer ID
      match.startTime = new Date();

      // Ensure we don't push game 1 twice if the umpire clicks start twice or refreshes
      if (match.games.length === 0) {
        match.games.push({
          gameNumber: 1,
          durationMins: 0,
          accumulatedScores: { team1: 0, team2: 0 },
          pointArrays: {}
        });
      }

      const rawCourtId = String(match.courtNumber).replace('court_', '');

      // EXPLICIT SYNC: Use the stored tournamentMatchId to update precisely the right record
      let tm = null;
      if (match.tournamentMatchId) {
        tm = await TournamentMatch.findByIdAndUpdate(match.tournamentMatchId,
          {
            status: 'In Progress', // Change from 'Started' to 'In Progress' for LIVE red badge
            games: match.games,
            servingPlayer: servingPlayerId || servingPlayer,
            tossWinner: tossWinnerId || tossWinner
          },
          { new: true }
        );

        if (tm && tm.courtId) {
          const court = await Court.findOne({ courtId: tm.courtId });
          // AUTO QUEUE JUMP: If the umpire started the upcoming match, swap it to active now
          if (court && String(court.upcomingMatchId) === String(tm._id)) {
            console.log(`[UmpireQueueJump] Match ${tm._id} started. Swapping upcoming to active on Court ${tm.courtId}.`);
            const oldActiveId = court.activeMatchId;
            court.activeMatchId = tm._id;
            court.upcomingMatchId = oldActiveId;
            await court.save();

            // Revert previous active if it hadn't started
            if (oldActiveId) {
              const oldTM = await TournamentMatch.findById(oldActiveId);
              if (oldTM && oldTM.status === 'Scheduled') {
                await TournamentMatch.findByIdAndUpdate(oldActiveId, { $set: { status: 'Assigned' } });
                await syncTournamentMatchToLiveRecord(oldActiveId);
              }
            }
          }
          // Broadcast the update so signage/mobile/scheduler all see the new Live match instantly
          await broadcastCourtUpdate(tm.courtId);
        }
      } else {
        // Fallback legacy logic for orphaned live matches
        tm = await TournamentMatch.findOneAndUpdate(
          { courtId: rawCourtId, status: { $in: ['Scheduled', 'Assigned', 'Started', 'In Progress'] } },
          {
            status: 'In Progress',
            games: match.games,
            servingPlayer: servingPlayerId || servingPlayer,
            tossWinner: tossWinnerId || tossWinner
          },
          { returnDocument: 'after', sort: { round: -1, matchIndex: 1 } }
        );
      }

      if (tm) io.emit('scheduler_update');

      console.log(`[${socket.id}] Updating match state to In Progress with toss details...`);
      match.markModified('games');
      await match.save();
      console.log(`[${socket.id}] start_match save success`);
      socket.emit('sync_success', { action: 'start_match', match });
      const enriched = await enrichMatchForSpectators(match);
      const numericId = parseInt(String(match.courtNumber).replace('court_', ''));
      io.to(match.matchId).emit('spectator_update', { match: enriched }); // Broadcast to future spectators
      io.to(`spectator_court_${numericId}`).emit('spectator_update', { match: enriched }); // Broadcast directly to Signage
      io.emit('scheduler_update'); // Broadcast to Scheduler View
    } catch (err) {
      console.error(`[${socket.id}] start_match error:`, err);
    }
  });

  // Event 3: Master Sync Event (Applies point arrays, accumulative scores, and durations per UI action)
  socket.on('sync_live_state', async ({ matchId, activeGameIndex, gameSnapshot, durations, servingPlayerId, servingPlayer, goldenPointActive, isGameOver }) => {
    try {
      // Sanitize keys to avoid Mongoose/MongoDB dot-key errors
      const safePointArrays = {};
      if (gameSnapshot.pointArrays) {
        Object.keys(gameSnapshot.pointArrays).forEach(k => {
          safePointArrays[k.replace(/\./g, '_')] = gameSnapshot.pointArrays[k];
        });
      }

      const updateSet = {
        [`games.${activeGameIndex}.accumulatedScores`]: gameSnapshot.accumulatedScores,
        [`games.${activeGameIndex}.pointArrays`]: safePointArrays,
      };

      if (durations) {
        updateSet[`games.${activeGameIndex}.durationMins`] = durations.gameMins;
        updateSet['matchResult.totalDurationMins'] = durations.matchMins;
      }

      if (servingPlayerId) updateSet['servingPlayer'] = servingPlayerId;
      else if (servingPlayer) updateSet['servingPlayer'] = servingPlayer;
      if (goldenPointActive !== undefined) updateSet['goldenPointActive'] = goldenPointActive;
      if (isGameOver !== undefined) updateSet['currentGameIsOver'] = isGameOver;

      if (isGameOver === true) {
        updateSet[`games.${activeGameIndex}.status`] = 'Completed';
      }

      const match = await Match.findOneAndUpdate(
        { matchId, lockedByDevice: socket.id },
        { $set: updateSet },
        { returnDocument: 'after', runValidators: true }
      );

      if (!match) return;

      // SYNC TO TOURNAMENT MATCH (Source of truth for Scheduler/Signage)
      if (match.tournamentMatchId) {
        await TournamentMatch.findByIdAndUpdate(match.tournamentMatchId, {
          $set: {
            games: match.games,
            status: match.status,
            servingPlayer: match.servingPlayer
          }
        }).catch(e => console.warn("Failed to sync Live State to TM:", e));

        // Only alert the scheduler if the status changed meaningfully (like a Game Over)
        if (isGameOver) {
          io.emit('scheduler_update');
        }
      }

      const enrichedMatch = await enrichMatchForSpectators(match);
      const numericId = parseInt(String(match.courtNumber).replace('court_', ''));
      io.to(match.matchId).emit('spectator_update', { match: enrichedMatch });
      io.to(`spectator_court_${numericId}`).emit('spectator_update', { match: enrichedMatch });
    } catch (err) {
      console.error(`[${socket.id}] sync_live_state error:`, err);
    }
  });

  // Event 4: Push next game block
  socket.on('start_next_game', async ({ matchId, newGameNumber }) => {
    try {
      const match = await Match.findOneAndUpdate(
        { matchId, lockedByDevice: socket.id },
        {
          $push: { games: { gameNumber: newGameNumber, status: 'In Progress', accumulatedScores: { team1: 0, team2: 0 }, pointArrays: {} } },
          $set: { currentGameIsOver: false, goldenPointActive: false }
        },
        { returnDocument: 'after' }
      );

      if (match && match.tournamentMatchId) {
        await TournamentMatch.findByIdAndUpdate(match.tournamentMatchId, {
          $set: { games: match.games, status: 'In Progress' }
        });
        io.emit('scheduler_update');
      }

      if (match) {
        const enrichedMatch = await enrichMatchForSpectators(match);
        const numericId = parseInt(String(match.courtNumber).replace('court_', ''));
        io.to(match.matchId).emit('spectator_update', { match: enrichedMatch });
        io.to(`spectator_court_${numericId}`).emit('spectator_update', { match: enrichedMatch });
      }
    } catch (err) {
      console.error(`[${socket.id}] start_next_game error:`, err);
    }
  });

  // NEW: Reusable logic to handle Match completion and tournament progression
  const completeTournamentMatch = async (tmId, resultData, isForfeit = false, finalGames = null) => {
    try {
      const tm = await TournamentMatch.findByIdAndUpdate(tmId, {
        status: isForfeit ? 'Forfeited' : 'Completed',
        matchResult: resultData,
        ...(finalGames && { games: finalGames })
      }, { new: true });

      if (!tm) return null;

      // Broadcast final result to spectators before shifting the court queue
      if (tm.courtId) {
        const finalMatchData = await mapMatchDataGlobal(tm._id);
        const numericId = parseInt(String(tm.courtId).replace('court_', ''));
        io.to(`spectator_court_${numericId}`).emit('spectator_update', { match: finalMatchData });
      }

      // Broadcast cleanup to the court
      if (tm.courtId) {
        const court = await Court.findOne({ courtId: tm.courtId });
        if (court) {
          // If the finished match was the active one, shift the queue
          if (String(court.activeMatchId) === String(tm._id)) {
            court.activeMatchId = court.upcomingMatchId;
            court.upcomingMatchId = null;
            court.status = 'Available';
            await court.save();
          } else if (String(court.upcomingMatchId) === String(tm._id)) {
            court.upcomingMatchId = null;
            court.status = 'Available';
            await court.save();
          }
        }
        await broadcastCourtUpdate(tm.courtId);
        const numericId = parseInt(String(tm.courtId).replace('court_', ''));
        io.to(`court_status_${numericId}`).emit('court_reloaded');
      }

      // [ROUND ROBIN STANDINGS UPDATE]
      if (tm.categoryId && tm.categoryId.startsWith('RR_')) {
        console.log(`[RoundRobin] Updating standings for category: ${tm.categoryId}`);
        try {
          const t1Id = parseInt(resultData.winner) === 1 ? tm.teams.team1 : tm.teams.team2;
          const t2Id = parseInt(resultData.winner) === 1 ? tm.teams.team2 : tm.teams.team1;

          const getPlayerId = async (particId) => {
            const p = await Participation.findById(particId).lean();
            return p?.player1Id;
          };

          const p1Id = await getPlayerId(tm.teams.team1);
          const p2Id = await getPlayerId(tm.teams.team2);

          // Calculate point difference from games
          let p1Points = 0;
          let p2Points = 0;
          let p1Games = 0;
          let p2Games = 0;

          if (tm.games) {
            tm.games.forEach(g => {
              const s1 = g.accumulatedScores?.team1 || 0;
              const s2 = g.accumulatedScores?.team2 || 0;
              p1Points += s1;
              p2Points += s2;
              if (s1 > s2) p1Games++;
              else if (s2 > s1) p2Games++;
            });
          }

          const winnerTeam = parseInt(resultData.winner);
          
          // Update Winner
          const winnerPId = winnerTeam === 1 ? p1Id : p2Id;
          const winnerPointsDiff = winnerTeam === 1 ? (p1Points - p2Points) : (p2Points - p1Points);
          const winnerGamesWon = winnerTeam === 1 ? p1Games : p2Games;
          const winnerGamesLost = winnerTeam === 1 ? p2Games : p1Games;

          await RoundRobinStanding.findOneAndUpdate(
            { categoryId: tm.categoryId, playerId: winnerPId },
            { 
              $inc: { 
                points: 2, 
                wins: 1, 
                matchesPlayed: 1, 
                pointDifference: winnerPointsDiff,
                gamesWon: winnerGamesWon,
                gamesLost: winnerGamesLost
              } 
            }
          );

          // Update Loser
          const loserPId = winnerTeam === 1 ? p2Id : p1Id;
          const loserPointsDiff = winnerTeam === 1 ? (p2Points - p1Points) : (p1Points - p2Points);
          const loserGamesWon = winnerTeam === 1 ? p2Games : p1Games;
          const loserGamesLost = winnerTeam === 1 ? p1Games : p2Games;

          await RoundRobinStanding.findOneAndUpdate(
            { categoryId: tm.categoryId, playerId: loserPId },
            { 
              $inc: { 
                points: 0, 
                losses: 1, 
                matchesPlayed: 1, 
                pointDifference: loserPointsDiff,
                gamesWon: loserGamesWon,
                gamesLost: loserGamesLost
              } 
            }
          );
          
          console.log(`[RoundRobin] Standings updated successfully.`);
          await updateCategoryResult(tm.categoryId);
        } catch (rrErr) {
          console.error("Round Robin Standings Update Error:", rrErr);
        }
      }

      // BRACKET PROGRESSION: Advance winner to the next round match slot!
      if (tm.winnerMatchId) {
        const nextMatch = await TournamentMatch.findById(tm.winnerMatchId);
        if (nextMatch) {
          let winningParticipationId = null;
          const winnerId = parseInt(resultData.winner);

          if (winnerId === 1) winningParticipationId = tm.teams.team1;
          else if (winnerId === 2) winningParticipationId = tm.teams.team2;

          if (winningParticipationId) {
            console.log(`[Bracket] Advancing runner: ${winningParticipationId} to Match: ${nextMatch._id}`);
            if (nextMatch.sourceMatch1Id && nextMatch.sourceMatch1Id.equals(tm._id)) {
              nextMatch.set('teams.team1', winningParticipationId);
            } else if (nextMatch.sourceMatch2Id && nextMatch.sourceMatch2Id.equals(tm._id)) {
              nextMatch.set('teams.team2', winningParticipationId);
            }
            if (nextMatch.teams.team1 && nextMatch.teams.team2) {
              nextMatch.status = 'Created';
            }
            await nextMatch.save();
          }
        }
      }

      // [KNOCKOUT RESULT UPDATE]
      if (tm.roundName === 'Final' || tm.roundName === 'Semi Final') {
        await updateCategoryResult(tm.categoryId);
      }

      return tm;
    } catch (err) {
      console.error("Completion Helper Error:", err);
      return null;
    }
  };

  // HELPER: Centralized Result Calculator for the Podium
  const updateCategoryResult = async (categoryId) => {
    try {
      const category = await Category.findOne({ categoryId }).lean();
      if (!category) return;

      let resultData = {
        categoryId,
        categoryName: category.categoryName,
        format: categoryId.startsWith('RR_') ? 'RoundRobin' : 'Knockout',
        winner: '-',
        runnerUp: '-',
        semi1: '-',
        semi2: '-'
      };

      if (resultData.format === 'RoundRobin') {
        // Only push to Results table if every match in the league is finished
        const incompleteCount = await TournamentMatch.countDocuments({ 
          categoryId, 
          status: { $nin: ['Completed', 'Forfeited', 'BYE'] } 
        });

        if (incompleteCount > 0) {
          console.log(`[ResultUpdate] RR Category ${categoryId}: ${incompleteCount} matches remaining. Postponing podium push.`);
          return;
        }

        // 1. Fetch Top 4 from Standings
        const standings = await RoundRobinStanding.find({ categoryId }).sort({ points: -1, pointDifference: -1 }).limit(4).lean();
        if (standings[0]) resultData.winner = standings[0].playerName;
        if (standings[1]) resultData.runnerUp = standings[1].playerName;
        if (standings[2]) resultData.semi1 = standings[2].playerName;
        if (standings[3]) resultData.semi2 = standings[3].playerName;
      } else {
        // 2. Fetch from Knockout Matches
        const matches = await TournamentMatch.find({ categoryId }).lean();
        const participations = await Participation.find({ categoryId }).lean();
        const players = await Player.find({}).lean();
        const playerMap = players.reduce((acc, p) => { acc[p.profileId] = p.fullName; return acc; }, {});

        const getTeamName = (pId) => {
          const part = participations.find(p => p._id.toString() === pId?.toString());
          if (!part) return 'TBD';
          const p1 = playerMap[part.player1Id] || part.player1Id;
          const p2 = part.player2Id ? (playerMap[part.player2Id] || part.player2Id) : null;
          return p2 ? `${p1} / ${p2}` : p1;
        };

        const finalMatch = matches.find(m => m.roundName === 'Final');
        if (finalMatch && (finalMatch.status === 'Completed' || finalMatch.status === 'Forfeited')) {
          const winId = finalMatch.matchResult?.winner;
          resultData.winner = winId === '1' ? getTeamName(finalMatch.teams.team1) : getTeamName(finalMatch.teams.team2);
          resultData.runnerUp = winId === '1' ? getTeamName(finalMatch.teams.team2) : getTeamName(finalMatch.teams.team1);
        }

        const semiMatches = matches.filter(m => m.roundName === 'Semi Final');
        const semiLosers = semiMatches.map(m => {
          if (m.status === 'Completed' || m.status === 'Forfeited') {
            const winId = m.matchResult?.winner;
            return winId === '1' ? getTeamName(m.teams.team2) : getTeamName(m.teams.team1);
          }
          return '-';
        }).filter(n => n !== '-' && n !== 'TBD');

        resultData.semi1 = semiLosers[0] || '-';
        resultData.semi2 = semiLosers[1] || '-';
      }

      await TournamentResult.findOneAndUpdate(
        { categoryId },
        { $set: resultData },
        { upsert: true }
      );
      console.log(`[ResultUpdate] Category ${categoryId} updated in TournamentResult.`);
    } catch (err) {
      console.error("Update Result Error:", err);
    }
  };

  // API: Forfeit Match manually from Scheduler
  app.post('/api/scheduler/match/:matchId/forfeit', async (req, res) => {
    const { matchId } = req.params;
    const { forfeitingTeamId } = req.body; // 1 or 2

    try {
      const winnerId = (parseInt(forfeitingTeamId) === 1) ? 2 : 1;
      const resultData = {
        winner: String(winnerId),
        finalScore: "Forfeit",
        totalDurationMins: 0
      };

      const tm = await completeTournamentMatch(matchId, resultData, true);
      if (!tm) return res.status(404).json({ success: false, message: 'Match not found' });

      // Also clear the live 'Match' record if it exists
      await Match.deleteOne({ tournamentMatchId: matchId });

      io.emit('scheduler_update');
      res.json({ success: true, message: 'Match forfeited successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Event 5: Terminate / Finalize
  socket.on('complete_match', async ({ matchId, winner, winnerId, finalScore, durations }) => {
    console.log(`[${socket.id}] complete_match triggered for matchId=${matchId}, winner=${winner}, winnerId=${winnerId}`);
    try {
      const match = await Match.findOneAndUpdate(
        { matchId, lockedByDevice: socket.id },
        {
          $set: {
            status: 'Completed',
            lockedByDevice: null,
            'matchResult.winner': String(winnerId || winner),
            'matchResult.finalScore': finalScore,
            'matchResult.totalDurationMins': durations.matchMins
          }
        },
        { returnDocument: 'after' }
      );
      if (!match) return;

      const resultData = {
        winner: String(winnerId || winner),
        finalScore,
        totalDurationMins: durations?.matchMins
      };

      if (match.tournamentMatchId) {
        await completeTournamentMatch(match.tournamentMatchId, resultData, false, match.games);
      }

      io.emit('scheduler_update');
    } catch (err) {
      console.error(`[${socket.id}] complete_match error:`, err);
    }
  });

  // Safe Disconnect Handler
  socket.on('disconnect', async () => {
    console.log(`Device Disconnected: ${socket.id}`);
    try {
      // Find any matches locked by this dropped socket and free them so another umpire 
      // can reconnect and take over control where they left off!
      await Match.updateMany(
        { lockedByDevice: socket.id },
        { $set: { lockedByDevice: null } }
      );
    } catch (err) {
      console.error("Disconnect cleanup error:", err);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Badminton Backend is blasting realtime signals on port ${PORT}`);
});
