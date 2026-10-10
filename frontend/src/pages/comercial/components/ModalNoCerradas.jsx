import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarX, ChevronRight, Quote, RotateCcw } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { abrir } from '../../../components/dashboard/MetricaClicable';
import { fmt } from './Shared';

/**
 * «No cerradas» del panel Cierre: cada llamada con show up que no terminó ni en venta ni en seña, con
 * el lead y la objeción que quedó registrada (pedido del usuario, 09/10/2026: «debe mostrar un modal
 * con el lead y la objeción registrada … y en el modal debe haber una opción para ir a la lista de
 * esas agendas en revisar»).
 *
 * La lista la arma el backend (`GET /comercial/cierres/no-cerradas`) con las MISMAS filas que cuenta
 * la tarjeta y que muestra Revisar con «Cerró: No»: por eso «Ver en Revisar» abre la misma cantidad
 * que dice el modal. Se pide al abrir y no viene en el resumen: leer la objeción de cada agenda no
 * tiene por qué pagarse en cada carga del dashboard.
 *
 * Props:
 *  - `cargar()`: la promesa con `{ filas }` del período y el alcance que se está mirando.
 *  - `total`: la cifra de la tarjeta, para la cabecera mientras la lista no llegó.
 *  - `irA` + `destino`: el drill-down a Revisar. Sin alguno de los dos (el tablero embebido que no
 *    tiene lista), no hay botón.
 *  - `onAbrir(fila)`: abre la ficha del lead. Sin él, las filas no son botones.
 */

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * «Lo tiene que hablar con la pareja» — Marlon · 11/09. Entera y sin recortar: es lo que se viene a
 * leer a este modal.
 */
const Objecion = ({ objecion }) => (
    <span className="flex min-w-0 items-start gap-2">
        <Quote size={13} className="mt-0.5 shrink-0 text-orange-300/80" aria-hidden="true" />
        <span className="min-w-0">
            <small className="block whitespace-pre-line break-words text-[13px] leading-snug text-slate-100">
                {objecion.texto}
            </small>
            <small className="mt-1 block text-[10.5px] font-semibold text-slate-500">
                {[objecion.autor, objecion.fecha && fmt.fecha(objecion.fecha)].filter(Boolean).join(' · ')}
            </small>
        </span>
    </span>
);

const SinObjecion = ({ conFicha }) => (
    <span className="flex min-w-0 items-start gap-2">
        <Quote size={13} className="mt-0.5 shrink-0 text-slate-600" aria-hidden="true" />
        <span className="min-w-0">
            <small className="block text-[12.5px] font-semibold text-slate-400">Sin objeción registrada</small>
            <small className="mt-0.5 block text-[10.5px] leading-snug text-slate-500">
                {conFicha
                    ? 'Abrí la ficha del lead y cargala desde el Historial.'
                    : 'Se carga desde el Historial de la ficha del lead.'}
            </small>
        </span>
    </span>
);

/** Una agenda: el lead, quién la atendió y cuándo, su estado y la objeción. */
const Fila = ({ fila, onAbrir }) => {
    const contenido = (
        <>
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                    <b className="min-w-0 max-w-full truncate text-[14px] text-white" title={fila.cliente}>
                        {fila.cliente}
                    </b>
                    {fila.post_call?.label && (
                        <small className="shrink-0 rounded-md border border-slate-700 bg-slate-800/70 px-1.5 py-px text-[10px] font-bold text-slate-300">
                            {fila.post_call.label}
                        </small>
                    )}
                    <small className="shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums">
                        {fila.closer} · {fmt.fecha(fila.fecha)}{fmt.hora(fila.fecha) ? ` ${fmt.hora(fila.fecha)}` : ''}
                    </small>
                </span>
                <span className="mt-2 block">
                    {fila.objecion ? <Objecion objecion={fila.objecion} /> : <SinObjecion conFicha={!!onAbrir} />}
                </span>
            </span>
            {onAbrir && <ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />}
        </>
    );
    const caja = 'flex w-full items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-left';
    return onAbrir ? (
        <button type="button" onClick={() => onAbrir(fila)} aria-label={`Abrir la ficha de ${fila.cliente}`}
            className={`${caja} cursor-pointer transition-colors hover:border-slate-600 hover:bg-slate-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400`}>
            {contenido}
        </button>
    ) : <div className={caja}>{contenido}</div>;
};

