// Elegir a un closer viendo si está listo para recibir agendas: chips en verde o rojo de Calendar
// (conectado en NeurOPS), WhatsApp (confirmado) y Horarios (cargados en Team o en su Configuración).
// Los listos van primero. Se usa al sumar a Team y al sumar a una estrategia.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { almacen } from '../../data/hooks';
import { Icono } from '../../ui/base';
import { toast } from '../../ui/toast';

// Closers activos de la app (/agendas-v2/usuarios): {id, nombre, email, calendar, whatsapp, tz}.
// null mientras carga; [] en modo local (sin backend). Sin `activo` (solo lectura: sumar y lo que le
// falta a cada closer es de quien configura) no se piden y queda null.
export function useUsuariosReales(activo = true) {
    const [usuarios, setUsuarios] = useState(null);
    useEffect(() => {
        if (!activo) return undefined;
        let vivo = true;
        Promise.resolve(almacen.adaptador.usuarios ? almacen.adaptador.usuarios() : [])
            .then(u => { if (vivo) setUsuarios(u); }, () => { if (vivo) { setUsuarios([]); toast('No se pudo traer la lista de closers.', 'error'); } });
        return () => { vivo = false; };
    }, [activo]);
    return usuarios;
}

// Cuántas de las tres le faltan (lo que no se sabe, en modo local, no cuenta).
const faltan = (o) => [o.calendar, o.whatsapp, o.horarios].filter(v => v === false).length;
export function ordenarListos(opciones) {
    return [...opciones].sort((a, b) => faltan(a) - faltan(b) || a.nombre.localeCompare(b.nombre, 'es'));
}

export function ChipsListo({ o }) {
    const chip = (v, n) => v === undefined ? null : (
        <span className={'lc ' + (v ? 'lc--ok' : 'lc--no')} title={(v ? '' : 'Sin ') + n}>
            <Icono n={v ? 'check' : 'x'} s={11} />{n}
        </span>
    );
    return <span className="lc-fila">{chip(o.calendar, 'Calendar')}{chip(o.whatsapp, 'WhatsApp')}{chip(o.horarios, 'Horarios')}</span>;
}

// opciones: [{id, nombre, calendar?, whatsapp?, horarios?, extra?}]. undefined = no se sabe (sin chip).
export default function ElegirCloser({ opciones, onElegir, texto = '+ Sumar closer', label = 'Sumar closer', disabled }) {
    const [abierto, setAbierto] = useState(false);
    const [pos, setPos] = useState(null);
    const caja = useRef(null);
    const pop = useRef(null);
    useLayoutEffect(() => {
        if (!abierto) return;
        const ubicar = () => {
            const r = caja.current.getBoundingClientRect();
            const ancho = Math.min(420, window.innerWidth - 32);
            const abajo = window.innerHeight - r.bottom - 12, arriba = r.top - 12;
            const haciaArriba = abajo < 240 && arriba > abajo;
            setPos({
                left: Math.max(16, Math.min(r.left, window.innerWidth - ancho - 16)), width: ancho,
                ...(haciaArriba ? { bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(340, arriba) } : { top: r.bottom + 6, maxHeight: Math.min(340, abajo) }),
            });
        };
        ubicar();
        window.addEventListener('resize', ubicar);
        window.addEventListener('scroll', ubicar, true);
        return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
    }, [abierto]);
    useEffect(() => {
        if (!abierto) return;
        const fuera = (e) => { if (!caja.current?.contains(e.target) && !pop.current?.contains(e.target)) setAbierto(false); };
        const esc = (e) => { if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); } };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
    }, [abierto]);
    const lista = ordenarListos(opciones);
    return (
        <div className="ec" ref={caja}>
            <button type="button" className="sx ec-btn" aria-haspopup="listbox" aria-expanded={abierto} aria-label={label} disabled={disabled || !lista.length}
                onClick={() => setAbierto(!abierto)}>
                <span>{texto}</span><Icono n="chevron-down" s={15} />
            </button>
            {abierto && createPortal(
                <ul ref={pop} className="ec-pop" role="listbox" aria-label={label} style={pos || { visibility: 'hidden' }}>
                    {lista.map(o => (
                        <li key={o.id}>
                            <button type="button" role="option" aria-selected="false" className="ec-op" onClick={() => { setAbierto(false); onElegir(o.id); }}>
                                <b>{o.nombre}{o.extra ? <span className="mut"> · {o.extra}</span> : null}</b>
                                <ChipsListo o={o} />
                            </button>
                        </li>
                    ))}
                </ul>,
                caja.current?.closest('.thalamus') || document.body,
            )}
        </div>
    );
}
