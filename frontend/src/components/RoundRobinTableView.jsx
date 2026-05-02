import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users, Star, Medal, ArrowUp, ArrowDown, LayoutGrid, Info } from 'lucide-react';
import { CONFIG } from '../utils/config';
import BracketCard from './BracketCard';

const RoundRobinTableView = ({ matches, categoryId, onUpdate, onEdit, onForfeit, highlightedId, setGlobalError }) => {
    const [standings, setStandings] = useState([]);
    const [loadingStandings, setLoadingStandings] = useState(false);

    useEffect(() => {
        if (categoryId) fetchStandings();
    }, [categoryId, matches]); // Re-fetch when matches update (scores might have changed)

    const fetchStandings = async () => {
        setLoadingStandings(true);
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/round-robin/standings/${categoryId}`);
            const json = await res.json();
            if (json.success) {
                // Rank them client-side just in case, but server should handle it
                const sorted = [...json.data].sort((a, b) => {
                  if (b.points !== a.points) return b.points - a.points;
                  if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
                  return (a.playerName || '').localeCompare(b.playerName || '');
                });
                setStandings(sorted);
            }
        } catch (err) { console.error(err); }
        finally { setLoadingStandings(false); }
    };

    // Use Standings (reliable list) or Matches to determine the primary sorting order
    // We sort them Alphabetically (A-Z) so Row 1 is Player A, Row 2 is Player B, etc.
    const sortedPlayers = useMemo(() => {
        let playerList = [];
        
        if (standings && standings.length > 0) {
            // Best source: the standings table
            playerList = standings.map(s => ({ id: s.playerId, fullName: s.playerName }));
        } else {
            // Fallback: extract from matches
            const playersMap = new Map();
            matches.forEach(m => {
                [m.teams?.team1, m.teams?.team2].forEach(team => {
                    const p = team?.players?.[0];
                    if (p && p.id) playersMap.set(p.id, { id: p.id, fullName: p.fullName });
                });
            });
            playerList = Array.from(playersMap.values());
        }

        return playerList.sort((a, b) => 
            (a.fullName || '').localeCompare(b.fullName || '')
        );
    }, [matches, standings]);

    const findMatch = (p1Id, p2Id) => {
        return matches.find(m => 
            (m.teams?.team1?.players?.[0]?.id === p1Id && m.teams?.team2?.players?.[0]?.id === p2Id) ||
            (m.teams?.team1?.players?.[0]?.id === p2Id && m.teams?.team2?.players?.[0]?.id === p1Id)
        );
    };

    return (
        <div className="flex flex-col xl:flex-row items-start gap-8 w-full px-4">
            {/* 1. STANDINGS TABLE */}
            <div className="w-full xl:w-[520px] shrink-0 xl:sticky xl:top-[8vh] z-30">
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl shadow-black/50">
                    <div className="py-4 px-8 border-b border-white/5 bg-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                <Trophy className="w-4 h-4 text-amber-500" />
                            </div>
                            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] italic">Standings</h3>
                        </div>
                        <Medal className="w-4 h-4 text-slate-500" />
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950/40">
                                            <th className="pl-8 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">#</th>
                                            <th className="px-4 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Player</th>
                                            <th className="px-2 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">P</th>
                                            <th className="px-2 py-4 text-[9px] font-black text-emerald-500 uppercase tracking-widest text-center">W</th>
                                            <th className="px-2 py-4 text-[9px] font-black text-rose-500 uppercase tracking-widest text-center">L</th>
                                            <th className="px-2 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">G</th>
                                            <th className="px-2 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">PD</th>
                                            <th className="pr-8 py-4 text-[9px] font-black text-amber-500 uppercase tracking-widest text-right">Pts</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {(() => {
                                            const hasStarted = standings.some(s => s.matchesPlayed > 0);
                                            return standings.map((entry, idx) => {
                                                const isFirst = idx === 0 && hasStarted;
                                                const isSecond = idx === 1 && hasStarted;
                                                
                                                return (
                                                    <tr key={entry.playerId} className={`group hover:bg-white/5 transition-colors 
                                                        ${isFirst ? 'bg-amber-500/10' : isSecond ? 'bg-slate-400/5' : ''}`}>
                                                        <td className="pl-8 py-4 text-[10px] font-black">
                                                            <div className="flex items-center space-x-2">
                                                                <span className={isFirst ? 'text-amber-500' : isSecond ? 'text-slate-400' : 'text-slate-600'}>
                                                                    {idx + 1}
                                                                </span>
                                                                {isFirst && <Trophy className="w-3 h-3 text-amber-500" />}
                                                                {isSecond && <Medal className="w-3 h-3 text-slate-400" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap">
                                                            <span className={`text-[11px] font-black uppercase ${isFirst ? 'text-amber-500' : isSecond ? 'text-slate-100' : 'text-white'}`}>
                                                                {entry.playerName}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-4 text-center">
                                                            <span className="text-xs font-bold text-slate-500">{entry.matchesPlayed}</span>
                                                        </td>
                                                        <td className="px-2 py-4 text-center">
                                                            <span className="text-xs font-bold text-emerald-500/60">{entry.wins}</span>
                                                        </td>
                                                        <td className="px-2 py-4 text-center">
                                                            <span className="text-xs font-bold text-rose-500/60">{entry.losses}</span>
                                                        </td>
                                                        <td className="px-2 py-4 text-center">
                                                            <span className="text-[10px] font-bold text-slate-500">{entry.gamesWon}-{entry.gamesLost}</span>
                                                        </td>
                                                        <td className="px-2 py-4 text-center">
                                                            <span className={`text-[10px] font-bold ${entry.pointDifference >= 0 ? 'text-emerald-500/40' : 'text-rose-500/40'}`}>
                                                                {entry.pointDifference > 0 ? '+' : ''}{entry.pointDifference}
                                                            </span>
                                                        </td>
                                                        <td className="pr-8 py-4 text-right font-black italic">
                                                            <span className={isFirst ? 'text-amber-500 text-sm' : isSecond ? 'text-slate-100' : 'text-amber-500'}>
                                                                {entry.points}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 2. COMPRESSED GRID (NO LEADING SPACERS) */}
            <div id="rr-grid-container" className="flex-1 w-full overflow-x-auto custom-scrollbar pb-16">
                <div className="inline-block min-w-max">
                    <table className="border-separate border-spacing-x-12 border-spacing-y-8">
                        <tbody>
                            {sortedPlayers.slice(0, -1).map((rowPlayer, rIdx) => (
                                <tr key={rowPlayer.id}>
                                    {sortedPlayers.slice(rIdx + 1).map((colPlayer) => {
                                        const originalMatch = findMatch(rowPlayer.id, colPlayer.id);
                                        // CLONE AND SWAP so rowPlayer is ALWAYS Team 1 (Top)
                                        let match = null;
                                        if (originalMatch) {
                                            match = JSON.parse(JSON.stringify(originalMatch));
                                            
                                            // FLIP LOGIC: Compare names to decide if we need to swap
                                            // We want rowPlayer to be Team 1 (Top)
                                            const t1Name = match.team1Name || (match.players?.team1?.[0]);
                                            const isTeam1Row = t1Name === rowPlayer.fullName;
                                            
                                            if (!isTeam1Row) {
                                                // 1. Swap Teams Metadata
                                                const tTeam = match.teams.team1;
                                                match.teams.team1 = match.teams.team2;
                                                match.teams.team2 = tTeam;

                                                // 2. Swap Display Names (Strings used by BracketCard)
                                                const tNameStr = match.team1Name;
                                                match.team1Name = match.team2Name;
                                                match.team2Name = tNameStr;

                                                // 3. Swap Players Array
                                                if (match.players) {
                                                    const tNames = match.players.team1;
                                                    match.players.team1 = match.players.team2;
                                                    match.players.team2 = tNames;
                                                }

                                                // 4. Swap Player IDs
                                                if (match.playerIds) {
                                                    const tIds = match.playerIds.team1;
                                                    match.playerIds.team1 = match.playerIds.team2;
                                                    match.playerIds.team2 = tIds;
                                                }

                                                // 5. Swap Scores/Result
                                                if (match.matchResult) {
                                                    const tS1 = match.matchResult.score1;
                                                    match.matchResult.score1 = match.matchResult.score2;
                                                    match.matchResult.score2 = tS1;
                                                    if (match.matchResult.winner) {
                                                        match.matchResult.winner = match.matchResult.winner === '1' ? '2' : '1';
                                                    }
                                                }
                                            }
                                        }

                                        return (
                                            <td key={colPlayer.id} className="p-0 align-top">
                                                <div className="w-[420px]">
                                                    {match ? (
                                                        <div className="scale-90 origin-top hover:scale-[0.92] transition-transform duration-300">
                                                            <BracketCard 
                                                                match={match}
                                                                onEdit={onEdit}
                                                                onUpdate={onUpdate}
                                                                onForfeit={onForfeit}
                                                                isHighlighted={highlightedId == match._id}
                                                                setGlobalError={setGlobalError}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="h-[200px] flex items-center justify-center bg-slate-900/10 rounded-[2rem] border border-dashed border-white/5 opacity-10">
                                                            <LayoutGrid className="w-8 h-8 text-slate-700" />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RoundRobinTableView;
