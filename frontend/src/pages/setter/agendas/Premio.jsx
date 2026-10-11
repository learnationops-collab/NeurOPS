import React, { forwardRef, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BarChart3, CheckCircle2, Flame, Trophy } from 'lucide-react';
import { nombreDeMes, tituloDeMes } from './meses';

/**
 * Lo que se ve con el mes (o la bandeja entera) vacío.
 *
 * `festejo`: lo acaba de vaciar en esta visita. Pedido de Kerwin (10/10/2026): "mostrarle un premio
 * por completarlo, como en un juego, para dar retroalimentación". Es el festejo del reporte que
 * aprobó (el check que se dibuja y las chispas que salen del centro), con un trofeo, las que
 * completó hoy y la racha de días con la bandeja vacía.
 *   · `'mes'`: vació el mes que estaba mirando y quedan otros: «¡Octubre al día!».
 *   · `'todo'`: no queda ninguna en ningún mes: «¡Bandeja vacía!», el premio final.
 *
 * Sin `festejo`: entró y ya estaba vacío. Un "al día" tranquilo, sin chispas: festejar cada vez que
 * abre la pantalla le quitaría valor al festejo de verdad.
 *
 * `llamado` es el mes que sigue con pendientes (11/10/2026, «este mes y luego el mes pasado [...] de
 * a poquito»): un botón corto para seguir con ése, nunca la lista de todos los meses junta. El
 * botón recibe el foco al vaciar un mes (`ref`), así que con Enter se sigue sin tocar el mouse.
 *
 * Con movimiento reducido no hay chispas ni trazo: el check aparece entero.
 */
const COLORES = ['var(--brand-secondary)', '#6F7BFF', 'var(--success)', 'var(--brand-secondary-light)'];

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const Chips = ({ hoy, racha, festejo }) => ((hoy > 0 || racha > 0) ? (
    <div className="ma-premio-chips">
        {hoy > 0 && (
            <span className="chip" style={{ '--c': 'var(--success)' }} title="Palabras clave que asignaste hoy">
                {plural(hoy, 'completada hoy', 'completadas hoy')}
            </span>
        )}
        {racha > 0 && (
            <span className="chip" style={{ '--c': 'var(--warning)' }} title="Días seguidos que terminaste sin ninguna pendiente">
                <Flame size={13} />
                {festejo && racha === 1 ? 'Primer día de racha' : `${plural(racha, 'día', 'días')} de racha`}
            </span>
        )}
    </div>
) : null);

/** «Seguí con septiembre · 23»: el próximo mes con pendientes. */
const Llamado = forwardRef(({ llamado }, ref) => {
    const reducir = useReducedMotion();
    if (!llamado) return null;
    return (
        <motion.button ref={ref} type="button" className="btn btn--cta ma-llamado" onClick={llamado.onIr}
            initial={reducir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.35 } }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            title={`${tituloDeMes(llamado.mes)}: ${plural(llamado.pendientes, 'agenda', 'agendas')} sin palabra clave`}>
            Seguí con {nombreDeMes(llamado.mes)} <b className="num">· {llamado.pendientes}</b>
            <ArrowRight size={16} aria-hidden="true" />
        </motion.button>
    );
});
Llamado.displayName = 'Llamado';

const Premio = forwardRef(({ festejo, hoy = 0, racha = 0, mes = null, llamado = null, onVerDatos }, ref) => {
    const reducir = useReducedMotion();
    const cajaRef = useRef(null);
    const final = festejo === 'todo' || (festejo && !llamado);

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
        // Entró y el mes ya estaba vacío: «Octubre al día» si quedan otros meses, «Todo al día» si no.
        const titulo = llamado && mes ? `${tituloDeMes(mes)} al día` : 'Todo al día';
        return (
            <section className="ma-premio ma-premio--calmo vidrio" aria-label={titulo}>
                <CheckCircle2 size={44} className="ma-premio-ok" aria-hidden="true" />
                <h2>{titulo}</h2>
                <Chips hoy={hoy} racha={racha} />
                <Llamado ref={ref} llamado={llamado} />
            </section>
        );
    }

    const titulo = final ? '¡Bandeja vacía!' : `¡${tituloDeMes(mes)} al día!`;
    return (
        <section className="ma-premio vidrio" ref={cajaRef} role="status" aria-label={titulo}>
            <div className="ma-premio-trofeo" aria-hidden="true">
                <svg className="ok" viewBox="0 0 84 84">
                    <circle cx="42" cy="42" r="40" />
                    <path d="M27 43l10 10 20-22" />
                </svg>
                <span className="ma-premio-copa"><Trophy size={20} /></span>
            </div>
            <h2>{titulo}</h2>
            <Chips hoy={hoy} racha={racha} festejo />
            {final ? (
                onVerDatos && (
                    <button type="button" className="btn btn--linea" onClick={onVerDatos}>
                        <BarChart3 size={16} />Ver mis datos
                    </button>
                )
            ) : <Llamado ref={ref} llamado={llamado} />}
        </section>
    );
});

Premio.displayName = 'Premio';

export default Premio;
