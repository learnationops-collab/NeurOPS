import React, { forwardRef, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, Check, ExternalLink, Instagram, Loader2, Radio, User } from 'lucide-react';
import { parseUtcIso } from '../../../utils/datetime';
import BuscadorAnuncio from './BuscadorAnuncio';

/**
 * Una agenda de la bandeja: quién es, cuándo es la reunión, con quién y en qué estado, y el
 * buscador para ponerle el anuncio. Todo legible de un vistazo, sin abrir nada.
 *
 * El Instagram está porque es la llave de la atribución (ver `palabra_clave_service`): si la agenda
 * ya lo tiene se muestra como link y no estorba; si falta, el campo aparece abierto. Si el backend
 * dice que falta, el foco va a ese campo.
 */
const TONOS = ['var(--brand-secondary)', '#6F7BFF', 'var(--success)', 'var(--warning)', '#9A7BE0'];

const colorDe = (nombre) => TONOS[Array.from(nombre || '').reduce((a, c) => a + c.charCodeAt(0), 0) % TONOS.length];

const iniciales = (nombre) => (nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const dos = (n) => String(n).padStart(2, '0');

/** "Hoy · 22:00", "Mañana · 10:30", "jue 09/10 · 22:00": la reunión en la hora de quien mira. */
export const cuandoLegible = (iso, ahora = new Date()) => {
    const d = parseUtcIso(iso);
    if (!d) return 'Sin fecha';
    const hora = `${dos(d.getHours())}:${dos(d.getMinutes())}`;
    const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dif = Math.round((dia(d) - dia(ahora)) / 86400000);
    const nombre = { 0: 'Hoy', 1: 'Mañana', [-1]: 'Ayer' }[dif]
        ?? `${d.toLocaleDateString('es', { weekday: 'short' }).replace('.', '')} ${dos(d.getDate())}/${dos(d.getMonth() + 1)}`;
    return `${nombre} · ${hora}`;
};

const TarjetaAgenda = forwardRef(({ agenda, anuncios, sugerido, onAsignar, orden = 0 }, ref) => {
    const reducir = useReducedMotion();
    const [elegido, setElegido] = useState(sugerido || null);
    const [editandoIg, setEditandoIg] = useState(!agenda.instagram);
    const [ig, setIg] = useState(agenda.instagram || '');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState(null);
    const [abierta, setAbierta] = useState(false);
    const igRef = useRef(null);
    const buscadorRef = useRef(null);

    // Quien arma la lista le da el foco al buscador de la tarjeta que sigue.
    React.useImperativeHandle(ref, () => ({ focus: () => buscadorRef.current?.focus() }), []);

    const confirmar = async (anuncio = elegido) => {
        if (!anuncio || enviando) return;
        setEnviando(true);
        setError(null);
        const instagram = editandoIg ? ig : undefined;
        const r = await onAsignar(agenda, anuncio, instagram);
        if (r?.error) {
            setEnviando(false);
            setError(r.error);
            // Mientras se enviaba el campo estuvo deshabilitado y perdió el foco: vuelve adonde
            // hay que corregir (el Instagram si es eso lo que falta, si no el buscador).
            if (/instagram/i.test(r.error)) {
                setEditandoIg(true);
                requestAnimationFrame(() => igRef.current?.focus());
            } else {
                requestAnimationFrame(() => buscadorRef.current?.focus());
            }
        }
        // Si salió bien la tarjeta se va: la saca la lista.
    };

    const idIg = `ig-${agenda.id}`;
    const estado = agenda.estado;

    return (
        <motion.li layout={!reducir} className={`ma-card${abierta ? ' ma-card--abierta' : ''}${enviando ? ' ma-card--enviando' : ''}`}
            initial={reducir ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, delay: Math.min(orden, 8) * 0.035 } }}
            exit={reducir ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, x: 48, scale: 0.97, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
            aria-label={`Agenda de ${agenda.cliente}`}>
            <div className="ma-info">
                <div className="ma-quien">
                    <span className="ma-ini" style={{ '--c': colorDe(agenda.cliente) }} aria-hidden="true">
                        {iniciales(agenda.cliente)}
                    </span>
                    <div className="ma-quien-t">
                        <h3 className="ma-nombre trunc" title={agenda.cliente}>{agenda.cliente}</h3>
                        <div className="ma-meta">
                            <span title="La reunión, en tu hora"><CalendarClock size={14} aria-hidden="true" />{cuandoLegible(agenda.reunion)}</span>
                            <span title="Closer"><User size={14} aria-hidden="true" />{agenda.closer}</span>
                            {agenda.canal && <span title="Por dónde reservó"><Radio size={14} aria-hidden="true" />{agenda.canal}</span>}
                        </div>
                    </div>
                    {estado?.label && (
                        <span className="chip ma-estado" style={{ '--c': `var(--${estado.tone || 'idle'})` }}>{estado.label}</span>
                    )}
                </div>

                <div className="ma-ig">
                    {editandoIg ? (
                        <>
                            <label className="sr" htmlFor={idIg}>Instagram de {agenda.cliente}</label>
                            <span className={`ma-ig-campo${!ig.trim() ? ' ma-ig-campo--falta' : ''}`}>
                                <Instagram size={14} aria-hidden="true" />
                                <input id={idIg} ref={igRef} type="text" value={ig} placeholder="usuario de Instagram"
                                    autoComplete="off" spellCheck={false} disabled={enviando}
                                    onChange={(e) => { setIg(e.target.value); setError(null); }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); if (elegido) confirmar(); else buscadorRef.current?.focus(); }
                                    }} />
                            </span>
                            {!agenda.instagram && (
                                <span className="ma-ig-nota">Sin Instagram Marketing no encuentra su conversación.</span>
                            )}
                        </>
                    ) : (
                        <>
                            <a className="ma-ig-link" href={`https://instagram.com/${agenda.instagram}`} target="_blank" rel="noopener noreferrer"
                                title="Abrir su perfil">
                                <Instagram size={14} aria-hidden="true" />@{agenda.instagram}<ExternalLink size={12} aria-hidden="true" />
                            </a>
                            <button type="button" className="ma-ig-cambiar" disabled={enviando}
                                onClick={() => { setEditandoIg(true); requestAnimationFrame(() => igRef.current?.focus()); }}>
                                Cambiar
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="ma-asignar">
                <BuscadorAnuncio ref={buscadorRef} anuncios={anuncios} elegido={elegido} deshabilitado={enviando}
                    onElegir={(a) => { setElegido(a); setError(null); }} onConfirmar={confirmar} onAbrir={setAbierta}
                    etiqueta={sugerido && elegido?.id === sugerido.id ? 'Palabra clave · sugerida por la agenda' : 'Palabra clave del anuncio'} />
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

TarjetaAgenda.displayName = 'TarjetaAgenda';

export default TarjetaAgenda;
