import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserPlus, Trophy, Users, Loader2, UserMinus, CheckCircle2 } from 'lucide-react';
import { CONFIG } from '../utils/config';
import { AlertModal } from './TournamentModals';

const RoundRobinSetupModal = ({ isOpen, onClose, onGenerate }) => {
    const [categoryName, setCategoryName] = useState('');
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [allPlayers, setAllPlayers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ open: false, message: '', title: '' });
    const isFetched = React.useRef(false);

    useEffect(() => {
        if (isOpen && !isFetched.current) {
            isFetched.current = true;
            fetchPlayers();
            setCategoryName('');
            setSelectedPlayers([]);
            setSearchTerm('');
        }
        if (!isOpen) {
            isFetched.current = false;
        }
    }, [isOpen]);

    const fetchPlayers = async () => {
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/view`);
            const json = await res.json();
            if (json.success) {
                // Extract unique players from profiles
                const players = json.data.reduce((acc, item) => {
                    if (item.player1) acc.add(JSON.stringify({ id: item.raw.player1Id, name: item.player1 }));
                    if (item.player2) acc.add(JSON.stringify({ id: item.raw.player2Id, name: item.player2 }));
                    return acc;
                }, new Set());
                
                setAllPlayers(Array.from(players).map(s => JSON.parse(s)).sort((a, b) => a.name.localeCompare(b.name)));
            }
        } catch (err) { console.error(err); }
    };

    const togglePlayer = useCallback((player) => {
        setSelectedPlayers(prev => {
            if (prev.find(p => p.id === player.id)) {
                return prev.filter(p => p.id !== player.id);
            } else {
                return [...prev, player];
            }
        });
    }, []);

    const filteredPlayers = useMemo(() => {
        if (!searchTerm) return allPlayers;
        const lowSearch = searchTerm.toLowerCase();
        return allPlayers.filter(p => p.name.toLowerCase().includes(lowSearch));
    }, [allPlayers, searchTerm]);

    const selectedIds = useMemo(() => new Set(selectedPlayers.map(p => p.id)), [selectedPlayers]);

    const handleGenerate = async () => {
        if (!categoryName) return setAlert({ open: true, message: "Please enter a category name", title: "Validation Error" });
        if (selectedPlayers.length < 2) return setAlert({ open: true, message: "Please select at least 2 players", title: "Validation Error" });

        setLoading(true);
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/generate-round-robin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoryName,
                    playerIds: selectedPlayers.map(p => p.id)
                })
            });
            const json = await res.json();
            if (json.success) {
                onGenerate(json);
                onClose();
            } else {
                setAlert({ open: true, message: json.message, title: "Generation Failed" });
            }
        } catch (err) {
            console.error(err);
            setAlert({ open: true, message: "Failed to generate league", title: "Network Error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[#020617]/90 backdrop-blur-xl" 
                        onClick={onClose} 
                    />
                    
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-5xl bg-slate-950 rounded-[3rem] border border-white/10 shadow-3xl overflow-hidden flex flex-col h-[85vh]"
                    >
                    {/* Header */}
                    <div className="p-8 border-b border-white/5 flex items-center justify-between bg-slate-900/20">
                        <div className="flex items-center space-x-5">
                            <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 shadow-lg shadow-amber-500/5">
                                <Trophy className="w-8 h-8 text-amber-500" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">New League</h2>
                                <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.3em] mt-2 opacity-60">Round Robin Generation Engine</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full transition-all group">
                            <X className="w-7 h-7 text-slate-500 group-hover:text-white transition-colors" />
                        </button>
                    </div>

                    {/* Content Split Layout */}
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        
                        {/* LEFT: Player Pool Selection */}
                        <div className="w-full md:w-[400px] border-r border-white/5 flex flex-col bg-slate-900/30">
                            <div className="p-6 space-y-4">
                                <div className="space-y-2 px-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter League Name..."
                                        value={categoryName}
                                        onChange={(e) => setCategoryName(e.target.value)}
                                        className="w-full bg-slate-950/60 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-amber-500/40 transition-all placeholder:text-slate-700"
                                    />
                                </div>
                                <div className="relative pt-2">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input 
                                        type="text" 
                                        placeholder="Search participants..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-900/40 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-xs font-bold text-white outline-none focus:bg-slate-900 transition-all"
                                    />
                                </div>
                            </div>
                            
                            <MemoizedPlayerList 
                                players={filteredPlayers} 
                                selectedIds={selectedIds} 
                                onToggle={togglePlayer} 
                            />
                        </div>

                        {/* RIGHT: Selection Review */}
                        <MemoizedSelectionReview 
                            selectedPlayers={selectedPlayers} 
                            onToggle={togglePlayer} 
                        />
                    </div>

                    {/* Footer */}
                    <div className="p-10 border-t border-white/5 bg-slate-950/80 backdrop-blur-2xl">
                        <div className="max-w-xl mx-auto flex items-center space-x-6">
                            <button 
                                onClick={onClose}
                                className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleGenerate}
                                disabled={loading || !categoryName || selectedPlayers.length < 2}
                                className="flex-1 py-5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 rounded-3xl text-slate-950 font-black uppercase tracking-[0.2em] shadow-2xl shadow-amber-500/20 transition-all flex items-center justify-center space-x-4 border-t border-white/20 active:scale-95"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span>Forging League...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trophy className="w-6 h-6" />
                                        <span>Generate {selectedPlayers.length > 0 ? (selectedPlayers.length * (selectedPlayers.length - 1) / 2) : 0} Matches</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
                
                <AlertModal 
                    isOpen={alert.open} 
                    message={alert.message} 
                    title={alert.title} 
                    onClose={() => setAlert({ ...alert, open: false })} 
                />
                </div>
            )}
        </AnimatePresence>
    );
};

// --- Optimized Sub-Components to Prevent Input Lag ---

const MemoizedPlayerList = React.memo(({ players, selectedIds, onToggle }) => (
    <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1 custom-scrollbar">
        {players.map(p => {
            const isSelected = selectedIds.has(p.id);
            return (
                <button 
                    key={p.id}
                    onClick={() => onToggle(p)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${isSelected ? 'bg-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/5' : 'hover:bg-white/5 border-transparent'}`}
                >
                    <div className="flex items-center space-x-3 overflow-hidden">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-500'}`}>
                            {isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col items-start truncate">
                            <span className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-slate-400'}`}>{p.name}</span>
                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{p.id}</span>
                        </div>
                    </div>
                    <UserPlus className={`w-4 h-4 transition-all ${isSelected ? 'text-amber-500 opacity-100 scale-110' : 'text-slate-700 opacity-0 group-hover:opacity-100'}`} />
                </button>
            );
        })}
    </div>
));

