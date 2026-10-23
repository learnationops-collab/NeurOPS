import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import useMovimiento from './useMovimiento';
import usePopover from './usePopover';
import './fecha-hora.css';

/**
 * La hora en 24 h de Learnation Clarity (Leadership: `x-cl.hora` + Alpine `clHora`). El campo abre
 * un panel con la hora y los minutos grandes, que se escriben directo (al completar la hora salta a
 * los minutos) o se suben y bajan con las flechas, la rueda o ↑↓ (minutos de a 5; con Shift de a 1),
 * más los horarios rápidos. Reemplaza al `<input type="time">`, que se veía «--:-- ----».
 *
 * `valor` y lo que devuelve `onChange` son «HH:MM» en 24 h, o '' si se quitó. Cada cambio se
 * aplica al toque: no hay botón de guardar.
 */

const dos = (n) => String(n).padStart(2, '0');
const RAPIDAS = ['09:00', '12:00', '15:00', '20:00'];

const partes = (v) => {
    const x = /^(\d{1,2}):(\d{2})/.exec(v || '');
    return x ? { h: Math.min(23, Number(x[1])), m: Math.min(59, Number(x[2])) } : { h: null, m: null };
};

const SelectorHora = ({ valor, onChange, etiqueta = 'Hora', deshabilitado = false }) => {
    const { abierto, alternar, cerrar, caja, pop } = usePopover();
    const mov = useMovimiento();
    const refH = useRef(null);
    const refM = useRef(null);
    const { h, m } = partes(valor);
    const hay = h !== null;
    // Lo que se está tipeando en cada casilla, hasta que se completa o se sale de ella.
    const [tipeo, setTipeo] = useState({ h: null, m: null });

    const poner = (k, n) => {
        const nueva = k === 'h'
            ? { h: Math.min(23, n), m: m ?? 0 }
            : { h: h ?? new Date().getHours(), m: Math.min(59, n) };
        onChange?.(`${dos(nueva.h)}:${dos(nueva.m)}`);
    };

    const paso = (k, d) => {
        if (k === 'h') {
            poner('h', h === null ? new Date().getHours() : (h + d + 24) % 24);
            return;
        }
        const base = m ?? 0;
        // De a 5 cae en el múltiplo siguiente (12 → 15, 12 → 10).
        const n = Math.abs(d) !== 5 ? base + d : (d > 0 ? Math.floor(base / 5) * 5 + 5 : Math.ceil(base / 5) * 5 - 5);
        poner('m', ((n % 60) + 60) % 60);
    };

    const escribir = (k, e) => {
        const d = e.target.value.replace(/\D/g, '').slice(0, 2);
        const tope = k === 'h' ? 2 : 5;
        if (d.length === 2 || (d.length === 1 && Number(d) > tope)) {
            setTipeo((t) => ({ ...t, [k]: null }));
            poner(k, Number(d));
            if (k === 'h') refM.current?.focus();
            else e.target.select();
        } else {
            setTipeo((t) => ({ ...t, [k]: d }));
        }
    };

    const salir = (k) => {
        const d = tipeo[k];
        setTipeo((t) => ({ ...t, [k]: null }));
        if (d) poner(k, Number(d));
    };

    const casilla = (k) => {
        const ref = k === 'h' ? refH : refM;
        const n = k === 'h' ? h : m;
        const grande = k === 'h' ? 1 : 5;
        const texto = tipeo[k] ?? (hay ? dos(n ?? 0) : '');
        return (
            <div className="fi-hr-celda">
                <button type="button" className="fi-hr-paso" tabIndex={-1} onClick={() => paso(k, grande)}
                    aria-label={k === 'h' ? 'Una hora más' : 'Cinco minutos más'}>
                    <ChevronUp aria-hidden="true" />
                </button>
                <input ref={ref} type="text" className="fi-hr-num" inputMode="numeric" maxLength={2}
                    placeholder="--" autoComplete="off" value={texto}
                    aria-label={k === 'h' ? 'Hora, de 0 a 23' : 'Minutos, de 0 a 59'}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => escribir(k, e)}
                    onBlur={() => salir(k)}
                    onWheel={(e) => paso(k, e.deltaY < 0 ? grande : -grande)}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') { e.preventDefault(); paso(k, k === 'm' && e.shiftKey ? 1 : grande); }
                        if (e.key === 'ArrowDown') { e.preventDefault(); paso(k, k === 'm' && e.shiftKey ? -1 : -grande); }
                        if (e.key === 'Enter') { e.preventDefault(); salir(k); cerrar(); }
                        if (k === 'm' && e.key === 'Backspace' && e.currentTarget.value === '') refH.current?.focus();
                    }} />
                <button type="button" className="fi-hr-paso" tabIndex={-1} onClick={() => paso(k, -grande)}
                    aria-label={k === 'h' ? 'Una hora menos' : 'Cinco minutos menos'}>
                    <ChevronDown aria-hidden="true" />
                </button>
                <span className="fi-hr-sub">{k === 'h' ? 'hora' : 'min'}</span>
            </div>
        );
    };

    return (
        <div className="fi-campo fi-hora" ref={caja}>
            <button type="button" className={`fi-trigger${hay ? '' : ' fi-trigger--vacio'}`}
                aria-haspopup="dialog" aria-expanded={abierto} aria-label={etiqueta}
                disabled={deshabilitado} onClick={alternar}>
                <span className="fi-trigger-txt">
                    <Clock size={16} className="mut" />
                    <span className="trunc num">{hay ? `${dos(h)}:${dos(m)}` : 'Elegí una hora'}</span>
                </span>
            </button>

            {abierto && (
                <motion.div ref={pop} className="fi-pop fi-pop--hora" role="dialog" aria-label={etiqueta}
                    {...mov.popover}>
                    <div className="fi-hr-top">
                        <small>Hora · 24 h</small>
                        {hay && (
                            <button type="button" className="fi-hr-quitar" onClick={() => { onChange?.(''); cerrar(); }}>
                                Sin hora
                            </button>
                        )}
                    </div>
                    <div className={`fi-hr-reloj${hay ? '' : ' fi-hr-reloj--vacio'}`}>
                        {casilla('h')}
                        <span className="fi-hr-dos" aria-hidden="true"><i /><i /></span>
                        {casilla('m')}
                    </div>
                    <div className="fi-hr-rapidas">
                        {RAPIDAS.map((v) => (
                            <button key={v} type="button" aria-pressed={valor === v}
                                onClick={() => { onChange?.(v); cerrar(); }}>
                                {`${Number(v.slice(0, 2))}:${v.slice(3)}`}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default SelectorHora;
