import React from 'react';
import { Play, Settings, AlertCircle } from 'lucide-react';
import { CONFIG } from '../utils/config';

const MatchStatusBadge = ({ status }) => {
    const configs = {
        TBD: 'bg-slate-900/50 text-slate-600 border-slate-800',
        Created: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        Assigned: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.05)]',
        Scheduled: 'bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
        'In Progress': 'bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
        Completed: 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.05)]',
        Forfeited: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    };
    const labels = {
        TBD: 'TBD',
        Created: 'Created',
        Assigned: 'Assigned',
        Scheduled: 'Queued',
        'In Progress': 'Live',
        Completed: 'Finished',
        Forfeited: 'Forfeited'
    };

    return (
        <div className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${configs[status] || configs.TBD}`}>
            {labels[status] || status}
        </div>
    );
};

const BracketCard = ({ match, onEdit, onUpdate, onForfeit, isHighlighted, setGlobalError }) => {
    const isBye = match.status === 'BYE';
    const isSettingsLocked = ['Completed', 'Forfeited', 'In Progress'].includes(match.status);
    const isFinalized = ['Completed', 'Forfeited'].includes(match.status);
    const isLive = ['In Progress'].includes(match.status);
    const status = match.status || 'Assigned'; // Explicitly fallback if undefined

    const handleCourtChange = async (courtId) => {
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/match/${match._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courtId })
            });
            const json = await res.json();
            if (json.success) onUpdate(match.categoryId);
        } catch (err) { console.error('Court update error:', err); }
    };

    const handleStartMatch = async () => {
        if (!match.courtId) return;
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/match/${match._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Scheduled' })
            });
            const json = await res.json();
            if (json.success) onUpdate(match.categoryId);
            else if (setGlobalError) setGlobalError(json.message);
            else alert(json.message);
        } catch (err) { console.error('Start match error:', err); }
    };

    const renderPlayers = (name, isWinner, isLoser) => {
        const isSpecial = !name || name === 'TBD' || name === 'BYE' || name === 'Unknown Team';

        if (isSpecial) {
            return (
                <div className="flex flex-col items-center justify-center h-[40px]">
                    <div className="text-slate-600 italic opacity-60 uppercase tracking-widest text-[10px] font-bold py-1 px-4 bg-slate-800/20 rounded-lg">
                        {name || 'TBD'}
                    </div>
                </div>
            );
        }

        const parts = name.split(' / ');
        const p1 = parts[0];
        const p2 = parts[1]; // undefined for singles

        const colorClass = isWinner ? 'text-emerald-400 font-bold' : isLoser ? 'text-slate-400 grayscale' : 'text-slate-100 font-medium'; // LIGHTER WEIGHT FOR DEFAULT STATE

        return (
            <div className="flex flex-col items-center justify-center h-[40px] space-y-1">
                <div className={`text-xs truncate uppercase tracking-tight leading-tight h-4 flex items-center transition-all duration-700 ${colorClass}`}>
                    {p1}
                </div>
                {/* Always render second slot, even if empty, for Singles/Doubles parity */}
                <div className={`text-xs truncate uppercase tracking-tight leading-tight h-4 flex items-center transition-all duration-700 ${colorClass}`}>
                    {p2 || <span className="opacity-0">Placeholder</span>}
                </div>
            </div>
        );
    };

    return (
        <div
            id={'match-' + match._id}
            className={`w-[400px] h-[220px] max-h-[220px] flex flex-col bg-slate-900 group relative border rounded-[1.5rem] overflow-visible shadow-2xl backdrop-blur-md transition-all 
                ${isHighlighted ? 'border-cyan-400 ring-[8px] ring-blue-500/40 ring-offset-[8px] ring-offset-[#020617] z-50' : 'border-slate-800 hover:border-slate-700 hover:shadow-black/60'} 
                ${isBye ? 'opacity-40 grayscale-[0.5]' : ''}`}
        >
            {isHighlighted && (
                <>
                    <div className="absolute -inset-6 rounded-[2.5rem] animate-[pulse_1.5s_ease-in-out_infinite] bg-cyan-500/40 blur-2xl -z-10" />
                    <div className="absolute -inset-14 rounded-[4rem] animate-[pulse_2s_ease-in-out_infinite] bg-blue-600/10 blur-3xl -z-20" />
                </>
            )}
            <div className="bg-slate-800/40 pl-3 pr-5 flex items-center justify-between border-b border-white/5 min-h-[56px] shrink-0">
                <div className="w-[140px] flex flex-col text-[8px] font-black text-slate-500 uppercase leading-tight tracking-wider">
                    <span>Games per Match: {match.gamesPerMatch || 3}</span>
                    <span>Points per Game: {match.pointsPerGame || 21}</span>
                    <span>Golden Point @ {match.goldenPointAt || 20}</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center">
                    {match.courtId ? (
                        <div className="flex flex-col items-center justify-center -space-y-0.5">
                            <h3 className="text-amber-500 font-black text-lg italic tracking-tighter text-center leading-none">
                                Court {match.courtId}
                            </h3>
                            <span className="text-[9px] font-black text-slate-100 uppercase tracking-[0.2em] mt-1 leading-none">
                                Match {String((match.matchIndex || 0)).padStart(2, '0')}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center -space-y-0.5">
                            <h3 className="text-slate-700 font-black text-lg italic tracking-tighter text-center leading-none">
                                TBD
                            </h3>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 leading-none">
                                Match {String((match.matchIndex || 0)).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                </div>
                <div className="w-[140px] flex justify-end shrink-0">
                    <MatchStatusBadge status={match.status} />
                </div>
            </div>
            <div className="flex-1 bg-slate-800/10 px-6 py-1 flex flex-col items-center text-center space-y-1.5 justify-center relative overflow-hidden">
                <div className="">{renderPlayers(match.team1Name, match.matchResult?.winner === '1', match.matchResult?.winner === '2')}</div>
                <div className="flex items-center space-x-4 w-full opacity-10">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-slate-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">vs</span>
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-slate-500" />
                </div>
                <div className="">{renderPlayers(match.team2Name, match.matchResult?.winner === '2', match.matchResult?.winner === '1')}</div>
            </div>
            <div className="bg-slate-800/40 px-6 flex items-center border-t border-white/5 relative h-[48px] shrink-0">
                {/* Left Section: Play Button - flex-1 pushes center */}
                <div className="flex-1 flex items-center justify-start">
                    <button
                        disabled={match.status !== 'Assigned'}
                        onClick={handleStartMatch}
                        className={'p-2 rounded-full transition-all border ' + (match.status === 'Assigned' ? 'bg-amber-500 text-slate-900 border-amber-400 hover:scale-110 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-800 text-slate-600 border-slate-700 opacity-50 cursor-not-allowed')}
                    >
                        <Play className="w-4 h-4 fill-current" />
                    </button>
                </div>

                {/* Center Section: Round Name - flex-none for exact width */}
                <div className="flex-none flex items-center justify-center">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic whitespace-nowrap leading-none">
                        {match.roundName}
                    </span>
                </div>

                {/* Right Section: Settings Gear - flex-1 balances left */}
                <div className="flex-1 flex items-center justify-end">
                    <button
                        disabled={isSettingsLocked}
                        onClick={() => onEdit(match)}
                        className={'p-2 rounded-xl transition-all border shadow-lg shadow-black/20 ' + (isSettingsLocked ? 'bg-slate-800/20 text-slate-700 border-white/5 cursor-not-allowed' : 'bg-slate-800/50 hover:bg-amber-500/20 text-amber-500/90 hover:text-amber-400 border-white/5 hover:border-amber-500/50')}
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                    {!isBye && (
                        <button
                            disabled={isFinalized || status === 'TBD'}
                            onClick={() => onForfeit(match)}
                            title={isFinalized ? "Match finalized" : isLive ? "Forfeit Live Match" : status === "TBD" ? "Waiting for teams to forfeit" : "Forfeit Match"}
                            className={'p-2 ml-2 rounded-xl transition-all border ' + ((isFinalized || status === 'TBD') ? 'bg-slate-800/20 text-slate-700 border-white/5 cursor-not-allowed' : isLive ? 'bg-rose-500/10 hover:bg-rose-500/30 text-rose-500 border-rose-500/20 hover:border-rose-500/50' : 'bg-slate-800/50 hover:bg-rose-500/20 text-rose-500/70 hover:text-rose-400 border-white/5 hover:border-rose-500/50')}
                        >
                            <AlertCircle className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BracketCard;
export { MatchStatusBadge };
