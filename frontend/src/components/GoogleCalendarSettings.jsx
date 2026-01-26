import { useState, useEffect } from 'react';
import api from '../services/api';
import { Calendar, RefreshCw, Check, AlertCircle, LogOut, ChevronDown } from 'lucide-react';
import Button from './ui/Button';

const GoogleCalendarSettings = () => {
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [calendars, setCalendars] = useState([]);
    const [selectedCalendar, setSelectedCalendar] = useState('primary');
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        checkStatus();

        // Check URL params for success message
        const params = new URLSearchParams(window.location.search);
        if (params.get('google_connected') === 'success') {
            setMessage("Cuenta de Google conectada exitosamente");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const checkStatus = async () => {
        try {
            const res = await api.get('/google/calendars');
            setConnected(res.data.connected);
            if (res.data.connected) {
                setCalendars(res.data.calendars || []);
                setSelectedCalendar(res.data.selected_calendar || 'primary');
            }
        } catch (err) {
            console.error("GCal status error", err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        try {
            const res = await api.get('/google/login');
            if (res.data.auth_url) {
                window.location.href = res.data.auth_url;
            }
        } catch (err) {
            setError("Error al iniciar conexión con Google");
        }
    };

    const handleDisconnect = async () => {
        try {
            await api.post('/google/disconnect');
            setConnected(false);
            setCalendars([]);
            setMessage("Cuenta desconectada");
        } catch (err) {
            setError("Error al desconectar");
        }
    };

    const handleSavePreference = async () => {
        try {
            await api.post('/google/calendars', { calendar_id: selectedCalendar });
            setMessage("Preferencia de calendario guardada");
        } catch (err) {
            setError("Error al guardar preferencia");
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse">Cargando integración de calendar...</div>;

    return (
        <div className="bg-surface p-8 rounded-[2.5rem] border border-base space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm p-2">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="GCal" className="w-full h-full" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-base">Google Calendar</h3>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Sincroniza tus agendas automáticamente</p>
                    </div>
                </div>
                <div>
                    {connected ? (
                        <span className="px-3 py-1 bg-success/10 text-success rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                            <Check size={10} /> Conectado
                        </span>
                    ) : (
                        <span className="px-3 py-1 bg-base text-muted rounded-full text-[10px] font-black uppercase tracking-widest">
                            No Conectado
                        </span>
                    )}
                </div>
            </div>

            {!connected ? (
                <div className="bg-main/50 p-6 rounded-2xl border border-dashed border-base text-center space-y-4">
                    <p className="text-xs text-muted">Conecta tu cuenta para sincronizar automáticamente las agendas creadas.</p>
                    <Button onClick={handleConnect} variant="primary" icon={Calendar}>
                        Conectar con Google
                    </Button>
                </div>
            ) : (
                <div className="space-y-4 bg-main/30 p-6 rounded-2xl border border-base">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Calendario de Destino</label>
                        <div className="relative">
                            <select
                                value={selectedCalendar}
                                onChange={(e) => setSelectedCalendar(e.target.value)}
                                className="w-full px-5 py-3 bg-surface border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold appearance-none cursor-pointer"
                            >
                                {calendars.map(c => (
                                    <option key={c.id} value={c.id}>{c.summary} {c.primary && '(Principal)'}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={16} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button onClick={handleDisconnect} variant="ghost" className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
                            Desconectar
                        </Button>
                        <Button onClick={handleSavePreference} variant="primary" icon={Check}>
                            Guardar Preferencia
                        </Button>
                    </div>
                </div>
            )}

            {message && (
                <div className="p-4 bg-success/10 text-success rounded-xl flex items-center gap-3 animate-in fade-in">
                    <Check size={16} />
                    <span className="text-xs font-bold">{message}</span>
                </div>
            )}
            {error && (
                <div className="p-4 bg-rose-500/10 text-rose-500 rounded-xl flex items-center gap-3 animate-in fade-in">
                    <AlertCircle size={16} />
                    <span className="text-xs font-bold">{error}</span>
                </div>
            )}
        </div>
    );
};

export default GoogleCalendarSettings;