const Esqueleto = () => (
    <ul className="grid gap-2" aria-label="Cargando las no cerradas">
        {[0, 1, 2].map(i => (
            <li key={i} className="h-[74px] rounded-2xl border border-slate-800 bg-slate-800/40 animate-pulse motion-reduce:animate-none" />
        ))}
    </ul>
);

const ModalNoCerradas = ({ cargar, total = null, irA = null, destino = null, onAbrir = null, onCerrar }) => {
    const reducido = useReducedMotion();
    const [filas, setFilas] = useState(null);
    const [error, setError] = useState(false);
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        let vigente = true;
        setError(false);
        Promise.resolve()
            .then(() => cargar())
            .then((datos) => { if (vigente) setFilas(datos?.filas || []); })
            .catch(() => { if (vigente) setError(true); });
        // Una respuesta que llega con el modal ya cerrado (o tras otro pedido) no escribe nada.
        return () => { vigente = false; };
    }, [cargar, intento]);

    // La cuenta de la cabecera es la de la lista apenas llega; antes, la de la tarjeta.
    const cuantas = filas ? filas.length : total;
    const ir = abrir(irA, destino);
    const verEnRevisar = ir ? () => { onCerrar?.(); ir(); } : null;

    return (
        <Modal ancho="3xl" titulo="No cerradas" onCerrar={onCerrar}
            icono={<CalendarX size={18} className="text-orange-300" />}
            subtitulo={cuantas === null || cuantas === undefined ? 'Llamadas con show up sin venta ni seña'
                : `${plural(cuantas, 'llamada', 'llamadas')} con show up sin venta ni seña`}
            pie={(
                <>
                    <small className="mr-auto text-[11px] font-semibold text-slate-500">
                        {onAbrir ? 'Tocá un lead para abrir su ficha.' : 'La objeción es la última cargada en la agenda.'}
                    </small>
                    {verEnRevisar && (
                        <button type="button" onClick={verEnRevisar}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-orange-400/40 bg-orange-500/15 px-4 py-2 text-orange-100 transition-colors hover:bg-orange-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400">
                            <small className="text-[11px] font-black uppercase tracking-widest">Ver en Revisar</small>
                            <ArrowRight size={14} aria-hidden="true" />
                        </button>
                    )}
                </>
            )}>
            {error && (
                <div className="grid justify-items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3" role="alert">
                    <small className="text-[13px] font-semibold text-rose-200">No se pudo cargar la lista.</small>
                    <button type="button" onClick={() => setIntento(n => n + 1)}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-rose-400/40 px-3 py-1.5 text-rose-100 hover:bg-rose-500/20">
                        <RotateCcw size={13} aria-hidden="true" />
                        <small className="text-[11px] font-bold">Reintentar</small>
                    </button>
                </div>
            )}
            {!error && filas === null && <Esqueleto />}
            {!error && filas?.length === 0 && (
                <p className="py-6 text-center text-[13px] text-slate-400">
                    Ninguna llamada con show up quedó sin cerrar en el período.
                </p>
            )}
            {!error && filas?.length > 0 && (
                <ul className="grid gap-2" aria-label="Agendas no cerradas">
                    {filas.map((fila, i) => (
                        <motion.li key={fila.id}
                            {...(reducido ? {} : {
                                initial: { opacity: 0, y: 8 },
                                animate: { opacity: 1, y: 0 },
                                // Escalonado, pero con techo: con 40 filas la última no puede tardar 2 s.
                                transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 10) * 0.035 },
                            })}>
                            <Fila fila={fila} onAbrir={onAbrir} />
                        </motion.li>
                    ))}
                </ul>
            )}
        </Modal>
    );
};

export default ModalNoCerradas;
