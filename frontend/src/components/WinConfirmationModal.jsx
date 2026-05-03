import React from 'react';
import { motion } from 'framer-motion';
import { useMatch } from '../context/MatchContext';
import { Trophy, ArrowLeft } from 'lucide-react';

const WinConfirmationModal = () => {
  const { pendingWinDetails, confirmWin, undoLastPoint, match } = useMatch();

  if (!pendingWinDetails) return null;

  const { team1Score, team2Score, winnerId, matchCompleted } = pendingWinDetails;
  const isTeam1Winner = winnerId === 'team1';

  const winningTeamName = winnerId === 'team1' 
    ? (match?.teams?.team1?.players?.map(p => p.firstName).join(' / ') || 'Team 1') 
    : (match?.teams?.team2?.players?.map(p => p.firstName).join(' / ') || 'Team 2');
  const title = matchCompleted ? "Match Point Scored!" : "Game Point Scored!";

  return (
    <div className="absolute inset-0 z-50 bg-gray-900/95 backdrop-blur-md flex items-center justify-center p-4 selection:bg-transparent">
      <motion.div 
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        className="bg-gray-900 border border-gray-700 p-5 md:p-6 rounded-2xl shadow-2xl max-w-md w-full relative flex flex-col items-center"
      >
        <h2 className="text-xl md:text-2xl font-black text-white text-center mb-1 uppercase tracking-widest leading-none drop-shadow-md">
          {title}
        </h2>
        
        <p className="text-gray-400 text-sm text-center mb-4 max-w-xs mx-auto">
          <span className="text-emerald-400 font-bold">{winningTeamName}</span> has scored the winning point.
        </p>

        <div className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 mb-6 flex justify-center items-center space-x-6 shadow-inner">
           <span className="text-emerald-400 font-black text-3xl">{isTeam1Winner ? team1Score : team2Score}</span>
           <span className="text-gray-500 font-bold text-[10px] uppercase tracking-[0.2em] px-3">Final Score</span>
           <span className="text-gray-600 font-black text-3xl">{isTeam1Winner ? team2Score : team1Score}</span>
        </div>

        <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 w-full">
          <button 
            onClick={undoLastPoint}
            className="flex-1 flex items-center justify-center space-x-2 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold rounded-xl transition-all shadow-md active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-amber-500" />
            <span className="uppercase tracking-widest text-[10px]">Undo Point</span>
          </button>
          
          <button 
            onClick={confirmWin}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
          >
            <span className="uppercase tracking-widest text-[10px]">Confirm & Continue</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default WinConfirmationModal;
