import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import usarMovimiento from './movimiento';
import usarPopover from './usarPopover';

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const PRESETS = [
    { label: 'En 1 semana', dias: 7 },
    { label: 'En 1 mes', meses: 1 },
    { label: 'En 3 meses', meses: 3 },
    { label: 'En 6 meses', meses: 6 },
];

/** Medianoche local: comparar fechas con hora adentro hace que "hoy" caiga en el pasado. */
const aDia = (v) => {
    if (!v) return null;
    const d = v instanceof Date ? new Date(v) : new Date(typeof v === 'number' ? v : `${v}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const aIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mismoDia = (a, b) => !!a && !!b && a.getTime() === b.getTime();

const fmtLargo = (d) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtCorto = (d) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

/** "en 3 días", "mañana": la distancia se lee antes que la fecha. */
const relativo = (d, hoy) => {
    const dias = Math.round((d - hoy) / 864e5);
    const pl = (n, a, b) => `en ${n} ${n === 1 ? a : b}`;
    if (dias < 0) return 'pasó';
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'mañana';
    if (dias < 7) return pl(dias, 'día', 'días');
    if (dias < 60) return pl(Math.round(dias / 7), 'semana', 'semanas');
    return pl(Math.round(dias / 30), 'mes', 'meses');
};

/**
 * Rejilla del mes empezando en LUNES. `(getDay() + 6) % 7` convierte el domingo=0
 * de JS en domingo=6, que es el orden con el que se lee un calendario en español.
 */
export const construirMes = (vista, { sel, minimo, hoy }) => {
    const hueco = (vista.getDay() + 6) % 7;
    const dias = new Date(vista.getFullYear(), vista.getMonth() + 1, 0).getDate();
    const celdas = Array.from({ length: hueco }, (_, i) => ({ hueco: true, clave: `h${i}` }));
    for (let n = 1; n <= dias; n += 1) {
        const d = new Date(vista.getFullYear(), vista.getMonth(), n);
        celdas.push({
            clave: aIso(d),
            n,
            fecha: d,
            elegido: mismoDia(d, sel),
            hoy: mismoDia(d, hoy),
            pasado: !!minimo && d < minimo,
        });
    }
    return celdas;
};

const SelectorFecha = ({
    valor,
    onChange,
    presets = PRESETS,
    minimo,          // undefined = hoy; null = sin mínimo
    rotulo = null,
    etiqueta = 'Fecha',
    deshabilitado = false,
}) => {
    const { abierto, alternar, cerrar, caja } = usarPopover();
    const mov = usarMovimiento();
    const hoy = useMemo(() => aDia(new Date()), []);
    const piso = minimo === null ? null : (aDia(minimo) || hoy);
    const sel = aDia(valor);
    const [mes, setMes] = useState(null);
    const vista = mes || new Date((sel || piso || hoy).getFullYear(), (sel || piso || hoy).getMonth(), 1);

    const celdas = construirMes(vista, { sel, minimo: piso, hoy });

    const elegir = (d) => {
        setMes(new Date(d.getFullYear(), d.getMonth(), 1));
        onChange?.(aIso(d), d);
        cerrar();
    };

    const desdeHoy = ({ dias = 0, meses = 0 }) => new Date(hoy.getFullYear(), hoy.getMonth() + meses, hoy.getDate() + dias);

    return (
        <div className="fi-campo" ref={caja}>
            {rotulo && <small className="t-rotulo">{rotulo}</small>}
            <button type="button" className={`fi-trigger${sel ? '' : ' fi-trigger--vacio'}`}
                aria-haspopup="dialog" aria-expanded={abierto} aria-label={etiqueta}
                disabled={deshabilitado} onClick={alternar}>
                <span className="fi-trigger-txt">
                    <Calendar size={16} className="mut" />
                    <span className="trunc">{sel ? fmtLargo(sel) : 'Elegí una fecha'}</span>
                </span>
                {sel && <span className="t-cap mut">{relativo(sel, hoy)}</span>}
            </button>

            {abierto && (
                <motion.div className="fi-pop fi-pop--fecha" role="dialog" aria-label={etiqueta}
                    {...mov.popover}>
                    <div style={{ display: 'grid', gap: 2, alignContent: 'start' }}>
                        <small className="t-rotulo" style={{ padding: '0 var(--s3) var(--s2)' }}>Rápido</small>
                        {presets.map(p => {
                            const d = desdeHoy(p);
                            return (
                                <button key={p.label} type="button" className="fi-opcion"
                                    aria-selected={mismoDia(d, sel)} role="option"
                                    onClick={() => elegir(d)}>
                                    <span>{p.label}</span>
                                    <span className="t-cap mut">{fmtCorto(d)}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="fi-cal">
                        <div className="fi-cal-cab">
                            <button type="button" className="ibtn ibtn--sm" aria-label="Mes anterior"
                                onClick={() => setMes(new Date(vista.getFullYear(), vista.getMonth() - 1, 1))}>
                                <ChevronLeft size={15} />
                            </button>
                            <span className="fi-cal-mes">
                                {vista.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                            </span>
                            <button type="button" className="ibtn ibtn--sm" aria-label="Mes siguiente"
                                onClick={() => setMes(new Date(vista.getFullYear(), vista.getMonth() + 1, 1))}>
                                <ChevronRight size={15} />
                            </button>
                        </div>
                        <div className="fi-cal-rejilla">
                            {SEMANA.map((d, i) => (
                                <span key={`${d}${i}`} className="fi-cal-sem" aria-hidden="true">{d}</span>
                            ))}
                            {celdas.map(c => (c.hueco ? (
                                <span key={c.clave} className="fi-cal-hueco" aria-hidden="true" />
                            ) : (
                                <button key={c.clave} type="button" className="fi-cal-dia"
                                    aria-pressed={c.elegido} data-hoy={c.hoy ? '1' : undefined}
                                    data-dia={c.clave}
                                    aria-label={fmtLargo(c.fecha)}
                                    disabled={c.pasado} onClick={() => elegir(c.fecha)}>
                                    {c.n}
                                </button>
                            )))}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default SelectorFecha;
