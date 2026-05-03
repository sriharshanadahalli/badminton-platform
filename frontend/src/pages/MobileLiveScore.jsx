import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, Play, FastForward, ChevronRight } from 'lucide-react';
import MobileCourtCard from '../components/MobileCourtCard';
import { CONFIG } from '../utils/config';

const MobileLiveScore = () => {
  const [viewMode, setViewMode] = useState('live'); // 'live' or 'upcoming'
  const courts = CONFIG.COURTS;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 shadow-2xl">
        <div className="flex flex-col space-y-3">
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-black tracking-[0.4em] italic bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent uppercase py-1 px-4 text-center leading-none">
              {CONFIG.TOURNAMENT_NAME}
            </h1>
            <div className="h-px w-20 bg-amber-500/40 mt-2" />
            <div className="flex items-center space-x-2 mt-2">
              <span className="h-px w-6 bg-amber-500/20" />
              <span className="text-amber-500 font-bold text-[9px] tracking-[0.25em] uppercase">Powered by Evolugics.com</span>
              <span className="h-px w-6 bg-amber-500/20" />
            </div>
          </div>

          {/* Toggle Button Group */}
          <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800/60 w-full max-w-sm self-center">
            <button
              onClick={() => setViewMode('live')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl transition-all duration-500 font-bold text-[10px] tracking-widest uppercase
                ${viewMode === 'live' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <List className="w-4 h-4" />
              <span>Live Scores</span>
            </button>
            <button
              onClick={() => setViewMode('upcoming')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl transition-all duration-500 font-bold text-[10px] tracking-widest uppercase
                ${viewMode === 'upcoming' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <FastForward className="w-4 h-4" />
              <span>Upcoming</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area - with top padding to account for fixed header (approx 175px) */}
      <main className="flex-1 px-4 pt-[145px] pb-8 max-w-lg mx-auto w-full touch-pan-y">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2 mt-4 mb-6 ml-1">
            <ChevronRight className={`w-3 h-3 ${viewMode === 'live' ? 'text-emerald-500' : 'text-amber-500'}`} />
            <h2 className="text-slate-500 font-bold text-[9px] uppercase tracking-[0.3em]">
              {viewMode === 'live' ? 'Real-time Match Updates' : 'Schedule of Next Matches'}
            </h2>
          </div>

          {courts.map((courtId) => (
            <MobileCourtCard key={courtId} courtId={courtId} viewMode={viewMode} />
          ))}
        </div>

        {/* Bottom Spacing / Simple Line */}
        <footer className="py-12 flex flex-col items-center">
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
        </footer>
      </main>
    </div>
  );
};

export default MobileLiveScore;
