import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMatch } from '../context/MatchContext';
import { Trophy, CheckCircle, Play, Users } from 'lucide-react';

const GameOverModal = () => {
  const { 
    match, isMatchOver, gameHistory, generateMatchJSON, 
    nextGame, gamesWon, submitGameResults, gameSubmissionPending,
    currentGame, servingTeam, team1Pos, team2Pos
  } = useMatch();
  
  const [showJSON, setShowJSON] = useState(false);
  const [setupMode, setSetupMode] = useState(false); // For next game setup (doubles)
  
  // Doubles Next Game Setup State
  const [nextServer, setNextServer] = useState(null);
  const [nextReceiver, setNextReceiver] = useState(null);

  const isDoubles = (match.teams?.team1?.players?.length > 1) || (match.teams?.team2?.players?.length > 1);

  // The last game in history is the one that just finished
  const lastGame = gameHistory[gameHistory.length - 1];
  const winnerTeam = lastGame?.winner;
  const lastGameWinnerName = winnerTeam === 'team1' ? (match.teams?.team1?.players?.map(p => p.firstName).join(' / ') || 'Team 1') : (match.teams?.team2?.players?.map(p => p.firstName).join(' / ') || 'Team 2');
  
  const matchWinnerId = gamesWon.team1 > gamesWon.team2 ? 'team1' : 'team2';
  const matchWinnerName = matchWinnerId === 'team1' ? (match.teams?.team1?.players?.map(p => p.firstName).join(' / ') || 'Team 1') : (match.teams?.team2?.players?.map(p => p.firstName).join(' / ') || 'Team 2');  

  const getFirstNames = (nameStr) => {
    if (!nameStr) return [];
    return nameStr.split(' / ').map(name => name.trim().split(' ')[0]);
  };

  const renderVerticalNames = (teamId) => {
    const team = teamId === 'team1' ? match.teams?.team1 : match.teams?.team2;
    const names = team?.players?.map(p => p.firstName) || (teamId === 'team1' ? ['Team 1'] : ['Team 2']);
    return (
      <div className="flex flex-col items-center">
        {names.map((name, idx) => (
          <span key={idx} className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-tight">{name}</span>
        ))}
      </div>
    );
  };

  // Effect to pre-select winning team as serving team for next game logic
  useEffect(() => {
    // 1. Auto-transition to setup mode for doubles after submission
    if (!gameSubmissionPending && !isMatchOver && isDoubles && !setupMode) {
      setSetupMode(true);
    }

    // 2. Pre-selection of players is disabled per requirement. 
    // Players must be explicitly chosen by the umpire for every game.
  }, [setupMode, isDoubles, lastGame, match, gameSubmissionPending, isMatchOver]);

  if (!lastGame) return null;

  const handleReturnToLanding = () => {
    window.location.href = '/';
  };

  const handleStartNextGame = () => {
    if (isDoubles) {
      // Calculate positions based on selection
      // Team 1 is always Team 1, but we need to know who is on Even/Odd side
      // In a new game, the server serves from Even side.
      const winId = lastGame.winner;
      
      const setupData = {
        servingTeam: winId,
        activeServer: nextServer,
        team1Pos: winId === 'team1' ? { evenSide: nextServer, oddSide: match.teams.team1.players.find(p => String(p.id) !== String(nextServer.id)) } : { evenSide: nextReceiver, oddSide: match.teams.team1.players.find(p => String(p.id) !== String(nextReceiver.id)) },
        team2Pos: winId === 'team2' ? { evenSide: nextServer, oddSide: match.teams.team2.players.find(p => String(p.id) !== String(nextServer.id)) } : { evenSide: nextReceiver, oddSide: match.teams.team2.players.find(p => String(p.id) !== String(nextReceiver.id)) }
      };
      nextGame(setupData);
    } else {
      nextGame();
    }
  };

  if (showJSON) {
    const summary = generateMatchJSON();
    return (
      <div className="absolute inset-0 z-50 bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center p-8">
        <h2 className="text-3xl font-bold text-white mb-6">Match Summary (JSON)</h2>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[70vh] overflow-y-auto">
          <pre className="text-emerald-400 font-mono text-sm whitespace-pre-wrap">
            {JSON.stringify(summary, null, 2)}
          </pre>
        </div>
        <button 
          onClick={handleReturnToLanding}
          className="mt-8 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition"
        >
          Return to Landing
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 bg-gray-900/95 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-gray-900 border border-gray-700 p-3 md:p-8 rounded-xl md:rounded-2xl shadow-2xl max-w-2xl w-full relative max-h-[96vh] flex flex-col"
      >
        <div className="mb-2 md:mb-6 flex gap-3 items-center text-xs md:text-sm text-gray-500 font-mono overflow-hidden">
          <span className="w-[60px]"></span>
          <span className="truncate flex-1 text-center font-bold text-white tracking-widest uppercase">
            {isMatchOver ? 'Match Complete' : `Game ${lastGame.game} Result`}
          </span>
          <span className="whitespace-nowrap flex-shrink-0 bg-gray-800 px-2 py-0.5 md:px-3 md:py-1 rounded-full border border-gray-700">
             {isMatchOver ? 'Final' : 'Finished'}
          </span>
        </div>
        
        <AnimatePresence mode="wait">
          {gameSubmissionPending ? (
            <motion.div 
              key="submit"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              className="space-y-4"
            >
              <h2 className="text-sm md:text-2xl font-bold text-center leading-tight">Game Over</h2>
              <div className="py-3 md:py-5 px-4 bg-gray-800/40 rounded-xl border border-gray-700/50">
                <div className="flex items-center justify-center space-x-6 md:space-x-12">
                   {/* Winner (Left) */}
                   <div className="flex flex-col items-center">
                     <span className="text-3xl md:text-5xl font-black mb-2 text-emerald-400">
                       {winnerTeam === 'team1' ? lastGame.scores.team1 : lastGame.scores.team2}
                     </span>
                     {renderVerticalNames(winnerTeam === 'team1' ? 'team1' : 'team2')}
                   </div>
                   
                   <div className="text-gray-800 font-black text-xl md:text-2xl italic">VS</div>
                   
                   {/* Loser (Right) */}
                   <div className="flex flex-col items-center opacity-40">
                     <span className="text-3xl md:text-5xl font-black mb-2 text-gray-700">
                       {winnerTeam === 'team1' ? lastGame.scores.team2 : lastGame.scores.team1}
                     </span>
                     {renderVerticalNames(winnerTeam === 'team1' ? 'team2' : 'team1')}
                   </div>
                </div>
              </div>

              <button 
                onClick={submitGameResults}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center transition disabled:opacity-50"
              >
                CONTINUE
              </button>
            </motion.div>
          ) : isMatchOver ? (
            <motion.div 
               key="match-over"
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               className="space-y-3 md:space-y-4"
            >
               <div className="bg-emerald-900/30 border border-emerald-500/30 p-3 md:p-5 rounded-xl text-center">
                  <h3 className="text-lg font-bold text-emerald-400 mb-1 uppercase tracking-tight">Match Complete</h3>
                  <p className="text-gray-100 text-lg mb-3 font-semibold">
                    {matchWinnerName} won {Math.max(gamesWon.team1, gamesWon.team2)} - {Math.min(gamesWon.team1, gamesWon.team2)}
                  </p>
                  
                  {/* Complete Score History */}
                  <div className="flex gap-2 justify-center mt-4 border-t border-emerald-500/20 pt-4">
                    {gameHistory.map((game, idx) => (
                      <div key={idx} className="bg-gray-800/60 px-2.5 py-1.5 rounded-lg border border-gray-700/50 text-center shadow-inner min-w-[64px]">
                        <div className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Game {game.game}</div>
                        <div className="font-mono font-bold text-xs whitespace-nowrap">
                          <span className={game.winner === matchWinnerId ? "text-emerald-400 font-black" : "text-gray-500"}>
                            {matchWinnerId === 'team1' ? game.scores.team1 : game.scores.team2}
                          </span>
                          <span className="text-gray-700 mx-1">-</span>
                          <span className={game.winner !== matchWinnerId ? "text-emerald-400 font-black" : "text-gray-500"}>
                            {matchWinnerId === 'team1' ? game.scores.team2 : game.scores.team1}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="pt-2">
                  <button 
                    onClick={() => setShowJSON(true)}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg"
                  >
                    SUBMIT MATCH
                  </button>
               </div>
            </motion.div>
          ) : setupMode ? (
            <motion.div 
              key="setup"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              className="space-y-4"
            >
              <h2 className="text-sm md:text-2xl font-bold text-center leading-tight tracking-tight">Select Players for Game {currentGame + 1}</h2>
              
              <div className="flex flex-col md:flex-row gap-3 text-left">
                {/* Server Selection */}
                <div className="flex-1 bg-gray-800/40 p-3 rounded-xl border border-gray-700/50">
                  <h3 className={`text-[10px] ${winnerTeam === 'team1' ? 'text-blue-400' : 'text-red-400'} uppercase font-bold tracking-[0.2em] mb-3 text-center`}>Serving</h3>
                  <div className="flex flex-col gap-2">
                    {(winnerTeam === 'team1' ? match.teams.team1.players : match.teams.team2.players).map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => setNextServer(p)}
                        className={`py-2.5 px-2 rounded-lg border font-bold text-xs md:text-sm transition-all ${nextServer?.id === p.id ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : (winnerTeam === 'team1' ? 'bg-blue-900/20 border-blue-500/30 text-blue-100' : 'bg-red-900/20 border-red-500/30 text-red-100')}`}
                      >
                        {p.firstName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Receiver Selection */}
                <div className="flex-1 bg-gray-800/40 p-3 rounded-xl border border-gray-700/50">
                  <h3 className={`text-[10px] ${winnerTeam === 'team1' ? 'text-red-400' : 'text-blue-400'} uppercase font-bold tracking-[0.2em] mb-3 text-center`}>Receiving</h3>
                  <div className="flex flex-col gap-2">
                    {(winnerTeam === 'team1' ? match.teams.team2.players : match.teams.team1.players).map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => setNextReceiver(p)}
                        className={`py-2.5 px-2 rounded-lg border font-bold text-xs md:text-sm transition-all ${nextReceiver?.id === p.id ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : (winnerTeam === 'team1' ? 'bg-red-900/20 border-red-500/30 text-red-100' : 'bg-blue-900/20 border-blue-500/30 text-blue-100')}`}
                      >
                        {p.firstName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                disabled={!nextServer || !nextReceiver}
                onClick={handleStartNextGame}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center transition disabled:opacity-50"
              >
                START GAME {currentGame + 1}
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="ready"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              className="space-y-6 py-6"
            >
              <h2 className="text-sm md:text-2xl font-bold text-center leading-tight tracking-tight">Prepare Game {currentGame + 1}</h2>

              <button 
                onClick={() => {
                  if (isDoubles) setSetupMode(true);
                  else handleStartNextGame();
                }}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center transition"
              >
                START THE GAME
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default GameOverModal;
