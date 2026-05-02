import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMatch } from '../context/MatchContext';
import MatchSetupModal from '../components/MatchSetupModal';
import GameOverModal from '../components/GameOverModal';
import WinConfirmationModal from '../components/WinConfirmationModal';
import CourtArea from '../components/CourtArea';
import Scoreboard from '../components/Scoreboard';
import FullscreenToggle from '../components/FullscreenToggle';

const CourtView = () => {
  const { courtId } = useParams();
  const { match, loading, error, fetchMatchData, initialSetupDone, matchStarted, isGameOver, isMatchOver } = useMatch();
  
  useEffect(() => {
    fetchMatchData(courtId);
  }, [courtId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="bg-red-900/40 border border-red-500/50 p-6 rounded-xl max-w-md text-center shadow-2xl">
          <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-300">{error}</p>
          <a href="/" className="mt-6 inline-block bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition">Back to Courts</a>
        </div>
      </div>
    );
  }

  if (!match) return null;

  return (
    <div className="min-h-screen w-full bg-gray-900 flex flex-col overflow-hidden relative selection:bg-transparent">
      {!(isGameOver || isMatchOver) && <FullscreenToggle />}
      
      {/* Top Header - Scoreboard and Timers */}
      {initialSetupDone && <Scoreboard />}

      {/* Main Court Area */}
      {initialSetupDone && (
        <div className="flex-1 w-full h-full px-1 md:px-8 mt-1 flex items-start md:items-end justify-center relative md:pb-12">
          <CourtArea />
        </div>
      )}

      {/* Modals */}
      {!matchStarted && <MatchSetupModal />}
      <WinConfirmationModal />
      {(isGameOver || isMatchOver) && <GameOverModal />}
      
    </div>
  );
};

export default CourtView;
