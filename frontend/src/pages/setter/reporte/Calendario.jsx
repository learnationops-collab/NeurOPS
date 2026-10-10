import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { aFecha, aIso, hoyIso, textoFecha } from './modelo';
import { reanimar } from './movimiento';

/**
 * La fecha del reporte con el calendario del diseño: un mes por vez, con la marca de cada día.
 *
 * `estadoDe(iso)` dice qué marca lleva un día: 'enviado' (lo dice el backend) o 'borrador' (lo
 * que quedó guardado en este navegador sin enviar). Los días que todavía no llegaron no se pueden
 * elegir: no hay nada que reportar de mañana. `alCambiarMes(desde, hasta)` avisa qué mes se está
 * mirando, para pedir sus "Enviado".
 *
 * Teclado como el diseño: flechas de día en día (y de semana en semana), Re Pág / Av Pág de mes en
 * mes, Escape cierra y devuelve el foco al botón.
 */
const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const limitesDelMes = (mes) => {
    const y = mes.getFullYear();
    const m = mes.getMonth();
    return [aIso(new Date(y, m, 1)), aIso(new Date(y, m + 1, 0))];
};

const Calendario = ({ fecha, onElegir, estadoDe, alCambiarMes }) => {
    const [abierto, setAbierto] = useState(false);
    const [mes, setMes] = useState(() => { const d = aFecha(fecha); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const cajaRef = useRef(null);
    const botonRef = useRef(null);
    const grillaRef = useRef(null);
    const dir = useRef(0);
    const hoy = hoyIso();

    useEffect(() => { alCambiarMes?.(...limitesDelMes(mes)); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false); };
        const escape = (e) => { if (e.key === 'Escape') { setAbierto(false); botonRef.current?.focus(); } };
        document.addEventListener('pointerdown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [abierto]);

    // Al abrir, el foco va al día elegido; al cambiar de mes, entra deslizándose de su lado.
    useEffect(() => {
        if (!abierto) return;
        const g = grillaRef.current;
        if (dir.current) reanimar(g, dir.current > 0 ? 'mes-sig' : 'mes-ant');
        dir.current = 0;
    }, [abierto, mes]);

    const abrir = () => {
        const d = aFecha(fecha);
        setMes(new Date(d.getFullYear(), d.getMonth(), 1));
        setAbierto(true);
        requestAnimationFrame(() => {
            (grillaRef.current?.querySelector('[aria-selected="true"]') || grillaRef.current?.querySelector('.rd-dia:not(:disabled)'))
                ?.focus({ preventScroll: true });
        });
    };

    const moverMes = (n) => {
        dir.current = n;
        setMes(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
    };

    const elegir = (iso) => {
        if (iso > hoy) return;
        setAbierto(false);
        botonRef.current?.focus();
        onElegir(iso);
    };

    const alTeclear = (e) => {
        const b = e.target.closest('[data-dia]');
        if (!b) return;
        if (e.key === 'PageUp' || e.key === 'PageDown') {
            e.preventDefault();
            moverMes(e.key === 'PageUp' ? -1 : 1);
            return;
        }
        const pasos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
        if (!pasos) return;
        e.preventDefault();
        const d = aFecha(b.dataset.dia);
        d.setDate(d.getDate() + pasos);
        const iso = aIso(d);
        if (d.getMonth() !== mes.getMonth()) moverMes(d < mes ? -1 : 1);
        requestAnimationFrame(() => grillaRef.current?.querySelector(`[data-dia="${iso}"]`)?.focus());
    };

    const y = mes.getFullYear();
    const m = mes.getMonth();
    const corrimiento = (new Date(y, m, 1).getDay() + 6) % 7;
    const nombreMes = mes.toLocaleDateString('es', { month: 'long' });
    const dias = Array.from({ length: 42 }, (_, i) => new Date(y, m, 1 - corrimiento + i));

    return (
        <div className="rd-campo rd-campo-fecha" ref={cajaRef}>
            <button ref={botonRef} type="button" className="rd-fecha-btn" aria-haspopup="dialog"
                aria-expanded={abierto} onClick={() => (abierto ? setAbierto(false) : abrir())}>
                <Calendar strokeWidth={1.75} aria-hidden="true" />
                <span>{textoFecha(fecha, hoy)}</span>
            </button>
            {abierto && (
                <div className="rd-cal" role="dialog" aria-label="Elegir fecha del reporte">
                    <div className="rd-cal-cab">
                        <button type="button" className="rd-ibtn rd-ibtn--sm" aria-label="Mes anterior" onClick={() => moverMes(-1)}>
                            <ChevronLeft strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <b aria-live="polite">{nombreMes[0].toUpperCase() + nombreMes.slice(1)} {y}</b>
                        <button type="button" className="rd-ibtn rd-ibtn--sm" aria-label="Mes siguiente" onClick={() => moverMes(1)}>
                            <ChevronRight strokeWidth={1.75} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="rd-cal-sem" aria-hidden="true">{SEMANA.map((d, i) => <span key={i}>{d}</span>)}</div>
                    <div className="rd-cal-grid" ref={grillaRef} role="grid" onKeyDown={alTeclear}>
                        {dias.map(d => {
                            const iso = aIso(d);
                            const est = estadoDe?.(iso);
                            const clases = ['rd-dia', d.getMonth() !== m && 'fuera', iso === hoy && 'hoy'].filter(Boolean).join(' ');
                            const nombre = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
                            return (
                                <button key={iso} type="button" className={clases} data-dia={iso} role="gridcell"
                                    aria-selected={iso === fecha} tabIndex={iso === fecha ? 0 : -1}
                                    disabled={iso > hoy}
                                    aria-label={`${nombre}${est ? `, ${est}` : ''}`}
                                    onClick={() => elegir(iso)}>
                                    {d.getDate()}
                                    {est && <i className="rd-marca" style={{ '--c': est === 'enviado' ? 'var(--success)' : 'var(--text-muted-40)' }} />}
                                </button>
                            );
                        })}
                    </div>
                    <div className="rd-cal-pie">
                        <span className="rd-cal-ley">
                            <span><i className="rd-punto" style={{ '--c': 'var(--success)' }} />Enviado</span>
                            <span><i className="rd-punto" style={{ '--c': 'var(--text-muted-40)' }} />Borrador</span>
                        </span>
                        <button type="button" className="rd-btn rd-btn--plain rd-btn--sm" onClick={() => elegir(hoy)}>Hoy</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calendario;
