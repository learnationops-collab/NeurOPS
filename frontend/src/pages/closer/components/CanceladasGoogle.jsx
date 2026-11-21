import React, { useCallback, useEffect, useState } from 'react';
import { CalendarX2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { formatAgendaDateTime } from '../../../utils/datetime';

/**
 * «Canceladas en tu Google Calendar» (ADR-W191): las agendas que el closer canceló o borró en su calendario y que
 * Work canceló sin saber por qué. Elige una opción y suma un detalle; «La pasé a otro closer», «La reagendé por
 * fuera» y «Error mío» la vuelven a pendiente. Sin ninguna, no se dibuja nada.
 *
 * `onCambio` vuelve a pedir las agendas del mazo (una reabierta reaparece en la bandeja).
 */
const Fila = ({ fila, opciones, reabren, onGuardada, abierta, onAbrir }) => {
    const [opcion, setOpcion] = useState(null);
    const [detalle, setDetalle] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const guardar = async () => {
        if (!opcion) { setError('Elegí por qué se canceló.'); return; }
        setGuardando(true);
        try {
            const r = await api.post(`/closer/canceladas-google/${fila.id}`, { opcion, detalle }).then(x => x.data);
            toast.success(r.reabierta ? `La agenda de ${fila.cliente} volvió a pendiente` : 'Motivo guardado');
            onGuardada(fila.id, r.reabierta);
        } catch (e) {
            setError(e?.response?.data?.message || 'No se pudo guardar el motivo');
        } finally {
            setGuardando(false);
        }
    };

    const cab = (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] min-w-0">
                <b>{fila.cliente}</b>
                <span className="text-muted text-[11px]"> · {formatAgendaDateTime(fila.fecha)} · {fila.fuente}</span>
            </span>
            {abierta ? <span className="text-muted text-[11px]">cancelada {formatAgendaDateTime(fila.cancelada)}</span> : (
                <button type="button" onClick={onAbrir}
                    className="px-3 py-1 rounded-full border border-amber-500/40 text-amber-200 text-[11.5px] font-bold hover:bg-amber-500/10">
                    Escribir motivo
                </button>
            )}
        </div>
    );
    // Una abierta por vez: cerradas, cada una es una línea y la tarjeta no empuja la bandeja.
    if (!abierta) return <div className="rounded-xl border border-white/10 px-3 py-2">{cab}</div>;
    return (
        <div className="rounded-xl border border-white/10 p-3 space-y-2">
            {cab}
            <p className="text-[11px] text-muted">¿Por qué se canceló?</p>
            <div className="flex flex-wrap gap-1.5">
                {opciones.map(o => (
                    <button key={o.key} type="button" onClick={() => { setOpcion(o.key); setError(''); }}
                        aria-pressed={opcion === o.key}
                        className={`px-2.5 py-1 rounded-full border text-[11.5px] transition-colors ${opcion === o.key
                            ? 'border-pink-500 bg-pink-500/15 text-pink-100' : 'border-white/15 text-slate-300 hover:border-white/30'}`}>
                        {o.label}
                    </button>
                ))}
            </div>
            <input value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={500}
                placeholder="Detalle (opcional): tuvo guardia y no sabe cuándo puede"
                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-[12px] outline-none focus:border-pink-500/60" />
            {opcion && reabren.includes(opcion) && (
                <p className="text-[11px] text-amber-300">La agenda vuelve a pendiente: no cuenta como cancelación del lead.</p>
            )}
            {error && <p className="text-[11px] text-rose-400">{error}</p>}
            <div className="flex justify-end">
                <button type="button" onClick={guardar} disabled={guardando}
                    className="px-4 py-1.5 rounded-full bg-pink-500 text-white text-[12px] font-bold disabled:opacity-60">
                    {guardando ? 'Guardando…' : 'Guardar motivo'}
                </button>
            </div>
        </div>
    );
};

const CanceladasGoogle = ({ onCambio }) => {
    const [datos, setDatos] = useState(null);
    const [abierta, setAbierta] = useState(null);

    const cargar = useCallback(() => {
        api.get('/closer/canceladas-google').then(r => setDatos(r.data))
            .catch(e => console.error(`Canceladas en Google: ${e}`));
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const guardada = (id, reabierta) => {
        setDatos(d => ({ ...d, filas: d.filas.filter(f => f.id !== id) }));
        if (reabierta) onCambio?.();
    };

    if (!datos?.filas?.length) return null;
    const n = datos.filas.length;
    return (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <CalendarX2 size={17} className="text-amber-400" />
                <b className="text-[13.5px]">Canceladas en tu Google Calendar</b>
                <span className="text-amber-300 text-[12px] font-bold">{n} sin motivo</span>
                <span className="text-muted text-[11px] ml-auto">Work las canceló al ver el evento borrado. Contanos por qué.</span>
            </div>
            {datos.filas.map(f => (
                <Fila key={f.id} fila={f} opciones={datos.opciones} reabren={datos.reabren} onGuardada={guardada}
                    abierta={abierta === f.id} onAbrir={() => setAbierta(f.id)} />
            ))}
        </section>
    );
};

export default CanceladasGoogle;
