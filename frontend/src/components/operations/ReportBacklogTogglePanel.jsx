import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

/* Bloqueo del reporte diario por trabajo atrasado. Vive como FeatureToggle (y no como constante
   en el código) porque se suspende y se reactiva por temporadas: mientras está apagado el closer
   sigue viendo su atraso en la pestaña de reporte, pero puede enviarlo igual. */

const TOGGLE_KEY = 'bloqueo_reporte_backlog';

const ReportBacklogTogglePanel = () => {
    const [toggle, setToggle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const fetchToggle = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/feature-toggles/${TOGGLE_KEY}`);
            setToggle(res.data);
        } catch (err) {
            console.error('Error al cargar el toggle de bloqueo del reporte:', err);
            toast.error('No se pudo cargar el estado del bloqueo del reporte');
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
                ? 'Bloqueo activado: sin la bandeja al día no se puede enviar el reporte'
                : 'Bloqueo suspendido: se puede enviar el reporte con trabajo atrasado');
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
                <h2 className="text-2xl font-black text-base tracking-tight">Bloqueo del Reporte Diario</h2>
                <p className="text-muted text-sm">
                    Cuando está activo, un closer no puede enviar su reporte del día mientras arrastre
                    trabajo de días anteriores: confirmaciones nunca gestionadas, llamadas confirmadas sin
                    registrar su resultado, o seguimientos asignados sin realizar. Suspendelo para darle
                    margen al equipo de ponerse al día sin perder los reportes de esos días.
                </p>
            </header>

            <div className="flex items-center justify-between gap-6 bg-surface border border-base rounded-3xl p-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isActive ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <p className="font-black text-base uppercase text-xs tracking-widest">
                            {isActive ? 'Bloqueo activo — el atraso traba el envío' : 'Bloqueo suspendido — solo se avisa del atraso'}
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
                    className={`relative w-16 h-9 rounded-full transition-colors disabled:opacity-50 cursor-pointer ${isActive ? 'bg-rose-500' : 'bg-slate-600'}`}
                    aria-pressed={isActive}
                >
                    <span className={`absolute top-1 left-1 w-7 h-7 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-7' : ''}`} />
                </button>
            </div>

            <p className="text-[11px] text-muted">
                El atraso se sigue calculando y mostrando en la pestaña "Reporte del día" en los dos casos —
                lo único que cambia es si traba el botón de enviar o no. El admin siempre estuvo exento.
            </p>
        </div>
    );
};

export default ReportBacklogTogglePanel;
