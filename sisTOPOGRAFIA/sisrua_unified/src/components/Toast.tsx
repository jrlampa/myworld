import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, duration]);

    const icons = {
        success: <CheckCircle2 className="text-emerald-400" size={20} />,
        error: <AlertCircle className="text-rose-400" size={20} />,
        info: <Info className="text-sky-400" size={20} />
    };

    const borderColors = {
        success: 'border-emerald-500/30',
        error: 'border-rose-500/30',
        info: 'border-sky-500/30'
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className={`fixed top-4 right-4 z-[1000] flex items-center gap-4 p-4 rounded-2xl glass border-t ${borderColors[type]} shadow-2xl max-w-sm w-full`}
        >
            <div className="shrink-0 p-2 rounded-xl bg-slate-800/50">
                {icons[type]}
            </div>
            <p className="text-xs font-semibold text-slate-100 flex-1 leading-relaxed">
                {message}
            </p>
            <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="text-slate-500 hover:text-white transition-colors p-1"
            >
                <X size={16} />
            </motion.button>
        </motion.div>
    );
};

export default Toast;
