import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, CheckCircle2, HelpCircle } from 'lucide-react';
import Button from './ui/Button';
import { TUTORIALS } from '../config/tutorials';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

const OnboardingTour = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [activeTutorial, setActiveTutorial] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
    const [showBubble, setShowBubble] = useState(false);
    const [availableTutorialId, setAvailableTutorialId] = useState(null);

    // Determine available tutorial based on context/role
    useEffect(() => {
        if (!user) return;

        let potentialTutorialId = null;

        // Context-aware tutorial selection
        if (user.role === 'admin' && location.pathname === '/admin/dashboard') {
            potentialTutorialId = 'admin-dashboard-v3';
        } else if (user.role === 'setter') {
            potentialTutorialId = 'setter-onboarding-v1';
        } else if (user.role === 'admin' && location.pathname.includes('/analysis')) {
            potentialTutorialId = 'admin-analysis-v2';
        }

        if (potentialTutorialId) {
            setAvailableTutorialId(potentialTutorialId);
            const seen = localStorage.getItem(`tutorial_seen_${potentialTutorialId}`);
            if (!seen) {
                startTutorial(potentialTutorialId);
            } else {
                setShowBubble(true);
            }
        } else {
            setAvailableTutorialId(null);
            setShowBubble(false);
            setActiveTutorial(null);
        }

    }, [user, location.pathname]);

    const startTutorial = (id) => {
        setActiveTutorial({ id: id, ...TUTORIALS[id] });
        setCurrentStep(0);
        setShowBubble(false);
    };

    // Lock scroll when tutorial is active
    useEffect(() => {
        const container = document.getElementById('app-main-scroll');
        if (activeTutorial && container) {
            container.style.overflow = 'hidden'; // Block user scroll
        } else if (container) {
            container.style.overflow = ''; // Restore default (css handles it)
            // Also reset highlighted elements
            document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        }
        return () => {
            if (container) container.style.overflow = '';
        };
    }, [activeTutorial]);

    useEffect(() => {
        if (activeTutorial) {
            const step = activeTutorial.steps[currentStep];

            // Function to handle scroll and positioning sequence
            const handleStepTransition = async () => {
                const container = document.getElementById('app-main-scroll');

                // Initial check and wait for element (handling loading states)
                let element = document.querySelector(step.target);
                let attempts = 0;
                while (!element && attempts < 20) { // Wait up to 5s (20 * 250ms)
                    await new Promise(r => setTimeout(r, 250));
                    element = document.querySelector(step.target);
                    attempts++;
                }

                // If still not found or no container, abort to prevent lock
                if (!element || !container) {
                    console.warn("Tutorial target not found, aborting step:", step.target);
                    // Optional: could cancel tour here if it's the first step
                    if (currentStep === 0) setActiveTutorial(null);
                    return;
                }

                const placement = step.placement || 'bottom';

                // 1. Custom Scroll Calculation
                const headerOffset = 120; // 80px sticky header + 40px buffer
                const popoverHeightEstimate = 220;

                // Calculate position relative to container content
                const containerRect = container.getBoundingClientRect();
                const elementRect = element.getBoundingClientRect();
                const currentScrollTop = container.scrollTop;

                // Distance from top of container viewport to top of element
                const relativeTop = elementRect.top - containerRect.top;

                // We want: elementTop = headerOffset (so it's visible below header)
                // NewScroll = CurrentScroll + (CurrentRelTop - DesiredRelTop)
                let targetScrollTop = currentScrollTop + relativeTop - headerOffset;

                // Adjust scroll if we need space on TOP for the popover
                if (placement === 'top') {
                    targetScrollTop -= popoverHeightEstimate;
                }

                // Clamp
                if (targetScrollTop < 0) targetScrollTop = 0;

                // Need to enable scroll capability momentarily if it was hidden?
                // Usually element.scrollTo works on overflow:hidden, but let's be safe
                // container.style.overflow = 'hidden'; // It is already hidden by useEffect.

                container.scrollTo({
                    top: targetScrollTop,
                    behavior: 'smooth'
                });

                // 2. Wait for scroll to likely finish
                await new Promise(r => setTimeout(r, 600));

                // 3. Measure after scroll
                // Must remeasure because rects changed
                const newElementRect = element.getBoundingClientRect();
                setTargetRect(newElementRect);
                element.classList.add('tutorial-highlight');

                // 4. Calculate Position (Viewport absolute coordinates)
                const gap = 24;
                const popWidth = 320;
                const popHeight = 200; // base estimate

                let x = 0;
                let y = 0;

                // Helper to center horizontally based on viewport rect
                const centerX = newElementRect.left + (newElementRect.width / 2) - (popWidth / 2);
                const centerY = newElementRect.top + (newElementRect.height / 2) - (popHeight / 2);

                switch (placement) {
                    case 'top':
                        x = centerX;
                        y = newElementRect.top - popHeight - gap;
                        // Avoid overlapping sticky header
                        if (y < 90) y = newElementRect.bottom + gap;
                        break;
                    case 'bottom':
                        x = centerX;
                        y = newElementRect.bottom + gap;
                        break;
                    case 'left':
                        x = newElementRect.left - popWidth - gap;
                        y = centerY;
                        break;
                    case 'right':
                        x = newElementRect.right + gap;
                        y = centerY;
                        break;
                    default:
                        x = centerX;
                        y = newElementRect.bottom + gap;
                }

                // Smart Clamping to Viewport
                x = Math.max(20, Math.min(x, window.innerWidth - popWidth - 20));
                y = Math.max(80, Math.min(y, window.innerHeight - popHeight - 20));

                setPopoverPos({ x, y });
            };

            const timer = setTimeout(handleStepTransition, 100);

            return () => {
                clearTimeout(timer);
                const element = document.querySelector(step.target);
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
        setShowBubble(true);
    };

    const handleSkip = () => {
        handleComplete();
    };

    const handleRestart = () => {
        if (availableTutorialId) {
            startTutorial(availableTutorialId);
        }
    };

    return (
        <>
            {/* Floating Help Bubble */}
            <AnimatePresence>
                {showBubble && availableTutorialId && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={handleRestart}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="fixed bottom-8 right-8 z-50 w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 border border-white/10"
                        title="Ver Tutorial"
                    >
                        <HelpCircle size={24} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Tutorial Overlay */}
            {activeTutorial && targetRect && (
                <div className="fixed inset-0 z-[100] pointer-events-none">
                    {/* Backdrop con agujero (Mask) */}
                    <div
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] pointer-events-auto transition-all duration-500"
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
                            initial={{ opacity: 0, y: popoverPos.y + 20, scale: 0.9 }}
                            animate={{
                                opacity: 1,
                                y: popoverPos.y,
                                x: popoverPos.x,
                                scale: 1,
                            }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="absolute bg-slate-900 border border-indigo-500/30 rounded-[2rem] p-6 shadow-2xl pointer-events-auto shadow-indigo-500/20 w-[320px]"
                            style={{
                                left: 0,
                                top: 0, // Positioning handled by animate x/y
                            }}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                                    Paso {currentStep + 1} de {activeTutorial.steps.length}
                                </span>
                                <button onClick={handleSkip} className="text-slate-500 hover:text-white transition-colors" title="Omitir tutorial">
                                    <X size={18} />
                                </button>
                            </div>

                            <h3 className="text-xl font-black text-white italic tracking-tighter mb-2">
                                {activeTutorial.steps[currentStep].title}
                            </h3>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                                {activeTutorial.steps[currentStep].content}
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
            )}
        </>
    );
};

export default OnboardingTour;
