import React from 'react';

const NextMatchDisplay = ({ matchConfig }) => {
  if (!matchConfig) {
    return (
      <div className="flex flex-col w-full h-full justify-center items-center p-6 text-center opacity-40">
        <h3 className="text-slate-500 text-base font-semibold tracking-widest uppercase italic">Next match will be scheduled soon</h3>
      </div>
    );
  }

  // Use full names
  const participants = matchConfig.players || matchConfig.participants || { team1: [], team2: [] };
  const team1Names = participants.team1?.join(' / ') || 'TBD';
  const team2Names = participants.team2?.join(' / ') || 'TBD';

  return (
    <div className="flex flex-col w-full h-full bg-slate-900/10">
      {/* Centered Header */}
      <div className="h-[4vh] bg-slate-800/40 border-b border-slate-700/30 flex justify-center items-center text-[8px] font-black text-slate-500 uppercase tracking-[0.4em] px-4">
        <span className="truncate">UP NEXT • {matchConfig.categoryName} • {matchConfig.roundName}</span>
      </div>

      {/* Centered Players */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-1 text-center">
        <span className="text-lg font-semibold tracking-tight text-slate-400 mb-1 truncate w-full">{team1Names}</span>

        <div className="opacity-20 my-1 flex items-center justify-center">
          <span className="text-[8px] font-black italic tracking-[0.2em]">VS</span>
        </div>

        <span className="text-lg font-semibold tracking-tight text-slate-400 mt-1 truncate w-full">{team2Names}</span>
      </div>
    </div>
  );
};

export default NextMatchDisplay;
