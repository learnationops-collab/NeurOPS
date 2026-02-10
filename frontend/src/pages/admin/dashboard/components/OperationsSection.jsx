import React, { useState, useEffect } from 'react';
import api from '../../../../services/api';
import Button from '../../../../components/ui/Button';
import { Send, Save, Zap, MessageSquare, Key, Phone, Plus, Trash2, User } from 'lucide-react';
import { toast } from 'react-hot-toast';

const OperationsSection = () => {
    const [loading, setLoading] = useState(true);
    const [integration, setIntegration] = useState(null);
    const [senderNumbers, setSenderNumbers] = useState([]);
    const [newSender, setNewSender] = useState({ label: '', phone: '' });
    const [testMessage, setTestMessage] = useState({
        number: '',
        message: 'Hola! Prueba desde NeurOPS.',
        selectedSender: ''
    });
    const [sending, setSending] = useState(false);
    const [savingKey, setSavingKey] = useState(false);

    useEffect(() => {
        fetchIntegration();
    }, []);

    const fetchIntegration = async () => {
        try {
            const res = await api.get('/admin/integrations');
            const twoChat = res.data.find(i => i.key === '2chat');
            if (twoChat) {
                setIntegration(twoChat);
                const numbers = twoChat.payload_config?.sender_numbers || [];
                // Migration: If no sender_numbers but from_number exists, add it
                if (numbers.length === 0 && twoChat.payload_config?.from_number) {
                    numbers.push({ label: 'Principal', phone: twoChat.payload_config.from_number });
                }
                setSenderNumbers(numbers);

                if (twoChat.payload_config?.test_number) {
                    setTestMessage(prev => ({
                        ...prev,
                        number: twoChat.payload_config.test_number,
                        selectedSender: numbers[0]?.phone || ''
                    }));
                }
            }
        } catch (error) {
            console.error("Error fetching integrations", error);
            toast.error("Error al cargar integraciones");
        } finally {
            setLoading(false);
        }
    };

    const handleAddSender = () => {
        if (!newSender.label || !newSender.phone) {
            toast.error("Etiqueta y número requeridos");
            return;
        }
        setSenderNumbers([...senderNumbers, { ...newSender }]);
        setNewSender({ label: '', phone: '' });
        toast.success("Número añadido a la lista local. No olvides guardar.");
    };

    const handleRemoveSender = (index) => {
        const newList = senderNumbers.filter((_, i) => i !== index);
        setSenderNumbers(newList);
    };

    const handleSaveConfig = async () => {
        if (!integration) return;
        setSavingKey(true);
        try {
            const updatedConfig = {
                ...integration.payload_config,
                api_key: integration.payload_config.api_key,
                sender_numbers: senderNumbers,
                from_number: senderNumbers[0]?.phone || '', // Keep default for backward compatibility
                test_number: testMessage.number
            };

            await api.post('/admin/integrations', {
                id: integration.id,
                payload_config: updatedConfig
            });
            toast.success("Configuración guardada exitosamente");
        } catch (error) {
            console.error("Error saving config", error);
            toast.error("Error al guardar configuración");
        } finally {
            setSavingKey(false);
        }
    };

    const handleTestSend = async () => {
        if (!testMessage.number || !testMessage.message) {
            toast.error("Número destino y mensaje requeridos");
            return;
        }
        if (!testMessage.selectedSender) {
            toast.error("Selecciona un remitente de la lista");
            return;
        }

        setSending(true);
        try {
            await api.post('/admin/integrations/2chat/test', {
                to_number: testMessage.number,
                from_number: testMessage.selectedSender,
                message: testMessage.message
            });
            toast.success("Mensaje enviado con éxito");
        } catch (error) {
            console.error("Error sending test message", error);
            toast.error("Error al enviar mensaje: " + (error.response?.data?.message || "Error desconocido"));
        } finally {
            setSending(false);
        }
    };

    if (loading) return (
        <div className="p-12 text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted font-bold uppercase tracking-widest text-xs">Cargando Operaciones...</p>
        </div>
    );

    return (
        <div className="space-y-10">
            <header className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
                        <Zap size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                            Centro de Operaciones
                        </h1>
                        <p className="text-muted font-medium text-lg italic">
                            "Gestión de canales y herramientas del sistema."
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* 2Chat Configuration Card */}
                <div className="glass-panel p-8 rounded-[32px] border border-white/5 bg-[#1a1c23]/80 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/20 rounded-xl text-green-500">
                                <MessageSquare size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Cuentas 2Chat</h2>
                        </div>
                        <Badge variant="success" className="px-3 py-1 font-black text-[10px]">CONECTADO</Badge>
                    </div>

                    {!integration ? (
                        <div className="text-rose-400 bg-rose-500/10 p-4 rounded-xl text-sm font-bold">
                            ⚠️ No se encontró la integración '2chat'. Verifica la base de datos.
                        </div>
                    ) : (
                        <div className="space-y-8 flex-1">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">
                                    <Key size={14} className="text-primary" /> API Key Maestro
                                </label>
                                <input
                                    type="password"
                                    value={integration.payload_config?.api_key || ''}
                                    onChange={(e) => setIntegration({ ...integration, payload_config: { ...integration.payload_config, api_key: e.target.value } })}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all font-mono text-sm shadow-inner"
                                    placeholder="UAK..."
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">
                                    <Phone size={14} className="text-primary" /> Números Autorizados
                                </label>

                                <div className="space-y-3">
                                    {senderNumbers.map((s, idx) => (
                                        <div key={idx} className="flex items-center gap-3 bg-white/5 border border-white/5 p-4 rounded-2xl group hover:bg-white/10 transition-all">
                                            <div className="p-2 bg-primary/20 rounded-lg text-primary group-hover:bg-primary transition-all group-hover:text-white">
                                                <User size={16} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-xs font-bold text-white">{s.label}</div>
                                                <div className="text-[10px] text-muted font-mono">{s.phone}</div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveSender(idx)}
                                                className="p-2 text-muted hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-4">
                                    <input
                                        type="text"
                                        value={newSender.label}
                                        onChange={(e) => setNewSender({ ...newSender, label: e.target.value })}
                                        className="sm:col-span-2 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary text-xs"
                                        placeholder="Etiqueta (Ej: Closer)"
                                    />
                                    <input
                                        type="text"
                                        value={newSender.phone}
                                        onChange={(e) => setNewSender({ ...newSender, phone: e.target.value })}
                                        className="sm:col-span-2 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary text-xs font-mono"
                                        placeholder="+549..."
                                    />
                                    <button
                                        onClick={handleAddSender}
                                        className="bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 flex items-center justify-center py-3 sm:py-0 transition-all active:scale-95"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="pt-6">
                                <Button
                                    onClick={handleSaveConfig}
                                    disabled={savingKey}
                                    className="w-full h-16 bg-primary hover:shadow-brand-glow text-white border-none shadow-lg transition-all"
                                >
                                    {savingKey ? 'Guardando...' : <span className="flex items-center gap-2 justify-center font-black uppercase tracking-widest text-xs"><Save size={16} /> Guardar Cambios</span>}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Test Message Card */}
                <div className="glass-panel p-8 rounded-[32px] border border-white/5 bg-[#1a1c23]/80 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                            <Send size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Consola de Prueba</h2>
                    </div>

                    <div className="space-y-6 flex-1">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">
                                Remitente
                            </label>
                            <select
                                value={testMessage.selectedSender}
                                onChange={(e) => setTestMessage({ ...testMessage, selectedSender: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all text-sm appearance-none"
                            >
                                <option value="" disabled>Seleccionar cuenta...</option>
                                {senderNumbers.map((s, idx) => (
                                    <option key={idx} value={s.phone}>{s.label} ({s.phone})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">
                                Número Destino
                            </label>
                            <input
                                type="text"
                                value={testMessage.number}
                                onChange={(e) => setTestMessage({ ...testMessage, number: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all text-sm shadow-inner"
                                placeholder="Ej: 54911..."
                            />
                            <p className="text-[10px] text-muted/50 ml-1 italic">Incluye país, sin '+' ni espacios.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">
                                Contenido del Mensaje
                            </label>
                            <textarea
                                value={testMessage.message}
                                onChange={(e) => setTestMessage({ ...testMessage, message: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all text-sm min-h-[140px] resize-none shadow-inner leading-relaxed"
                                placeholder="Escribe un mensaje de prueba..."
                            />
                        </div>

                        <div className="pt-4">
                            <Button
                                onClick={handleTestSend}
                                disabled={sending || !testMessage.selectedSender}
                                className={`w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl ${sending || !testMessage.selectedSender ? 'bg-primary/30 cursor-not-allowed text-white/50' : 'bg-primary hover:scale-[1.01] active:scale-95 shadow-brand-glow text-white'
                                    }`}
                            >
                                {sending ? 'Enviando...' : <span className="flex items-center gap-2 justify-center"><Send size={18} /> Disparar Prueba</span>}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Internal Badge helper since we use it
const Badge = ({ children, variant = "default", className = "" }) => {
    const variants = {
        default: "bg-white/10 text-white",
        success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20",
        warning: "bg-amber-500/20 text-amber-400 border border-amber-500/20",
        rose: "bg-rose-500/20 text-rose-400 border border-rose-500/20"
    };
    return (
        <span className={`${variants[variant]} ${className} rounded-full uppercase tracking-tighter`}>
            {children}
        </span>
    );
};

export default OperationsSection;
