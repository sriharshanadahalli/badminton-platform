import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import LiveScoreDisplay from './LiveScoreDisplay';
import NextMatchDisplay from './NextMatchDisplay';
import { CONFIG } from '../utils/config';

const SignageCourtPanel = ({ courtId }) => {
  const [liveMatch, setLiveMatch] = useState(null);
  const [nextMatch, setNextMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  const [lastMatchData, setLastMatchData] = useState(null);

  // Sync Live Match & Next Match
  useEffect(() => {
    let socket;
    
    const initLiveSync = async () => {
      try {
        const backendUrl = CONFIG.BACKEND_URL;
        const res = await fetch(`${backendUrl}/api/court_status/${courtId}`);
        if (res.ok) {
           const json = await res.json();
           if (json.success) {
             if (json.match) setLiveMatch(json.match);
             if (json.nextMatch !== undefined) setNextMatch(json.nextMatch);
             else setNextMatch(null);
             if (json.lastMatch) setLastMatchData(json.lastMatch);
           }
        }
      } catch (err) {
         console.warn(`Failed to fetch initial status for ${courtId}`, err);
      }

      const backendUrl = CONFIG.BACKEND_URL;
      console.log(`[Signage] Connecting to ${backendUrl} for courtId: "${courtId}"`);
      socket = io(backendUrl, {
         transports: ['websocket', 'polling'],
         reconnectionAttempts: 5
      });
      socket.emit('spectate_court', { courtId });
      console.log(`[Signage] Emitted spectate_court for "${courtId}"`);
      
      socket.on('spectator_update', ({ match, nextMatch, lastMatch }) => {
         console.log(`[Signage] RECEIVED spectator_update for ${courtId}. MatchStatus: ${match?.status}, LastStatus: ${lastMatch?.status}`);
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

  const displayedMatch = (() => {
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

  const displayCourtName = `COURT ${courtId}`;

  return (
    <div className="flex flex-col h-full bg-[#020617] p-2 space-y-2">
      <div className="flex-1 flex flex-col space-y-2 overflow-hidden relative">
        {/* Top Segment: Live / Last Completed (70% height) */}
        <div className="h-[70%] bg-[#0f172a] rounded-3xl border border-slate-800/10 shadow-2xl overflow-hidden relative">
           {loading ? (
              <div className="flex w-full h-full justify-center items-center"><div className="animate-spin w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full"/></div>
           ) : (
              <LiveScoreDisplay match={displayedMatch} courtId={courtId} />
           )}
        </div>

        {/* Bottom Segment: Upcoming (30% height) */}
        <div className="h-[30%] bg-slate-900/20 rounded-3xl border border-slate-800/10 shadow-[0_10px_30px_rgba(0,0,0,0.4)] overflow-hidden relative">
           <NextMatchDisplay matchConfig={nextMatch} />
        </div>
      </div>
    </div>
  );
};

export default SignageCourtPanel;
