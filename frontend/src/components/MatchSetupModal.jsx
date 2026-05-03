import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMatch } from '../context/MatchContext';
import { User, Users } from 'lucide-react';

const MatchSetupModal = () => {
  const { match, completeSetup, startMatch } = useMatch();
  
  const [step, setStep] = useState(1);
  const [tossWinner, setTossWinner] = useState(null); // 'team1' or 'team2'
  const [tossDecision, setTossDecision] = useState(null); // 'court' or 'serve'
  const [teamOnLeft, setTeamOnLeft] = useState(null); // 'team1' or 'team2'
  const [servingTeam, setServingTeam] = useState(null); // 'team1' or 'team2'
  const [initialServer, setInitialServer] = useState(null); 
  const [initialReceiver, setInitialReceiver] = useState(null); 
  
  const isDoubles = (match.teams?.team1?.players?.length > 1) || (match.teams?.team2?.players?.length > 1);

  const getTeamName = (teamId, useFirstNamesOnly = true) => {
    const team = teamId === 'team1' ? match.teams?.team1 : match.teams?.team2;
    if (!team || !team.players) return `Team ${teamId === 'team1' ? 1 : 2}`;
    return team.players.map(p => useFirstNamesOnly ? p.firstName : p.fullName).join(' / ');
  };

  const renderTeamName = (teamId, defaultName, useFirstNamesOnly = false) => {
    const team = teamId === 'team1' ? match.teams?.team1 : match.teams?.team2;

    if (!team || !team.players || team.players.length === 0) {
        return <div className="text-xl font-semibold text-white truncate px-2">{defaultName}</div>;
    }
    return team.players.map((p, idx) => (
      <div key={idx} className="text-lg font-semibold text-white truncate px-2 my-0.5" title={p.fullName}>
          {useFirstNamesOnly ? p.firstName : p.fullName}
      </div>
    ));
  };
  
  const getTeamColorClass = (teamId) => teamId === 'team1' ? 'text-blue-400' : 'text-red-400';


  const onTossWinnerSelect = (t) => {
    setTossWinner(t);
    setStep(2);
  };

  const onTossDecisionSelect = (decision) => {
    setTossDecision(decision);
    
    // Auto-resolve serving team based on implicit rules
    if (decision === 'court') {
      const otherTeam = tossWinner === 'team1' ? 'team2' : 'team1';
      setServingTeam(otherTeam);
    } else if (decision === 'serve') {
      setServingTeam(tossWinner);
    }
    
    setStep(3);
  };

  const onStep3Select = (choice) => {
    setTeamOnLeft(choice); // choice is 1 or 2
    
    if (!isDoubles) {
      // Auto-complete for singles
      const server = servingTeam === 'team1' 
        ? match.teams.team1.players[0]
        : match.teams.team2.players[0];
      const receiver = servingTeam === 'team1'
        ? match.teams.team2.players[0]
        : match.teams.team1.players[0];
        
      completeSetup({
        tossWinner,
        teamOnLeft: choice,
        servingTeam,
        initialServer: server,
        initialReceiver: receiver
      });
    }
    setStep(4);
  };

  const submitDoublesSetup = () => {
    completeSetup({
      tossWinner,
      teamOnLeft,
      servingTeam,
      initialServer,
      initialReceiver
    });
  };

  const renderStepContent = () => {
    switch(step) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Who won the Toss?</h2>
            <div className="flex gap-4">
              {/* Step 1: Show FULL names */}
              <button 
                onClick={() => onTossWinnerSelect('team1')}
                className="flex-1 bg-blue-900/30 hover:bg-blue-600 border-2 border-blue-500/50 p-6 rounded-xl transition cursor-pointer flex flex-col items-center justify-center text-blue-100"
              >
                {renderTeamName('team1', 'Team 1', false)}
              </button>
              <button 
                onClick={() => onTossWinnerSelect('team2')}
                className="flex-1 bg-red-900/30 hover:bg-red-600 border-2 border-red-500/50 p-6 rounded-xl transition cursor-pointer flex flex-col items-center justify-center text-red-100"
              >
                {renderTeamName('team2', 'Team 2', false)}
              </button>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">
              <span className={getTeamColorClass(tossWinner)}>{getTeamName(tossWinner, true)}</span>'s Decision
            </h2>
            <p className="text-gray-400 text-center text-sm">What does the toss winner choose?</p>
            <div className="flex gap-4">
              <button 
                onClick={() => onTossDecisionSelect('court')}
                className="flex-1 bg-gray-800 hover:bg-emerald-600 border border-gray-700 p-6 rounded-xl transition cursor-pointer text-white font-bold text-xl"
              >
                Court
              </button>
              <button 
                onClick={() => onTossDecisionSelect('serve')}
                className="flex-1 bg-gray-800 hover:bg-emerald-600 border border-gray-700 p-6 rounded-xl transition cursor-pointer text-white font-bold text-xl"
              >
                Serve
              </button>
            </div>
          </div>
        );

      case 3: {
        const chooserTeam = tossDecision === 'court' ? tossWinner : (tossWinner === 'team1' ? 'team2' : 'team1');

        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">
              <span className={getTeamColorClass(chooserTeam)}>{getTeamName(chooserTeam, true)}</span> Selection
            </h2>
            <p className="text-gray-400 text-center text-sm">Which side of the court will they start on?</p>
            <div className="flex gap-4">
              <button onClick={() => onStep3Select(chooserTeam)} className="flex-1 bg-gray-800 hover:bg-emerald-600 border border-gray-700 p-6 rounded-xl transition text-white font-bold text-xl">Left Side</button>
              <button onClick={() => onStep3Select(chooserTeam === 'team1' ? 'team2' : 'team1')} className="flex-1 bg-gray-800 hover:bg-emerald-600 border border-gray-700 p-6 rounded-xl transition text-white font-bold text-xl">Right Side</button>
            </div>
          </div>
        );
      }

      case 4: {
        const team1 = match.teams?.team1?.players || [];
        const team2 = match.teams?.team2?.players || [];
        const servingTeamPlayers = servingTeam === 'team1' ? team1 : team2;
        const receivingTeamId = servingTeam === 'team1' ? 'team2' : 'team1';
        const receivingTeamPlayers = receivingTeamId === 'team1' ? team1 : team2;

        return (
          <div className="flex flex-col h-full space-y-2 md:space-y-4">
            <h2 className="text-sm md:text-2xl font-bold text-center leading-tight">{isDoubles ? 'Select Initial Players' : 'Ready to Start?'}</h2>
            
            {!isDoubles ? (
              <div className="flex flex-row gap-2 py-4">
                <div className="flex-1 bg-gray-800/50 p-3 md:p-5 rounded-xl border border-gray-700/50 flex flex-col items-center">
                   <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Serving</span>
                   <span className={`text-xl md:text-2xl font-black ${getTeamColorClass(servingTeam)}`}>{getTeamName(servingTeam, true)}</span>
                </div>
                <div className="flex-1 bg-gray-800/50 p-3 md:p-5 rounded-xl border border-gray-700/50 flex flex-col items-center">
                   <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Receiving</span>
                   <span className={`text-xl md:text-2xl font-black ${getTeamColorClass(receivingTeamId)}`}>{getTeamName(receivingTeamId, true)}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-2 md:gap-4 flex-1">
                {/* Serving Team */}
                <div className="flex-1 flex flex-col bg-gray-800/50 p-2 md:p-3 rounded-xl border border-gray-700/50">
                  <h3 className={`text-[10px] text-bold text-center ${getTeamColorClass(servingTeam)} uppercase tracking-wider mb-2`}>Serving</h3>
                  <div className="flex flex-row md:flex-col gap-1.5 md:gap-2 flex-1">
                    {servingTeamPlayers.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => setInitialServer(p)}
                        className={`flex-1 flex items-center justify-center p-2 text-[10px] md:text-sm text-center leading-tight rounded-lg border transition-all font-bold ${initialServer?.id === p.id ? 'bg-emerald-600 border-emerald-400 text-white' : (servingTeam === 'team1' ? 'bg-blue-900/20 border-blue-500/30 text-blue-100' : 'bg-red-900/20 border-red-500/30 text-red-100')}`}
                      >
                        {p.firstName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Receiving Team */}
                <div className="flex-1 flex flex-col bg-gray-800/50 p-2 md:p-3 rounded-xl border border-gray-700/50">
                  <h3 className={`text-[10px] text-bold text-center ${getTeamColorClass(receivingTeamId)} uppercase tracking-wider mb-2`}>Receiving</h3>
                  <div className="flex flex-row md:flex-col gap-1.5 md:gap-2 flex-1">
                    {receivingTeamPlayers.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => setInitialReceiver(p)}
                        className={`flex-1 flex items-center justify-center p-2 text-[10px] md:text-sm text-center leading-tight rounded-lg border transition-all font-bold ${initialReceiver?.id === p.id ? 'bg-emerald-600 border-emerald-400 text-white' : (receivingTeamId === 'team1' ? 'bg-blue-900/20 border-blue-500/30 text-blue-100' : 'bg-red-900/20 border-red-500/30 text-red-100')}`}
                      >
                        {p.firstName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <button 
              disabled={isDoubles && (!initialServer || !initialReceiver)}
              onClick={() => {
                const setupData = { tossWinner, teamOnLeft, servingTeam, initialServer, initialReceiver };
                if (isDoubles) {
                  completeSetup(setupData);
                }
                startMatch(setupData);
              }}
              className={`w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50`}
            >
              START MATCH
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-gray-900/95 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        key={step}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="bg-gray-900 border border-gray-700 p-3 md:p-8 rounded-xl md:rounded-2xl shadow-2xl max-w-2xl w-full relative max-h-[96vh] flex flex-col"
      >
        <div className="mb-2 md:mb-6 flex gap-3 items-center text-xs md:text-sm text-gray-500 font-mono overflow-hidden">
          {step > 1 ? (
            <button 
              onClick={() => {
                setStep(step - 1);
                if (step === 4) {
                  setInitialServer(null);
                  setInitialReceiver(null);
                }
              }}
              className="text-gray-400 hover:text-white font-semibold transition-colors uppercase tracking-wider flex-shrink-0"
            >
              ← Back
            </button>
          ) : (
             <span className="w-[60px]"></span>
          )}
          <span className="truncate flex-1 text-center font-bold text-white tracking-widest">{match.matchType} Setup</span>
          <span className="whitespace-nowrap flex-shrink-0 bg-gray-800 px-2 py-0.5 md:px-3 md:py-1 rounded-full border border-gray-700">
            Step {step} / 4
          </span>
        </div>
        
        <div className="overflow-y-auto overflow-x-hidden hide-scrollbar flex-1 relative px-1">
          {renderStepContent()}
        </div>

      </motion.div>
    </div>
  );
};

export default MatchSetupModal;
