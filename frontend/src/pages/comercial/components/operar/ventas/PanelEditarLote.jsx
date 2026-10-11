import React, { useEffect, useId, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Pencil } from 'lucide-react';
import Modal from '../../../../../components/ui/Modal';
import { editarEnLote, getOpcionesDeLote } from './ventasApi';

/**
 * «Editar en lote» de Ventas (10/10/2026): la «Modificación masiva» de la tabla vieja de Ventas de
 * Operaciones, sobre las filas tildadas en Revisar.
 *
 * Los campos y sus opciones son los de la tabla vieja, y van al mismo endpoint
 * (`POST /public/financial-sales/bulk-update`, admin y operador): programa, tipo de pago, método,
 * estado, closer y setter. Las opciones fijas son las suyas; el closer y el setter salen de donde
 * los sacaba ella (`getOpcionesDeLote`: los closers del período más los del sistema, y las fuentes
 * del período). Donde ella dejaba escribir otro valor, acá también.
 *
 * Dos diferencias, a propósito:
 *  - Se cambian varios campos de una vez (el endpoint ya lo aceptaba; la vieja pedía uno por vez).
 *    Cada uno arranca en «No cambiar» y solo viaja lo que se cambió: el backend no toca lo demás.
 *  - Antes de aplicar se ve un resumen: cuántas ventas, qué campo pasa a qué valor y qué tienen hoy.
 *    Es un cambio que pisa datos de cobro de varias personas a la vez y no tiene deshacer.
 *
 * No existe el «todo el filtro» de la vieja: en Revisar se opera sobre lo que se tildó, que puede
 * ser toda la lista con la casilla del encabezado.
 */

const NO_CAMBIAR = '';
const OTRO = '__otro__';

/** Los campos, en el orden de la tabla vieja. `de(fila)` es lo que la fila de Revisar dice hoy. */
const CAMPOS = [
    { key: 'programa', label: 'Programa', de: (f) => f.programa,
        opciones: [['RR', 'Residency Roadmap (RR)'], ['AL', 'Ace Learner (AL)'], ['SI', 'Specialist Initiative (SI)']],
        otro: 'Otro programa' },
    { key: 'tipo_pago_simple', label: 'Tipo de pago', de: (f) => f.tipo_pago_raw?.split(' - ').pop() || f.tipo_pago?.label,
        opciones: ['Seña', 'Parcial', 'Cuota', 'Completo', 'Renovación', 'Upsell'], otro: 'Otro tipo de pago' },
    { key: 'metodo_pago', label: 'Método', de: (f) => f.metodo,
        opciones: ['Stripe', 'PayPal', 'Binance', 'Hotmart'], otro: 'Otro método' },
    { key: 'estado', label: 'Estado', de: (f) => f.estado?.label,
        opciones: ['Completada', 'Pendiente', 'Reembolsada', 'Cancelada'] },
    // El valor es el nombre del closer, como en la vieja: el backend lo resuelve igual que un correo.
    { key: 'email_vendedor', label: 'Closer', de: (f) => f.closer, remotas: 'closers',
        otro: 'Correo del closer', tipoOtro: 'email' },
    { key: 'setter', label: 'Setter', de: (f) => f.setter || 'Sin setter', remotas: 'setters', otro: 'Otro setter' },
];

const opcionesDe = (campo, remotas) => (campo.remotas ? (remotas?.[campo.remotas] || []) : campo.opciones)
    .map(o => (Array.isArray(o) ? { valor: o[0], texto: o[1] } : { valor: o, texto: o }));

/** El valor que viaja de un campo: lo elegido, lo escrito en «Otro…», o '' si no cambia. */
const valorDe = (eleccion) => (eleccion?.valor === OTRO ? (eleccion.texto || '').trim() : eleccion?.valor || '');

/** Cómo se lee un valor en el resumen: el texto de su opción («Residency Roadmap (RR)»), o él mismo. */
const textoDe = (campo, valor, remotas) => opcionesDe(campo, remotas).find(o => o.valor === valor)?.texto || valor;

