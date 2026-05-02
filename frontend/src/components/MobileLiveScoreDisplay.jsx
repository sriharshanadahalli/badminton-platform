import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const checkWinner = (teamId, match) => {
  if (!['Completed', 'Forfeited'].includes(match?.status)) return false;
  const winnerName = match?.matchResult?.winner;
  if (!winnerName) return false;

  // 1. Check if winner is explicitly "1" or "2"
  if (winnerName === String(teamId)) return true;

  const normalize = (s) => s?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
  const normWinner = normalize(winnerName);

  // 2. Check generic team names
  if (normWinner === `team ${teamId}` || normWinner === `team${teamId}`) return true;

  const players = match.players?.[`team${teamId}`] || [];
  const joinedName = normalize(players.join(' / '));
  if (normWinner === joinedName) return true;

  const winnerParts = normWinner.split(/[\/\-\&]/).map(s => s.trim());
  return players.some(p => {
    const normP = normalize(p);
    return winnerParts.some(part => part === normP) || normWinner.includes(normP);
  });
};

const MobileScoreCardGroup = ({ current, isWinningScore, isCurrent, isCompleted, isGameOver, teamId }) => {
  return (
    <div className={`
      relative w-[12vw] h-[5vh] min-w-[40px] flex items-center justify-center rounded-lg border transition-all duration-500
      ${isWinningScore ? 'bg-emerald-500/10 border-emerald-500/30' :
        (isCurrent && !isCompleted && !isGameOver) ? 'bg-amber-500/10 border-amber-500/30' :
          'bg-slate-800/40 border-slate-700/30'}
    `}>
      <span className={`font-mono font-black text-lg ${isWinningScore ? 'text-emerald-400' : (isCurrent && !isCompleted && !isGameOver) ? 'text-amber-400' : 'text-slate-500'}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={`${teamId}-${current}`}
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -5, opacity: 0 }}
          >
            {current}
          </motion.div>
        </AnimatePresence>
      </span>
    </div>
  );
};

const MobileLiveScoreDisplay = ({ match, courtId }) => {
  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-600 italic text-[10px] uppercase tracking-widest font-black text-center">
        Next Match will be scheduled soon
      </div>
    );
  }

  const isCompleted = ['Completed', 'Forfeited'].includes(match?.status);
  const players = match?.players || { team1: [], team2: [] };
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

  const getDisplayScore = (idx, tId) => {
    if (!isStarted) return '-';
    const g = games[idx];
    let score = g?.accumulatedScores?.[`team${tId}`] ?? '-';
    if (idx === games.length - 1 && (match?.scores || match?.currentScores)) {
      const live = match.scores || match.currentScores;
      score = live[`team${tId}`] ?? score;
    }
    return score;
  };

  const getPointStatus = (teamId) => {
    if (!match || isCompleted || match.currentGameIsOver) return null;

    const target = parseInt(match.pointsPerGame, 10);
    const goldenTrigger = (match.goldenPointAt && match.goldenPointAt > 0) ? match.goldenPointAt : (target === 21 ? 29 : target === 15 ? 20 : target === 11 ? 14 : target + 3);
    const cap = goldenTrigger + 1;

    const currentIdx = games.length - 1;
    if (currentIdx < 0) return null;

    const s1 = getDisplayScore(currentIdx, 1);
    const s2 = getDisplayScore(currentIdx, 2);

    if (s1 === goldenTrigger && s2 === goldenTrigger) return 'GOLDEN POINT';

    const myScore = teamId === 1 ? s1 : s2;
    const oppScore = teamId === 1 ? s2 : s1;

    if (myScore >= target - 1 && myScore > oppScore) {
      const completedGames = games.slice(0, currentIdx);
      const team1Wins = completedGames.filter(g => g.accumulatedScores.team1 > g.accumulatedScores.team2).length;
      const team2Wins = completedGames.filter(g => g.accumulatedScores.team2 > g.accumulatedScores.team1).length;
      const threshold = Math.ceil(totalGames / 2);
      const myWins = teamId === 1 ? team1Wins : team2Wins;

      if (myWins === threshold - 1) return 'MATCH POINT';
      return 'GAME POINT';
    }
    return null;
  };

  const currentIdx = games.length - 1;

  return (
    <div className="flex flex-col w-full h-full bg-slate-900/40 border-t border-slate-700/20">
      <div className="p-3 space-y-3">
        {/* Team 1 Row */}
        <div className={`flex flex-col p-3 rounded-xl border transition-all duration-500 ${t1Serving ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-slate-800/20 border-slate-700/20'}`}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-2 overflow-hidden">
              <div className={`w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] transition-all ${t1Serving ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
              <div className="flex flex-col truncate">
                {(players.team1 || ['TBD']).map((p, i) => (
                  <span key={i} className={`font-bold text-sm truncate ${team1WinsMatch ? 'text-emerald-400' : (isCompleted || match?.currentGameIsOver) && !team1WinsMatch ? 'text-slate-500' : 'text-slate-100'}`}>{p}</span>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-1 h-6 min-w-[70px] justify-end">
              {team1WinsMatch ? (
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 uppercase italic">Winner</span>
              ) : getPointStatus(1) ? (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase italic animate-pulse whitespace-nowrap ${getPointStatus(1) === 'GOLDEN POINT'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                    : getPointStatus(1) === 'GAME POINT'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                  {getPointStatus(1)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex space-x-1.5">
            {gameSlots.map((g, idx) => {
              const s1 = getDisplayScore(idx, 1);
              const s2 = getDisplayScore(idx, 2);

              // Autonomous Set-Over Logic for instantaneous color feedback
              // Custom Logic: Golden points and caps
              const goldenTrigger = (match.goldenPointAt && match.goldenPointAt > 0) ? match.goldenPointAt : (targetPoints === 21 ? 29 : targetPoints === 15 ? 20 : targetPoints === 11 ? 14 : targetPoints + 3);
              const cap = goldenTrigger + 1;
              const isSetOver = (s1 >= targetPoints && Math.abs(s1 - s2) >= 2) || (s1 === cap) || (s2 === cap);

              const isWin = (s1 > s2 && ((s1 >= targetPoints && s1 - s2 >= 2) || (s1 === cap))) ||
                (idx === currentIdx && isCompleted && team1WinsMatch);

              return (
                <MobileScoreCardGroup
                  key={idx}
                  current={s1}
                  isCurrent={idx === currentIdx}
                  isCompleted={isCompleted}
                  isGameOver={idx === currentIdx && (match?.currentGameIsOver || isSetOver)}
                  teamId={1}
                  isWinningScore={isWin}
                />
              );
            })}
          </div>
        </div>

        {/* Team 2 Row */}
        <div className={`flex flex-col p-3 rounded-xl border transition-all duration-500 ${t2Serving ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,41,0.1)]' : 'bg-slate-800/20 border-slate-700/20'}`}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-2 overflow-hidden">
              <div className={`w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] transition-all ${t2Serving ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
              <div className="flex flex-col truncate">
                {(players.team2 || ['TBD']).map((p, i) => (
                  <span key={i} className={`font-bold text-sm truncate ${team2WinsMatch ? 'text-emerald-400' : (isCompleted || match?.currentGameIsOver) && !team2WinsMatch ? 'text-slate-500' : 'text-slate-100'}`}>{p}</span>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-1 h-6 min-w-[70px] justify-end">
              {team2WinsMatch ? (
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 uppercase italic">Winner</span>
              ) : getPointStatus(2) ? (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase italic animate-pulse whitespace-nowrap ${getPointStatus(2) === 'GOLDEN POINT'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                    : getPointStatus(2) === 'GAME POINT'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                  {getPointStatus(2)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex space-x-1.5">
            {gameSlots.map((g, idx) => {
              const s1 = getDisplayScore(idx, 1);
              const s2 = getDisplayScore(idx, 2);

              // Autonomous Set-Over Logic for instantaneous color feedback
              // Custom Logic: Golden points and caps
              const goldenTrigger = (match.goldenPointAt && match.goldenPointAt > 0) ? match.goldenPointAt : (targetPoints === 21 ? 29 : targetPoints === 15 ? 20 : targetPoints === 11 ? 14 : targetPoints + 3);
              const cap = goldenTrigger + 1;
              const isSetOver = (s1 >= targetPoints && Math.abs(s1 - s2) >= 2) || (s1 === cap) || (s2 === cap);

              const isWin = (s2 > s1 && ((s2 >= targetPoints && s2 - s1 >= 2) || (s2 === cap))) ||
                (idx === currentIdx && isCompleted && team2WinsMatch);

              return (
                <MobileScoreCardGroup
                  key={idx}
                  current={s2}
                  isCurrent={idx === currentIdx}
                  isCompleted={isCompleted}
                  isGameOver={idx === currentIdx && (match?.currentGameIsOver || isSetOver)}
                  teamId={2}
                  isWinningScore={isWin}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileLiveScoreDisplay;
