import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { BarChart3, CheckCircle2, Flame, Trophy } from 'lucide-react';

/**
 * Lo que se ve con la bandeja vacía.
 *
 * `festejo`: la acaba de vaciar en esta visita. Pedido de Kerwin (10/10/2026): "mostrarle un premio
 * por completarlo, como en un juego, para dar retroalimentación". Es el festejo del reporte que
 * aprobó (el check que se dibuja y las chispas que salen del centro), con un trofeo, las que
 * completó hoy y la racha de días con la bandeja vacía.
 *
 * Sin `festejo`: entró y ya estaba vacía. Un "Todo al día" tranquilo, sin chispas: festejar cada
 * vez que abre la pantalla le quitaría valor al festejo de verdad.
 *
 * Con movimiento reducido no hay chispas ni trazo: el check aparece entero.
 */
const COLORES = ['var(--brand-secondary)', '#6F7BFF', 'var(--success)', 'var(--brand-secondary-light)'];

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const Premio = ({ festejo, hoy = 0, racha = 0, onVerDatos }) => {
    const reducir = useReducedMotion();
    const cajaRef = useRef(null);

    // Las chispas del `festejo()` del artifact: se crean, vuelan y se borran solas.
    useEffect(() => {
        if (!festejo || reducir || !cajaRef.current) return undefined;
        const caja = cajaRef.current;
        const chispas = Array.from({ length: 26 }, (_, i) => {
            const s = document.createElement('i');
            const angulo = Math.random() * Math.PI * 2;
            const radio = 90 + Math.random() * 140;
            s.className = 'chispa';
            s.setAttribute('aria-hidden', 'true');
            s.style.cssText = `--c:${COLORES[i % COLORES.length]};--dx:${Math.cos(angulo) * radio}px;`
                + `--dy:${Math.sin(angulo) * radio}px;--dl:${Math.round(Math.random() * 160)}ms`;
            caja.appendChild(s);
            return s;
        });
        const id = setTimeout(() => chispas.forEach(s => s.remove()), 1600);
        return () => { clearTimeout(id); chispas.forEach(s => s.remove()); };
    }, [festejo, reducir]);

    if (!festejo) {
        return (
            <section className="ma-premio ma-premio--calmo vidrio" aria-label="Bandeja al día">
                <CheckCircle2 size={44} className="ma-premio-ok" aria-hidden="true" />
                <h2>Todo al día</h2>
                <p>No tenés agendas sin palabra clave. Las nuevas van a aparecer acá.</p>
                {(hoy > 0 || racha > 0) && (
                    <div className="ma-premio-chips">
                        {hoy > 0 && <span className="chip" style={{ '--c': 'var(--success)' }}>{plural(hoy, 'completada hoy', 'completadas hoy')}</span>}
                        {racha > 0 && <span className="chip" style={{ '--c': 'var(--warning)' }}><Flame size={13} />{plural(racha, 'día', 'días')} de racha</span>}
                    </div>
                )}
            </section>
        );
    }

    return (
        <section className="ma-premio vidrio" ref={cajaRef} role="status" aria-label="¡Bandeja vacía!">
            <div className="ma-premio-trofeo" aria-hidden="true">
                <svg className="ok" viewBox="0 0 84 84">
                    <circle cx="42" cy="42" r="40" />
                    <path d="M27 43l10 10 20-22" />
                </svg>
                <span className="ma-premio-copa"><Trophy size={20} /></span>
            </div>
            <h2>¡Bandeja vacía!</h2>
            <p className="num">
                {hoy > 0 ? `Completaste ${plural(hoy, 'agenda', 'agendas')} hoy.` : 'Todas tus agendas tienen su anuncio.'}
                {' '}Marketing ya sabe de qué anuncio vino cada una.
            </p>
            {racha > 0 && (
                <div className="ma-premio-chips">
                    <span className="chip" style={{ '--c': 'var(--warning)' }}>
                        <Flame size={13} />{racha === 1 ? 'Primer día de racha' : `${racha} días seguidos al día`}
                    </span>
                </div>
            )}
            {onVerDatos && (
                <button type="button" className="btn btn--linea" onClick={onVerDatos}>
                    <BarChart3 size={16} />Ver mis datos
                </button>
            )}
        </section>
    );
};

export default Premio;
