import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import FullscreenToggle from '../components/FullscreenToggle';
import { CONFIG } from '../utils/config';

const LandingView = () => {
  const navigate = useNavigate();
  const courts = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen max-h-screen bg-gray-900 flex flex-col items-center justify-center p-2 lg:p-6 landscape-only-warning relative overflow-hidden">
      {/* Warning for portrait devices, hidden in landscape */}
      <div className="absolute inset-x-0 top-0 bg-red-600 text-white text-center py-2 text-sm md:hidden hidden portrait:block z-50">
        Please rotate your device to landscape mode for the best experience.
      </div>

      <FullscreenToggle />

      {/* Header Section */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center mb-2 lg:mb-8 z-10 mt-1 lg:mt-0 title-container"
      >
        <h1 className="text-xl md:text-2xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-[0.4em] uppercase italic leading-none">
          {CONFIG.TOURNAMENT_NAME}
        </h1>
        <div className="h-0.5 lg:h-px w-16 lg:w-24 bg-amber-500/40 mt-2" />
      </motion.div>

      {/* Courts Selection Area */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-6xl relative z-10 px-1 lg:px-4 flex-1 max-h-[80vh] flex flex-col justify-center"
      >
        <p className="text-gray-300 text-[10px] lg:text-xs font-medium uppercase tracking-[0.3em] mb-4 lg:mb-8 text-center opacity-70">
          Select your court to start the match
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 lg:gap-6">
          {courts.map((courtNum) => (
            <motion.button
              key={courtNum}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/court/${courtNum.toString().padStart(2, '0')}`)}
              className="group relative flex flex-col items-center justify-center w-[calc(20%-0.6rem)] lg:w-[calc(20%-1.2rem)] h-[22vh] lg:h-auto lg:aspect-square bg-gray-800/90 backdrop-blur-md rounded-xl md:rounded-2xl lg:rounded-3xl border border-gray-700/60 hover:border-emerald-500 active:border-emerald-500 shadow-lg overflow-hidden transition-all duration-300"
            >
              {/* Subtle hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/15 to-transparent opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity duration-300" />

              <span className="text-gray-400 text-[9px] lg:text-sm font-semibold tracking-widest mb-0.5 lg:mb-2 uppercase z-10">Court</span>
              <span className="text-lg lg:text-5xl font-black text-white group-hover:text-emerald-400 transition-colors duration-300 z-10">
                {courtNum.toString().padStart(2, '0')}
              </span>

              {/* Glowing bottom line on hover */}
              <div className="absolute bottom-0 w-full h-1 lg:h-2 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-[25vh] h-[25vh] bg-emerald-600/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[25vh] h-[25vh] bg-cyan-600/10 rounded-full blur-[80px] pointer-events-none" />
    </div>
  );
};

export default LandingView;
