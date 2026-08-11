import React, { useState, useEffect } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const TOGGLE_KEY = 'closer_leads_audit';

const LeadsAuditTogglePanel = () => {
    const [toggle, setToggle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const fetchToggle = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/feature-toggles/${TOGGLE_KEY}`);
            setToggle(res.data);
        } catch (err) {
            console.error('Error al cargar el toggle de auditoría de leads:', err);
            toast.error('No se pudo cargar el estado de la auditoría de leads');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchToggle(); }, []);

    const handleToggle = async () => {
        if (!toggle) return;
        setUpdating(true);
        try {
            const res = await api.patch(`/admin/feature-toggles/${TOGGLE_KEY}`, {
                is_active: !toggle.is_active
            });
            setToggle(res.data);
            toast.success(res.data.is_active
                ? 'Pestaña de Auditoría activada para los closers'
                : 'Pestaña de Auditoría desactivada para los closers');
        } catch (err) {
            console.error('Error al actualizar el toggle:', err);
            toast.error('No se pudo actualizar el estado');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    const isActive = !!toggle?.is_active;

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h2 className="text-2xl font-black text-base tracking-tight">Auditoría de Leads (Closers)</h2>
                <p className="text-muted text-sm">
                    Activa temporalmente una pestaña extra en el panel de cada closer para que revise y
                    actualice, mes por mes, el estado de sus agendas y los pagos de sus leads asignados.
                </p>
            </header>

            <div className="flex items-center justify-between gap-6 bg-surface border border-base rounded-3xl p-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isActive ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/10 text-muted'}`}>
                        <ClipboardList size={24} />
                    </div>
                    <div>
                        <p className="font-black text-base uppercase text-xs tracking-widest">
                            {isActive ? 'Pestaña activa para todos los closers' : 'Pestaña desactivada'}
                        </p>
                        {toggle?.updated_at && (
                            <p className="text-xs text-muted mt-1">
                                Último cambio: {new Date(toggle.updated_at).toLocaleString()}
                                {toggle.updated_by ? ` · ${toggle.updated_by}` : ''}
                            </p>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleToggle}
                    disabled={updating}
                    className={`relative w-16 h-9 rounded-full transition-colors disabled:opacity-50 cursor-pointer ${isActive ? 'bg-emerald-500' : 'bg-slate-600'}`}
                    aria-pressed={isActive}
                >
                    <span className={`absolute top-1 left-1 w-7 h-7 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-7' : ''}`} />
                </button>
            </div>
        </div>
    );
};

export default LeadsAuditTogglePanel;
