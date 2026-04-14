import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut } from 'lucide-react';
import useDockNavigation from '../../hooks/useDockNavigation';

const Dock = () => {
    const { user, logout } = useAuth();
    const {
        pages,
        activePageIndex,
        sections,
        activeSectionIndex,
        onPageChange,
        onSectionChange
    } = useDockNavigation();

    const userInitial = user?.name?.charAt(0).toUpperCase() || 'U';

    const handleWheel = (e) => {
        if (Math.abs(e.deltaY) > 10) {
            e.preventDefault();
            if (sections.length > 0) {
                if (e.deltaY > 0) {
                    // Siguiente
                    if (activeSectionIndex < sections.length - 1) {
                        onSectionChange(activeSectionIndex + 1);
                    }
                } else {
                    // Anterior
                    if (activeSectionIndex > 0) {
                        onSectionChange(activeSectionIndex - 1);
                    }
                }
            }
        }
    };

    return (
        <div className="fixed bottom-10 left-0 w-full flex justify-center z-50 pointer-events-none">
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                className="pointer-events-auto"
            >
                <div
                    className="bg-[#1a1c23]/95 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-1.5 shadow-2xl flex items-center"
                    onWheel={handleWheel}
                >
                    {/* Left edge (No spacer here as per user request to move Dashboard to the left edge) */}

                    {/* Horizontal Pages List - Natural width, compact gap */}
                    <div className="flex items-center gap-1.5 px-2">
                        {pages.map((page, idx) => {
                            const isActive = idx === activePageIndex;
                            const hasSections = isActive && sections.length > 0;
                            const currentSection = hasSections ? sections[activeSectionIndex] : null;
                            const prevSection = hasSections ? sections[(activeSectionIndex - 1 + sections.length) % sections.length] : null;
                            const nextSection = hasSections ? sections[(activeSectionIndex + 1) % sections.length] : null;

                            return (
                                <div key={page.id} className="relative flex flex-col items-center">
                                    {/* Orbiting Elements for Active Page (Sections) */}
                                    {isActive && hasSections && (
                                        <>
                                            {/* Prev Section Label (Orbiting Top) */}
                                            <AnimatePresence mode="wait">
                                                {activeSectionIndex > 0 && (
                                                    <motion.div
                                                        key={`prev-${prevSection?.id}`}
                                                        initial={{ opacity: 0, x: '-50%', y: 5 }}
                                                        animate={{ opacity: 0.3, x: '-50%', y: 0 }}
                                                        exit={{ opacity: 0, x: '-50%', y: -5 }}
                                                        className="absolute -top-10 left-1/2 text-[9px] font-black text-muted/50 uppercase tracking-[0.3em] cursor-pointer whitespace-nowrap hover:text-primary transition-colors"
                                                        onClick={() => onSectionChange(activeSectionIndex - 1)}
                                                    >
                                                        {prevSection?.label}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Next Section Label (Orbiting Bottom) */}
                                            <AnimatePresence mode="wait">
                                                {activeSectionIndex < sections.length - 1 && (
                                                    <motion.div
                                                        key={`next-${nextSection?.id}`}
                                                        initial={{ opacity: 0, x: '-50%', y: -5 }}
                                                        animate={{ opacity: 0.3, x: '-50%', y: 0 }}
                                                        exit={{ opacity: 0, x: '-50%', y: 5 }}
                                                        className="absolute -bottom-10 left-1/2 text-[9px] font-black text-muted/50 uppercase tracking-[0.3em] cursor-pointer whitespace-nowrap hover:text-primary transition-colors"
                                                        onClick={() => onSectionChange(activeSectionIndex + 1)}
                                                    >
                                                        {nextSection?.label}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </>
                                    )}

                                    {/* Main Button/Pill */}
                                    <motion.button
                                        onClick={() => onPageChange(idx)}
                                        className={`
                                            relative flex items-center justify-center gap-2.5 transition-all duration-500 rounded-full
                                            ${isActive
                                                ? 'bg-[#1534ff] text-white px-5 h-10 min-w-[140px] shadow-lg shadow-blue-600/20'
                                                : 'w-10 h-10 text-muted/50 hover:text-primary hover:bg-white/5'}
                                        `}
                                        layoutId={isActive ? "dock-pill" : undefined}
                                    >
                                        <div className="flex items-center gap-2">
                                            <page.icon size={20} className={isActive ? 'text-white' : ''} />
                                            {isActive && (
                                                <div className="flex gap-0.5 opacity-40">
                                                    <div className="w-1 h-1 rounded-full bg-white" />
                                                    <div className="w-1 h-1 rounded-full bg-white/50" />
                                                </div>
                                            )}
                                        </div>

                                        {isActive && (
                                            <motion.span
                                                initial={{ opacity: 0, x: -5 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap ml-1"
                                            >
                                                {hasSections && currentSection?.label ? currentSection.label : page.label}
                                            </motion.span>
                                        )}
                                    </motion.button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Balanced Right Container (Avatar - Exactly 56px) */}
                    <div className="w-14 flex items-center justify-end pr-1">
                        <div className="relative group">
                            <button className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted font-bold text-sm hover:bg-white/10 transition-all">
                                {userInitial}
                            </button>

                            {/* Dropdown Menu */}
                            <div className="absolute bottom-full right-0 pb-5 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                                <div className="bg-[#1a1c23]/95 backdrop-blur-2xl border border-white/5 rounded-3xl p-4 shadow-2xl min-w-[220px]">
                                    <div className="px-2 py-2 border-b border-white/5 mb-3">
                                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Personal Account</p>
                                        <p className="text-sm font-bold text-white mt-1">{user?.name}</p>
                                        <p className="text-[10px] text-muted truncate">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={logout}
                                        className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-rose-500/10 transition-colors text-left group/item"
                                    >
                                        <LogOut size={16} className="text-muted group-hover/item:text-rose-500" />
                                        <span className="text-sm font-bold text-muted group-hover/item:text-rose-500">Log Out</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Dock;
