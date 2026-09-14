import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import api from '../../services/api';
import useNow from '../../hooks/useNow';
import { formatCountdown, formatAgendaDateTime, viewerTimezoneLabel } from '../../utils/datetime';
import AnimatedCounter from '../rare-ui/animated-counter';

// mm:ss / h:mm:ss son los únicos formatos de `formatCountdown` con dígitos que cambian cada
// segundo (el resto -- "En 3 días", "Hace 2 horas y 15 minutos" -- combina texto y números de
// forma irregular, sin nada que valga la pena animar dígito por dígito). Se replica acá la
// misma condición que usa `formatCountdown` internamente para decidir el modo cronómetro, en
// vez de parsear su `label` ya armado.
const isCronometro = (countdown) => !countdown.isPast && countdown.kind !== 'now' && countdown.days === 0;

// Dígitos del cronómetro (mm:ss, o h:mm:ss pasada la hora) con rueda animada por dígito en vez
// de texto plano -- el resto de estados (now/past/lejos) siguen usando `countdown.label` tal cual.
const CronometroDigits = ({ countdown }) => (
    <span className="inline-flex items-baseline">
        {countdown.hours > 0 && (
            <>
                <AnimatedCounter value={countdown.hours} duration={0.4} />
                <span>:</span>
            </>
        )}
        <AnimatedCounter value={countdown.minutes} padStart={2} duration={0.4} />
        <span>:</span>
        <AnimatedCounter value={countdown.seconds} padStart={2} duration={0.4} />
    </span>
);

// Cronómetro fijo de la próxima llamada, en el header del workspace.
//
// Por qué no sale del mazo: el mazo se carga por pestaña y por día seleccionado, así que no
// puede contestar "cuál es la próxima" mientras el closer mira el reporte de ayer o el
// dashboard. `GET /closer/next-appointment` es un SELECT con LIMIT 1 y no depende de la vista.
//
// La hora se muestra siempre en la zona del navegador de quien mira, con la etiqueta de zona al
// lado: si un operador simula a un closer de otro país, la agenda se ve en la hora del operador
// y la etiqueta lo deja explícito, sin que haya que deducirlo.
const NextAgendaChrono = ({ refreshKey = 0 }) => {
    const [appt, setAppt] = useState(null);
    const now = useNow(1000);

    const fetchNext = useCallback(async () => {
        try {
            const res = await api.get('/closer/next-appointment');
            setAppt(res.data?.appointment || null);
        } catch (err) {
            // Silencioso a propósito: es un adorno del header, no puede romper el workspace.
            console.error('Error al cargar la próxima agenda:', err);
        }
    }, []);

    useEffect(() => { fetchNext(); }, [fetchNext, refreshKey]);

    // La próxima agenda cambia cuando el closer procesa una tarjeta (lo cubre `refreshKey`) o
    // cuando simplemente pasa el tiempo y la de ahora deja de serlo. Un refresco cada 5 min
    // cubre el segundo caso sin castigar al backend.
    useEffect(() => {
        const id = setInterval(fetchNext, 5 * 60 * 1000);
        return () => clearInterval(id);
    }, [fetchNext]);

    if (!appt?.start_time) return null;

    const countdown = formatCountdown(appt.start_time, now, { withSeconds: true });
    if (!countdown) return null;

    const tono = countdown.kind === 'now'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
        : countdown.kind === 'past'
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
            : countdown.kind === 'soon'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-slate-800 bg-slate-900 text-slate-300';

    return (
        <div
            className={`shrink-0 hidden md:flex items-center gap-2 rounded-full border px-3 py-1.5 ${tono}`}
            title={`${appt.lead_name} · ${formatAgendaDateTime(appt.start_time)} (${viewerTimezoneLabel()}, tu zona horaria)`}
        >
            <span className="relative flex items-center justify-center">
                {countdown.kind === 'now' && (
                    <motion.span
                        className="absolute inset-0 rounded-full bg-emerald-400"
                        animate={{ scale: [1, 2.2], opacity: [0.55, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                    />
                )}
                <Clock size={13} className="relative" />
            </span>
            <div className="leading-none">
                <div className="text-[8px] font-black uppercase tracking-[0.15em] opacity-70">Próxima agenda</div>
                <div className="text-[11px] font-black tabular-nums">
                    {isCronometro(countdown) ? <CronometroDigits countdown={countdown} /> : countdown.label}
                    <span className="opacity-60 font-bold"> · {appt.lead_name}</span>
                </div>
            </div>
        </div>
    );
};

export default NextAgendaChrono;
