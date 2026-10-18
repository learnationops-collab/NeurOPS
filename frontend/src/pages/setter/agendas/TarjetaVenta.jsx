import React, { forwardRef, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Receipt } from 'lucide-react';
import BuscadorAnuncio from './BuscadorAnuncio';
import CampoInstagram from './CampoInstagram';
import { colorDe, iniciales } from './TarjetaAgenda';

/**
 * Un cliente con ventas de la fuente del setter: sus pagos (fecha, tipo, monto y la palabra clave de
 * cada uno, si ya tiene) y el buscador para ponerle el anuncio a TODOS (ver
 * `ventas_palabra_clave_service`). Mismo dibujo y teclado que la tarjeta de una agenda.
 */

const DINERO = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const dinero = (v) => DINERO.format(v || 0);
/** El día del pago tal como está guardado (es una fecha, no un instante): «02/10/26». */
export const diaDelPago = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '—');

const TarjetaVenta = forwardRef(({ grupo, anuncios, onAsignar, orden = 0 }, ref) => {
    const reducir = useReducedMotion();
    const [elegido, setElegido] = useState(null);
    const [editandoIg, setEditandoIg] = useState(!grupo.instagram);
    const [ig, setIg] = useState(grupo.instagram || '');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState(null);
    const igRef = useRef(null);
    const buscadorRef = useRef(null);
    React.useImperativeHandle(ref, () => ({ focus: () => buscadorRef.current?.focus() }), []);

    const confirmar = async (anuncio = elegido) => {
        if (!anuncio || enviando) return;
        setEnviando(true);
        setError(null);
        const r = await onAsignar(grupo, anuncio, editandoIg ? ig : undefined);
        if (r?.error) {
            setEnviando(false);
            setError(r.error);
            if (/instagram/i.test(r.error)) {
                setEditandoIg(true);
                requestAnimationFrame(() => igRef.current?.focus());
            } else {
                requestAnimationFrame(() => buscadorRef.current?.focus());
            }
        }
    };

    const n = grupo.pagos.length;
    return (
        <motion.li layout={!reducir} className={`ma-card ma-card--venta${enviando ? ' ma-card--enviando' : ''}`}
            initial={reducir ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, delay: Math.min(orden, 8) * 0.035 } }}
            exit={reducir ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, x: 48, scale: 0.97, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
            aria-label={`Ventas de ${grupo.cliente}`}>
            <div className="ma-info">
                <div className="ma-quien">
                    <span className="ma-ini" style={{ '--c': colorDe(grupo.cliente) }} aria-hidden="true">
                        {iniciales(grupo.cliente)}
                    </span>
                    <div className="ma-quien-t">
                        <h3 className="ma-nombre trunc" title={grupo.cliente}>{grupo.cliente}</h3>
                        <div className="ma-meta">
                            <span><Receipt size={14} aria-hidden="true" />{n} {n === 1 ? 'pago' : 'pagos'} · {dinero(grupo.total)}</span>
                        </div>
                    </div>
                </div>
                <ul className="mv-pagos" aria-label={`Pagos de ${grupo.cliente}`}>
                    {grupo.pagos.map((p) => (
                        <li key={p.id}>
                            <span className="num">{diaDelPago(p.fecha)}</span>
                            <span className="trunc" title={p.programa}>{p.tipo || 'Pago'}</span>
                            <b className="num">{dinero(p.monto)}</b>
                            <small className={p.palabra_clave ? 'mv-con' : 'mv-sin'}>{p.palabra_clave || 'Sin palabra clave'}</small>
                        </li>
                    ))}
                </ul>
                <CampoInstagram id={`ig-venta-${grupo.grupo}`} nombre={grupo.cliente} guardado={grupo.instagram}
                    editando={editandoIg} valor={ig} deshabilitado={enviando} inputRef={igRef}
                    onCambiar={(v) => { setIg(v); setError(null); }}
                    onEditar={() => { setEditandoIg(true); requestAnimationFrame(() => igRef.current?.focus()); }}
                    onEnter={() => { if (elegido) confirmar(); else buscadorRef.current?.focus(); }} />
            </div>

            <div className="ma-asignar">
                <BuscadorAnuncio ref={buscadorRef} anuncios={anuncios} elegido={elegido} deshabilitado={enviando}
                    onElegir={(a) => { setElegido(a); setError(null); }} onConfirmar={confirmar}
                    etiqueta={n > 1 ? `Palabra clave de sus ${n} pagos` : 'Palabra clave del anuncio'} />
                <motion.button type="button" className="btn btn--cta btn--sm ma-btn" disabled={!elegido || enviando}
                    whileTap={reducir ? undefined : { scale: 0.94 }} onClick={() => confirmar()}>
                    {enviando ? <Loader2 size={15} className="ma-gira" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                    {enviando ? 'Asignando' : 'Asignar'}
                </motion.button>
                {error && <p className="ma-error" role="alert">{error}</p>}
            </div>
        </motion.li>
    );
});

TarjetaVenta.displayName = 'TarjetaVenta';

export default TarjetaVenta;
