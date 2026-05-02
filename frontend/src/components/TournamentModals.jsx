import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, HelpCircle, X } from 'lucide-react';

export const AlertModal = ({ isOpen, message, title = "Action Required", type = "error", onClose }) => {
    if (!isOpen) return null;
    
    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }} 
                    className="absolute inset-0 bg-black/80 backdrop-blur-md" 
                    onClick={onClose} 
                />
                <motion.div 
                    initial={{ scale: 0.98, opacity: 0, y: 10 }} 
                    animate={{ scale: 1, opacity: 1, y: 0 }} 
                    exit={{ scale: 0.98, opacity: 0, y: 10 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-3xl p-10 overflow-hidden text-center"
                >
                    <div className="flex justify-center mb-8">
                        <div className={`p-5 rounded-3xl ${type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                            {type === 'success' ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-3 italic">{title}</h3>
                    <p className="text-slate-400 text-xs font-bold leading-relaxed uppercase tracking-widest mb-10">{message}</p>
                    <button 
                        onClick={onClose} 
                        className="w-full bg-white text-slate-950 font-black py-5 rounded-2xl transition-all hover:bg-slate-200 active:scale-95 uppercase tracking-[0.2em] text-[10px]"
                    >
                        I Understand
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export const ConfirmModal = ({ isOpen, message, title = "Confirmation", onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", danger = false }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }} 
                    className="absolute inset-0 bg-black/80 backdrop-blur-md" 
                    onClick={onCancel} 
                />
                <motion.div 
                    initial={{ scale: 0.98, opacity: 0, y: 10 }} 
                    animate={{ scale: 1, opacity: 1, y: 0 }} 
                    exit={{ scale: 0.98, opacity: 0, y: 10 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-3xl p-10 overflow-hidden text-center"
                >
                    <div className="flex justify-center mb-8">
                        <div className={`p-5 rounded-3xl ${danger ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                            <HelpCircle className="w-10 h-10" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-3 italic">{title}</h3>
                    <p className="text-slate-400 text-xs font-bold leading-relaxed uppercase tracking-widest mb-10">{message}</p>
                    
                    <div className="flex gap-4">
                        <button 
                            onClick={onCancel} 
                            className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button 
                            onClick={onConfirm} 
                            className={`flex-[2] ${danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-600 hover:bg-amber-500'} text-white font-black py-5 rounded-2xl transition-all shadow-xl uppercase tracking-[0.2em] text-[10px] active:scale-95`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
