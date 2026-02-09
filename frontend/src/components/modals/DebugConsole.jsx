import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Minimize2, Maximize2, Trash2, Copy } from 'lucide-react';

import api from '../../services/api'; // Import configured API

const DebugConsole = ({ isVisible, onClose }) => {
    const [isOpen, setIsOpen] = useState(false); // Default collapsed
    const [logs, setLogs] = useState([]);

    // Ref to keep track of the original console methods
    const originalConsole = useRef({
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
    });

    const checkAuthStatus = async () => {
        try {
            console.info("Testing Auth Connection...");
            const res = await api.get('/auth/debug');
            console.log("Auth Debug Response:", res.data);
            if (!res.data.is_authenticated) {
                console.warn("Server says NOT Authenticated. Cookies received:", res.data.cookies_received);
            } else {
                console.log("Server says Authenticated as:", res.data.user_id);
            }
        } catch (e) {
            console.error("Auth Check Failed:", e);
        }
    };

    const copyLogs = () => {
        const logText = logs.map(log => {
            // Use log.message as it's the current structure
            const content = typeof log.message === 'object' ? JSON.stringify(log.message) : log.message;
            return `[${log.timestamp}][${log.type}] ${content}`;
        }).join('\n');

        navigator.clipboard.writeText(logText).then(() => {
            console.info('Logs copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy logs', err);
        });
    };

    useEffect(() => {
        const handleLog = (type, args) => {
            const timestamp = new Date().toLocaleTimeString();
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch (e) {
                        return '[Circular/Object]';
                    }
                }
                return String(arg);
            }).join(' ');

            // Defer state update to avoid "Cannot update a component during render" errors
            setTimeout(() => {
                setLogs(prev => [...prev, { type, message, timestamp }].slice(-100)); // Keep last 100 logs
            }, 0);

            // Call original console method to ensure it still shows in DevTools
            if (originalConsole.current[type]) {
                originalConsole.current[type](...args);
            }
        };

        // Override console methods
        console.log = (...args) => handleLog('log', args);
        console.error = (...args) => handleLog('error', args);
        console.warn = (...args) => handleLog('warn', args);
        console.info = (...args) => handleLog('info', args);

        return () => {
            // Restore original console methods on cleanup
            console.log = originalConsole.current.log;
            console.error = originalConsole.current.error;
            console.warn = originalConsole.current.warn;
            console.info = originalConsole.current.info;
        };
    }, []);

    if (!isVisible) return null;

    return (
        <div className={`fixed bottom-4 right-4 z-[9999] transition-all duration-300 font-mono text-xs ${isOpen ? 'w-96 h-96' : 'w-auto h-auto'}`}>
            <div className="bg-slate-900 border border-slate-700 rounded-t-lg shadow-2xl flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-2 bg-slate-800 border-b border-slate-700 rounded-t-lg cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                    <div className="flex items-center gap-2 text-slate-300">
                        <Terminal size={14} />
                        <span className="font-bold">Debug Console</span>
                        <span className="bg-slate-700 px-1.5 rounded text-[10px]">{logs.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); checkAuthStatus(); }}
                            className="px-2 py-0.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded text-[10px] transition-colors border border-indigo-500/30"
                            title="Check Auth Status"
                        >
                            Test Auth
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); copyLogs(); }}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400 transition-colors"
                            title="Copy Logs"
                        >
                            <Copy size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setLogs([]); }}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                            title="Clear Logs"
                        >
                            <Trash2 size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                            title="Hide Console"
                        >
                            <X size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        >
                            {isOpen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        </button>
                    </div>
                </div>

                {/* Logs Area (only visual when open) */}
                {isOpen && (
                    <div className="flex-1 overflow-y-auto p-2 bg-slate-950/90 space-y-1 custom-scrollbar">
                        {logs.length === 0 && (
                            <div className="text-slate-600 text-center mt-4">No logs yet...</div>
                        )}
                        {logs.map((log, idx) => (
                            <div key={idx} className={`border-b border-slate-800/50 pb-1 break-words ${log.type === 'error' ? 'text-red-400' :
                                log.type === 'warn' ? 'text-yellow-400' :
                                    'text-emerald-400'
                                }`}>
                                <span className="text-[10px] text-slate-500 mr-2">[{log.timestamp}]</span>
                                <span className="uppercase text-[9px] font-bold opacity-70 mr-1">[{log.type}]</span>
                                <span>{log.message}</span>
                            </div>
                        ))}
                        {/* Auto-scroll anchor could be added here */}
                        <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DebugConsole;
