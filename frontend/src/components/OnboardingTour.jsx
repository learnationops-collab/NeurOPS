import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import Button from './ui/Button';
import { TUTORIALS } from '../config/tutorials';
import { useAuth } from '../contexts/AuthContext';

const OnboardingTour = () => {
    const { user } = useAuth();
    const [activeTutorial, setActiveTutorial] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);

    useEffect(() => {
        if (!user) return;

        // Buscar tutorial pendiente para el rol del usuario
        const tutorialId = Object.keys(TUTORIALS).find(id => {
            const t = TUTORIALS[id];
            const seen = localStorage.getItem(`tutorial_seen_${id}`);
            return t.role === user.role && !seen;
        });

        if (tutorialId) {
            setActiveTutorial({ id: tutorialId, ...TUTORIALS[tutorialId] });
            setCurrentStep(0);
        }
    }, [user]);

    useEffect(() => {
        if (activeTutorial) {
            const step = activeTutorial.steps[currentStep];
            const element = document.querySelector(step.target);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const rect = element.getBoundingClientRect();
                setTargetRect(rect);
                element.classList.add('tutorial-highlight');
            }

            return () => {
                if (element) element.classList.remove('tutorial-highlight');
            };
        }
    }, [activeTutorial, currentStep]);

    const handleNext = () => {
        if (currentStep < activeTutorial.steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleComplete = () => {
        localStorage.setItem(`tutorial_seen_${activeTutorial.id}`, 'true');
        setActiveTutorial(null);
    };

    if (!activeTutorial || !targetRect) return null;

    const step = activeTutorial.steps[currentStep];

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Backdrop con agujero (Mask) */}
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] pointer-events-auto"
                style={{
                    clipPath: `polygon(
                        0% 0%, 0% 100%, 
                        ${targetRect.left - 10}px 100%, 
                        ${targetRect.left - 10}px ${targetRect.top - 10}px, 
                        ${targetRect.right + 10}px ${targetRect.top - 10}px, 
                        ${targetRect.right + 10}px ${targetRect.bottom + 10}px, 
                        ${targetRect.left - 10}px ${targetRect.bottom + 10}px, 
                        ${targetRect.left - 10}px 100%, 100% 100%, 100% 0%
                    )`
                }}
            />

            {/* Popover Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        left: targetRect.left,
                        top: targetRect.bottom + 20
                    }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute z-[101] w-80 bg-slate-900 border border-indigo-500/30 rounded-[2rem] p-6 shadow-2xl pointer-events-auto shadow-indigo-500/20"
                >
                    <div className="flex justify-between items-start mb-4">
                        <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                            Paso {currentStep + 1} de {activeTutorial.steps.length}
                        </span>
                        <button onClick={handleComplete} className="text-slate-500 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <h3 className="text-xl font-black text-white italic tracking-tighter mb-2 italic">
                        {step.title}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                        {step.content}
                    </p>

                    <div className="flex justify-between items-center">
                        <div className="flex gap-1">
                            {activeTutorial.steps.map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-4 bg-indigo-500' : 'bg-slate-700'}`}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            {currentStep > 0 && (
                                <Button variant="ghost" size="sm" onClick={handlePrev} icon={ChevronLeft} className="px-3" />
                            )}
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleNext}
                                icon={currentStep === activeTutorial.steps.length - 1 ? CheckCircle2 : ChevronRight}
                                className="text-[10px] uppercase tracking-widest font-black"
                            >
                                {currentStep === activeTutorial.steps.length - 1 ? 'Listo' : 'Siguiente'}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default OnboardingTour;
