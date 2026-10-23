import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import useMovimiento from './useMovimiento';
import usePopover from './usePopover';
import './fecha-hora.css';

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Los atajos del calendario de Clarity (Leadership, `clEditores.atajos`). `lunes` y `finDeMes` se
// resuelven contra hoy en `desdeHoy`.
const PRESETS = [
    { label: 'Hoy', dias: 0 },
    { label: 'Mañana', dias: 1 },
    { label: 'En 3 días', dias: 3 },
    { label: 'En 1 semana', dias: 7 },
    { label: 'Próximo lunes', lunes: true },
    { label: 'Fin de mes', finDeMes: true },
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
// «vie 24»: el día del atajo, como en Clarity.
const fmtAtajo = (d) => d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }).replace('.', '');

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
    const { abierto, alternar, cerrar, caja, pop } = usePopover();
    const atajos = presets?.length ? presets : PRESETS;
    const mov = useMovimiento();
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

    const desdeHoy = ({ dias = 0, meses = 0, lunes = false, finDeMes = false }) => {
        if (lunes) return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + ((8 - hoy.getDay()) % 7 || 7));
        if (finDeMes) return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        return new Date(hoy.getFullYear(), hoy.getMonth() + meses, hoy.getDate() + dias);
    };

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

            {/* El calendario de Clarity: arriba la fecha elegida, abajo los atajos a la izquierda y
                el mes a la derecha. Se guarda al tocar el día. */}
            {abierto && (
                <motion.div ref={pop} className="fi-pop fi-pop--fecha" role="dialog" aria-label={etiqueta}
                    {...mov.popover}>
                    <span className="fi-fe-velo" aria-hidden="true" />
                    <div className="fi-fe-cab">
                        <span className={`fi-fe-campo${sel ? '' : ' fi-fe-campo--vacia'}`}>
                            <small>{etiqueta}</small>
                            <b>{sel ? fmtLargo(sel) : 'Elegí un día'}</b>
                        </span>
                        {sel && <span className="fi-fe-dist">{relativo(sel, hoy)}</span>}
                    </div>
                    <div className="fi-fe-cuerpo">
                        <div className="fi-fe-rapidos" role="listbox" aria-label="Atajos">
                            {atajos.map(p => {
                                const d = desdeHoy(p);
                                return (
                                    <button key={p.label} type="button" className="fi-fe-rapido"
                                        aria-selected={mismoDia(d, sel)} role="option"
                                        disabled={!!piso && d < piso}
                                        onClick={() => elegir(d)}>
                                        <b>{p.label}</b>
                                        <span>{fmtAtajo(d)}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="fi-cal">
                            <div className="fi-cal-cab">
                                <span className="fi-cal-mes">
                                    {vista.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                                </span>
                                <button type="button" className="fi-fe-mini"
                                    onClick={() => setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1))}>
                                    Hoy
                                </button>
                                <button type="button" className="fi-fe-nav" aria-label="Mes anterior"
                                    onClick={() => setMes(new Date(vista.getFullYear(), vista.getMonth() - 1, 1))}>
                                    <ChevronLeft size={15} />
                                </button>
                                <button type="button" className="fi-fe-nav" aria-label="Mes siguiente"
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
                    </div>
                    <div className="fi-fe-pie">
                        <span>Se guarda al tocar el día</span>
                        <button type="button" className="fi-fe-ok" onClick={cerrar}>
                            <Check size={14} aria-hidden="true" /> Listo
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default SelectorFecha;
