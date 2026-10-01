import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import './modal.css';

/**
 * Cascarón de los modales de formulario (equipo, agendas, ventas): velo, cabecera, cuerpo y pie.
 *
 * Kerwin, 01/10/2026, sobre el rol operador: "los modales están muy mal diseñados, no puedo usar
 * los botones". El de editar un miembro del equipo en una laptop quedaba cortado arriba y abajo:
 * sin el título, sin la X y sin «Guardar». Las tres causas, y lo que hace este cascarón con cada una:
 *
 *  - El velo era hijo de un `space-y-*`: Tailwind le pone `margin-top` a cada hermano que no es el
 *    primero, y un `fixed inset-0` con margen arriba se corre hacia abajo. La franja de arriba de
 *    la página quedaba sin velo. Acá va en un portal a `body`, fuera de cualquier contenedor.
 *  - El panel no tenía alto máximo y el velo no scrolleaba: un formulario más alto que la ventana
 *    se salía por arriba y por abajo, sin forma de llegar a sus botones. Acá el panel mide como
 *    mucho la ventana menos un margen, la cabecera y el pie quedan fijos y solo scrollea el cuerpo.
 *  - Montado adentro de `MainLayout`, su `z-index` solo competía dentro del `relative z-10` del
 *    layout. Desde `body` tapa todo, menos el widget de bugs, a propósito (ver `modal.css`).
 *
 * Quien lo usa lo monta cuando hace falta y lo desmonta al cerrar (`{abierto && <Modal …/>}`), sin
 * `AnimatePresence`, igual que `ModalConfirmacion`.
 *
 * Props:
 *  - `titulo`, `subtitulo`, `icono`: la cabecera. La X de cerrar va siempre.
 *  - `pie`: los botones de acción. Van en un pie fijo que reserva el hueco del widget de bugs.
 *  - `onSubmit`: si viene, cuerpo y pie van dentro de un `<form>`, así un `type="submit"` del pie
 *    envía el formulario (y la validación nativa de los `required` sigue funcionando).
 *  - `cerrable`: en `false` (mientras se guarda) no cierra ni con Escape, ni con el fondo, ni con la X.
 *  - `ancho`: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'roadmap'.
 *  - `tono`: 'slate' (los tableros oscuros de agendas y ventas) o 'tema' (sigue el tema elegido).
 */

const ANCHOS = {
    sm: '24rem', md: '28rem', lg: '32rem', xl: '36rem', '2xl': '42rem', '3xl': '48rem',
    '4xl': '56rem', '5xl': '64rem', '6xl': '72rem', roadmap: '1400px',
};

const TONOS = {
    slate: {
        panel: 'bg-slate-900 border border-slate-800 text-slate-200',
        linea: 'border-slate-800/70',
        pie: 'bg-slate-950/40',
        titulo: 'text-white',
        subtitulo: 'text-slate-500',
        cerrar: 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700',
    },
    tema: {
        panel: 'bg-surface border border-base text-base',
        linea: 'border-base',
        pie: 'bg-main/30',
        titulo: 'text-base',
        subtitulo: 'text-muted',
        cerrar: 'bg-main border-base text-muted hover:text-base hover:bg-surface-hover',
    },
};

const ENFOCABLES = 'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/* Modales abiertos, del de más abajo al de más arriba: Escape cierra solo el de arriba. */
const pila = [];

