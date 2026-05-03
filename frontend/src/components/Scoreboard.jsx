import React from 'react';
import { useMatch } from '../context/MatchContext';
import { Clock, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Scoreboard = () => {
  const { match, scores, currentGame, gameHistory, matchTimer, gameTimer } = useMatch();

  // Create an array of games to display [1, 2, 3...]
  const numGames = match.noOfGames || match.gamesPerMatch || 3;
  const gamesList = Array.from({ length: numGames }, (_, i) => i + 1);

  const team1Label = match.teams?.team1?.players?.map(p => p.firstName).join(' / ') || 'Team 1';
  const team2Label = match.teams?.team2?.players?.map(p => p.firstName).join(' / ') || 'Team 2';

  const getPointStatus = () => {
    const target = parseInt(match.pointsPerGame, 10);
    const goldenTrigger = (match.goldenPointAt && match.goldenPointAt > 0) ? match.goldenPointAt : (target === 21 ? 29 : target === 15 ? 20 : target === 11 ? 14 : target + 3);
    const cap = goldenTrigger + 1;

    if (scores.team1 === goldenTrigger && scores.team2 === goldenTrigger) return { label: 'GOLDEN POINT', type: 'gp' };

    const threshold = Math.ceil(numGames / 2);
    const wins = {
      team1: gameHistory.filter(g => g.winner === 'team1').length,
      team2: gameHistory.filter(g => g.winner === 'team2').length
    };

    const s1 = scores.team1;
    const s2 = scores.team2;

    const isMatchPoint = (s1 >= target - 1 && s1 > s2 && wins.team1 === threshold - 1) ||
      (s2 >= target - 1 && s2 > s1 && wins.team2 === threshold - 1);
    if (isMatchPoint) return { label: 'MATCH POINT', type: 'mp' };

    const isGamePoint = (s1 >= target - 1 && s1 > s2) || (s2 >= target - 1 && s2 > s1);
    if (isGamePoint) return { label: 'GAME POINT', type: 'gp_game' };

    return null;
  };

  const formatMins = (totalSeconds) => {
    const m = Math.max(1, Math.ceil(totalSeconds / 60));
    return `${m}'`;
  };

  const widgetClass = "h-[64px] md:h-[88px] bg-gray-900/80 backdrop-blur rounded-xl border border-gray-700 pointer-events-auto shadow-xl shadow-black/50 flex align-center justify-center overflow-hidden";

  const pointStatus = getPointStatus();

  return (
    <div className="w-full px-1 py-1 md:p-4 flex justify-between items-start z-10 pointer-events-none max-w-7xl mx-auto gap-1 md:gap-4">

      {/* Timers - Top Left */}
      <div className={`${widgetClass} flex-col px-2 md:px-4 justify-center min-w-[70px] md:min-w-[110px] w-auto`}>
        <div className="flex items-center gap-1 md:gap-3 text-emerald-400 font-mono text-sm md:text-xl">
          <Clock className="w-3 h-3 md:w-5 md:h-5 flex-shrink-0 hidden sm:block" />
          <div className="flex flex-col flex-1">
            <span className="text-[8px] md:text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5 md:mb-1">Match</span>
            <span className="leading-none font-bold whitespace-nowrap">{formatMins(matchTimer.seconds)}</span>
          </div>
        </div>
        <div className="w-full h-px bg-gray-700/50 my-1 md:my-2"></div>
        <div className="flex items-center gap-1 md:gap-3 text-gray-300 font-mono text-xs md:text-lg">
          <Clock className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0 hidden sm:block" />
          <div className="flex flex-col flex-1">
            <span className="text-[8px] md:text-[10px] text-gray-500 uppercase tracking-widest leading-none mb-0.5 md:mb-1">Game</span>
            <span className="leading-none whitespace-nowrap">{formatMins(gameTimer.seconds)}</span>
          </div>
        </div>
      </div>

      {/* Category/Round Info - Top Center */}
      <div className={`${widgetClass} flex-col px-2 md:px-6 flex-1 max-w-[200px] md:max-w-md items-center justify-center text-center gap-0.5 md:gap-1 overflow-hidden`}>
        {match.categoryName && (
          <h2 className="text-[10px] md:text-sm font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-wider uppercase leading-tight truncate w-full px-2" title={match.categoryName}>
            {match.categoryName}
          </h2>
        )}

        <div className="flex flex-col items-center justify-center -space-y-0.5">
          {match.roundName && (
            <div className="text-[8px] md:text-[10px] text-white/90 font-mono font-bold tracking-[0.2em] uppercase px-2 py-0.5 bg-slate-800/80 rounded border border-slate-700/50 shadow-inner scale-90 md:scale-100">
              {match.roundName}
            </div>
          )}

          <div className="h-5 md:h-6 mt-1.5 md:mt-2 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {pointStatus && (
                <motion.div
                  key={pointStatus.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`px-2 py-0.5 rounded border text-[8px] md:text-[9px] font-black uppercase tracking-widest animate-pulse shadow-lg ${pointStatus.type === 'gp'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-amber-900/20'
                      : pointStatus.type === 'gp_game'
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-cyan-900/20'
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-emerald-900/20'
                    }`}
                >
                  {pointStatus.label}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Scoreboard - Top Right */}
      <div className={`${widgetClass} p-0 bg-gray-900/90`}>

        {/* Teams Label Column */}
        <div className="flex flex-col bg-gray-800/50 justify-center px-2 md:px-4 py-1 md:py-2 border-r border-gray-700/50 min-w-[70px] md:min-w-[140px] max-w-[100px] md:max-w-[200px]">
          <div className="text-[10px] md:text-sm font-semibold text-white flex-1 flex items-center overflow-hidden text-ellipsis whitespace-nowrap" title={team1Label}>
            {team1Label}
          </div>
          <div className="w-full h-px bg-gray-700/50 my-0.5 md:my-1"></div>
          <div className="text-[10px] md:text-sm font-semibold text-white flex-1 flex items-center overflow-hidden text-ellipsis whitespace-nowrap" title={team2Label}>
            {team2Label}
          </div>
        </div>

        {/* Games Columns */}
        {gamesList.map(gameNum => {
          const isCurrent = gameNum === currentGame;

          let t1Score = '-';
          let t2Score = '-';
          let isT1Winner = false;
          let isT2Winner = false;

          if (gameNum < currentGame) {
            const history = gameHistory.find(g => g.game === gameNum);
            if (history) {
              t1Score = history.scores.team1;
              t2Score = history.scores.team2;
              isT1Winner = history.winner === 'team1';
              isT2Winner = history.winner === 'team2';
            }
          } else if (gameNum === currentGame) {
            t1Score = scores.team1;
            t2Score = scores.team2;
          }

          return (
            <div
              key={gameNum}
              className={`flex flex-col justify-center px-1.5 md:px-3 py-1 border-r border-gray-700/50 min-w-[2rem] md:min-w-[3.5rem] text-center
                ${isCurrent ? 'bg-emerald-900/30' : ''}
              `}
            >
              <div className={`font-mono text-sm md:text-xl font-bold flex-1 flex items-center justify-center overflow-hidden relative ${isT1Winner ? 'text-emerald-400' : isCurrent || t1Score !== '-' ? 'text-white' : 'text-gray-600'}`}>
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={`t1-${t1Score}`}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -10, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="absolute"
                  >
                    {t1Score}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="w-full h-px bg-transparent my-0.5"></div>

              <div className={`font-mono text-sm md:text-xl font-bold flex-1 flex items-center justify-center overflow-hidden relative ${isT2Winner ? 'text-emerald-400' : isCurrent || t2Score !== '-' ? 'text-white' : 'text-gray-600'}`}>
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={`t2-${t2Score}`}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -10, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="absolute"
                  >
                    {t2Score}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default Scoreboard;
