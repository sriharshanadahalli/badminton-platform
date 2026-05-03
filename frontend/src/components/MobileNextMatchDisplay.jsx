import React from 'react';
import { Clock, Calendar } from 'lucide-react';

const MobileNextMatchDisplay = ({ matchConfig, courtId }) => {
  if (!matchConfig) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-600 italic text-[10px] uppercase tracking-widest font-black text-center">
        Next Match will be scheduled soon
      </div>
    );
  }

  const team1Names = matchConfig.teams?.team1?.players?.map(p => p.fullName) || [];
  const team2Names = matchConfig.teams?.team2?.players?.map(p => p.fullName) || [];

  return (
    <div className="flex flex-col w-full bg-slate-900/40 border-t border-slate-700/20">
      <div className="p-4 space-y-4 flex flex-col items-center text-center">
        {/* Team 1 Area */}
        <div className="flex flex-col items-center">
          <div className="flex flex-col items-center">
            {(team1Names.length > 0 ? team1Names : ['TBD']).map((p, i) => (
              <span key={i} className="text-slate-200 font-bold text-base tracking-tight leading-snug">{p}</span>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-3 opacity-20 py-1">
          <div className="w-8 h-px bg-slate-500" />
          <span className="text-[8px] font-black italic tracking-widest">VS</span>
          <div className="w-8 h-px bg-slate-500" />
        </div>

        {/* Team 2 Area */}
        <div className="flex flex-col items-center">
          <div className="flex flex-col items-center">
            {(team2Names.length > 0 ? team2Names : ['TBD']).map((p, i) => (
              <span key={i} className="text-slate-200 font-bold text-base tracking-tight leading-snug">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileNextMatchDisplay;
