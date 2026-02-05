import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DebugConsole from './DebugConsole';
import OnboardingTour from './OnboardingTour';
import OperatorControls from './OperatorControls';
import GlobalSettingsModal from './GlobalSettingsModal';
import Dock from './Dock';
import WidgetsPill from './WidgetsPill';
import HotkeysManager from './HotkeysManager';

const MainLayout = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [showImpersonation, setShowImpersonation] = useState(false);
    const [showConsole, setShowConsole] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isPillOpen, setIsPillOpen] = useState(false);
    const [isDockVisible, setIsDockVisible] = useState(true);
    const [lastWidgetsNavKey, setLastWidgetsNavKey] = useState(null);

    const inactivityTimerRef = useRef(null);

    // Reset inactivity timer and show dock
    const resetInactivity = useCallback(() => {
        setIsDockVisible(true);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

        inactivityTimerRef.current = setTimeout(() => {
            setIsDockVisible(false);
        }, 5000); // 5 seconds
    }, []);

    // Handle global activity
    useEffect(() => {
        const handleActivity = () => resetInactivity();

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('mousedown', handleActivity);
        window.addEventListener('scroll', handleActivity, true);

        // Initial timer
        resetInactivity();

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('mousedown', handleActivity);
            window.removeEventListener('scroll', handleActivity, true);
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, [resetInactivity]);

    // Double-click to close menus
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

    // Control Focus: 'widgets' if pill is open, else 'dock'
    const controlFocus = isPillOpen ? 'widgets' : 'dock';

    // Auto-minimize dock when widgets open
    useEffect(() => {
        if (isPillOpen) {
            setIsDockVisible(false);
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        } else {
            resetInactivity();
        }
    }, [isPillOpen, resetInactivity]);

    if (!user) return null;

    return (
        <div className="flex h-screen bg-main text-base overflow-hidden w-full">
            {/* behavior only component */}
            <HotkeysManager
                controlFocus={controlFocus}
                onToggleWidgets={() => setIsPillOpen(prev => !prev)}
                onToggleSettings={() => setShowSettings(prev => !prev)}
                onResetInactivity={resetInactivity}
                onWidgetsNavigate={(key) => setLastWidgetsNavKey({ key, timestamp: Date.now() })}
            />

            {/* Simulation Overlay */}
            <OperatorControls
                isOpen={showImpersonation}
                onClose={() => setShowImpersonation(false)}
            />

            {/* Global Settings Modal */}
            <GlobalSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />

            {/* Tutorial Overlay */}
            <OnboardingTour />

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-main relative">
                {/* Page Content */}
                <div id="app-main-scroll" className="flex-1 overflow-y-auto scroll-smooth pb-32">
                    <div className="min-h-full">
                        {children}
                    </div>
                </div>

                {/* Navigation Dock */}
                <Dock
                    isVisible={isDockVisible}
                    onToggleVisibility={() => setIsDockVisible(!isDockVisible)}
                    onSettingsClick={() => setShowSettings(true)}
                    isSettingsOpen={showSettings}
                />

                {/* Widgets & Tools Pill */}
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
    );
};

export default MainLayout;
