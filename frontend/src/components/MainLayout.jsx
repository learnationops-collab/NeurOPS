import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../context/ThemeContext';
import DebugConsole from './modals/DebugConsole';
import OnboardingTour from './modals/OnboardingTour';
import OperatorControls from './modals/OperatorControls';
import GlobalSettingsModal from './modals/GlobalSettingsModal';
import Dock from './shared/Dock';
import WidgetsPill from './shared/WidgetsPill';
import HotkeysManager from './admin/HotkeysManager';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const MainLayout = ({ children }) => {
    const { user } = useAuth();
    const { backgroundType, customBackground, stockBackground } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const [showImpersonation, setShowImpersonation] = useState(false);
    const [showConsole, setShowConsole] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isPillOpen, setIsPillOpen] = useState(false);
    const [isDockVisible, setIsDockVisible] = useState(true);
    const [lastWidgetsNavKey, setLastWidgetsNavKey] = useState(null);

    // Estados para notificaciones globales
    const inactivityTimerRef = useRef(null);

    const resetInactivity = useCallback(() => {
        setIsDockVisible(true);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

        inactivityTimerRef.current = setTimeout(() => {
            setIsDockVisible(false);
        }, 5000); // 5 seconds
    }, []);

    useEffect(() => {
        const handleActivity = () => resetInactivity();

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('mousedown', handleActivity);
        window.addEventListener('scroll', handleActivity, true);

        resetInactivity();

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('mousedown', handleActivity);
            window.removeEventListener('scroll', handleActivity, true);
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, [resetInactivity]);

    useEffect(() => {
        const handleDoubleClick = () => {
            if (isPillOpen) setIsPillOpen(false);
            if (showSettings) setShowSettings(false);
            if (showConsole) setShowConsole(false);
            if (showImpersonation) setShowImpersonation(false);
        };

        window.addEventListener('dblclick', handleDoubleClick);
        return () => window.removeEventListener('dblclick', handleDoubleClick);
    }, [isPillOpen, showSettings, showConsole, showImpersonation]);

    const controlFocus = isPillOpen ? 'widgets' : 'dock';

    useEffect(() => {
        if (isPillOpen) {
            setIsDockVisible(false);
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        } else {
            resetInactivity();
        }
    }, [isPillOpen, resetInactivity]);

    if (!user) return null;

    const bgImage = backgroundType === 'custom' ? customBackground : backgroundType === 'stock' ? stockBackground : null;

    return (
        <div
            className="flex h-screen bg-main text-base overflow-visible w-full relative transition-all duration-1000"
            style={bgImage ? {
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            } : {}}
        >
            {bgImage && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
            )}

            <div className="relative z-10 flex w-full h-full overflow-visible">
                <HotkeysManager
                    controlFocus={controlFocus}
                    onToggleWidgets={() => setIsPillOpen(prev => !prev)}
                    onToggleSettings={() => setShowSettings(prev => !prev)}
                    onResetInactivity={resetInactivity}
                    onWidgetsNavigate={(key) => setLastWidgetsNavKey({ key, timestamp: Date.now() })}
                />

                <OperatorControls
                    isOpen={showImpersonation}
                    onClose={() => setShowImpersonation(false)}
                />

                <GlobalSettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                />

                <OnboardingTour />

                <main className="flex-1 flex flex-col min-w-0 overflow-visible relative">
                    <div id="app-main-scroll" className="flex-1 overflow-y-auto scroll-smooth pb-32">
                        <div className="min-h-full">
                            {children}
                        </div>
                    </div>

                    <Dock
                        isVisible={isDockVisible}
                        onToggleVisibility={() => setIsDockVisible(!isDockVisible)}
                        onSettingsClick={() => setShowSettings(true)}
                        isSettingsOpen={showSettings}
                    />

                    <WidgetsPill
                        isOpen={isPillOpen}
                        onToggle={() => setIsPillOpen(!isPillOpen)}
                        onConsoleToggle={() => setShowConsole(!showConsole)}
                        onImpersonateClick={() => setShowImpersonation(true)}
                        isConsoleOpen={showConsole}
                        lastNavKey={lastWidgetsNavKey}
                    />
                </main>

                <DebugConsole isVisible={showConsole} onClose={() => setShowConsole(false)} />
            </div>


        </div>
    );
};

export default MainLayout;
