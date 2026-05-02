import React from 'react';
import { Maximize } from 'lucide-react';

const FullscreenToggle = () => {
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        if (window.screen?.orientation?.lock) {
          await window.screen.orientation.lock('landscape').catch(() => { });
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        if (window.screen?.orientation?.unlock) {
          window.screen.orientation.unlock();
        }
      }
    } catch (err) {
      console.warn("Fullscreen/Orientation API failed", err);
    }
  };

  return (
    <button
      onClick={toggleFullscreen}
      className="fixed bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-800/80 text-gray-300 rounded-full text-xs md:text-sm hover:bg-gray-700 active:bg-gray-700 transition flex items-center gap-2 border border-gray-600 shadow-lg z-[100] cursor-pointer"
    >
      <Maximize className="w-4 h-4" />
      <span className="hidden sm:inline">Toggle Fullscreen</span>
    </button>
  );
};

export default FullscreenToggle;
