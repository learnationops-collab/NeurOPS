import { useEffect } from 'react';

const HotkeysManager = ({
    controlFocus = 'dock', // 'dock' or 'widgets'
    onToggleWidgets,
    onToggleSettings,
    onResetInactivity,
    onDockNavigate,
    onWidgetsNavigate
}) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if in input/textarea/contenteditable
            if (
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA' ||
                e.target.isContentEditable
            ) return;

            // Reset inactivity timer on any key press (reveals dock)
            if (onResetInactivity) onResetInactivity();

            const key = e.key.toLowerCase();

            // Toggle Widgets Panel ('W')
            if (key === 'w' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                if (onToggleWidgets) onToggleWidgets();
            }

            // Toggle Settings ('C')
            if (key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                if (onToggleSettings) onToggleSettings();
            }

            // Navigation Keys (Arrows)
            const isArrow = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key);
            if (isArrow) {
                e.preventDefault(); // Prevent browser scroll or highlight
                if (controlFocus === 'widgets' && onWidgetsNavigate) {
                    onWidgetsNavigate(key);
                } else if (controlFocus === 'dock' && onDockNavigate) {
                    onDockNavigate(key);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [controlFocus, onToggleWidgets, onToggleSettings, onResetInactivity, onDockNavigate, onWidgetsNavigate]);

    return null; // This component provides only behavior
};

export default HotkeysManager;
