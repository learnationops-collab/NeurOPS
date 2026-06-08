import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import LeadRoadmapDetail from '../leads/LeadRoadmapDetail';

const LeadRoadmapModal = ({ isOpen, instagram, clientId, email, phone, onClose, onSuccess }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 overflow-y-auto">
                {/* Backdrop overlay */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
                />

                {/* Modal Container */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    className="relative w-full max-w-[1400px] bg-slate-950 border border-slate-800 rounded-[2.5rem] shadow-2xl z-10 overflow-hidden my-8"
                >
                    {/* Botón flotante de cierre */}
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 w-10 h-10 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-full flex items-center justify-center transition-all z-50"
                        title="Cerrar modal"
                    >
                        <X size={18} />
                    </button>

                    <div className="p-2 sm:p-4 md:p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <LeadRoadmapDetail 
                            instagram={instagram}
                            clientId={clientId}
                            email={email}
                            phone={phone}
                            onBack={onClose}
                            onUpdate={onSuccess}
                        />
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default LeadRoadmapModal;
