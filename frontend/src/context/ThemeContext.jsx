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

    useEffect(() => {
        const root = window.document.documentElement;
        // Remove old theme classes
        Object.values(themes).forEach(t => root.classList.remove(t.class));
        // Add current theme class
        root.classList.add(themes[theme].class);
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, themes }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
