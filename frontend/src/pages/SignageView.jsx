import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Maximize, Minimize } from 'lucide-react';
import SignageCourtPanel from '../components/SignageCourtPanel';
import { CONFIG } from '../utils/config';

const SignageView = () => {
  const { signageId } = useParams();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Map signage_a -> court_01/02, signage_b -> court_03/04
  let courtLeft = 'null';
  let courtRight = 'null';

  if (signageId) {
    const match = signageId.match(/signage_([a-z])/i);
    if (match) {
      const letterAscii = match[1].toLowerCase().charCodeAt(0) - 97; // a -> 0, b -> 1
      const leftNo = (letterAscii * 2) + 1;
      const rightNo = (letterAscii * 2) + 2;
      courtLeft = leftNo.toString().padStart(2, '0');
      courtRight = rightNo.toString().padStart(2, '0');
    }
  }

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-white font-sans overflow-hidden select-none">
      {/* Premium Vibrant Header */}
      <header className="h-[10vh] border-b border-white/5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 backdrop-blur-xl flex items-center justify-center relative px-8 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

        <div className="flex flex-col items-center">
          <h1 className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-[0.4em] uppercase italic leading-none">
            {CONFIG.TOURNAMENT_NAME}
          </h1>
          <div className="h-px w-24 bg-amber-500/40 mt-2" />
        </div>


      </header>

      {/* Main Display Area */}
      <main className="h-[84vh] flex flex-row overflow-hidden relative">
        {/* Decorative central divider */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-slate-700 to-transparent z-10 transform -translate-x-1/2" />

        <div className="w-1/2 h-full">
          <SignageCourtPanel courtId={courtLeft} />
        </div>

        <div className="w-1/2 h-full">
          <SignageCourtPanel courtId={courtRight} />
        </div>
      </main>

      {/* Footer */}
      <footer className="h-[6vh] bg-slate-950 flex items-center justify-between px-8 border-t border-slate-800">
        <div className="w-48"></div>
        <p className="text-slate-500 text-xs font-semibold tracking-widest uppercase">
          powered by <a href="https://evolugics.com/" target="_blank" rel="noreferrer" className="text-amber-500 hover:text-amber-400 transition-colors">evolugics.com</a>
        </p>
        <div className="w-48 flex justify-end">
          <button
            onClick={toggleFullscreen}
            className="text-slate-400 hover:text-amber-500 transition-colors p-1.5 rounded-md hover:bg-slate-900 border border-slate-800"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default SignageView;
