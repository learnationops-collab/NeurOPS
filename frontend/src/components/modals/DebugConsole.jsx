import React, { useState, useEffect } from 'react';
import { X, Terminal, Filter, Trash2, StopCircle, PlayCircle, Minimize2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '../ui/Button';

const DebugConsole = ({ isVisible, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [isPaused, setIsPaused] = useState(false);
    const [filter, setFilter] = useState('');
    const [logLevel, setLogLevel] = useState('all');

    useEffect(() => {
        const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };

        const intercept = (type, args) => {
            if (isPaused) return;
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');

            setLogs(prev => [
                {
                    id: Date.now() + Math.random(),
                    timestamp: new Date().toLocaleTimeString(),
                    type,
                    message
                },
                ...prev
            ].slice(0, 500)); // Limit history

            originalConsole[type].apply(console, args);
        };

        console.log = (...args) => intercept('log', args);
        console.error = (...args) => intercept('error', args);
        console.warn = (...args) => intercept('warn', args);
        console.info = (...args) => intercept('info', args);

        return () => {
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;
            console.info = originalConsole.info;
        };
    }, [isPaused]);

    const filteredLogs = logs.filter(log =>
        (logLevel === 'all' || log.type === logLevel) &&
        (log.message.toLowerCase().includes(filter.toLowerCase()))
    );

    const getLogColor = (type) => {
        switch (type) {
            case 'error': return 'text-rose-400';
            case 'warn': return 'text-amber-400';
            case 'info': return 'text-sky-400';
            default: return 'text-slate-300';
        }
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-0 left-0 w-full h-[40vh] bg-[#0f111a]/95 backdrop-blur-md border-t border-slate-800 z-50 flex flex-col font-mono text-xs shadow-2xl"
            >
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Terminal size={14} />
                            <span className="font-bold">SYSTEM CONSOLE</span>
                        </div>
                        <div className="h-4 w-px bg-slate-700" />
                        <div className="flex gap-2">
                            <Button
                                onClick={() => setIsPaused(!isPaused)}
                                variant="ghost"
                                className={`h-6 px-2 text-[10px] ${isPaused ? 'text-amber-400' : 'text-slate-400'}`}
                            >
                                {isPaused ? <PlayCircle size={12} className="mr-1" /> : <StopCircle size={12} className="mr-1" />}
                                {isPaused ? 'RESUME' : 'PAUSE'}
                            </Button>
                            <Button onClick={() => setLogs([])} variant="ghost" className="h-6 px-2 text-[10px] text-slate-400 hover:text-rose-400">
                                <Trash2 size={12} className="mr-1" /> CLEAR
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Filter size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Filter output..."
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2 py-1 text-slate-300 focus:border-indigo-500 outline-none w-48"
                            />
                        </div>
                        <select
                            value={logLevel}
                            onChange={(e) => setLogLevel(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 outline-none"
                        >
                            <option value="all">All Levels</option>
                            <option value="log">Log</option>
                            <option value="info">Info</option>
                            <option value="warn">Warn</option>
                            <option value="error">Error</option>
                        </select>
                        <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
                            <Minimize2 size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono custom-scrollbar">
                    {filteredLogs.map(log => (
                        <div key={log.id} className="flex gap-4 hover:bg-white/5 p-0.5 rounded px-2">
                            <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                            <span className={`uppercase font-bold shrink-0 w-12 ${getLogColor(log.type)}`}>{log.type}</span>
                            <span className="text-slate-300 break-all whitespace-pre-wrap">{log.message}</span>
                        </div>
                    ))}
                    {filteredLogs.length === 0 && (
                        <div className="text-slate-600 italic text-center py-10">No logs captured...</div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default DebugConsole;