/** Lo que las filas tienen hoy en un campo: «Stripe ×2 · PayPal». */
const hoyEn = (campo, filas) => {
    const conteo = new Map();
    filas.forEach(f => {
        const v = campo.de(f) || '—';
        conteo.set(v, (conteo.get(v) || 0) + 1);
    });
    return [...conteo.entries()].sort((a, b) => b[1] - a[1])
        .map(([v, n]) => (n > 1 ? `${v} ×${n}` : v)).join(' · ');
};

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const CONTROL = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[13px] font-semibold '
    + 'text-white outline-none transition-colors focus:border-indigo-400 disabled:opacity-50';

const Rotulo = ({ htmlFor, children }) => (
    <label htmlFor={htmlFor} className="block">
        <small className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{children}</small>
    </label>
);

const Campo = ({ campo, eleccion, onCambiar, remotas, cargando }) => {
    const id = useId();
    const opciones = opcionesDe(campo, remotas);
    const conOtro = !!campo.otro;
    const esperando = campo.remotas && cargando;
    const cambia = valorDe(eleccion) !== NO_CAMBIAR;
    return (
        <div className="grid gap-1.5">
            <Rotulo htmlFor={id}>{campo.label}</Rotulo>
            {/* El que cambia se marca con el borde: de un vistazo se ve qué se va a tocar. */}
            <select id={id} className={cambia ? CONTROL.replace('border-slate-700', 'border-indigo-400/70') : CONTROL}
                value={eleccion.valor} disabled={esperando}
                onChange={(e) => onCambiar({ valor: e.target.value, texto: '' })}>
                <option value={NO_CAMBIAR}>{esperando ? 'Cargando…' : 'No cambiar'}</option>
                {opciones.map(o => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                {conOtro && <option value={OTRO}>Otro…</option>}
            </select>
            {eleccion.valor === OTRO && (
                <input type={campo.tipoOtro || 'text'} className={CONTROL} aria-label={campo.otro}
                    placeholder={campo.otro} value={eleccion.texto} autoFocus
                    onChange={(e) => onCambiar({ valor: OTRO, texto: e.target.value })} />
            )}
        </div>
    );
};

const PanelEditarLote = ({ filas, fechas, onCerrar, onHecho }) => {
    const reducido = useReducedMotion();
    const [elecciones, setElecciones] = useState(
        () => Object.fromEntries(CAMPOS.map(c => [c.key, { valor: NO_CAMBIAR, texto: '' }])));
    const [remotas, setRemotas] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [paso, setPaso] = useState('editar');
    const [aplicando, setAplicando] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let vigente = true;
        getOpcionesDeLote(fechas)
            .then((o) => { if (vigente) setRemotas(o); })
            // Sin la lista, el closer y el setter se pueden escribir igual con «Otro…».
            .catch(() => { if (vigente) setRemotas({ closers: [], setters: [] }); })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [fechas]);

    const cambios = useMemo(() => CAMPOS
        .map(c => ({ campo: c, valor: valorDe(elecciones[c.key]) }))
        .filter(c => c.valor !== NO_CAMBIAR), [elecciones]);
    // «Otro…» elegido y sin escribir: ese campo todavía no dice a qué cambia.
    const incompletos = CAMPOS.filter(c => elecciones[c.key].valor === OTRO && !valorDe(elecciones[c.key]));
    const listo = cambios.length > 0 && incompletos.length === 0;
    const n = filas.length;

    const aplicar = async () => {
        setAplicando(true);
        setError(null);
        try {
            const respuesta = await editarEnLote(filas.map(f => f.id),
                Object.fromEntries(cambios.map(c => [c.campo.key, c.valor])));
            toast.success(respuesta?.message || `${plural(n, 'venta actualizada', 'ventas actualizadas')}`);
            onHecho?.();
            onCerrar?.();
        } catch (err) {
            setError(err?.response?.data?.error || 'No se pudieron guardar los cambios. Probá de nuevo.');
            setAplicando(false);
        }
    };

    const entrada = reducido ? {} : {
        initial: { opacity: 0, x: paso === 'resumen' ? 16 : -16 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    };
    const boton = 'inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 transition-colors '
        + 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 '
        + 'disabled:cursor-not-allowed disabled:opacity-50';
    const nombres = filas.slice(0, 5).map(f => f.cliente).join(', ');

    return (
        <Modal ancho="xl" titulo="Editar en lote" onCerrar={onCerrar} cerrable={!aplicando}
            icono={<Pencil className="text-indigo-400" size={18} />}
            subtitulo={paso === 'editar'
                ? `${plural(n, 'venta seleccionada', 'ventas seleccionadas')}. Lo que quede en «No cambiar» no se toca.`
                : 'Revisá los cambios antes de aplicarlos: no se pueden deshacer.'}
            pie={paso === 'editar' ? (
                <>
                    <button type="button" onClick={onCerrar}
                        className={`${boton} border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700`}>
                        <small className="text-[12px] font-bold">Cancelar</small>
                    </button>
                    <button type="button" disabled={!listo} onClick={() => setPaso('resumen')}
                        className={`${boton} bg-indigo-600 text-white hover:bg-indigo-500`}>
                        <small className="text-[12px] font-bold">Revisar los cambios</small>
                        <ArrowRight size={14} aria-hidden="true" />
                    </button>
                </>
            ) : (
                <>
                    <button type="button" disabled={aplicando} onClick={() => { setPaso('editar'); setError(null); }}
                        className={`${boton} border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700`}>
                        <ArrowLeft size={14} aria-hidden="true" />
                        <small className="text-[12px] font-bold">Volver</small>
                    </button>
                    <button type="button" disabled={aplicando} onClick={aplicar}
                        className={`${boton} bg-indigo-600 text-white hover:bg-indigo-500`}>
                        <Check size={14} aria-hidden="true" />
                        <small className="text-[12px] font-bold">
                            {aplicando ? 'Aplicando…' : `Aplicar a ${plural(n, 'venta', 'ventas')}`}
                        </small>
                    </button>
                </>
            )}>
            <motion.div key={paso} {...entrada}>
                {paso === 'editar' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {CAMPOS.map(c => (
                            <Campo key={c.key} campo={c} eleccion={elecciones[c.key]} remotas={remotas}
                                cargando={cargando}
                                onCambiar={(e) => setElecciones(prev => ({ ...prev, [c.key]: e }))} />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-4">
                        <section aria-label="Resumen de los cambios" className="grid gap-2">
                            {cambios.map(({ campo, valor }) => (
                                <div key={campo.key}
                                    className="grid gap-1 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                                    <span className="flex flex-wrap items-baseline gap-x-2">
                                        <small className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {campo.label}
                                        </small>
                                        <ArrowRight size={12} className="text-slate-500" aria-hidden="true" />
                                        <b className="text-[14px] text-white">{textoDe(campo, valor, remotas)}</b>
                                    </span>
                                    <small className="text-[11.5px] font-semibold text-slate-500">
                                        Hoy: {hoyEn(campo, filas)}
                                    </small>
                                </div>
                            ))}
                        </section>
                        <p className="text-[12.5px] leading-relaxed text-slate-400">
                            Se aplica a <b className="text-slate-200">{plural(n, 'venta', 'ventas')}</b>
                            {`: ${nombres}${n > 5 ? ` y ${plural(n - 5, 'más', 'más')}` : ''}.`} Queda guardado al
                            instante y Google Sheets se pone al día unos segundos después.
                        </p>
                        {error && (
                            <p role="alert"
                                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] font-semibold text-rose-200">
                                {error}
                            </p>
                        )}
                    </div>
                )}
            </motion.div>
        </Modal>
    );
};

export default PanelEditarLote;
