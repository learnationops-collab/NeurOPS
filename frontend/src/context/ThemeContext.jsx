import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const themes = {
    dark: {
        id: 'dark',
        name: 'Dark Premium',
        class: 'theme-dark'
    },
    light: {
        id: 'light',
        name: 'Light Minimal',
        class: 'theme-light'
    },
    vibrant: {
        id: 'vibrant',
        name: 'Electric Neon',
        class: 'theme-vibrant'
    }
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('app-theme') || 'dark';
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

    useEffect(() => {
        const root = window.document.documentElement;

        // Apply Mode (Light/Dark)
        if (theme === 'dark' || theme === 'vibrant') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // Apply Style Variant (Solid/Glass)
        root.setAttribute('data-theme-style', variant);

        localStorage.setItem('app-theme', theme);
        localStorage.setItem('app-theme-variant', variant);
        localStorage.setItem('app-bg-type', backgroundType);
        if (customBackground) localStorage.setItem('app-bg-custom', customBackground);
        localStorage.setItem('app-bg-stock', stockBackground);
    }, [theme, variant, backgroundType, customBackground, stockBackground]);

    return (
        <ThemeContext.Provider value={{
            theme, setTheme,
            variant, setVariant,
            backgroundType, setBackgroundType,
            customBackground, setCustomBackground,
            stockBackground, setStockBackground,
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
