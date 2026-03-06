import React, { useState, useEffect } from 'react';
import { CalendarDays, Clock, User as UserIcon, AlertCircle, X, ChevronDown } from 'lucide-react';
import api from '../../services/api';

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const SLOTS = Array.from({ length: 16 }, (_, i) => {
    const totalMinutes = i * 90;
    const hour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const min = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hour}:${min}`;
});

const CloserAvailabilityModal = ({ isOpen, onClose, apiEndpoint }) => {
    const [closers, setClosers] = useState([]);
    const [selectedCloserId, setSelectedCloserId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchAvailability();
        }
    }, [isOpen, apiEndpoint]);

    const fetchAvailability = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(apiEndpoint);
            const data = res.data || [];
            setClosers(data);
            if (data.length > 0) {
                setSelectedCloserId(data[0].closer_id.toString());
            }
        } catch (err) {
            console.error("Error fetching closer availability:", err);
            setError("No se pudo cargar la disponibilidad.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const selectedCloser = closers.find(c => c.closer_id.toString() === selectedCloserId);
    const weeklySchedule = selectedCloser ? selectedCloser.schedule : {};

    const isSlotSelected = (dayIdx, timeStr) => {
        const dayStr = dayIdx.toString();
        const slots = weeklySchedule[dayStr] || [];
        return slots.some(s => s.start === timeStr);
    };

    const hasAnyAvailability = selectedCloser && Object.keys(weeklySchedule).length > 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-5xl bg-surface border border-base rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex-none p-6 sm:p-8 flex items-center justify-between border-b border-base/50 bg-main/30 backdrop-blur-md relative z-10">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            <CalendarDays size={24} className="sm:w-8 sm:h-8" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-3xl font-black text-base tracking-tighter uppercase italic leading-none">
                                Disponibilidad
                            </h2>
                            <p className="text-muted text-[10px] font-bold tracking-[0.2em] uppercase mt-2">
                                Horarios Semanales de Closers
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 sm:p-4 rounded-xl sm:rounded-2xl hover:bg-main hover:text-rose-500 transition-all text-muted relative"
                    >
                        <X size={20} className="sm:w-6 sm:h-6" />
                    </button>
                    <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 bg-surface space-y-6">
                    {loading ? (
                        <div className="p-20 text-center animate-pulse flex flex-col items-center justify-center gap-4">
                            <Clock className="w-12 h-12 text-primary opacity-20" />
                            <p className="text-[10px] uppercase font-black tracking-widest text-muted">Cargando Horarios...</p>
                        </div>
                    ) : error ? (
                        <div className="p-10 text-center space-y-4 bg-red-500/10 rounded-3xl border border-red-500/20 max-w-md mx-auto">
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                            <p className="text-red-500 text-sm font-bold">{error}</p>
                            <button onClick={fetchAvailability} className="text-xs text-red-500 underline uppercase font-black tracking-wider">Reintentar</button>
                        </div>
                    ) : closers.length === 0 ? (
                        <div className="p-16 text-center space-y-4 bg-main/50 rounded-3xl border border-dashed border-base">
                            <UserIcon className="w-12 h-12 text-muted opacity-50 mx-auto" />
                            <h3 className="text-lg font-black uppercase tracking-tight text-base italic">No hay closers activos</h3>
                            <p className="text-xs text-muted font-medium">Asegúrate de tener perfiles con el rol "closer" en el sistema.</p>
                        </div>
                    ) : (
                        <>
                            {/* Selector de Closer */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-main/50 p-6 rounded-3xl border border-base/50">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-base flex items-center gap-2">
                                        <UserIcon size={16} className="text-primary" />
                                        Selecciona un Closer
                                    </h3>
                                    <p className="text-[10px] text-muted font-bold tracking-widest">Visualiza en tiempo real su grilla horaria</p>
                                </div>
                                <div className="relative w-full sm:w-72">
                                    <select
                                        value={selectedCloserId}
                                        onChange={e => setSelectedCloserId(e.target.value)}
                                        className="w-full appearance-none bg-surface border border-base hover:border-primary/50 text-sm font-bold p-4 pl-5 rounded-2xl shadow-sm cursor-pointer transition-all outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        {closers.map(c => (
                                            <option key={c.closer_id} value={c.closer_id}>{c.closer_name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={16} />
                                </div>
                            </div>

                            {/* Grilla Semanal */}
                            {!hasAnyAvailability ? (
                                <div className="p-16 text-center space-y-4 bg-main/20 rounded-3xl border border-dashed border-base/50">
                                    <div className="w-16 h-16 bg-main rounded-full flex items-center justify-center mx-auto text-muted shadow-inner border border-base">
                                        <AlertCircle size={24} className="opacity-50" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black uppercase tracking-tight text-base italic">Sin Horarios</h3>
                                        <p className="text-xs text-muted font-medium mt-1">Este closer aún no ha configurado su disponibilidad.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-base rounded-[2rem] overflow-hidden bg-main/20 shadow-inner">
                                    {/* Cabecera de días */}
                                    <div className="grid grid-cols-8 border-b border-base bg-surface-hover/20">
                                        <div className="p-4 flex items-center justify-center">
                                            <Clock size={16} className="text-muted" />
                                        </div>
                                        {DAYS_ES.map(day => (
                                            <div key={day} className="p-4 text-center font-black text-[10px] sm:text-[11px] tracking-widest text-muted uppercase">
                                                {day.substring(0, 3)}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Filas de horarios */}
                                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                                        {SLOTS.map(timeStr => (
                                            <div key={timeStr} className="grid grid-cols-8 border-b border-base/30 last:border-0 hover:bg-surface-hover/10 transition-colors">
                                                {/* Columna de hora */}
                                                <div className="p-3 text-center border-r border-base/50 text-[10px] sm:text-[11px] font-black text-muted flex items-center justify-center bg-main/40">
                                                    {timeStr}
                                                </div>

                                                {/* Columnas de días */}
                                                {DAYS_ES.map((_, dayIdx) => {
                                                    const selected = isSlotSelected(dayIdx, timeStr);
                                                    return (
                                                        <div
                                                            key={dayIdx}
                                                            className={`h-12 sm:h-14 border-l border-base/10 transition-all flex items-center justify-center ${selected ? 'bg-primary/5' : ''}`}
                                                        >
                                                            {selected ? (
                                                                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center animate-in zoom-in duration-200 border border-primary/30">
                                                                    <div className="w-2 sm:w-3 h-2 sm:h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--color-primary),0.5)]" />
                                                                </div>
                                                            ) : (
                                                                <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg border border-dashed border-base/50 opacity-20" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CloserAvailabilityModal;
