import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { useTimer } from '../hooks/useTimer';
import io from 'socket.io-client';
import { CONFIG } from '../utils/config';

const MatchContext = createContext(null);

export const useMatch = () => useContext(MatchContext);

export const MatchProvider = ({ children }) => {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [currentCourtId, setCurrentCourtId] = useState(null);

  // Setup State
  const [tossWinner, setTossWinner] = useState(null);
  const [teamOnLeft, setTeamOnLeft] = useState(1); // 1 = team1 on left, 2 = team2 on left
  const [servingTeam, setServingTeam] = useState(null); // 1 or 2
  const [initialSetupDone, setInitialSetupDone] = useState(false);

  // Match State
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [gamesWon, setGamesWon] = useState({ team1: 0, team2: 0 });
  const [currentGame, setCurrentGame] = useState(1);
  const [gameHistory, setGameHistory] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isMatchOver, setIsMatchOver] = useState(false);
  const [matchStarted, setMatchStarted] = useState(false);
  const [gameSubmissionPending, setGameSubmissionPending] = useState(false);
  const [goldenPointActive, setGoldenPointActive] = useState(false);

  // Undo Functionality State
  const [undoState, setUndoState] = useState(null);
  const [pendingWinDetails, setPendingWinDetails] = useState(null);
  
  // Realtime Live Point Tracking Arrays
  const [pointArrays, setPointArrays] = useState({});

  // Player Positions
  // Positions are tracked relative to the court halves (left/right) -> 'L' or 'R'
  // When viewed from above, Team on Left has a top and bottom.
  // We will call the sides 'top' and 'bottom' strictly for rendering, but
  // Badminton rules use 'Right' (even) and 'Left' (odd) service courts.
  // For the "Team on Left" side of the screen, the 'Right' service court is at the 'bottom' of the screen, and 'Left' is 'top'.
  // For the "Team on Right" side of the screen, the 'Right' service court is at the 'top', and 'Left' is 'bottom'.
  const [team1Pos, setTeam1Pos] = useState({ evenSide: null, oddSide: null });
  const [team2Pos, setTeam2Pos] = useState({ evenSide: null, oddSide: null });
  const [activeServer, setActiveServer] = useState(null); // player name

  const matchTimer = useTimer();
  const gameTimer = useTimer();

  const fetchMatchData = useCallback(async (courtId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/api/court_status/${courtId}`);
      if (!res.ok) throw new Error("Backend API unreachable");
      const respData = await res.json();
      
      if (!respData.success || !respData.match) {
         throw new Error(respData.message || "No match assigned yet for this court");
      }
      
      let data = respData.match;
      
      // Concurrency: Use a persistent Device ID to identify this specific browser/tablet
      let persistentDeviceId = localStorage.getItem('scorer_device_id');
      if (!persistentDeviceId) {
        persistentDeviceId = `DEV-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
        localStorage.setItem('scorer_device_id', persistentDeviceId);
      }
      
      // CRITICAL: Prevent simultaneous access from multiple devices
      if (data.lockedByDeviceId && data.lockedByDeviceId !== persistentDeviceId) {
         throw new Error("Access Denied: This court is already being scored by another device.");
      }

      data.deviceId = persistentDeviceId;
      data.noOfGames = data.gamesPerMatch;
      data.team1Name = data.teams.team1.players.map(p => p.fullName).join(' / ');
      data.team2Name = data.teams.team2.players.map(p => p.fullName).join(' / ');
      data.category = data.categoryName;
      data.categoryId = data.category;

      setPointArrays({ "team1": [], "team2": [] });

      if (data.status === 'Assigned' || data.status === 'Forfeited') {
         throw new Error("No match assigned yet for this court");
      }

      if (data.status === 'In Progress' || data.status === 'Completed') {
         // Recovery logic simplified for brevity but maintaining essential structure
         const wins = { team1: 0, team2: 0 };
         const history = (data.games || []).map(g => ({
            game: g.gameNumber,
            scores: g.accumulatedScores,
            winner: g.accumulatedScores?.team1 > g.accumulatedScores?.team2 ? 1 : 2
         }));
         for (let i = 0; i < history.length - 1; i++) wins[`team${history[i].winner}`]++;
         
         setGameHistory(history.slice(0, -1));
         setGamesWon(wins);
         setCurrentGame(data.games?.length || 1);
         const activeGame = data.games?.[data.games.length - 1];
         if (activeGame) {
            setScores(activeGame.accumulatedScores || { team1: 0, team2: 0 });
            setPointArrays(activeGame.pointArrays || { team1: [], team2: [] });
         }
         setInitialSetupDone(true);
         setMatchStarted(true);
         setTossWinner(data.tossWinner === data.team1Name ? 1 : 2);
      }

      setMatch(data);
      if (data.matchType?.includes('Singles')) {
        const t1 = data.teams.team1.players[0];
        const t2 = data.teams.team2.players[0];
        setTeam1Pos({ evenSide: t1, oddSide: t1 });
        setTeam2Pos({ evenSide: t2, oddSide: t2 });
      } else {
        const t1 = data.teams.team1.players;
        const t2 = data.teams.team2.players;
        setTeam1Pos({ evenSide: t1[0], oddSide: t1[1] });
        setTeam2Pos({ evenSide: t2[0], oddSide: t2[1] });
      }
      
      setLoading(false);
      if (socket) socket.emit('join_court', { courtData: data });

    } catch (err) {
      setMatch(null);
      setInitialSetupDone(false);
      setError(err.message);
      setLoading(false);
    }
  }, [socket]);

  // Persistent Socket & Admin Sync
  useEffect(() => {
    // Singleton pattern for dev mode HMR
    if (window.socketInstance) {
      setSocket(window.socketInstance);
      return;
    }

    const newSocket = io(CONFIG.BACKEND_URL, { 
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 10000
    });

    window.socketInstance = newSocket;
    setSocket(newSocket);

    return () => {
      // Keep socket alive during HMR
    };
  }, []); 

  // Handle reloads and subscription when court changes
  useEffect(() => {
    if (!socket) return;

    const handleReload = () => {
       // CRITICAL: If the match is already over locally, don't reload!
       // This allows the Umpire to see the "Match Complete" modal before being kicked out.
       if (isMatchOver) {
         console.log("[Socket] Match over locally, ignoring reload signal to preserve UI modal.");
         return;
       }

       const pathParts = window.location.pathname.split('/');
       const cId = pathParts[pathParts.length - 1];
       if (cId && cId.startsWith('court_')) {
         console.log(`[Socket] Refreshing court ${cId} due to admin reload...`);
         fetchMatchData(cId);
       }
    };

    socket.on('court_reloaded', handleReload);
    
    socket.on('court_locked_error', ({ message }) => {
       setError(message);
       setMatch(null);
    });

    socket.on('connect', () => {
      console.log("[Socket] Reconnected to backend.");
      const pathParts = window.location.pathname.split('/');
      const cId = pathParts[pathParts.length - 1];
      if (cId && cId.startsWith('court_')) {
        socket.emit('subscribe_to_court', { courtId: cId });
      }
    });

    // Initial subscription
    const pathParts = window.location.pathname.split('/');
    const cId = pathParts[pathParts.length - 1];
    if (cId && cId.startsWith('court_')) {
      socket.emit('subscribe_to_court', { courtId: cId });
    }

    return () => {
      socket.off('court_reloaded', handleReload);
    };
  }, [socket, fetchMatchData, isMatchOver]);

  // Re-join court when socket or match ready
  useEffect(() => {
    if (socket && match && !initialSetupDone) {
      socket.emit('join_court', { courtData: match });
    }
  }, [socket, match, initialSetupDone]);

  const completeSetup = (setupData) => {
    setTossWinner(setupData.tossWinner);
    setTeamOnLeft(setupData.teamOnLeft);
    setServingTeam(setupData.servingTeam);
    setActiveServer(setupData.initialServer); 

    // adjust positions for 0-0
    if (match.matchType?.includes('Doubles')) {
      const { initialServer, initialReceiver, servingTeam } = setupData;
      const recTeamId = servingTeam === 1 ? 2 : 1;

      const servingPlayers = servingTeam === 1 ? match.teams.team1.players : match.teams.team2.players;
      const initialServerObj = initialServer;
      const serverPartnerObj = servingPlayers.find(p => p.id !== initialServer.id);

      const receivingPlayers = recTeamId === 1 ? match.teams.team1.players : match.teams.team2.players;
      const initialReceiverObj = initialReceiver;
      const receiverPartnerObj = receivingPlayers.find(p => p.id !== initialReceiver.id);

      if (servingTeam === 1) {
        setTeam1Pos({ evenSide: initialServerObj, oddSide: serverPartnerObj });
        setTeam2Pos({ evenSide: initialReceiverObj, oddSide: receiverPartnerObj });
      } else {
        setTeam2Pos({ evenSide: initialServerObj, oddSide: serverPartnerObj });
        setTeam1Pos({ evenSide: initialReceiverObj, oddSide: receiverPartnerObj });
      }
    } else {
      // Singles: Both sides refer to the same player object
      const { servingTeam } = setupData;
      const team1Obj = match.teams.team1.players[0];
      const team2Obj = match.teams.team2.players[0];
      
      const servingObj = servingTeam === 1 ? team1Obj : team2Obj;
      const receivingObj = servingTeam === 1 ? team2Obj : team1Obj;

      if (servingTeam === 1) {
        setTeam1Pos({ evenSide: servingObj, oddSide: servingObj });
        setTeam2Pos({ evenSide: receivingObj, oddSide: receivingObj });
      } else {
        setTeam2Pos({ evenSide: servingObj, oddSide: servingObj });
        setTeam1Pos({ evenSide: receivingObj, oddSide: receivingObj });
      }
    }

    setInitialSetupDone(true);
  };

  const startMatch = (setupData = null) => {
    setMatchStarted(true);
    matchTimer.start();
    gameTimer.start();

    // Use passed setupData to avoid async state stale-ness during initialization
    const w = setupData?.tossWinner || tossWinner;
    const s = setupData?.initialServer || activeServer;
    
    let r = setupData?.initialReceiver;
    if (!r) {
        // Fallback for singles or if not provided
        const stId = setupData?.servingTeam || servingTeam;
        const recTeamId = stId === 1 ? 2 : 1;
        r = match.teams?.[`team${recTeamId}`]?.players?.[0];
    }

    // Broadcast Toss details to backend to officially stamp the StartTime
    if (socket) {
        const tossWinnerName = w === 1 ? match.team1Name : (w === 2 ? match.team2Name : null);
        
        socket.emit('start_match', { 
          matchId: match.matchId, 
          tossWinnerId: w ? String(w) : null, // team index "1" or "2"
          tossWinner: tossWinnerName, 
          servingPlayerId: s?.id,
          servingPlayer: s?.id, 
          receivingPlayerId: r?.id,
          receivingPlayer: r?.id
        });
    }
  };

  const handleGameOver = useCallback((finalScores, winningTeam) => {
    // handleGameOver is now purely for UI notification and history recording.
    // Logic for sync and timer stopping moved to addPoint for zero-latency response.
    if (isGameOver) return;

    setIsGameOver(true);
    setGameSubmissionPending(true);

    console.log(`[REACTIVE] Game ${currentGame} finished notification. Winner: Team ${winningTeam}`);

    // Record the finished game
    setGameHistory(prevHistory => {
      if (prevHistory.some(g => g.game === currentGame)) return prevHistory;
      return [...prevHistory, {
        game: currentGame,
        scores: finalScores,
        winner: winningTeam
      }];
    });

    // Increment wins and check for match completion UI state
    setGamesWon(prevWins => {
      const nextWins = { ...prevWins };
      nextWins[`team${winningTeam}`] += 1;

      const threshold = Math.ceil(match.noOfGames / 2);
      if (nextWins[`team${winningTeam}`] >= threshold) {
        setIsMatchOver(true);
      }
      return nextWins;
    });
  }, [currentGame, isGameOver, match]);

  const submitGameResults = () => {
    // submitGameResults is now a UI-only action that confirms the umpire has read the modal.
    // All actual DB syncing happens inside addPoint.
    setGameSubmissionPending(false);
  };



  const addPoint = (scoringTeam) => {
    if (isGameOver || isMatchOver || pendingWinDetails) return;

    // 0. Capture exact state BEFORE modifying it for potential Undo
    setUndoState({
      scores: { ...scores },
      pointArrays: { ...pointArrays },
      servingTeam,
      activeServer,
      team1Pos: { ...team1Pos },
      team2Pos: { ...team2Pos },
      goldenPointActive
    });

    // 1. Calculate NEW Scores
    const newTeam1Score = scoringTeam === 1 ? scores.team1 + 1 : scores.team1;
    const newTeam2Score = scoringTeam === 2 ? scores.team2 + 1 : scores.team2;
    const scoringTeamPoints = scoringTeam === 1 ? newTeam1Score : newTeam2Score;
    const isEven = scoringTeamPoints % 2 === 0;

    // 2. Victory/Game-Point Calculations
    const target = parseInt(match.pointsPerGame, 10);
    const goldenTrigger = (match.goldenPointAt && match.goldenPointAt > 0) ? match.goldenPointAt : (target === 21 ? 29 : target === 15 ? 20 : target === 11 ? 14 : target + 3);
    const cap = goldenTrigger + 1;
    
    // Immediate Victory Check
    const t1 = newTeam1Score;
    const t2 = newTeam2Score;
    const isWinT1 = (t1 >= target && t1 - t2 >= 2) || (t1 === cap);
    const isWinT2 = (t2 >= target && t2 - t1 >= 2) || (t2 === cap);
    const winDetected = isWinT1 || isWinT2;
    const winnerId = isWinT1 ? 1 : 2;

    const isGoldenPoint = !winDetected && newTeam1Score === goldenTrigger && newTeam2Score === goldenTrigger;

    // 3. Update Point Arrays for Sync (Using safe team indices to avoid dot-key Mongoose errors)
    const nextArrays = { ...pointArrays };
    const t1ScoreInc = scoringTeam === 1 ? 1 : 0;
    const t2ScoreInc = scoringTeam === 2 ? 1 : 0;
    nextArrays["team1"] = [...(nextArrays["team1"] || []), t1ScoreInc];
    nextArrays["team2"] = [...(nextArrays["team2"] || []), t2ScoreInc];

    // 4. Determine NEW Serving Player and Positions
    let nextServer = activeServer;
    
    // Side out?
    if (scoringTeam !== servingTeam) {
      const newServingTeam = scoringTeam;
      if (newServingTeam === 1) {
        nextServer = isEven ? team1Pos.evenSide : team1Pos.oddSide;
      } else {
        nextServer = isEven ? team2Pos.evenSide : team2Pos.oddSide;
      }
      setServingTeam(newServingTeam);
    } else {
      if (match.matchType?.includes('Doubles')) {
        if (scoringTeam === 1) {
          setTeam1Pos(prev => ({ evenSide: prev.oddSide, oddSide: prev.evenSide }));
        } else {
          setTeam2Pos(prev => ({ evenSide: prev.oddSide, oddSide: prev.evenSide }));
        }
      }
    }

    // 5. Commit to React State
    setScores({ team1: newTeam1Score, team2: newTeam2Score });
    setPointArrays(nextArrays);
    setActiveServer(nextServer);
    if (isGoldenPoint) setGoldenPointActive(true);

    // 6. INSTANT SYNC & INTERCEPT WIN
    if (winDetected) {
       // Check for match completion wins
       const currentWins = { ...gamesWon };
       currentWins[`team${winnerId}`]++;
       const winThreshold = Math.ceil(match.noOfGames / 2);
       const matchCompleted = currentWins[`team${winnerId}`] >= winThreshold;
       
       // INTERCEPT: Do not pause timer or show Game Over modal yet. Await confirmation.
       setPendingWinDetails({
         team1Score: newTeam1Score,
         team2Score: newTeam2Score,
         winnerId,
         matchCompleted,
         currentWins
       });

       if (socket) {
          // Sync point immediately but state it is NOT game over yet
          socket.emit('sync_live_state', {
             matchId: match.matchId,
             activeGameIndex: currentGame - 1,
             gameSnapshot: {
                accumulatedScores: { team1: newTeam1Score, team2: newTeam2Score },
                pointArrays: nextArrays
             },
             durations: { gameMins: Math.ceil(gameTimer.seconds/60), matchMins: Math.ceil(matchTimer.seconds/60) },
             servingPlayerId: nextServer?.id,
             servingPlayer: nextServer?.id,
             isGameOver: false // Needs confirmation
          });
       }

    } else {
      // Normal point sync
      if (socket) {
         socket.emit('sync_live_state', {
            matchId: match.matchId,
            activeGameIndex: currentGame - 1,
            gameSnapshot: {
               accumulatedScores: { team1: newTeam1Score, team2: newTeam2Score },
               pointArrays: nextArrays
            },
            durations: { gameMins: Math.ceil(gameTimer.seconds/60), matchMins: Math.ceil(matchTimer.seconds/60) },
            servingPlayerId: nextServer?.id,
            servingPlayer: nextServer?.id,
            goldenPointActive: isGoldenPoint
         });
      }
    }
  };

  const confirmWin = () => {
    if (!pendingWinDetails) return;
    const { team1Score, team2Score, winnerId, matchCompleted, currentWins } = pendingWinDetails;

    // Timers only pause when explicitly confirmed
    gameTimer.pause();
    if (matchCompleted) matchTimer.pause();

    if (socket) {
        socket.emit('sync_live_state', {
            matchId: match.matchId,
            activeGameIndex: currentGame - 1,
            gameSnapshot: {
               accumulatedScores: { team1: team1Score, team2: team2Score },
               pointArrays 
            },
            durations: { gameMins: Math.ceil(gameTimer.seconds/60), matchMins: Math.ceil(matchTimer.seconds/60) },
            servingPlayerId: activeServer?.id,
            servingPlayer: activeServer?.id,
            isGameOver: true
        });

        if (matchCompleted) {
            const matchWinnerName = winnerId === 1 ? match.team1Name : match.team2Name;
            socket.emit('complete_match', {
               matchId: match.matchId,
               winner: matchWinnerName,
               winnerId: winnerId,
               finalScore: `${currentWins.team1} - ${currentWins.team2}`,
               durations: { matchMins: Math.ceil(matchTimer.seconds / 60) }
            });
        }
    }

    setUndoState(null);
    setPendingWinDetails(null);
    handleGameOver({ team1: team1Score, team2: team2Score }, winnerId);
  };

  const undoLastPoint = () => {
    if (!undoState) return;
    
    // 1. Revert to explicit snapshot
    setScores(undoState.scores);
    setPointArrays(undoState.pointArrays);
    setServingTeam(undoState.servingTeam);
    setActiveServer(undoState.activeServer);
    setTeam1Pos(undoState.team1Pos);
    setTeam2Pos(undoState.team2Pos);
    setGoldenPointActive(undoState.goldenPointActive);

    // 2. Clear pending win if we intercepted one
    setPendingWinDetails(null);

    // 3. Immediately broadcast the reverted state to signage/backends
    if (socket) {
      socket.emit('sync_live_state', {
         matchId: match.matchId,
         activeGameIndex: currentGame - 1,
         gameSnapshot: {
            accumulatedScores: undoState.scores,
            pointArrays: undoState.pointArrays
         },
         durations: { gameMins: Math.ceil(gameTimer.seconds/60), matchMins: Math.ceil(matchTimer.seconds/60) },
         servingPlayerId: undoState.activeServer?.id,
         servingPlayer: undoState.activeServer?.id,
         goldenPointActive: undoState.goldenPointActive,
         isGameOver: false
      });
    }

    // 4. Burn the undo state (only usable once)
    setUndoState(null);
  };

  const acknowledgeGoldenPoint = () => {
    setGoldenPointActive(false);
  };

  const nextGame = (setupData = null) => {
    setTeamOnLeft(prev => prev === 1 ? 2 : 1); // Swap sides
    setScores({ team1: 0, team2: 0 });
    setCurrentGame(prev => prev + 1);
    setIsGameOver(false);
    setGameSubmissionPending(false);
    
    if (setupData) {
      if (setupData.servingTeam) setServingTeam(setupData.servingTeam);
      if (setupData.activeServer) setActiveServer(setupData.activeServer);
      // Optional: Update positions for doubles
      if (setupData.team1Pos) setTeam1Pos(setupData.team1Pos);
      if (setupData.team2Pos) setTeam2Pos(setupData.team2Pos);
    } else {
      // Automatic fallback for Singles
      const winningTeam = gameHistory[gameHistory.length - 1].winner;
      setServingTeam(winningTeam);
      const newServer = winningTeam === 1 ? team1Pos.evenSide : team2Pos.evenSide;
      setActiveServer(newServer);
    }

    gameTimer.reset();
    gameTimer.start();
    
    // Reset point arrays for next game internally
    setPointArrays({
      [match.team1Name]: [],
      [match.team2Name]: []
    });

    if (socket) {
       socket.emit('start_next_game', { matchId: match.matchId, newGameNumber: currentGame + 1 });
    }
  };

  const generateMatchJSON = () => {
    return {
      matchID: match.matchID,
      duration: matchTimer.formatTime(true),
      gamesPlayed: gameHistory.length,
      history: gameHistory,
      winner: gamesWon.team1 > gamesWon.team2 ? "Team 1" : "Team 2",
      finalGameWins: gamesWon
    };
  };

  return (
    <MatchContext.Provider value={{
      match, loading, error, fetchMatchData,
      tossWinner, teamOnLeft, servingTeam, initialSetupDone, completeSetup,
      startMatch, matchStarted,
      scores, gamesWon, currentGame, gameHistory, isGameOver, isMatchOver, gameSubmissionPending,
      team1Pos, team2Pos, activeServer,
      matchTimer, gameTimer, goldenPointActive,
      addPoint, nextGame, generateMatchJSON, acknowledgeGoldenPoint, submitGameResults,
      undoState, pendingWinDetails, confirmWin, undoLastPoint
    }}>
      {children}
    </MatchContext.Provider>
  );
};
