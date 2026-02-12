import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const themes = {
    elegant: {
        id: 'elegant',
        name: 'Elegant Blue',
        class: 'theme-elegant',
        description: 'Glass / Textos Oscuros'
    },
    clean: {
        id: 'clean',
        name: 'Clean Mac',
        class: 'theme-clean',
        description: 'Solid / Minimalista'
    },
    custom: {
        id: 'custom',
        name: 'Custom Pro',
        class: 'theme-custom',
        description: 'Dark / Personalizable'
    }
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        const stored = localStorage.getItem('app-theme');
        return (stored && themes[stored]) ? stored : 'elegant';
    });

    const [variant, setVariant] = useState(() => {
        return localStorage.getItem('app-theme-variant') || 'glass';
    });

    const [backgroundType, setBackgroundType] = useState(() => {
        return localStorage.getItem('app-bg-type') || 'theme'; // 'theme', 'stock', 'custom'
    });

    const [customBackground, setCustomBackground] = useState(() => {
        return localStorage.getItem('app-bg-custom') || null;
    });

    const [stockBackground, setStockBackground] = useState(() => {
        return localStorage.getItem('app-bg-stock') || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop';
    });

    const [customPrimary, setCustomPrimary] = useState(() => {
        return localStorage.getItem('app-custom-primary') || '#6366f1';
    });

    useEffect(() => {
        const root = window.document.documentElement;

        // Apply Mode (Light/Dark) based on specific theme config
        // Elegant & Clean are explicitly Light (per user request for dark text)
        // Custom is set to Dark base to provide a dark option
        if (theme === 'custom') {
            root.classList.add('dark');
            root.style.setProperty('--brand-primary', customPrimary);
        } else {
            root.classList.remove('dark');
            root.style.removeProperty('--brand-primary');
        }

        // Remove all theme classes first
        Object.values(themes).forEach(t => root.classList.remove(t.class));
        // Add current theme class
        root.classList.add(themes[theme].class);

        // Apply Style Variant (Solid/Glass)
        // Check if theme enforces a specific variant, otherwise use selected
        // User requested: Elegant -> Glass, Clean -> Solid defaults?
        // But user also said "temas definen background pero usuario define..."
        // I will keep variant decoupled but maybe set reasonable defaults if I could.
        // For now, respect the manually selected 'variant'.
        root.setAttribute('data-theme-style', variant);

        localStorage.setItem('app-theme', theme);
        localStorage.setItem('app-theme-variant', variant);
        localStorage.setItem('app-bg-type', backgroundType);
        if (customBackground) localStorage.setItem('app-bg-custom', customBackground);
        localStorage.setItem('app-bg-stock', stockBackground);
        localStorage.setItem('app-custom-primary', customPrimary);
    }, [theme, variant, backgroundType, customBackground, stockBackground, customPrimary]);

    return (
        <ThemeContext.Provider value={{
            theme, setTheme,
            variant, setVariant,
            backgroundType, setBackgroundType,
            customBackground, setCustomBackground,
            stockBackground, setStockBackground,
            customPrimary, setCustomPrimary,
            themes
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