/* El scroll de `body` se traba con el primer modal y se suelta con el último. */
let trabas = 0;
let overflowPrevio = '';
const trabarScroll = () => {
    if (trabas++ === 0) {
        overflowPrevio = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
    return () => {
        trabas = Math.max(0, trabas - 1);
        if (trabas === 0) document.body.style.overflow = overflowPrevio;
    };
};

const Modal = ({
    titulo,
    subtitulo = null,
    icono = null,
    children,
    pie = null,
    onCerrar,
    onSubmit = null,
    cerrable = true,
    ancho = 'xl',
    tono = 'slate',
    etiqueta = null,
    className = '',
    cuerpoClassName = '',
}) => {
    const reducido = useReducedMotion();
    const ids = useId();
    const panel = useRef(null);
    const t = TONOS[tono] || TONOS.slate;

    // Refs para que los efectos corran una sola vez y lean siempre lo último.
    const cerrarRef = useRef(onCerrar);
    const cerrableRef = useRef(cerrable);
    cerrarRef.current = onCerrar;
    cerrableRef.current = cerrable;
    const cerrar = () => { if (cerrableRef.current) cerrarRef.current?.(); };

    useEffect(() => {
        const yo = {};
        pila.push(yo);
        const soltarScroll = trabarScroll();
        const antes = document.activeElement;
        panel.current?.focus({ preventScroll: true });

        const escape = (e) => {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            if (pila[pila.length - 1] !== yo) return;
            e.preventDefault();
            if (cerrableRef.current) cerrarRef.current?.();
        };
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('keydown', escape);
            const i = pila.indexOf(yo);
            if (i >= 0) pila.splice(i, 1);
            soltarScroll();
            if (antes && document.contains(antes)) antes.focus?.({ preventScroll: true });
        };
    }, []);

    // El fondo cierra con un clic que EMPIEZA y termina en él: arrastrar una selección de texto
    // desde un campo y soltarla afuera no puede tirar lo que se estaba escribiendo.
    const pulsoEnFondo = useRef(false);

    // Tab no se escapa del diálogo.
    const atraparTab = (e) => {
        if (e.key !== 'Tab' || !panel.current) return;
        const enfocables = [...panel.current.querySelectorAll(ENFOCABLES)];
        if (!enfocables.length) return;
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];
        if (e.shiftKey && (document.activeElement === primero || document.activeElement === panel.current)) {
            e.preventDefault();
            ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
        }
    };

    const cuerpo = (
        <div className={`modal-cuerpo custom-scrollbar px-5 py-5 sm:px-6 text-left ${cuerpoClassName}`}>
            {children}
        </div>
    );
    const piePanel = pie && (
        <div className={`modal-pie flex flex-wrap items-center justify-end gap-3 border-t pl-5 sm:pl-6 py-4 ${t.linea} ${t.pie}`}>
            {pie}
        </div>
    );

    return createPortal(
        <div className="modal-velo" data-modal-velo="">
            <motion.div className="modal-fondo" aria-hidden="true" data-modal-fondo=""
                onMouseDown={() => { pulsoEnFondo.current = true; }}
                onClick={() => {
                    if (pulsoEnFondo.current) cerrar();
                    pulsoEnFondo.current = false;
                }}
                {...(reducido ? {} : {
                    initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.16 },
                })} />
            <motion.div ref={panel} tabIndex={-1} role="dialog" aria-modal="true"
                aria-labelledby={etiqueta ? undefined : `${ids}-titulo`}
                aria-label={etiqueta || undefined}
                onKeyDown={atraparTab}
                onMouseDown={() => { pulsoEnFondo.current = false; }}
                className={`modal-panel rounded-[2rem] shadow-2xl ${t.panel} ${className}`}
                style={{ '--modal-ancho': ANCHOS[ancho] || ancho }}
                {...(reducido ? {} : {
                    initial: { opacity: 0, y: 12, scale: 0.98 },
                    animate: { opacity: 1, y: 0, scale: 1 },
                    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                })}>
                <div className={`modal-cabecera flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 ${t.linea}`}>
                    <div className="flex min-w-0 items-start gap-3">
                        {icono && <span className="mt-0.5 shrink-0" aria-hidden="true">{icono}</span>}
                        <div className="min-w-0">
                            <h2 id={`${ids}-titulo`}
                                className={`text-lg font-black italic uppercase leading-tight tracking-tight break-words ${t.titulo}`}>
                                {titulo}
                            </h2>
                            {subtitulo && (
                                <div className={`mt-1 text-[10px] font-black uppercase tracking-widest ${t.subtitulo}`}>
                                    {subtitulo}
                                </div>
                            )}
                        </div>
                    </div>
                    <button type="button" aria-label="Cerrar" title="Cerrar" disabled={!cerrable}
                        onClick={cerrar}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${t.cerrar}`}>
                        <X size={18} />
                    </button>
                </div>

                {onSubmit ? (
                    <form className="modal-form" onSubmit={onSubmit}>
                        {cuerpo}
                        {piePanel}
                    </form>
                ) : (
                    <>
                        {cuerpo}
                        {piePanel}
                    </>
                )}
            </motion.div>
        </div>,
        document.body,
    );
};

export default Modal;
