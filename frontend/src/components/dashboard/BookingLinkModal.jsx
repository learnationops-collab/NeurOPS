import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Copy, CheckCircle2, X, ChevronDown, Activity, Link as LinkIcon } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const BookingLinkModal = ({ isOpen, onClose, data = [] }) => {
    const [copying, setCopying] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [selectedLinkId, setSelectedLinkId] = useState(null);
    const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
    const [isLinkDropdownOpen, setIsLinkDropdownOpen] = useState(false);

    useEffect(() => {
        if (data.length > 0 && !selectedGroupId) {
            setSelectedGroupId(data[0].id);
            if (data[0].links.length > 0) {
                setSelectedLinkId(data[0].links[0].id);
            }
        }
    }, [data, selectedGroupId]);

    const selectedGroup = data.find(g => g.id === selectedGroupId) || data[0] || {};
    const selectedLink = selectedGroup.links?.find(l => l.id === selectedLinkId) || selectedGroup.links?.[0] || {};

    const handleCopyLink = () => {
        if (!selectedLink.url) return;
        navigator.clipboard.writeText(selectedLink.url);
        setCopying(true);
        setTimeout(() => setCopying(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                />
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    className="relative w-full max-w-sm bg-main border border-white/10 rounded-[32px] shadow-2xl overflow-hidden p-8"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-xl">
                                <Zap size={18} className="text-indigo-400" />
                            </div>
                            <h2 className="text-lg font-black uppercase tracking-tighter text-white italic">Links de Agenda</h2>
                        </div>
                        <button onClick={onClose} className="p-2 text-muted hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Selector de Evento Comercial */}
                        <div className="relative">
                            <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] ml-1 mb-2 block">Evento Comercial</label>
                            <button
                                onClick={() => {
                                    setIsGroupDropdownOpen(!isGroupDropdownOpen);
                                    setIsLinkDropdownOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-5 py-4 bg-surface/50 border border-base rounded-2xl text-[11px] font-bold text-base hover:border-indigo-500/40 transition-all focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <span className="truncate">{selectedGroup.name || 'Selecciona Evento'}</span>
                                <ChevronDown size={14} className={`text-muted transition-transform duration-300 ${isGroupDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {isGroupDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute top-full left-0 w-full mt-2 bg-surface/95 backdrop-blur-xl border border-base rounded-2xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar"
                                    >
                                        {data.map((group) => (
                                            <button
                                                key={group.id}
                                                onClick={() => {
                                                    setSelectedGroupId(group.id);
                                                    if (group.links.length > 0) {
                                                        setSelectedLinkId(group.links[0].id);
                                                    } else {
                                                        setSelectedLinkId(null);
                                                    }
                                                    setIsGroupDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-5 py-4 text-[10px] font-bold uppercase tracking-wide hover:bg-indigo-500/10 transition-colors border-b border-base/30 last:border-0 ${selectedGroupId === group.id ? 'text-indigo-400 bg-indigo-500/5' : 'text-muted'}`}
                                            >
                                                {group.name}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Selector de Link / Variante */}
                        <div className="relative">
                            <label className="text-[9px] font-black text-muted-main uppercase tracking-[0.2em] ml-1 mb-2 block">Variante / Link</label>
                            <button
                                onClick={() => {
                                    setIsLinkDropdownOpen(!isLinkDropdownOpen);
                                    setIsGroupDropdownOpen(false);
                                }}
                                disabled={!selectedGroup.links || selectedGroup.links.length === 0}
                                className="w-full flex items-center justify-between px-5 py-4 bg-surface/50 border border-base rounded-2xl text-[11px] font-bold text-base hover:border-indigo-500/40 transition-all focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                            >
                                <span className="truncate">{selectedLink.name || 'Sin links disponibles'}</span>
                                <ChevronDown size={14} className={`text-muted transition-transform duration-300 ${isLinkDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {isLinkDropdownOpen && selectedGroup.links && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute top-full left-0 w-full mt-2 bg-surface/95 backdrop-blur-xl border border-base rounded-2xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar"
                                    >
                                        {selectedGroup.links.map((link) => (
                                            <button
                                                key={link.id}
                                                onClick={() => {
                                                    setSelectedLinkId(link.id);
                                                    setIsLinkDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-5 py-4 text-[10px] font-bold uppercase tracking-wide hover:bg-indigo-500/10 transition-colors border-b border-base/30 last:border-0 ${selectedLinkId === link.id ? 'text-indigo-400 bg-indigo-500/5' : 'text-muted'}`}
                                            >
                                                {link.name}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Link Card Component */}
                        <div className="p-6 bg-surface/30 border border-white/5 rounded-2xl space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <LinkIcon size={12} className="text-indigo-500/50" />
                                    <span className="text-[10px] font-mono text-indigo-400/80 truncate">
                                        {selectedLink.url ? `.../book/${selectedLink.slug}` : 'N/A'}
                                    </span>
                                </div>
                                <Activity size={12} className="text-emerald-500 animate-pulse shrink-0" />
                            </div>

                            <Button
                                onClick={handleCopyLink}
                                disabled={!selectedLink.url}
                                className={`w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${copying ? 'bg-emerald-500' : 'bg-indigo-500 shadow-lg shadow-indigo-500/20 hover:scale-[1.02]'}`}
                            >
                                {copying ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                                {copying ? 'Copiado' : 'Copiar Link'}
                            </Button>
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-white/5 text-center">
                        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted/20 italic">
                            Hotkey [L] para cerrar
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BookingLinkModal;
