import React, { useState, useEffect } from 'react';
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
    HelpCircle
} from 'lucide-react';
import Card from '../ui/Card';
import { toast } from 'react-hot-toast';

const UTMGenerator = () => {
    const [formData, setFormData] = useState({
        baseUrl: 'https://institute.thelearnation.com/',
        source: 'instagram',
        medium: 'stories',
        campaign: '',
        content: ''
    });

    const [generatedUrl, setGeneratedUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [isValidUrl, setIsValidUrl] = useState(true);

    const sources = ['instagram', 'facebook', 'google', 'email', 'whatsapp'];
    const mediums = ['bio', 'cpc', 'stories', 'newsletter', 'organic'];

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

    const copyToClipboard = async () => {
        if (!generatedUrl) return;
        try {
            await navigator.clipboard.writeText(generatedUrl);
            setCopied(true);
            
            // Log to backend (silent)
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

    return (
        <Card variant="surface" className="max-w-4xl mx-auto space-y-8 border-white/5 bg-[#0a0b0e]/80 backdrop-blur-xl">
            <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                    <Share2 className="text-primary" size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase">Generador de UTMs</h2>
                    <p className="text-[10px] font-bold text-muted tracking-widest uppercase">Estandarización de enlaces de campaña</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sección de Entradas */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest">
                            <Globe size={12} /> URL Base
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                name="baseUrl"
                                value={formData.baseUrl}
                                onChange={handleInputChange}
                                placeholder="https://institute.thelearnation.com/tu-landing"
                                className={`w-full p-4 bg-white/[0.03] border ${!isValidUrl ? 'border-rose-500/50' : 'border-white/10'} rounded-2xl text-xs font-medium focus:border-primary/50 transition-all outline-none text-white`}
                            />
                            {!isValidUrl && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500">
                                    <AlertCircle size={16} />
                                </div>
                            )}
                        </div>
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
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest">
                                    <Layers size={12} /> UTM Medium
                                </label>
                                <div className="relative group/tooltip">
                                    <HelpCircle size={14} className="text-muted/50 cursor-help hover:text-primary transition-colors" />
                                    <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#1a1b1e] border border-white/10 rounded-2xl p-4 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[100] shadow-2xl backdrop-blur-xl">
                                        <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-3 border-b border-white/5 pb-2">Guía de Mediums</p>
                                        <ul className="space-y-2 text-[10px] text-white/70 font-medium">
                                            <li><span className="text-white font-bold">bio:</span> Link en la biografía del perfil.</li>
                                            <li><span className="text-white font-bold">cpc:</span> Anuncios pagados (pago por clic).</li>
                                            <li><span className="text-white font-bold">stories:</span> Enlaces en historias (IG/FB).</li>
                                            <li><span className="text-white font-bold">newsletter:</span> Enlaces en campañas de email.</li>
                                            <li><span className="text-white font-bold">organic:</span> Tráfico natural no pagado.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
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
