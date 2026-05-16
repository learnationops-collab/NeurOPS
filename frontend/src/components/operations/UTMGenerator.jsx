import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Link, 
    Copy, 
    Check, 
    Globe, 
    Tag, 
    Layers, 
    Share2, 
    Type,
    HelpCircle,
    Plus,
    X,
    AlertCircle
} from 'lucide-react';
import Card from '../ui/Card';
import { toast } from 'react-hot-toast';

const UTMGenerator = () => {
    const defaultLandings = [
        'https://institute.thelearnation.com/acceso',
        'https://institute.thelearnation.com/bienvenido',
        'https://institute.thelearnation.com/live-class',
        'https://institute.thelearnation.com/live'
    ];

    const [customLandings, setCustomLandings] = useState(() => {
        const saved = localStorage.getItem('utm_generator_custom_landings');
        return saved ? JSON.parse(saved) : [];
    });

    const [newLandingUrl, setNewLandingUrl] = useState('');
    const [showAddLanding, setShowAddLanding] = useState(false);

    const [formData, setFormData] = useState({
        baseUrl: defaultLandings[0],
        source: 'instagram',
        medium: 'stories',
        campaign: '',
        content: ''
    });

    const [generatedUrl, setGeneratedUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [isValidUrl, setIsValidUrl] = useState(true);

    const sources = ['instagram', 'facebook', 'google', 'email', 'whatsapp', 'manychat'];
    const mediums = ['bio', 'cpc', 'stories', 'newsletter', 'organic', 'automation'];

    useEffect(() => {
        localStorage.setItem('utm_generator_custom_landings', JSON.stringify(customLandings));
    }, [customLandings]);

    const formatString = (str) => {
        return str
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-');
    };

    const validateUrl = (url) => {
        if (!url) return true;
        try {
            new URL(url);
            return true;
        } catch (e) {
            return false;
        }
    };

    useEffect(() => {
        const { baseUrl, source, medium, campaign, content } = formData;
        
        const valid = validateUrl(baseUrl);
        setIsValidUrl(valid);

        if (baseUrl && valid) {
            try {
                const url = new URL(baseUrl);
                const params = new URLSearchParams(url.search);

                params.set('utm_source', formatString(source));
                params.set('utm_medium', formatString(medium));
                
                if (campaign) params.set('utm_campaign', formatString(campaign));
                if (content) params.set('utm_content', formatString(content));

                // Reconstruir URL preservando hash si existe
                setGeneratedUrl(`${url.origin}${url.pathname}?${params.toString()}${url.hash}`);
            } catch (err) {
                setGeneratedUrl('');
            }
        } else {
            setGeneratedUrl('');
        }
    }, [formData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddLanding = () => {
        if (!validateUrl(newLandingUrl)) {
            toast.error('URL inválida');
            return;
        }
        if (customLandings.includes(newLandingUrl) || defaultLandings.includes(newLandingUrl)) {
            toast.error('URL ya existe en la lista');
            return;
        }
        setCustomLandings(prev => [...prev, newLandingUrl]);
        setFormData(prev => ({ ...prev, baseUrl: newLandingUrl }));
        setNewLandingUrl('');
        setShowAddLanding(false);
        toast.success('Landing agregada');
    };

    const removeLanding = (url, e) => {
        e.stopPropagation();
        setCustomLandings(prev => prev.filter(l => l !== url));
    };

    const copyToClipboard = async () => {
        if (!generatedUrl) return;
        try {
            await navigator.clipboard.writeText(generatedUrl);
            setCopied(true);
            
            try {
                await fetch('/api/marketing/utm-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        base_url: formData.baseUrl,
                        final_url: generatedUrl,
                        utm_source: formData.source,
                        utm_medium: formData.medium,
                        utm_campaign: formData.campaign,
                        utm_content: formData.content
                    })
                });
            } catch (logErr) {
                console.error("Failed to log UTM creation", logErr);
            }

            toast.success('¡Enlace copiado y registrado!', {
                style: {
                    background: '#020617',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)'
                }
            });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Error al copiar');
        }
    };

    const allLandings = [...defaultLandings, ...customLandings];

    return (
        <Card variant="surface" className="max-w-4xl mx-auto space-y-8 border-white/5 bg-[#0a0b0e]/80 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                        <Share2 className="text-primary" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black italic tracking-tighter uppercase">Generador de UTMs</h2>
                        <p className="text-[10px] font-bold text-muted tracking-widest uppercase">Estandarización de enlaces de campaña</p>
                    </div>
                </div>
            </div>

            {/* Selección Rápida de Landings */}
            <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest">
                    <Globe size={12} /> Seleccionar Landing Page
                </label>
                <div className="flex flex-wrap gap-2">
                    {allLandings.map((url) => {
                        const isCustom = customLandings.includes(url);
                        const isActive = formData.baseUrl === url;
                        const label = url.split('/').pop() || url;

                        return (
                            <div key={url} className="relative group">
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, baseUrl: url }))}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                                        isActive 
                                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                        : 'bg-white/[0.03] border-white/10 text-muted hover:border-white/30 hover:text-white'
                                    }`}
                                >
                                    {label}
                                </button>
                                {isCustom && (
                                    <button 
                                        onClick={(e) => removeLanding(url, e)}
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border-2 border-[#0a0b0e]"
                                    >
                                        <X size={8} className="text-white" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    <button 
                        onClick={() => setShowAddLanding(!showAddLanding)}
                        className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Agregar Landing
                    </button>
                </div>

                <AnimatePresence>
                    {showAddLanding && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="flex gap-2 p-4 bg-white/[0.02] border border-white/5 rounded-2xl mt-2">
                                <input 
                                    type="text"
                                    placeholder="https://otra-landing.com/..."
                                    value={newLandingUrl}
                                    onChange={(e) => setNewLandingUrl(e.target.value)}
                                    className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-white/20"
                                />
                                <button 
                                    onClick={handleAddLanding}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
                                >
                                    Guardar
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sección de Entradas */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest">
                            URL Manual
                        </label>
                        <input
                            type="text"
                            name="baseUrl"
                            value={formData.baseUrl}
                            onChange={handleInputChange}
                            placeholder="https://institute.thelearnation.com/tu-landing"
                            className={`w-full p-4 bg-white/[0.03] border ${!isValidUrl ? 'border-rose-500/50' : 'border-white/10'} rounded-2xl text-xs font-medium focus:border-primary/50 transition-all outline-none text-white`}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest">
                                <Tag size={12} /> UTM Source
                            </label>
                            <select
                                name="source"
                                value={formData.source}
                                onChange={handleInputChange}
                                className="w-full p-4 bg-[#1a1b1e] border border-white/10 rounded-2xl text-xs font-medium focus:border-primary/50 transition-all outline-none appearance-none text-white cursor-pointer"
                            >
                                {sources.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest">
                                <Layers size={12} /> UTM Medium
                            </label>
                            <select
                                name="medium"
                                value={formData.medium}
                                onChange={handleInputChange}
                                className="w-full p-4 bg-[#1a1b1e] border border-white/10 rounded-2xl text-xs font-medium focus:border-primary/50 transition-all outline-none appearance-none text-white cursor-pointer"
                            >
                                {mediums.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest">
                            <Type size={12} /> UTM Campaign
                        </label>
                        <input
                            type="text"
                            name="campaign"
                            value={formData.campaign}
                            onChange={handleInputChange}
                            placeholder="Black Friday 2024"
                            className="w-full p-4 bg-white/[0.03] border border-white/10 rounded-2xl text-xs font-medium focus:border-primary/50 transition-all outline-none text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest">
                            <Type size={12} /> UTM Content (Opcional)
                        </label>
                        <input
                            type="text"
                            name="content"
                            value={formData.content}
                            onChange={handleInputChange}
                            placeholder="Banner A"
                            className="w-full p-4 bg-white/[0.03] border border-white/10 rounded-2xl text-xs font-medium focus:border-primary/50 transition-all outline-none text-white"
                        />
                    </div>
                </div>

                {/* Sección de Resultado */}
                <div className="space-y-6">
                    <div className="h-full flex flex-col">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Resultado Final</label>
                        <div className="flex-1 p-6 bg-primary/5 border border-primary/20 rounded-3xl flex flex-col justify-between relative group overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-[9px] font-bold text-primary tracking-widest uppercase mb-4">URL Generada</p>
                                <div className="text-sm font-mono break-all text-white/90 leading-relaxed min-h-[100px]">
                                    {generatedUrl || <span className="text-white/20 italic">Completa los campos para generar el enlace...</span>}
                                </div>
                            </div>

                            <button
                                onClick={copyToClipboard}
                                disabled={!generatedUrl}
                                className={`mt-6 w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 font-black uppercase text-[10px] tracking-widest ${
                                    copied 
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                    : 'bg-primary text-white hover:shadow-lg hover:shadow-primary/30 disabled:opacity-30 disabled:hover:shadow-none'
                                }`}
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                {copied ? 'Copiado!' : 'Copiar al portapapeles'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default UTMGenerator;
