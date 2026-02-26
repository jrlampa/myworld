import React from 'react';
import { LogIn, LogOut, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginButton() {
    const { user, loading, loginWithGoogle, logout, quotaInfo } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center p-2 rounded-xl bg-slate-900/50 border border-white/5">
                <Loader2 className="animate-spin text-slate-500" size={18} />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <AnimatePresence>
                {user ? (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md border border-white/10 p-1.5 pr-4 rounded-xl shadow-xl shadow-black/20"
                    >
                        <img
                            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=random`}
                            alt="Avatar"
                            className="w-8 h-8 rounded-lg object-cover border border-white/20"
                        />
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-white leading-tight">{user.displayName?.split(' ')[0] || 'User'}</span>

                            {quotaInfo && (
                                <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 mt-0.5">
                                    <ShieldCheck size={10} />
                                    <span>{quotaInfo.maxQuota - quotaInfo.generatedCount} left</span>
                                </div>
                            )}
                        </div>

                        <div className="h-6 w-px bg-white/10 mx-1"></div>

                        <button
                            onClick={logout}
                            className="text-slate-400 hover:text-rose-400 transition-colors p-1"
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    </motion.div>
                ) : (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={loginWithGoogle}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-blue-500/20 transition-all border border-white/10"
                    >
                        <LogIn size={16} />
                        Login
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
