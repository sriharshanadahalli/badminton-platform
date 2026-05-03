import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMatch } from '../context/MatchContext';

// Moved PlayerToken outside to prevent React from remounting it on every render, solving the blink effect.
// Moved PlayerToken outside to prevent React from remounting it on every render, solving the blink effect.
const PlayerToken = ({ player, teamId, isServer, customTop }) => {
  if (!player) return null;
  const displayName = player.firstName || player.fullName?.split(' ')[0] || 'Player';

  return (
    <motion.div
      initial={false}
      animate={{ top: customTop }}
      transition={{ type: 'tween', ease: 'easeInOut', duration: 0.7 }}
      className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full shadow-2xl transition-shadow z-10 
        ${isServer ? 'ring-2 md:ring-4 ring-yellow-400 ring-offset-2 md:ring-offset-4 ring-offset-[#1b8a53]' : ''}
      `}
    >
      <span className={`text-white font-bold px-3 py-1 md:px-5 md:py-2 rounded-full text-xs md:text-base whitespace-nowrap overflow-hidden text-ellipsis min-w-[80px] md:min-w-[120px] max-w-[130px] md:max-w-[200px] text-center font-sans tracking-wide ${teamId === 'team1' ? 'bg-blue-600 border-[1.5px] border-blue-400' : 'bg-red-600 border-[1.5px] border-red-400'}`}>

        {displayName}
      </span>
      {isServer && (
        <div className="absolute -top-3 md:-top-5 text-yellow-400 font-bold text-[8px] md:text-xs bg-black/80 px-1.5 py-0.5 rounded shadow tracking-widest uppercase">
          SERVER
        </div>
      )}
    </motion.div>
  );
};

const CourtArea = () => {
  const { match, teamOnLeft, team1Pos, team2Pos, activeServer, addPoint, scores, servingTeam, goldenPointActive, acknowledgeGoldenPoint, undoState, undoLastPoint } = useMatch();

  const [showUndoConfirm, setShowUndoConfirm] = useState(false);

  // Determine which team is left vs right
  const leftTeamId = teamOnLeft === 'team1' ? 'team1' : 'team2';
  const rightTeamId = teamOnLeft === 'team1' ? 'team2' : 'team1';

  const leftTeamPos = leftTeamId === 'team1' ? team1Pos : team2Pos;
  const rightTeamPos = rightTeamId === 'team1' ? team1Pos : team2Pos;

  const activeServerId = activeServer?.id || activeServer;
  const isSingles = match?.matchType?.toLowerCase().includes('singles');
  const servingScore = servingTeam === 'team1' ? scores.team1 : scores.team2;
  const isEvenScore = servingScore % 2 === 0;

  return (
    <div className="w-full max-w-7xl aspect-[2/1] max-h-[42vh] md:max-h-[65vh] bg-[#1b8a53] rounded-sm relative border-[3px] md:border-4 border-white shadow-2xl overflow-hidden flex selection:bg-transparent -mt-4 md:mt-0 -mb-2 md:-mb-8">

      {/* Court Lines Overlay */}
      <div className="absolute inset-x-8 inset-y-6 border-2 border-white pointer-events-none z-0" />
      <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white -ml-0.5 z-0" />
      <div className="absolute left-8 right-[75%] top-1/2 h-1 bg-white -mt-0.5 z-0" />
      <div className="absolute left-[75%] right-8 top-1/2 h-1 bg-white -mt-0.5 z-0" />
      <div className="absolute left-1/2 top-6 bottom-6 w-1 bg-white -ml-[25%] pointer-events-none z-0" />
      <div className="absolute left-1/2 top-6 bottom-6 w-1 bg-white ml-[25%] pointer-events-none z-0" />

      {/* Interactive Half: Left */}
      <div className="flex-1 h-full relative z-10 pointer-events-none">
        {isSingles ? (
          <PlayerToken
            player={isEvenScore ? leftTeamPos.evenSide : leftTeamPos.oddSide}
            teamId={leftTeamId}
            isServer={servingTeam === leftTeamId}
            customTop={isEvenScore ? '75%' : '25%'}
          />
        ) : (
          <>
            <PlayerToken
              player={leftTeamPos.oddSide}
              teamId={leftTeamId}
              isServer={leftTeamPos.oddSide?.id === activeServerId}
              customTop="25%"
            />
            <PlayerToken
              player={leftTeamPos.evenSide}
              teamId={leftTeamId}
              isServer={leftTeamPos.evenSide?.id === activeServerId}
              customTop="75%"
            />
          </>
        )}

        <div className="absolute bottom-12 md:bottom-20 left-2 md:left-6 pointer-events-auto z-30">
          <button
            onClick={() => addPoint(leftTeamId)}
            className={`w-10 h-10 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-3xl text-white font-bold shadow-xl border-[3px] md:border-4 border-white/20 transition-all ${leftTeamId === 'team1' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}`}

          >
            +1
          </button>
        </div>
      </div>

      {/* Net & Undo Button Area */}
      <div className="w-4 h-full bg-gray-300 relative z-20 shadow-[0_0_15px_rgba(0,0,0,0.5)] border-x-2 border-white border-dashed pointer-events-none flex flex-col items-center justify-end pb-2 md:pb-6">
        {undoState && (
          <div className="absolute bottom-12 md:bottom-20 pointer-events-auto">
            <button
              onClick={() => setShowUndoConfirm(true)}
              title="Undo Last Point"
              className="w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-xl text-white font-bold shadow-2xl border-2 md:border-[3px] border-white/30 bg-amber-600 hover:bg-amber-500 transition-transform active:scale-95"
            >
              -1
            </button>
          </div>
        )}
      </div>

      {/* Interactive Half: Right */}
      <div className="flex-1 h-full relative z-10 pointer-events-none">
        {isSingles ? (
          <PlayerToken
            player={isEvenScore ? rightTeamPos.evenSide : rightTeamPos.oddSide}
            teamId={rightTeamId}
            isServer={servingTeam === rightTeamId}
            customTop={isEvenScore ? '25%' : '75%'}
          />
        ) : (
          <>
            <PlayerToken
              player={rightTeamPos.evenSide}
              teamId={rightTeamId}
              isServer={rightTeamPos.evenSide?.id === activeServerId}
              customTop="25%"
            />
            <PlayerToken
              player={rightTeamPos.oddSide}
              teamId={rightTeamId}
              isServer={rightTeamPos.oddSide?.id === activeServerId}
              customTop="75%"
            />
          </>
        )}

        <div className="absolute bottom-12 md:bottom-20 right-2 md:right-6 pointer-events-auto z-30">
          <button
            onClick={() => addPoint(rightTeamId)}
            className={`w-10 h-10 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-3xl text-white font-bold shadow-xl border-[3px] md:border-4 border-white/20 transition-all ${rightTeamId === 'team1' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}`}

          >
            +1
          </button>
        </div>
      </div>

      {/* Golden Point Modal */}
      {goldenPointActive && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm pointer-events-auto">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-yellow-500/20 border-2 border-yellow-500 p-6 md:p-8 rounded-3xl max-w-sm w-full text-center shadow-[0_0_50px_rgba(234,179,8,0.2)]"
          >
            <h2 className="text-3xl md:text-4xl font-black text-yellow-400 mb-2 uppercase tracking-widest animate-pulse drop-shadow-md">Golden Point</h2>
            <p className="text-gray-200 text-sm md:text-lg mb-6 md:mb-8 font-semibold">Next point wins the game!</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                acknowledgeGoldenPoint();
              }}
              className="w-full py-3 md:py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-lg md:text-xl rounded-xl shadow-lg transition-transform active:scale-95"
            >
              Continue
            </button>
          </motion.div>
        </div>
      )}

      {/* Undo Confirmation Modal (Local to CourtArea to sit over the court cleanly) */}
      {showUndoConfirm && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm pointer-events-auto">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-900 border border-gray-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative"
          >
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest text-center">Confirm Undo</h3>
            <p className="text-gray-400 text-sm md:text-base text-center mb-6">Are you sure you want to revert the last point?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowUndoConfirm(false)}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  undoLastPoint();
                  setShowUndoConfirm(false);
                }}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(217,119,6,0.3)]"
              >
                Yes, Undo
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
};

export default CourtArea;
