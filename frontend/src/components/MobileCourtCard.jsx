import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import MobileLiveScoreDisplay from './MobileLiveScoreDisplay';
import MobileNextMatchDisplay from './MobileNextMatchDisplay';
import { CONFIG } from '../utils/config';

const MobileCourtCard = ({ courtId, viewMode }) => {
  const [liveMatch, setLiveMatch] = useState(null);
  const [nextMatch, setNextMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  const [lastMatchData, setLastMatchData] = useState(null);

  // Sync Live Match & Next Match
  useEffect(() => {
    let socket;
    const initLiveSync = async () => {
      try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/api/court_status/${courtId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            if (json.match) setLiveMatch(json.match);
            if (json.nextMatch) setNextMatch(json.nextMatch);
            else setNextMatch(null); 
            if (json.lastMatch) setLastMatchData(json.lastMatch);
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch ${courtId}`, err);
      }

      socket = io(CONFIG.BACKEND_URL, { transports: ['websocket', 'polling'] });
      socket.emit('spectate_court', { courtNumber: courtId });
      socket.on('spectator_update', ({ match, nextMatch, lastMatch }) => {
        if (match !== undefined) setLiveMatch(match);
        if (nextMatch !== undefined) setNextMatch(nextMatch);
        if (lastMatch !== undefined) setLastMatchData(lastMatch);
      });
      setLoading(false);
    };

    initLiveSync();
    
    return () => { 
        if (socket) socket.disconnect(); 
    };
  }, [courtId]);

  // Periodic re-render to check expiry
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const displayedLiveMatch = (() => {
    if (!liveMatch || ['Assigned', 'Scheduled'].includes(liveMatch.status)) {
      if (lastMatchData) {
        const finishedAt = new Date(lastMatchData.updatedAt || Date.now()).getTime();
        if (Date.now() - finishedAt < 300000) { // 5 minutes
          return lastMatchData;
        }
      }
    }
    return liveMatch;
  })();

  const courtName = courtId.replace('_', ' ').toUpperCase();
  const currentMatch = viewMode === 'live' ? displayedLiveMatch : nextMatch;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl mb-6">
      <div className="bg-slate-800/50 px-5 py-3 flex items-center justify-center border-b border-white/5 relative min-h-[64px]">
        {/* Left: Category & Round */}
        {currentMatch && (
          <div className="absolute left-4 flex flex-col items-start max-w-[30%] overflow-hidden">
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider truncate w-full leading-tight">
              {currentMatch.category || 'Match'}
            </span>
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider truncate w-full leading-tight">
              {currentMatch.round || 'Normal'}
            </span>
          </div>
        )}

        {/* Center: Court Number */}
        <h3 className="text-amber-500 font-black text-xl italic tracking-tighter text-center">{courtName}</h3>

        {/* Right: Status Indicator (Only in Live mode) */}
        {viewMode === 'live' && displayedLiveMatch && !loading && (
           <div className="absolute right-4 flex items-center">
             {['Completed', 'Forfeited'].includes(displayedLiveMatch.status) ? (
               <div className="flex items-center justify-center px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                 <span className="text-emerald-400 text-[8px] font-black uppercase tracking-widest leading-none">
                   {displayedLiveMatch.status}
                 </span>
               </div>
             ) : (
               <div className="flex items-center justify-center space-x-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md">
                 <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                 <span className="text-red-500 text-[8px] font-black uppercase tracking-widest leading-none">Live</span>
               </div>
             )}
           </div>
        )}
      </div>

      <div className="min-h-[150px]">
        {loading ? (
          <div className="flex h-[150px] items-center justify-center">
            <div className="animate-spin w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          viewMode === 'live' ?
            <MobileLiveScoreDisplay match={displayedLiveMatch} courtId={courtId} /> :
            <MobileNextMatchDisplay matchConfig={nextMatch} courtId={courtId} />
        )}
      </div>
    </div>
  );
};

export default MobileCourtCard;
