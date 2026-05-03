import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, Table as TableIcon, CheckCircle2, AlertCircle,
    Settings, GitBranch, LayoutGrid, ChevronRight,
    FileSpreadsheet, Plus, Save, Play, RefreshCw, Home, BarChart2, Grid, Users, Search,
    ArrowUpDown, ChevronUp, ChevronDown, Trophy, FlaskConical
} from 'lucide-react';
import { CONFIG } from '../utils/config';
import Papa from 'papaparse';
import io from 'socket.io-client';
import RoundRobinSetupModal from '../components/RoundRobinSetupModal';
import RoundRobinTableView from '../components/RoundRobinTableView';
import BracketCard, { MatchStatusBadge } from '../components/BracketCard';
import { AlertModal, ConfirmModal } from '../components/TournamentModals';

const SchedulerView = () => {
    const [activeTab, setActiveTab] = useState('home'); // 'home', 'data', 'brackets'
    const [categories, setCategories] = useState([]);
    const [summaryData, setSummaryData] = useState([]);
    const [resolvedData, setResolvedData] = useState([]);
    const [resultsData, setResultsData] = useState([]);
    const [simMatches, setSimMatches] = useState([]);
    const [simN, setSimN] = useState(16);
    const [loading, setLoading] = useState(false);
    const [notif, setNotif] = useState(null);

    // Bracket State
    const [selectedCategory, setSelectedCategory] = useState('');
    const [bracketMatches, setBracketMatches] = useState([]);
    const [editingMatch, setEditingMatch] = useState(null);
    const [forfeitMatch, setForfeitMatch] = useState(null);
    const [globalError, setGlobalError] = useState(null);
    const [courtsState, setCourtsState] = useState([]);
    const [playerAvailability, setPlayerAvailability] = useState([]);
    const [playerSearch, setPlayerSearch] = useState('');
    const [dataSearch, setDataSearch] = useState('');
    const [playerSort, setPlayerSort] = useState({ key: 'playerName', direction: 'asc' });
    const [highlightedMatchId, setHighlightedMatchId] = useState(null);
    const [pendingScrollMatchId, setPendingScrollMatchId] = useState(null);

    // [EXPERIMENTAL] Bulk Bracket Generation State
    const [bulkGenStatus, setBulkGenStatus] = useState('idle'); // 'idle', 'processing', 'completed'
    const [bulkResults, setBulkResults] = useState([]);
    const [isRRModalOpen, setIsRRModalOpen] = useState(false);
    const [confirm, setConfirm] = useState({ open: false, message: '', title: '', onConfirm: null });
    const [overviewSort, setOverviewSort] = useState({ key: 'categoryName', direction: 'asc' });

    useEffect(() => {
        fetchSummary();
        fetchMetadata();
        fetchCourts();
        fetchPlayerAvailability();
        fetchResults();
    }, []);

    // Live Sockets for Tournament Updates (Queue shifts, progress, etc)
    useEffect(() => {
        const socket = io(CONFIG.BACKEND_URL, { transports: ['websocket', 'polling'] });

        socket.on('scheduler_update', () => {
            console.log("Realtime scheduler update received!");
            fetchCourts();
            fetchSummary();
            fetchResults();
            fetchPlayerAvailability(true);
            if (selectedCategory) {
                fetchBracket(selectedCategory, true);
            }
        });

        return () => socket.disconnect();
    }, [selectedCategory]);

    // Fetch bracket when category changes
    useEffect(() => {
        if (selectedCategory) {
            fetchBracket(selectedCategory);
        }
    }, [selectedCategory]);

    // Enhanced Match Zoom Effect: Triggers only when tab is active and data is loaded
    useEffect(() => {
        if (activeTab === 'brackets' && !loading && pendingScrollMatchId) {
            const container = document.getElementById('bracket-view-container');
            if (!container) return; 

            const element = container.querySelector(`#match-${pendingScrollMatchId}`);
            
            if (element) {
                // Timeout to ensure layout is fully painted
                const timer = setTimeout(() => {
                    // 1. Calculate absolute position for vertical window centering
                    const rect = element.getBoundingClientRect();
                    
                    // Vertical centering in the WINDOW (Works for both Bracket and RR)
                    const scrollY = window.pageYOffset + rect.top - (window.innerHeight / 2) + (rect.height / 2);
                    window.scrollTo({ top: scrollY, behavior: 'smooth' });

                    // 2. Horizontal centering - Find the correct scrollable container
                    // RR view has an internal scrollable div, Brackets use the main container
                    const rrContainer = document.getElementById('rr-grid-container');
                    const scrollContainer = rrContainer || container;
                    
                    const containerRect = scrollContainer.getBoundingClientRect();
                    const targetLeft = scrollContainer.scrollLeft + (rect.left - containerRect.left) - (containerRect.width / 2) + (rect.width / 2);
                    
                    scrollContainer.scrollTo({ left: targetLeft, behavior: 'smooth' });
                    
                    setPendingScrollMatchId(null);
                    setTimeout(() => setHighlightedMatchId(null), 3000);
                }, 150);
                
                return () => clearTimeout(timer);
            }
        }
    }, [activeTab, loading, bracketMatches, pendingScrollMatchId]);


    const fetchSummary = async () => {
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/summary`);
            const json = await res.json();
            if (json.success) setSummaryData(json.data);
        } catch (err) { console.error('Summary fetch error:', err); }
    };

    const fetchCourts = async () => {
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/courts`);
            const json = await res.json();
            if (json.success) setCourtsState(json.data);
        } catch (err) { console.error('Courts fetch error:', err); }
    };

    const fetchMetadata = async () => {
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/view`);
            const json = await res.json();
            if (json.success) {
                setResolvedData(json.data);
                const uniqueCats = Array.from(new Set(json.data.map(item => JSON.stringify({ id: item.raw.categoryId, name: item.categoryName }))))
                    .map(s => JSON.parse(s))
                    .sort((a, b) => a.name.localeCompare(b.name));
                setCategories(uniqueCats);
            }
        } catch (err) { console.error('Fetch error:', err); }
    };

    const fetchBracket = async (catId, silent = false) => {
        if (!catId) return;
        if (!silent) setLoading(true);
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/bracket-view/${catId}`);
            const json = await res.json();
            if (json.success) {
                setBracketMatches(json.data);
            }
        } catch (err) {
            console.error('Bracket fetch error:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchPlayerAvailability = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/player-availability`);
            const json = await res.json();
            if (json.success) setPlayerAvailability(json.data);
        } catch (err) {
            console.error('Player availability fetch error:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchResults = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/results`);
            const json = await res.json();
            if (json.success) setResultsData(json.data);
        } catch (err) {
            console.error('Results fetch error:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchSimulation = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/test/simulate-bracket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numPlayers: simN })
            });
            const json = await res.json();
            if (json.success) setSimMatches(json.data);
            else showNotif(json.message, 'error');
        } catch (err) {
            console.error('Simulation fetch error:', err);
            showNotif('Simulation failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    // [EXPERIMENTAL] Bulk Bracket Generation Logic
    const handleGenerateAllBrackets = async () => {
        setConfirm({
            open: true,
            title: "Regenerate All Brackets?",
            message: "This will REGENERATE brackets for ALL categories, deleting any existing matches. Proceed?",
            onConfirm: async () => {
                setConfirm(prev => ({ ...prev, open: false }));
                setBulkGenStatus('processing');
                setBulkResults([]);
                try {
                    const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/generate-all-brackets`, { method: 'POST' });
                    const json = await res.json();
                    if (json.success) {
                        setBulkResults(json.results);
                        setBulkGenStatus('completed');
                        fetchSummary(); // Update UI
                        showNotif("Bulk generation complete", "success");
                    } else {
                        showNotif(json.message, "error");
                        setBulkGenStatus('idle');
                    }
                } catch (err) {
                    console.error(err);
                    showNotif("Failed to generate all brackets", "error");
                    setBulkGenStatus('idle');
                }
            }
        });
    };

    // Performance Optimization: Memoize Filtered & Sorted Data
    const filteredPlayerAvailability = useMemo(() => {
        const term = playerSearch.toLowerCase().trim();
        let result = [...playerAvailability];

        if (term) {
            result = result.filter(e =>
                e.playerName.toLowerCase().includes(term) ||
                e.categoryName.toLowerCase().includes(term)
            );
        }

        // Apply Sorting
        if (playerSort.key) {
            result.sort((a, b) => {
                const valA = a[playerSort.key];
                const valB = b[playerSort.key];
                if (valA < valB) return playerSort.direction === 'asc' ? -1 : 1;
                if (valA > valB) return playerSort.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [playerAvailability, playerSearch, playerSort]);

    const filteredResolvedData = useMemo(() => {
        const term = dataSearch.toLowerCase().trim();
        if (!term) return resolvedData;
        return resolvedData.filter(item =>
            item.categoryName.toLowerCase().includes(term) ||
            item.player1.toLowerCase().includes(term) ||
            (item.player2 && item.player2.toLowerCase().includes(term))
        );
    }, [resolvedData, dataSearch]);

    const sortedSummaryData = useMemo(() => {
        let result = [...summaryData];
        if (overviewSort.key) {
            result.sort((a, b) => {
                const valA = a[overviewSort.key];
                const valB = b[overviewSort.key];
                
                // Handle numeric vs string
                if (typeof valA === 'string') {
                    return overviewSort.direction === 'asc' 
                        ? valA.localeCompare(valB) 
                        : valB.localeCompare(valA);
                }
                
                return overviewSort.direction === 'asc' 
                    ? valA - valB 
                    : valB - valA;
            });
        }
        return result;
    }, [summaryData, overviewSort]);

    const jumpToMatch = (catId, matchId) => {
        setActiveTab('brackets');
        setSelectedCategory(catId);
        
        // Set both highlight and pending scroll
        setHighlightedMatchId(matchId);
        setPendingScrollMatchId(matchId);

        // If the category is the same, useEffect on selectedCategory won't fire,
        // so we manually refresh to trigger the loading lifecycle
        if (selectedCategory === catId) {
            fetchBracket(catId);
        }
    };


    const showNotif = (message, type = 'success') => {
        setNotif({ message, type });
        setTimeout(() => setNotif(null), 4000);
    };

    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const parsedData = mapFlexibly(results.data, type);
                try {
                    const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/upload/${type}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(parsedData)
                    });
                    const json = await res.json();
                    if (json.success) {
                        showNotif(json.message);
                        fetchMetadata();
                    } else showNotif(json.message || 'Upload failed', 'error');
                } catch (err) { showNotif('Network error uploading data', 'error'); }
                finally { setLoading(false); e.target.value = ''; }
            }
        });
    };

    const mapFlexibly = (data, type) => {
        return data.map(row => {
            const mapped = {};
            const keys = Object.keys(row);
            const lowerKeys = keys.map(k => k.toLowerCase().trim());
            const findKey = (keywords) => {
                const index = lowerKeys.findIndex(lk => keywords.some(kw => lk.includes(kw)));
                return index !== -1 ? keys[index] : null;
            };
            if (type === 'categories') {
                const idKey = findKey(['id', 'cat']);
                const nameKey = findKey(['name', 'title']);
                mapped.categoryId = row[idKey]?.toString().trim() || '';
                mapped.categoryName = row[nameKey]?.toString().trim() || '';
            } else if (type === 'players') {
                const idKey = findKey(['id', 'profile', 'player']);
                const nameKey = findKey(['name', 'full']);
                mapped.profileId = row[idKey]?.toString().trim() || '';
                mapped.fullName = row[nameKey]?.toString().trim() || '';
            } else if (type === 'participation') {
                const catKey = findKey(['cat', 'group']);
                const p1Key = findKey(['player1', 'p1', 'lead', 'member1']);
                const p2Key = findKey(['player2', 'p2', 'partner', 'member2']);
                mapped.categoryId = row[catKey]?.toString().trim() || '';
                mapped.player1Id = row[p1Key]?.toString().trim() || '';
                mapped.player2Id = row[p2Key]?.toString().trim() || null;
            }
            return mapped;
        }).filter(item => {
            if (type === 'participation') return item.categoryId && item.player1Id;
            if (type === 'categories') return item.categoryId && item.categoryName;
            if (type === 'players') return item.profileId && item.fullName;
            return true;
        });
    };

    const generateBracket = async () => {
        if (!selectedCategory) return showNotif('Select a category first', 'error');
        setLoading(true);
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/generate-bracket/${selectedCategory}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const json = await res.json();
            if (json.success) {
                showNotif(json.message);
                fetchBracket(selectedCategory);
                fetchSummary();
            } else showNotif(json.message, 'error');
        } catch (err) { showNotif('Error generating bracket', 'error'); }
        finally { setLoading(false); }
    };

    const handleRRGenerated = (data) => {
        showNotif(data.message);
        fetchMetadata();
        fetchSummary();
        if (data.categoryId) {
            setSelectedCategory(data.categoryId);
            setActiveTab('brackets');
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans selection:bg-amber-500/30">
            {/* [EXPERIMENTAL] Bulk Generation Modal */}
            <BulkGenerationModal 
                status={bulkGenStatus} 
                results={bulkResults} 
                onClose={() => setBulkGenStatus('idle')} 
            />

            {/* Fixed Navigation Block */}
            <div className="fixed top-0 left-0 right-0 z-[60] bg-[#020617]/90 backdrop-blur-xl border-b border-white/5">
                <header className="h-[8vh] flex items-center justify-center px-8">
                    <div className="flex flex-col items-center">
                        <h1 className="text-2xl lg:text-4xl font-black tracking-[0.4em] italic bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent uppercase py-1 leading-none">
                            {CONFIG.TOURNAMENT_NAME}
                        </h1>
                        <div className="h-px w-20 bg-amber-500/40 mt-1.5" />
                    </div>
                </header>

                <div className="px-8 pb-2">
                    <div className="flex flex-col items-center md:items-start">
                        <div className="flex items-center space-x-3 mb-4 opacity-50">
                            <ChevronRight className="w-3 h-3 text-emerald-500" />
                            <h2 className="text-slate-400 font-bold text-[9px] uppercase tracking-[0.4em]">Tournament Management</h2>
                        </div>

                        <div className="grid grid-cols-7 gap-4 w-full max-w-4xl">
                            <TabButton id="home" active={activeTab} set={setActiveTab} label="Overview" icon={Home} />
                            <TabButton id="data" active={activeTab} set={setActiveTab} label="Data Source" icon={LayoutGrid} />
                            <TabButton id="brackets" active={activeTab} set={setActiveTab} label="Brackets" icon={GitBranch} />
                            <TabButton id="courts" active={activeTab} set={setActiveTab} label="Court View" icon={Grid} />
                            <TabButton id="players" active={activeTab} set={(id) => { setActiveTab(id); setPlayerSearch(''); }} label="Player View" icon={Users} />
                            <TabButton id="results" active={activeTab} set={setActiveTab} label="Results" icon={Trophy} />
                            <TabButton id="simulator" active={activeTab} set={setActiveTab} label="Simulator" icon={FlaskConical} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content with padding to account for fixed header/footer */}
            <main className="flex-1 mt-[18vh] mb-[10vh] p-2 lg:p-4 px-4 w-full relative">
                <AnimatePresence>
                    {activeTab === 'home' && (
                        <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                            <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-wider">Tournament Overview</h3>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Live match progress by category</p>
                                    </div>
                                    <div className="p-3 bg-amber-500/10 rounded-2xl">
                                        <BarChart2 className="w-6 h-6 text-amber-500" />
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-950/20">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-900/50">
                                                <th className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] w-16 text-center">#</th>
                                                <th 
                                                    onClick={() => setOverviewSort({ key: 'categoryName', direction: overviewSort.key === 'categoryName' && overviewSort.direction === 'asc' ? 'desc' : 'asc' })}
                                                    className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] cursor-pointer hover:text-amber-500 transition-colors"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <span>Category Name</span>
                                                        <ArrowUpDown className={`w-3 h-3 ${overviewSort.key === 'categoryName' ? 'opacity-100 text-amber-500' : 'opacity-20'}`} />
                                                    </div>
                                                </th>
                                                <th 
                                                    onClick={() => setOverviewSort({ key: 'total', direction: overviewSort.key === 'total' && overviewSort.direction === 'asc' ? 'desc' : 'asc' })}
                                                    className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center cursor-pointer hover:text-amber-500 transition-colors"
                                                >
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <span>Total Matches</span>
                                                        <ArrowUpDown className={`w-3 h-3 ${overviewSort.key === 'total' ? 'opacity-100 text-amber-500' : 'opacity-20'}`} />
                                                    </div>
                                                </th>
                                                <th 
                                                    onClick={() => setOverviewSort({ key: 'completed', direction: overviewSort.key === 'completed' && overviewSort.direction === 'asc' ? 'desc' : 'asc' })}
                                                    className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center cursor-pointer hover:text-amber-500 transition-colors"
                                                >
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <span>Completed</span>
                                                        <ArrowUpDown className={`w-3 h-3 ${overviewSort.key === 'completed' ? 'opacity-100 text-amber-500' : 'opacity-20'}`} />
                                                    </div>
                                                </th>
                                                <th 
                                                    onClick={() => setOverviewSort({ key: 'playersAvailable', direction: overviewSort.key === 'playersAvailable' && overviewSort.direction === 'asc' ? 'desc' : 'asc' })}
                                                    className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center cursor-pointer hover:text-amber-500 transition-colors"
                                                >
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <span>Players Available</span>
                                                        <ArrowUpDown className={`w-3 h-3 ${overviewSort.key === 'playersAvailable' ? 'opacity-100 text-amber-500' : 'opacity-20'}`} />
                                                    </div>
                                                </th>
                                                <th 
                                                    onClick={() => setOverviewSort({ key: 'ongoing', direction: overviewSort.key === 'ongoing' && overviewSort.direction === 'asc' ? 'desc' : 'asc' })}
                                                    className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center cursor-pointer hover:text-amber-500 transition-colors"
                                                >
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <span>Ongoing</span>
                                                        <ArrowUpDown className={`w-3 h-3 ${overviewSort.key === 'ongoing' ? 'opacity-100 text-amber-500' : 'opacity-20'}`} />
                                                    </div>
                                                </th>
                                                <th className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {sortedSummaryData.length > 0 ? (
                                                <>
                                                    {sortedSummaryData.map((cat, index) => (
                                                        <tr key={cat.categoryId} className="hover:bg-white/5 transition-colors group">
                                                            <td className="px-8 py-6">
                                                                <span className="text-xs font-black text-slate-500">{index + 1}</span>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <span className="text-base font-bold text-white group-hover:text-amber-400 transition-colors uppercase tracking-wide">{cat.categoryName}</span>
                                                            </td>
                                                            <td className="px-8 py-6 text-center">
                                                                <span className="text-lg font-black text-slate-300">{cat.total}</span>
                                                            </td>
                                                            <td className="px-8 py-6 text-center">
                                                                <span className="text-lg text-emerald-400 font-black tracking-tighter">{cat.completed}</span>
                                                            </td>
                                                            <td className="px-8 py-6 text-center">
                                                                <button 
                                                                    onClick={() => {
                                                                        setActiveTab('players');
                                                                        setPlayerSearch(cat.categoryName);
                                                                    }}
                                                                    className={`text-lg font-black transition-colors cursor-pointer ${cat.playersAvailable > 0 ? 'text-amber-500 hover:text-amber-400 underline decoration-amber-500/30 underline-offset-4' : 'text-slate-700 cursor-default'}`}
                                                                >
                                                                    {cat.playersAvailable}
                                                                </button>
                                                            </td>
                                                            <td className="px-8 py-6 text-center">
                                                                <span className={`text-lg font-black tracking-tighter ${cat.ongoing > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-600'}`}>
                                                                    {cat.ongoing}
                                                                </span>
                                                            </td>
                                                            <td className="px-8 py-5 text-right">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedCategory(cat.categoryId);
                                                                        fetchBracket(cat.categoryId);
                                                                        setActiveTab('brackets');
                                                                    }}
                                                                    className="text-[11px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-all flex items-center justify-end space-x-1 ml-auto cursor-pointer"
                                                                >
                                                                    <span>View Bracket</span>
                                                                    <ChevronRight className="w-3 h-3" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* TOTAL ROW */}
                                                    <tr className="bg-amber-500/5 border-t border-amber-500/20">
                                                        <td className="px-8 py-6">
                                                            <div className="w-4 h-4 rounded bg-amber-500/20 flex items-center justify-center">
                                                                <BarChart2 className="w-2.5 h-2.5 text-amber-500" />
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <span className="text-base font-black text-amber-500 uppercase tracking-[0.2em]">Tournament Totals</span>
                                                        </td>
                                                        <td className="px-8 py-6 text-center">
                                                            <span className="text-xl text-amber-500 font-black">
                                                                {summaryData.reduce((sum, c) => sum + c.total, 0)}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-6 text-center">
                                                            <span className="text-xl text-emerald-500 font-black">
                                                                {summaryData.reduce((sum, c) => sum + c.completed, 0)}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-6 text-center">
                                                            <span className="text-xl text-amber-500 font-black">
                                                                {summaryData.reduce((sum, c) => sum + (c.playersAvailable || 0), 0)}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-6 text-center">
                                                            <span className="text-xl text-rose-500 font-black">
                                                                {summaryData.reduce((sum, c) => sum + c.ongoing, 0)}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <div className="w-10 h-1 bg-amber-500/20 rounded-full ml-auto" />
                                                        </td>
                                                    </tr>
                                                </>
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-8 py-12 text-center text-slate-600 text-xs italic font-bold uppercase tracking-widest">
                                                        No match data available yet. Please upload data or generate brackets.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'players' && (
                        <motion.div key="players" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                            <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-8">
                                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                                    <div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-wider">Player Availability</h3>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Players ready to play (Not currently on any court)</p>
                                    </div>
                                    <div className="flex items-center space-x-4 w-full md:w-auto">
                                        <div className="relative flex-1 md:w-64 group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                                            <input
                                                type="text"
                                                placeholder="Search players or categories..."
                                                value={playerSearch}
                                                onChange={(e) => setPlayerSearch(e.target.value)}
                                                className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                                            />
                                        </div>
                                        <button onClick={() => fetchPlayerAvailability()} className="p-3 bg-amber-500/10 rounded-2xl hover:bg-amber-500/20 transition-colors shrink-0 cursor-pointer">
                                            <RefreshCw className="w-5 h-5 text-amber-500" />
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-950/20">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-900/50">
                                                <th className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] w-16 text-center">#</th>
                                                <th onClick={() => setPlayerSort({ key: 'playerName', direction: playerSort.key === 'playerName' && playerSort.direction === 'asc' ? 'desc' : 'asc' })} className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] cursor-pointer hover:text-amber-500 transition-colors">
                                                    <div className="flex items-center space-x-2">
                                                        <span>Player Name</span>
                                                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                    </div>
                                                </th>
                                                <th onClick={() => setPlayerSort({ key: 'categoryName', direction: playerSort.key === 'categoryName' && playerSort.direction === 'asc' ? 'desc' : 'asc' })} className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] cursor-pointer hover:text-amber-500 transition-colors">
                                                    <div className="flex items-center space-x-2">
                                                        <span>Category</span>
                                                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                    </div>
                                                </th>
                                                <th className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Partner</th>
                                                <th onClick={() => setPlayerSort({ key: 'matchesPlayed', direction: playerSort.key === 'matchesPlayed' && playerSort.direction === 'asc' ? 'desc' : 'asc' })} className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center cursor-pointer hover:text-amber-500 transition-colors">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <span>Played</span>
                                                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                    </div>
                                                </th>
                                                <th className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredPlayerAvailability.length > 0 ? (
                                                filteredPlayerAvailability.map((entry, idx) => (
                                                    <tr key={`${entry.playerId}-${idx}`} className="hover:bg-white/5 transition-colors group">
                                                        <td className="px-8 py-5 text-center">
                                                            <span className="text-xs font-black text-slate-500">{idx + 1}</span>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors uppercase tracking-wide">{entry.playerName}</span>
                                                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{entry.matchType}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <button
                                                                onClick={() => jumpToMatch(entry.categoryId, entry._id)}
                                                                className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black border border-amber-500/20 uppercase tracking-widest hover:bg-amber-500 hover:text-slate-900 transition-all cursor-pointer flex items-center group/btn"
                                                            >
                                                                {entry.categoryName}
                                                                <ChevronRight className="w-3 h-3 ml-1 opacity-0 group-hover/btn:opacity-100 -translate-x-2 group-hover/btn:translate-x-0 transition-all" />
                                                            </button>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tight italic">
                                                                {entry.partnerName || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-lg font-black text-white">{entry.matchesPlayed}</span>
                                                                <span className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.2em]">Total</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <div className="flex flex-col items-end">
                                                                <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                                    <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Available</span>
                                                                </div>
                                                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-1 italic">{entry.roundName}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-8 py-10 text-center">
                                                        <div className="flex flex-col items-center space-y-4 opacity-20">
                                                            <Users className="w-12 h-12" />
                                                            <p className="text-xs font-black uppercase tracking-[0.3em] italic">No Players Available to Start</p>
                                                            <p className="text-[10px] uppercase font-bold tracking-widest max-w-[200px]">All ready players are currently assigned to courts or previous matches are still ongoing.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'results' && (
                        <ResultsView data={resultsData} loading={loading} />
                    )}

                    {activeTab === 'simulator' && (
                        <SimulationView
                            n={simN}
                            setN={setSimN}
                            onRun={fetchSimulation}
                            matches={simMatches}
                            loading={loading}
                        />
                    )}

                    {activeTab === 'courts' && (
                        <motion.div key="courts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-12">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                                {courtsState.map(court => (
                                    <div key={court.courtId} className="bg-slate-900/40 rounded-[2.5rem] border border-white/5 p-8 space-y-8 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors duration-500" />

                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center space-x-4">
                                                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                                                    <Grid className="w-5 h-5 text-amber-500" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Court {court.courtId}</h3>
                                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">{court.name || `Court ${court.courtId}`}</p>
                                                </div>
                                            </div>
                                            <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border ${court.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                                {court.status}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-10">
                                            {/* Active Match */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-2">
                                                    <div className="flex items-center space-x-3">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Current Match</span>
                                                    </div>
                                                    {court.activeMatch?.categoryName && (
                                                        <span className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest italic truncate max-w-[200px]">
                                                            {court.activeMatch.categoryName}
                                                        </span>
                                                    )}
                                                </div>
                                                {court.activeMatch ? (
                                                    <div className="flex justify-center">
                                                        <BracketCard
                                                            match={court.activeMatch}
                                                            onEdit={setEditingMatch}
                                                            onUpdate={() => { fetchCourts(); fetchSummary(); }}
                                                            onForfeit={setForfeitMatch}
                                                            isHighlighted={highlightedMatchId === court.activeMatch._id}
                                                            setGlobalError={setGlobalError}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="h-[220px] w-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[1.5rem] bg-slate-950/20 group-hover:border-white/10 transition-colors">
                                                        <span className="text-slate-700 font-black uppercase tracking-widest text-xs italic">Court Available</span>
                                                        <span className="text-slate-800 text-[9px] uppercase tracking-widest mt-1">No active match assigned</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Upcoming Match */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-2">
                                                    <div className="flex items-center space-x-3">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Upcoming Match</span>
                                                    </div>
                                                    {court.upcomingMatch?.categoryName && (
                                                        <span className="text-[10px] font-black text-indigo-500/60 uppercase tracking-widest italic truncate max-w-[200px]">
                                                            {court.upcomingMatch.categoryName}
                                                        </span>
                                                    )}
                                                </div>
                                                {court.upcomingMatch ? (
                                                    <div className="flex justify-center">
                                                        <BracketCard
                                                            match={court.upcomingMatch}
                                                            onEdit={setEditingMatch}
                                                            onUpdate={() => { fetchCourts(); fetchSummary(); }}
                                                            onForfeit={setForfeitMatch}
                                                            isHighlighted={highlightedMatchId === court.upcomingMatch._id}
                                                            setGlobalError={setGlobalError}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="h-[220px] w-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[1.5rem] bg-slate-950/10 group-hover:border-white/10 transition-colors">
                                                        <span className="text-slate-800 font-black uppercase tracking-widest text-xs italic">Queue Empty</span>
                                                        <span className="text-slate-900 text-[9px] uppercase tracking-widest mt-1">No upcoming matches scheduled</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'data' && (
                        <motion.div key="data" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <UploadSection title="Match Categories" description="Upload ID & Category Mapping" onUpload={(e) => handleFileUpload(e, 'categories')} color="blue" />
                                <UploadSection title="Player Profiles" description="Upload Profile IDs & Names" onUpload={(e) => handleFileUpload(e, 'players')} color="purple" />
                                <UploadSection title="Match Participation" description="Link Categories & Team Members" onUpload={(e) => handleFileUpload(e, 'participation')} color="emerald" />
                            </div>
                            <DataTable data={filteredResolvedData} search={dataSearch} setSearch={setDataSearch} />
                        </motion.div>
                    )}

                    {activeTab === 'brackets' && (
                        <motion.div key="brackets" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2">
                            <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-6 flex flex-col xl:flex-row items-center justify-between gap-6">
                                <div className="flex items-center space-x-4">
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => { setSelectedCategory(e.target.value); fetchBracket(e.target.value); }}
                                        className="bg-slate-800 border-none text-white text-xs font-bold py-3 px-6 rounded-2xl outline-none focus:ring-1 focus:ring-amber-500 min-w-[200px]"
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>

                                    {(selectedCategory && bracketMatches.length === 0) && (
                                        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                                            <button onClick={generateBracket} disabled={loading} className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-8 py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center space-x-2">
                                                <GitBranch className="w-4 h-4" />
                                                <span className="text-[10px] uppercase tracking-widest">Generate Bracket</span>
                                            </button>
                                            
                                            <button onClick={() => setIsRRModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center space-x-2">
                                                <Trophy className="w-4 h-4" />
                                                <span className="text-[10px] uppercase tracking-widest">Generate Round Robin</span>
                                            </button>

                                            {/* [EXPERIMENTAL] Bulk Button */}
                                            <button 
                                                onClick={handleGenerateAllBrackets} 
                                                disabled={loading || bulkGenStatus === 'processing'} 
                                                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-8 py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center space-x-2 border border-white/5"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${bulkGenStatus === 'processing' ? 'animate-spin' : ''}`} />
                                                <span className="text-[10px] uppercase tracking-widest">Generate All Brackets</span>
                                            </button>
                                        </div>
                                    )}
                                    {(!selectedCategory) && (
                                        <button onClick={() => setIsRRModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center space-x-2 ml-4">
                                            <Trophy className="w-4 h-4" />
                                            <span className="text-[10px] uppercase tracking-widest">New Round Robin League</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Courts Assignment Dashboard */}
                            <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-6 overflow-x-auto custom-scrollbar">
                                <div className="flex items-center space-x-3 mb-4">
                                    <LayoutGrid className="w-4 h-4 text-emerald-500" />
                                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Live Court Queues</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    {courtsState.map(c => {
                                        const isMatch1InProgress = c.activeMatchId?.status === 'In Progress';
                                        const isMatch2InProgress = c.upcomingMatchId?.status === 'In Progress';
                                        const isUnavailable = c.status === 'Unavailable';

                                        return (
                                            <div key={c.courtId} className={`relative p-4 rounded-2xl border transition-all duration-500 ${isUnavailable ? 'bg-slate-900/80 border-rose-500/30' : 'bg-slate-900/40 border-white/10 hover:border-amber-500/30'}`}>
                                                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Court {c.courtId}</span>
                                                    <div className={`w-2 h-2 rounded-full shadow-lg ${isUnavailable ? 'bg-rose-500 animate-pulse shadow-rose-500/20' : 'bg-emerald-500 shadow-emerald-500/20'}`} />
                                                </div>

                                                <div className="space-y-4">
                                                    <CourtSlot match={c.activeMatchId} type="Active" isLive={isMatch1InProgress} />
                                                    <CourtSlot match={c.upcomingMatchId} type="Next" isLive={isMatch2InProgress} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div id="bracket-view-container" className="relative min-h-[600px] bg-slate-900/20 rounded-[3rem] border border-white/5 p-6 lg:p-8 overflow-x-auto custom-scrollbar mt-6">
                                {bracketMatches.length > 0 ? (
                                    selectedCategory.startsWith('RR_') ? (
                                        <RoundRobinTableView 
                                            matches={bracketMatches}
                                            categoryId={selectedCategory}
                                            onUpdate={() => fetchBracket(selectedCategory)}
                                            onEdit={setEditingMatch}
                                            onForfeit={setForfeitMatch}
                                            highlightedId={highlightedMatchId}
                                            setGlobalError={setGlobalError}
                                        />
                                    ) : (
                                        <div className="flex items-start justify-start h-full min-w-max py-10 px-6">
                                            <BracketLayer
                                                matches={bracketMatches}
                                                catId={selectedCategory}
                                                onUpdate={() => fetchBracket(selectedCategory)}
                                                onEdit={setEditingMatch}
                                                onForfeit={setForfeitMatch}
                                                highlightedId={highlightedMatchId}
                                            />
                                        </div>
                                    )
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20">
                                        <GitBranch className="w-20 h-20 mb-6" />
                                        <p className="text-xl font-black uppercase tracking-[0.3em] italic">Waiting for Bracket Generation</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {loading && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 flex flex-col items-center space-y-4 shadow-2xl">
                        <div className="animate-spin w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">Processing Data</span>
                    </div>
                </div>
            )}

            {editingMatch && (
                <EditMatchModal
                    match={editingMatch}
                    participants={resolvedData.filter(d => d.raw.categoryId === selectedCategory)}
                    courts={courtsState}
                    onClose={() => setEditingMatch(null)}
                    onSave={() => {
                        setEditingMatch(null);
                        fetchCourts();
                        fetchBracket(selectedCategory);
                    }}
                />
            )}

            {forfeitMatch && (
                <ForfeitMatchModal
                    match={forfeitMatch}
                    participants={resolvedData.filter(d => d.raw.categoryId === selectedCategory)}
                    onClose={() => setForfeitMatch(null)}
                    onConfirm={async (teamId) => {
                        try {
                            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/match/${forfeitMatch._id}/forfeit`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ forfeitingTeamId: teamId })
                            });
                            const json = await res.json();
                            if (json.success) {
                                showNotif("Match forfeited successfully");
                                setForfeitMatch(null);
                                fetchCourts();
                                fetchBracket(selectedCategory);
                            } else showNotif(json.message, 'error');
                        } catch (err) { showNotif("Communication error", "error"); }
                    }}
                />
            )}

            <RoundRobinSetupModal 
                isOpen={isRRModalOpen}
                onClose={() => setIsRRModalOpen(false)}
                onGenerate={handleRRGenerated}
            />

            <AnimatePresence>
                {notif && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[101] pointer-events-none">
                        <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 border backdrop-blur-xl ${notif.type === 'success' ? 'bg-emerald-900/80 border-emerald-500/30' : 'bg-red-900/80 border-red-500/30'}`}>
                            {notif.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
                            <span className="text-sm font-bold text-white tracking-wide">{notif.message}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <footer className="fixed bottom-0 left-0 right-0 h-[6vh] bg-slate-950/80 backdrop-blur-md border-t border-white/5 flex items-center justify-center z-[60]">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">Powered by <span className="text-amber-500/60">Evolugics.com</span></p>
            </footer>

            {globalError && (
                <AlertModal
                    isOpen={!!globalError}
                    message={globalError}
                    onClose={() => setGlobalError(null)}
                />
            )}

            <ConfirmModal 
                isOpen={confirm.open}
                title={confirm.title}
                message={confirm.message}
                onConfirm={confirm.onConfirm}
                onCancel={() => setConfirm({ ...confirm, open: false })}
                danger={true}
            />
        </div>
    );
};

const EditMatchModal = ({ match, onClose, onSave, participants, courts }) => {
    const [teams, setTeams] = useState(() => {
        if (match.participation) return match.participation;
        // If match.teams exists and contains strings (IDs), use it. 
        if (match.teams && typeof match.teams.team1 === 'string') return match.teams;
        return { team1: null, team2: null };
    });
    const [params, setParams] = useState({
        gamesPerMatch: match.gamesPerMatch || 3,
        pointsPerGame: match.pointsPerGame || 21,
        goldenPointAt: match.goldenPointAt || 20
    });
    const [courtId, setCourtId] = useState(match.courtId || '');
    const [saving, setSaving] = useState(false);
    const [validationError, setValidationError] = useState(null);

    const sortedParticipants = [...participants].sort((a, b) => a.player1.localeCompare(b.player1));

    const handleSave = async () => {
        // Validation for Golden Point Logic
        const target = parseInt(params.pointsPerGame);
        const golden = parseInt(params.goldenPointAt);

        if (golden < target - 1) {
            setValidationError(`Invalid Golden Point! According to tournament rules, the Golden Point trigger (@ ${golden}) must be at least ${target - 1} (one point less than the target of ${target}).`);
            return;
        }

        if (golden > 30) {
            setValidationError(`Invalid Golden Point! The maximum allowed trigger point is 30.`);
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/scheduler/match/${match._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participation: teams, parameters: params, courtId })
            });
            const json = await res.json();
            if (json.success) {
                onSave();
            } else {
                setValidationError(json.message || 'Failed to save changes');
            }
        } catch (err) {
            console.error('Save error:', err);
            setValidationError('A network error occurred while saving.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black uppercase italic tracking-widest text-white">Edit Match Configuration</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{match.roundName || `Round ${match.roundNumber}`} | Slot {match.matchIndex + 1}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                <div className="p-8 space-y-10">
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2">
                            <LayoutGrid className="w-4 h-4 text-amber-500" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Team Assignments {match.roundNumber !== 1 && "(Locked for progression rounds)"}</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <MatchTeamSelect label="Team 1" value={teams.team1} disabled={match.roundNumber !== 1} options={sortedParticipants} onChange={(val) => setTeams({ ...teams, team1: val })} />
                            <MatchTeamSelect label="Team 2" value={teams.team2} disabled={match.roundNumber !== 1} options={sortedParticipants} onChange={(val) => setTeams({ ...teams, team2: val })} />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center space-x-2">
                            <Settings className="w-4 h-4 text-emerald-500" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Match Settings</h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <ConfigInput label="Games" value={params.gamesPerMatch} onChange={(v) => setParams({ ...params, gamesPerMatch: parseInt(v) })} />
                            <ConfigInput label="Points" value={params.pointsPerGame} onChange={(v) => setParams({ ...params, pointsPerGame: parseInt(v) })} />
                            <ConfigInput label="Golden" value={params.goldenPointAt} onChange={(v) => setParams({ ...params, goldenPointAt: parseInt(v) })} />
                            <div className="flex flex-col space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 px-1">Court</label>
                                <select
                                    value={courtId}
                                    onChange={(e) => setCourtId(e.target.value)}
                                    disabled={!teams.team1 || !teams.team2}
                                    className={`bg-slate-800/50 border border-white/10 text-amber-500 font-black text-center p-3.5 h-[58px] rounded-2xl outline-none focus:ring-1 focus:ring-amber-500 transition-all text-xs appearance-none ${(!teams.team1 || !teams.team2) ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    <option value="" className="bg-slate-900">{(!teams.team1 || !teams.team2) ? 'TEAMS REQUIRED' : 'NOT SET'}</option>
                                    {courts && courts.filter(c => c.status === 'Available' || c.courtId === match.courtId).map(c => (
                                        <option
                                            key={c.courtId}
                                            value={c.courtId}
                                            className="bg-slate-900"
                                        >
                                            COURT {c.courtId}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-black/20 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="flex-[2] bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-amber-600/10 uppercase tracking-[0.2em] text-[10px] flex items-center justify-center space-x-2">
                        {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-4 h-4" />}
                        <span>Save Match Changes</span>
                    </button>
                </div>

                {/* Validation Error Modal Overlay */}
                <AnimatePresence>
                    {validationError && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-8"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                className="flex flex-col items-center text-center space-y-6"
                            >
                                <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center border border-rose-500/30">
                                    <AlertCircle className="w-8 h-8 text-rose-500" />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xl font-black uppercase italic tracking-tighter text-white">
                                        {validationError?.startsWith('Player Not Available:') ? 'Player Not Available' : 'Attention Required'}
                                    </h4>
                                    <p className="text-slate-400 text-xs font-medium leading-relaxed max-w-xs">
                                        {validationError?.startsWith('Player Not Available:') ? (
                                            validationError.replace('Player Not Available: ', '').split(/('.+?'|Court \d+|under .+? category)/).map((part, i) => {
                                                if (part.startsWith("'") && part.endsWith("'")) return <span key={i} className="text-white font-bold">{part}</span>;
                                                if (part.startsWith("Court ")) return <span key={i} className="text-amber-400 font-bold">{part}</span>;
                                                if (part.startsWith("under ") && part.endsWith(" category")) {
                                                    const cat = part.replace("under ", "").replace(" category", "");
                                                    return <React.Fragment key={i}>under <span className="text-emerald-400 font-bold">{cat}</span> category</React.Fragment>;
                                                }
                                                return part;
                                            })
                                        ) : validationError}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setValidationError(null)}
                                    className="px-8 py-3 bg-white text-slate-950 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    I Understand
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

// Note: AlertModal and ConfirmModal are now imported from TournamentModals.jsx

const MatchTeamSelect = ({ label, value, options, onChange, disabled }) => (
    <div className="flex flex-col space-y-2">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</label>
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full bg-slate-800 border-none text-white text-[11px] font-bold py-3 px-4 rounded-xl outline-none focus:ring-1 focus:ring-amber-500 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
            <option value="">No Team (BYE)</option>
            {options.map(o => (
                <option key={o.raw._id} value={o.raw._id}>{o.player1}{o.player2 !== '-' ? ` / ${o.player2}` : ''}</option>
            ))}
        </select>
    </div>
);
const ForfeitMatchModal = ({ match, onClose, onConfirm, participants }) => {
    const [selectedForfeit, setSelectedForfeit] = useState(null); // null, 1 or 2

    const getTeamLabel = (participationId) => {
        if (!participationId) return 'BYE / TBD';
        const found = participants.find(p => p.raw._id === participationId);
        if (!found) return 'Unknown Team';
        return found.player1 + (found.player2 !== '-' ? ` / ${found.player2}` : '');
    };

    const team1Name = match.team1Name || getTeamLabel(match.participation?.team1);
    const team2Name = match.team2Name || getTeamLabel(match.participation?.team2);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-8 overflow-hidden text-center">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-rose-500/10 rounded-full">
                        <AlertCircle className="w-10 h-10 text-rose-500" />
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {!selectedForfeit ? (
                        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <h3 className="text-xl font-black uppercase text-white mb-2">Declare Forfeit</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Which team is forfeiting the match?</p>

                            <div className="space-y-4">
                                <button
                                    onClick={() => setSelectedForfeit(1)}
                                    className="w-full bg-slate-800 hover:bg-rose-500/20 border border-white/5 hover:border-rose-500/50 p-4 rounded-xl text-white transition-all group flex flex-col items-center gap-1"
                                >
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100 italic">Select Forfeiture</span>
                                    <span className="text-xs font-bold uppercase">{team1Name}</span>
                                </button>

                                <button
                                    onClick={() => setSelectedForfeit(2)}
                                    className="w-full bg-slate-800 hover:bg-rose-500/20 border border-white/5 hover:border-rose-500/50 p-4 rounded-xl text-white transition-all group flex flex-col items-center gap-1"
                                >
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100 italic">Select Forfeiture</span>
                                    <span className="text-xs font-bold uppercase">{team2Name}</span>
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                            <h3 className="text-xl font-black uppercase text-rose-500 mb-2">Double Confirmation</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-loose">
                                Are you sure <span className="text-white">{selectedForfeit === 1 ? team1Name : team2Name}</span> is forfeiting?
                                <br />
                                <span className="text-emerald-500">{selectedForfeit === 1 ? team2Name : team1Name}</span> will be declared the winner.
                            </p>

                            <div className="pt-4 space-y-3">
                                <button
                                    onClick={() => onConfirm(selectedForfeit)}
                                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-4 rounded-xl uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-rose-600/20 transition-all"
                                >
                                    Yes, Confirm Forfeit
                                </button>
                                <button onClick={() => setSelectedForfeit(null)} className="w-full py-2 text-slate-500 hover:text-white text-[9px] font-black uppercase tracking-widest transition-colors">Go Back</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button onClick={onClose} className="mt-8 text-slate-500 hover:text-white text-[8px] font-black uppercase tracking-[0.3em] transition-colors border-t border-white/5 pt-4 w-full cursor-pointer">Abort and Exit</button>
            </motion.div>
        </div>
    );
};

const BracketLayer = ({ matches, onUpdate, catId, onEdit, onForfeit, highlightedId, setGlobalError }) => {
    const roundsMap = matches.reduce((acc, m) => {
        // Use roundNumber for stable numeric grouping
        const rNum = m.roundNumber || 1;
        if (!acc[rNum]) acc[rNum] = [];
        acc[rNum].push(m);
        return acc;
    }, {});
    const sortedRounds = Object.keys(roundsMap).sort((a, b) => parseInt(a) - parseInt(b));

    // Geometric Constants
    // Geometric Constants - Compact & Pro Look
    const CARD_HEIGHT = 220;
    const BASE_GAP = 30;
    const BASE_SLOT = CARD_HEIGHT + BASE_GAP;

    return (
        <div id="bracket-root" className="flex gap-20 py-4 px-12 w-max min-w-full relative bg-slate-950/20 rounded-[3rem] border border-white/5 mx-0 mt-0 mb-20 backdrop-blur-sm">
            {sortedRounds.map((r, idx) => (
                <div key={r} className="flex flex-col min-w-[320px] relative z-20">
                    <div className="flex flex-col">
                        {roundsMap[r].map((match) => {
                            // Calculate depth based on the numeric round index (r is the key from roundsMap)
                            const roundIndex = parseInt(r) - 1;
                            const slotHeight = Math.pow(2, roundIndex) * BASE_SLOT;
                            return (
                                <div
                                    key={match._id}
                                    style={{ height: slotHeight }}
                                    className="flex items-center justify-center transition-all duration-700"
                                >
                                    <BracketCard
                                        match={match}
                                        onEdit={onEdit}
                                        onUpdate={onUpdate}
                                        onForfeit={onForfeit}
                                        isHighlighted={highlightedId == match._id}
                                        setGlobalError={setGlobalError}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
            <BracketConnectors sortedRounds={sortedRounds} roundsMap={roundsMap} />
        </div>
    );
};

const CourtSlot = ({ match, type, isLive }) => (
    <div className={`bg-slate-950/50 p-3 rounded-xl border border-white/5 border-l-2 flex flex-col justify-center min-h-[54px] ${isLive ? 'border-l-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'border-l-slate-700'}`}>
        <span className={`text-[8px] uppercase font-black tracking-widest mb-1 ${isLive ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`}>
            {type} Match
        </span>
        {match ? (
            <div className="flex flex-col">
                <span className="text-[10px] text-amber-500 font-bold truncate">{match.roundName} - Match {match.matchIndex + 1}</span>
                <span className="text-[9px] text-slate-300 truncate opacity-80">{match.team1Name} vs {match.team2Name}</span>
            </div>
        ) : (
            <span className="text-[9px] text-slate-700 italic font-bold">Slot Available</span>
        )}
    </div>
);

const BracketConnectors = ({ sortedRounds, roundsMap }) => {
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" style={{ minWidth: '100%' }}>
            {sortedRounds.map((round) => {
                return roundsMap[round].map((m) => {
                    if (!m.winnerMatchId) return null;
                    // Search all rounds for the target match
                    let target = null;
                    for (const r of sortedRounds) {
                        target = (roundsMap[r] || []).find(nm => nm._id === m.winnerMatchId);
                        if (target) break;
                    }
                    if (!target) return null;
                    return <ConnectorLine key={m._id + '-' + target._id} startId={'match-' + m._id} endId={'match-' + target._id} />;
                });
            })}
        </svg>
    );
};

const ConnectorLine = ({ startId, endId }) => {
    const [path, setPath] = useState('');

    // Using a ref to ensure we always have the latest IDs
    const updatePath = () => {
        const startEl = document.getElementById(startId);
        const endEl = document.getElementById(endId);
        const container = document.getElementById('bracket-root');
        if (!startEl || !endEl || !container) return;

        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();
        const rectC = container.getBoundingClientRect();

        const x1 = rectS.right - rectC.left;
        const y1 = rectS.top + rectS.height / 2 - rectC.top;
        const x2 = rectE.left - rectC.left;
        const y2 = rectE.top + rectE.height / 2 - rectC.top;

        const midX = x1 + (x2 - x1) / 2;

        setPath(`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`);
    };

    useEffect(() => {
        updatePath();
        const timer = setTimeout(updatePath, 500);
        window.addEventListener('resize', updatePath);
        return () => {
            window.removeEventListener('resize', updatePath);
            clearTimeout(timer);
        };
    }, [startId, endId]);

    return <path d={path} fill="none" stroke="rgba(245, 158, 11, 0.45)" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" className="drop-shadow-[0_0_12px_rgba(245,158,11,0.2)] transition-all duration-500" />;
};

// BracketCard and MatchStatusBadge were moved to src/components/BracketCard.jsx

const TabButton = ({ id, active, set, label, icon: Icon }) => (
    <button 
        onClick={() => set(id)} 
        className={'flex flex-col items-center justify-center space-y-1 pb-4 transition-colors relative w-full cursor-pointer ' + (active === id ? 'text-white' : 'text-slate-600 hover:text-slate-400')}
    >
        <Icon className={'w-4 h-4 ' + (active === id ? 'text-amber-500' : '')} />
        <span className="text-[9px] font-black uppercase tracking-widest text-center whitespace-nowrap">{label}</span>
        {active === id && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-full" />}
    </button>
);

const ConfigInput = ({ label, value, onChange }) => (
    <div className="flex flex-col space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 px-1">{label}</label>
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="bg-slate-800/50 border border-white/10 text-white font-black text-center p-4 rounded-2xl outline-none focus:ring-1 focus:ring-amber-500 transition-all text-xl" />
    </div>
);

const UploadSection = ({ title, description, onUpload, color }) => {
    const colorClasses = {
        blue: 'hover:border-blue-500/50 group-hover:text-blue-400 from-blue-600/10',
        purple: 'hover:border-purple-500/50 group-hover:text-purple-400 from-purple-600/10',
        emerald: 'hover:border-emerald-500/50 group-hover:text-emerald-400 from-emerald-600/10'
    };
    return (
        <div className={'group relative bg-slate-900/40 p-6 rounded-3xl border border-white/5 transition-all duration-300 hover:bg-slate-900/60 ' + colorClasses[color].split(' ')[0] + ' overflow-hidden'}>
            <div className={'absolute inset-0 bg-gradient-to-br ' + colorClasses[color].split(' ')[2] + ' to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500'} />
            <div className="relative z-10 flex flex-col space-y-4">
                <div className="flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white group-hover:translate-x-1 transition-transform duration-300">{title}</h3>
                    <p className="text-[10px] text-slate-500 font-medium">{description}</p>
                </div>
                <label className="cursor-pointer flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 py-3 rounded-2xl border border-white/10 transition-colors">
                    <Upload className={'w-4 h-4 ' + colorClasses[color].split(' ')[1]} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Select CSV</span>
                    <input type="file" accept=".csv" onChange={onUpload} className="hidden" />
                </label>
            </div>
        </div>
    );
};

const DataTable = ({ data, search, setSearch }) => {
    const [sort, setSort] = useState({ key: 'categoryName', direction: 'asc' });

    const sortedData = useMemo(() => {
        let result = [...data];
        if (sort.key) {
            result.sort((a, b) => {
                const valA = a[sort.key];
                const valB = b[sort.key];
                if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [data, sort]);

    const toggleSort = (key) => {
        setSort({
            key,
            direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc'
        });
    };

    const downloadCSV = () => {
        const csv = Papa.unparse(sortedData.map(row => ({
            'Category': row.categoryName,
            'Player 1 / Team Lead': row.player1,
            'Player 2 / Partner': row.player2
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'resolved_matches.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-slate-900/40 rounded-3xl border border-white/5 backdrop-blur-md overflow-hidden flex flex-col h-[500px]">
            <div className="p-6 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/5">
                <div className="flex items-center space-x-3">
                    <TableIcon className="w-5 h-5 text-amber-500" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Resolved Match Entries</h2>
                </div>

                <div className="flex items-center space-x-4 w-full md:w-auto">
                    <button
                        onClick={downloadCSV}
                        className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl border border-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                        <span>Download CSV</span>
                    </button>
                    <div className="relative flex-1 md:w-64 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search matches..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-950/40 border border-white/5 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                        />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">{data.length} Matches Found</span>
                </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                        <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                            <th className="px-6 py-4">#</th>
                            <th onClick={() => toggleSort('categoryName')} className="px-6 py-4 cursor-pointer hover:text-amber-500 transition-colors">
                                <div className="flex items-center space-x-2">
                                    <span>Category</span>
                                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                                </div>
                            </th>
                            <th onClick={() => toggleSort('player1')} className="px-6 py-4 cursor-pointer hover:text-amber-500 transition-colors">
                                <div className="flex items-center space-x-2">
                                    <span>Player 1 / Team Lead</span>
                                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                                </div>
                            </th>
                            <th onClick={() => toggleSort('player2')} className="px-6 py-4 cursor-pointer hover:text-amber-500 transition-colors">
                                <div className="flex items-center space-x-2">
                                    <span>Player 2 / Partner</span>
                                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {sortedData.length > 0 ? (sortedData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4 text-xs font-mono text-slate-600">{idx + 1}</td>
                                <td className="px-6 py-4"><span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20">{item.categoryName}</span></td>
                                <td className="px-6 py-4 text-sm font-semibold text-slate-200">{item.player1}</td>
                                <td className="px-6 py-4 text-sm text-slate-400 italic">{item.player2 !== '-' ? item.player2 : <span className="text-slate-700 not-italic">Singles</span>}</td>
                            </tr>
                        ))) : (
                            <tr><td colSpan="4" className="px-6 py-20 text-center"><div className="flex flex-col items-center space-y-3 opacity-30"><FileSpreadsheet className="w-12 h-12" /><p className="text-sm">No matches match your search criteria.</p></div></td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ResultsView = ({ data, loading }) => {
    const handleExportCSV = () => {
        const csvData = data.map((row, idx) => ({
            'S.No': idx + 1,
            'Category': row.categoryName,
            'Winner': row.winner,
            'Runner Up': row.runnerUp,
            'Semi Finalist 1': row.semi1,
            'Semi Finalist 2': row.semi2
        }));

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `tournament_results_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-8">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-wider">Tournament Results</h3>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Final standings for all categories</p>
                    </div>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl transition-all shadow-lg shadow-emerald-600/10 uppercase tracking-widest text-[10px] font-black cursor-pointer"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Export Results CSV</span>
                    </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-950/20">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/50">
                                <th className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">S.No</th>
                                <th className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Category</th>
                                <th className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Winner</th>
                                <th className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Runner Up</th>
                                <th className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Semi Finalists</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.length > 0 ? (
                                data.map((row, idx) => (
                                    <tr key={row.categoryId} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-8 py-6 text-slate-500 font-mono text-xs">{idx + 1}</td>
                                        <td className="px-8 py-6">
                                            <span className="text-sm font-bold text-white uppercase tracking-wide">{row.categoryName}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center space-x-2">
                                                <Trophy className="w-4 h-4 text-amber-500" />
                                                <span className="text-sm font-black text-amber-400 uppercase">{row.winner}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-sm font-bold text-slate-300 uppercase">{row.runnerUp}</td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col space-y-1">
                                                <span className="text-xs text-slate-500 font-bold uppercase">{row.semi1 !== '-' ? row.semi1 : ''}</span>
                                                <span className="text-xs text-slate-500 font-bold uppercase">{row.semi2 !== '-' ? row.semi2 : ''}</span>
                                                {row.semi1 === '-' && row.semi2 === '-' && <span className="text-xs text-slate-700 italic">None</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center text-slate-600 text-sm italic font-bold uppercase tracking-widest">
                                        {loading ? "Loading results..." : "No results available yet. Complete tournament matches to see standings."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    );
};

// [EXPERIMENTAL] Bulk Generation Progress Modal
const BulkGenerationModal = ({ status, results, onClose }) => {
    if (status === 'idle') return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
                <div className="p-8 border-b border-white/5 bg-slate-950/40">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className={`p-3 rounded-2xl ${status === 'processing' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                <RefreshCw className={`w-6 h-6 ${status === 'processing' ? 'animate-spin' : ''}`} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-wider">Bulk Bracket Generation</h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                                    {status === 'processing' ? 'Processing all categories...' : 'Generation Complete'}
                                </p>
                            </div>
                        </div>
                        {status === 'completed' && (
                            <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                Close
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                    {results.length === 0 && status === 'processing' && (
                        <div className="py-12 flex flex-col items-center justify-center space-y-4 opacity-50">
                            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Initializing...</p>
                        </div>
                    )}
                    {results.map((res, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-950/40 rounded-2xl border border-white/5">
                            <div className="flex items-center space-x-3">
                                {res.status === 'success' ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-xs font-bold text-slate-200">{res.categoryName}</span>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${res.status === 'success' ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
                                {res.message}
                            </span>
                        </div>
                    ))}
                </div>

                {status === 'completed' && (
                    <div className="p-8 bg-slate-950/60 border-t border-white/5">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <span>Total Categories: {results.length}</span>
                            <span className="text-emerald-500">
                                Successful: {results.filter(r => r.status === 'success').length}
                            </span>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

const SimulationView = ({ n, setN, onRun, matches, loading }) => {
    return (
        <motion.div key="simulator" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-8">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-wider">Bracket Logic Simulator</h3>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Test seeded pairing and progression (Wimbledon Rules)</p>
                    </div>
                    <div className="flex items-center space-x-4 bg-slate-950/40 p-2 rounded-2xl border border-white/5">
                        <div className="px-4 py-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-4">Players</span>
                            <input
                                type="number"
                                value={n}
                                onChange={(e) => setN(parseInt(e.target.value) || 0)}
                                className="bg-transparent text-amber-500 font-black text-lg outline-none w-16 text-center"
                            />
                        </div>
                        <button
                            onClick={onRun}
                            disabled={loading}
                            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 px-6 py-3 rounded-xl transition-all uppercase tracking-widest text-[10px] font-black flex items-center space-x-2"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            <span>{loading ? 'Simulating...' : 'Run Simulation'}</span>
                        </button>
                    </div>
                </div>

                {matches.length > 0 ? (
                    <div className="relative bg-slate-950/20 rounded-[2rem] border border-white/5 p-12 overflow-auto custom-scrollbar min-h-[700px] shadow-inner">
                        <BracketLayer
                            matches={matches}
                            onUpdate={() => { }}
                            catId="SIMULATOR"
                            onEdit={() => { }}
                            onForfeit={() => { }}
                            highlightedId={null}
                        />
                    </div>
                ) : (
                    <div className="py-32 flex flex-col items-center justify-center space-y-4 opacity-20 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                        <FlaskConical className="w-16 h-16" />
                        <p className="text-sm font-black uppercase tracking-[0.4em]">Ready to Simulate</p>
                        <p className="text-[10px] uppercase font-bold text-slate-500">Enter number of players and click Run</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default SchedulerView;
