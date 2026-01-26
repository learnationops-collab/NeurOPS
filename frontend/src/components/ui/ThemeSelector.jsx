import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Check } from 'lucide-react';

const ThemeSelector = () => {
    const { theme, setTheme, themes } = useTheme();

    const themePreviews = {
        dark: {
            bg: '#030712',
            primary: '#6366f1',
            text: '#f8fafc'
        },
        light: {
            bg: '#f8fafc',
            primary: '#3b82f6',
            text: '#0f172a'
        },
        vibrant: {
            bg: '#09090b',
            primary: '#d946ef',
            text: '#f8fafc'
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(themes).map((t) => (
                <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`
                        relative group overflow-hidden rounded-2xl border transition-all p-4 text-left
                        ${theme === t.id
                            ? 'border-primary ring-2 ring-primary/20 bg-surface'
                            : 'border-base hover:border-white/10 bg-black/20'}
                    `}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">{t.name}</p>
                            <p className="text-[8px] font-bold text-muted uppercase">Preset v1.0</p>
                        </div>
                        {theme === t.id && (
                            <div className="bg-primary text-white p-1 rounded-full shadow-lg">
                                <Check size={12} strokeWidth={4} />
                            </div>
                        )}
                    </div>

                    {/* Mini Preview Box */}
                    <div
                        className="h-16 rounded-xl border border-white/5 flex items-center justify-center p-2 gap-2"
                        style={{ backgroundColor: themePreviews[t.id].bg }}
                    >
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: themePreviews[t.id].primary }}></div>
                        <div className="w-1/2 h-2 rounded-full opacity-20" style={{ backgroundColor: themePreviews[t.id].text }}></div>
                    </div>
                </button>
            ))}
        </div>
    );
};

export default ThemeSelector;
