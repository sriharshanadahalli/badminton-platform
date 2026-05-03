import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Robust Winner Detection Helper
const checkWinner = (teamId, match) => {
  if (!['Completed', 'Forfeited'].includes(match?.status)) return false;
  const winnerName = match?.winner;
  if (!winnerName) return false;

  // 1. Check if winner is explicitly "team1" or "team2"
  if (winnerName === `team${teamId}`) return true;

  const normalize = (s) => s?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
  const normWinner = normalize(winnerName);

  // 2. Check generic team names
  if (normWinner === `team ${teamId}` || normWinner === `team${teamId}`) return true;

  // 3. Check full joined team string
  const players = match.teams?.[`team${teamId}`]?.players?.map(p => p.fullName) || [];
  const joinedName = normalize(players.join(' / '));
  if (normWinner === joinedName) return true;

  // 4. Fuzzy check: Is any player in this team part of the winner string?
  const winnerParts = normWinner.split(/[\/\-\&]/).map(s => s.trim());
  return players.some(p => {
    const normP = normalize(p);
    return winnerParts.some(part => part === normP) || normWinner.includes(normP);
  });
};


const ScoreCardBase = ({ current, isWinningScore, isCurrent, isCompleted, isGameOver, teamId }) => {
  return (
    <div className={`
      relative w-[4.8vw] h-[8vh] min-w-[45px] min-h-[60px] 
      rounded-2xl transition-all duration-700 ease-out flex items-center justify-center
      ${isWinningScore ? 'bg-emerald-900/20 border border-emerald-900/20' :
        (isCurrent && !isCompleted && !isGameOver) ? 'bg-amber-900/20 border border-amber-900/20' :
          'bg-slate-900/40 border border-slate-800/10'} 
      overflow-hidden
    `}>
      {/* Number with Umpire-Style Absolute Animation */}
      <div className={`relative h-full w-full flex items-center justify-center overflow-hidden font-mono font-black tracking-tighter transition-all duration-500 text-[clamp(1.4rem,4.8vh,3.5rem)]
         ${isWinningScore ? 'text-emerald-400' :
          (isCurrent && !isCompleted && !isGameOver) ? 'text-amber-200' :
            'text-slate-500'}
       `}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={`${teamId}-${current}`}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              opacity: { duration: 0.2 }
            }}
            className="absolute"
          >
            {current}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const LiveScoreDisplay = ({ match, courtId }) => {
  const isCompleted = ['Completed', 'Forfeited'].includes(match?.status);
  const team1Players = match?.teams?.team1?.players?.map(p => p.fullName) || [];
  const team2Players = match?.teams?.team2?.players?.map(p => p.fullName) || [];
  const team1WinsMatch = checkWinner(1, match);
  const team2WinsMatch = checkWinner(2, match);
  const isStarted = ['In Progress', 'Completed', 'Forfeited'].includes(match?.status);

  const activeServerId = match?.servingPlayerId;
  const t1Serving = match?.teams?.team1?.players?.some(p => p.id === activeServerId) && !isCompleted;
  const t2Serving = match?.teams?.team2?.players?.some(p => p.id === activeServerId) && !isCompleted;

  const games = match?.games || [];
  const totalGames = match?.gamesPerMatch || 3;
  const gameSlots = Array.from({ length: totalGames }, (_, i) => games[i] || null);
  const targetPoints = match?.pointsPerGame || 21;

  // Internal Logic for Corrected Scores within Component Scope
  const getDisplayScore = (idx, tId) => {
    if (!isStarted) return '-';
    const g = games[idx];
    let score = g?.scores?.[tId] ?? '-';

    // Fallback: Real-time scores for the active game
    if (idx === games.length - 1) {
      const live = match.games?.[match.games.length - 1]?.scores;
      score = live?.[tId] ?? score;
    }

    // Victory Correction: Accurate for Deuce and Golden Point
    if (isCompleted && idx === games.length - 1) {
      const isWinner = tId === 'team1' ? team1WinsMatch : team2WinsMatch;
      if (isWinner && typeof score === 'number') {
        const oppTId = tId === 'team1' ? 'team2' : 'team1';
        const live = match.games?.[match.games.length - 1]?.scores;
        const oppScore = live ? (live[oppTId] ?? 0) : (games[idx]?.scores?.[oppTId] ?? 0);

        // Force victory point (at least target, and at least opp + 1)
        return Math.max(score, targetPoints, oppScore + 1);
      }
    }
    return score;
  };

  const getPointStatus = (teamId) => {
    if (!match || isCompleted || match.currentGameIsOver) return null;
    const currentGameIndex = games.length - 1;
    if (currentGameIndex < 0) return null;

    const target = parseInt(match.pointsPerGame, 10);
    const goldenTrigger = (match.goldenPointAt && match.goldenPointAt > 0) ? match.goldenPointAt : (target === 21 ? 29 : target === 15 ? 20 : target === 11 ? 14 : target + 3);
    const cap = goldenTrigger + 1;

    const s1 = getDisplayScore(currentGameIndex, 'team1');
    const s2 = getDisplayScore(currentGameIndex, 'team2');

    if (s1 === goldenTrigger && s2 === goldenTrigger) return 'GOLDEN POINT';

    const myScore = teamId === 'team1' ? s1 : s2;
    const oppScore = teamId === 'team1' ? s2 : s1;

    if (myScore >= target - 1 && myScore > oppScore) {
      const currentGameIndex = games.length - 1;
      const completedGames = games.slice(0, currentGameIndex);

      const team1Wins = completedGames.filter(g => g.scores.team1 > g.scores.team2).length;
      const team2Wins = completedGames.filter(g => g.scores.team2 > g.scores.team1).length;

      const threshold = Math.ceil(totalGames / 2);
      const myWins = teamId === 'team1' ? team1Wins : team2Wins;

      if (myWins === threshold - 1) return 'MATCH POINT';
      return 'GAME POINT';
    }
    return null;
  };

  const displayCourtName = courtId ? `COURT ${courtId}` : '';

  return (
    <div className="flex flex-col w-full h-full bg-[#020617] relative overflow-hidden">
      {/* 3-Column Header */}
      <div className="h-[7vh] bg-slate-900/50 border-b border-slate-800/60 grid grid-cols-3 items-center px-[2vw]">
        <div className="flex items-center space-x-[1vw] border-l-2 border-indigo-500/40 pl-[1vw] overflow-hidden">
          {match ? (
            <div className="flex flex-col justify-center min-w-0">
              <span className="text-indigo-400 font-bold text-[clamp(7px,0.8vh,10px)] uppercase tracking-[0.2em] whitespace-nowrap truncate">{match.categoryName}</span>
              <span className="text-slate-400 font-bold text-[clamp(7px,0.8vh,10px)] uppercase tracking-[0.2em] whitespace-nowrap truncate">{match.roundName}</span>
            </div>
          ) : (
            <span className="text-slate-600 font-bold text-[clamp(8px,1vh,12px)] uppercase tracking-[0.2em]">Pending Match</span>
          )}
        </div>

        <div className="flex flex-col items-center justify-center">
          <span className="text-amber-500 font-black text-[clamp(1.2rem,2.8vh,3.5rem)] leading-none italic tracking-tighter">
            {displayCourtName}
          </span>
          <div className="h-[1px] w-[60%] bg-amber-500/20 mt-[0.3vh]" />
        </div>

        <div className="flex items-center justify-center lg:justify-end pr-[1vw]">
          {!match ? (
            <span className="text-slate-700 text-[9px] font-bold tracking-[0.2em] uppercase">Standby</span>
          ) : isCompleted ? (
            <div className={`flex items-center justify-center border px-[1.5vw] py-[0.5vh] rounded-full min-w-[8vw] ${match.status === 'Forfeited' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
              <span className={`${match.status === 'Forfeited' ? 'text-rose-400' : 'text-emerald-400'} font-black animate-pulse text-[9px] tracking-[0.3em] uppercase block text-center`}>
                {match.status === 'Forfeited' ? 'FORFEITED' : 'COMPLETED'}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-[1.2vw]">
              <div className="flex items-center space-x-[0.5vw] px-[0.8vw] py-[0.4vh] bg-red-600/5 border border-red-600/20 rounded-full">
                <span className="w-1 h-1 rounded-full bg-red-500 animate-ping" />
                <span className="text-red-500 text-[9px] font-black uppercase tracking-[0.2em]">Live</span>
              </div>
              <span className="text-slate-500 text-[9px] font-mono font-bold tracking-[0.2em] uppercase">{match.games?.length > 0 ? (match.games[match.games.length - 1]?.durationMins || 0) : 0}'</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-[1.5vh] px-[3vw] min-h-0 py-[1vh]">
        {match && (
          <div className="flex justify-end pr-[2vw]">
            <div className="flex items-center space-x-[0.3vw] flex-shrink-0">
              {gameSlots.map((g, idx) => {
                const isCurrentGame = idx === games.length - 1;
                const isFinished = (match.currentGameIsOver && isCurrentGame) || idx < games.length - 1;
                return (
                  <div key={idx} className="w-[4.8vw] min-w-[45px] flex justify-center border-b border-transparent">
                    <span className={`${isFinished ? 'text-slate-200' : 'text-slate-400'} font-bold text-[12px] font-mono tracking-tighter`}>
                      {games[idx]?.durationMins || 0}'
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!match ? (
          <div className="flex flex-col items-center justify-center py-[10vh] animate-pulse">
            <h3 className="text-slate-500 text-lg font-semibold tracking-widest uppercase italic border-y border-slate-800/50 py-4 px-12">Match will be scheduled soon</h3>
          </div>
        ) : (
          <>
            {/* Team 1 Section */}
            <div className={`flex items-center justify-between p-[2vw] py-[1.5vh] rounded-[24px] border transition-colors duration-500 ${team1WinsMatch ? 'bg-emerald-950/20 border-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.1)]' : t1Serving ? 'bg-indigo-950/20 border-indigo-400/20 shadow-[0_0_35px_rgba(99,102,241,0.2)]' : 'bg-slate-900/30 border-slate-800/10'}`}>
              <div className="flex flex-col flex-1 min-w-0 pr-[1vw]">
                <div className="h-[13vh] flex flex-col justify-center relative">
                  <div className="flex flex-col space-y-[0.3vh] overflow-visible">
                    {(team1Players.length > 0 ? team1Players : ['TBD']).map((p, i) => (
                      <span key={i} className={`font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis text-[clamp(1.2rem,3vh,2rem)] leading-tight ${team1WinsMatch ? 'text-emerald-400' : (isCompleted && !team1WinsMatch) ? 'text-slate-500' : 'text-slate-200'}`}>
                        {p}
                      </span>
                    ))}
                  </div>

                  <div className="h-[3vh] mt-[0.8vh] flex items-center">
                    {team1WinsMatch ? (
                      <div className="inline-flex items-center px-[1vw] py-[0.3vh] bg-emerald-500/10 border border-emerald-400/50 rounded text-emerald-400 font-black text-[9px] italic tracking-[0.25em] animate-pulse uppercase whitespace-nowrap">
                        Winner
                      </div>
                    ) : getPointStatus('team1') ? (
                      <div className={`inline-flex items-center px-[0.8vw] py-[0.3vh] rounded font-black text-[9px] italic tracking-[0.25em] animate-pulse uppercase whitespace-nowrap border ${getPointStatus('team1') === 'GOLDEN POINT'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                        : getPointStatus('team1') === 'GAME POINT'
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                        {getPointStatus('team1')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-[0.3vw] flex-shrink-0">
                {gameSlots.map((g, idx) => {
                  const isLastGameInArray = idx === games.length - 1;
                  const score = getDisplayScore(idx, 'team1');
                  const oppScore = getDisplayScore(idx, 'team2');

                  const goldenTrigger = (match?.goldenPointAt && match?.goldenPointAt > 0) ? match.goldenPointAt : (targetPoints === 21 ? 29 : targetPoints === 15 ? 20 : targetPoints === 11 ? 14 : targetPoints + 3);
                  const cap = goldenTrigger + 1;
                  const isSetOver = (score >= targetPoints && score - oppScore >= 2) || (score === cap) || (oppScore === cap);

                  const isWinningScore = (score > oppScore && ((score >= targetPoints && score - oppScore >= 2) || (score === cap))) ||
                    (isLastGameInArray && isCompleted && team1WinsMatch);

                  return (
                    <ScoreCardBase
                      key={idx}
                      current={score}
                      isCurrent={isLastGameInArray}
                      isCompleted={isCompleted}
                      isGameOver={isLastGameInArray && (match?.currentGameIsOver || isSetOver)}
                      isWinningScore={isWinningScore}
                      teamId={'team1'}
                    />
                  );
                })}
              </div>
            </div>



            {/* Team 2 Section */}
            <div className={`flex items-center justify-between p-[2vw] py-[1.5vh] rounded-[24px] border transition-colors duration-500 ${team2WinsMatch ? 'bg-emerald-950/20 border-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.1)]' : t2Serving ? 'bg-indigo-950/20 border-indigo-400/20 shadow-[0_0_35px_rgba(99,102,241,0.2)]' : 'bg-slate-900/30 border-slate-800/10'}`}>
              <div className="flex flex-col flex-1 min-w-0 pr-[1vw]">
                <div className="h-[13vh] flex flex-col justify-center relative">
                  <div className="flex flex-col space-y-[0.3vh] overflow-visible">
                    {(team2Players.length > 0 ? team2Players : ['TBD']).map((p, i) => (
                      <span key={i} className={`font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis text-[clamp(1.2rem,3vh,2rem)] leading-tight ${team2WinsMatch ? 'text-emerald-400' : (isCompleted && !team2WinsMatch) ? 'text-slate-500' : 'text-slate-200'}`}>
                        {p}
                      </span>
                    ))}
                  </div>

                  <div className="h-[3vh] mt-[0.8vh] flex items-center">
                    {team2WinsMatch ? (
                      <div className="inline-flex items-center px-[1vw] py-[0.3vh] bg-emerald-500/10 border border-emerald-400/50 rounded text-emerald-400 font-black text-[9px] italic tracking-[0.25em] animate-pulse uppercase whitespace-nowrap">
                        Winner
                      </div>
                    ) : getPointStatus('team2') ? (
                      <div className={`inline-flex items-center px-[0.8vw] py-[0.3vh] rounded font-black text-[9px] italic tracking-[0.25em] animate-pulse uppercase whitespace-nowrap border ${getPointStatus('team2') === 'GOLDEN POINT'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                        : getPointStatus('team2') === 'GAME POINT'
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                        {getPointStatus('team2')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-[0.3vw] flex-shrink-0">
                {gameSlots.map((g, idx) => {
                  const isLastGameInArray = idx === games.length - 1;
                  const score = getDisplayScore(idx, 'team2');
                  const oppScore = getDisplayScore(idx, 'team1');

                  // Autonomous Set-Over Logic for instantaneous color feedback
                  const goldenTrigger = (match?.goldenPointAt && match?.goldenPointAt > 0) ? match.goldenPointAt : (targetPoints === 21 ? 29 : targetPoints === 15 ? 20 : targetPoints === 11 ? 14 : targetPoints + 3);
                  const cap = goldenTrigger + 1;
                  const isSetOver = (score >= targetPoints && Math.abs(score - oppScore) >= 2) || (score === cap) || (oppScore === cap);

                  const isWinningScore = (score > oppScore && ((score >= targetPoints && score - oppScore >= 2) || (score === cap))) ||
                    (isLastGameInArray && isCompleted && team2WinsMatch);

                  return (
                    <ScoreCardBase
                      key={idx}
                      current={score}
                      isCurrent={isLastGameInArray}
                      isCompleted={isCompleted}
                      isGameOver={isLastGameInArray && (match?.currentGameIsOver || isSetOver)}
                      isWinningScore={isWinningScore}
                      teamId={'team2'}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LiveScoreDisplay;
