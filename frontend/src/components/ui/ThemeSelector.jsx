import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Check, Box, Layers, Palette } from 'lucide-react';

const ThemeSelector = () => {
    const { theme, setTheme, themes, variant, setVariant, customPrimary, setCustomPrimary } = useTheme();

    const presets = [
        { id: 'elegant', icon: Layers, label: 'Elegant Blue', sub: 'Glass & Light' },
        { id: 'clean', icon: Box, label: 'Clean Mac', sub: 'Solid & Light' },
        { id: 'custom', icon: Palette, label: 'Custom Pro', sub: 'Dark & Dynamic' }
    ];

    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

    return (
        <div className="space-y-12">
            {/* Theme Presets */}
            <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted">Estilo Visual</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {presets.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setTheme(p.id)}
                            className={`
                                relative group overflow-hidden rounded-[2rem] border-2 transition-all p-6 text-left flex flex-col justify-between h-32
                                ${theme === p.id
                                    ? 'border-primary ring-4 ring-primary/20 bg-surface'
                                    : 'border-base hover:border-primary/50 bg-main/50'}
                            `}
                        >
                            <div className="flex justify-between items-start">
                                <div className={`p-3 rounded-2xl transition-colors ${theme === p.id ? 'bg-primary text-white' : 'bg-surface text-muted'}`}>
                                    <p.icon size={20} />
                                </div>
                                {theme === p.id && <div className="bg-primary text-white p-1.5 rounded-full"><Check size={14} strokeWidth={4} /></div>}
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-main">{p.label}</p>
                                <p className="text-[9px] font-bold text-muted uppercase tracking-wider">{p.sub}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Color Picker (Only for Custom Theme) */}
            {theme === 'custom' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted">Acento Principal</h4>
                    <div className="flex flex-wrap gap-4 p-6 bg-surface border border-base rounded-[2rem]">
                        <input
                            type="color"
                            value={customPrimary}
                            onChange={(e) => setCustomPrimary(e.target.value)}
                            className="w-12 h-12 rounded-full cursor-pointer overflow-hidden border-0 p-0 shadow-xl"
                        />
                        {colors.map(c => (
                            <button
                                key={c}
                                onClick={() => setCustomPrimary(c)}
                                className={`w-12 h-12 rounded-full border-2 transition-all shadow-lg ${customPrimary === c ? 'border-white scale-110 ring-2 ring-white/50' : 'border-transparent hover:scale-110'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Container Style Selector (Still available for decoupling) */}
            <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted">Acabado de Contenedores</h4>
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { id: 'glass', label: 'Glass (Líquido)', sub: 'Translúcido & Blur', icon: Layers },
                        { id: 'solid', label: 'Solid (Material)', sub: 'Opaco & Clean', icon: Box }
                    ].map((s) => (
                        <button
                            key={s.id}
                            onClick={() => setVariant(s.id)}
                            className={`
                            relative group overflow-hidden rounded-2xl border transition-all p-4 text-left flex items-center gap-4
                            ${variant === s.id
                                    ? 'border-primary ring-2 ring-primary/20 bg-surface'
                                    : 'border-base hover:border-white/10 bg-black/20'}
                        `}
                        >
                            <div className={`p-3 rounded-xl transition-colors ${variant === s.id ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted'}`}>
                                <s.icon size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-main">{s.label}</p>
                                <p className="text-[8px] font-bold text-muted uppercase">{s.sub}</p>
                            </div>
                            {variant === s.id && (
                                <div className="absolute top-4 right-4 text-primary">
                                    <Check size={14} strokeWidth={4} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ThemeSelector;