const MemoizedSelectionReview = React.memo(({ selectedPlayers, onToggle }) => (
    <div className="flex-1 flex flex-col bg-slate-950">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Draft Lineup</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 italic">Each player will play every other player once</p>
            </div>
            <div className="px-4 py-2 bg-slate-900 rounded-xl border border-white/5">
                <span className="text-xl font-black text-amber-500 italic leading-none">{selectedPlayers.length}</span>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Participants</span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {selectedPlayers.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AnimatePresence mode='popLayout'>
                        {selectedPlayers.map((player, idx) => (
                            <motion.div 
                                key={player.id}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="flex items-center justify-between p-5 bg-slate-900/40 border border-white/10 rounded-[1.5rem] group hover:border-amber-500/30 transition-all"
                            >
                                <div className="flex items-center space-x-4 overflow-hidden">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                                        <span className="text-xs font-black text-slate-950 uppercase">{idx + 1}</span>
                                    </div>
                                    <div className="flex flex-col truncate">
                                        <span className="text-sm font-black text-white truncate">{player.name}</span>
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Confirmed Entry</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onToggle(player)}
                                    className="p-2 hover:bg-rose-500/10 rounded-xl transition-all group/btn"
                                >
                                    <UserMinus className="w-5 h-5 text-slate-700 group-hover/btn:text-rose-500" />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                        <Users className="w-10 h-10 text-slate-700" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">No Players Selected</p>
                        <p className="text-[10px] font-bold text-slate-600 uppercase mt-2">Select players from the left panel to begin</p>
                    </div>
                </div>
            )}
        </div>
    </div>
));

export default RoundRobinSetupModal;
