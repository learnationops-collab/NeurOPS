import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, FileText, History, MessageSquare, PhoneCall, Wallet } from 'lucide-react';
import useMovimiento from './piezas/useMovimiento';

/**
 * Tablist de la ficha, como control segmentado.
 *
 * Antes era texto suelto con un subrayado fino —así venía del mockup— y quedaba ajeno
 * al resto del tablero, donde toda pestaña es una píldora dentro de un riel hundido
 * (`.tabs`/`.tab` de comercial.css). Acá se usa el mismo lenguaje.
 *
 * El ícono no es adorno: entre cinco o seis nombres parecidos —Resultado, Historial,
 * Formulario— la forma se reconoce antes que la palabra.
 *
 * Navegable con flechas, Inicio y Fin, como manda un tablist de verdad: con seis
 * pestañas, llegar a la última con Tab es peor que no tener atajo.
 */

const ICONOS = {
    conf: ClipboardCheck,
    resultado: PhoneCall,
    acciones: Wallet,
    hist: History,
    form: FileText,
    com: MessageSquare,
};

const FichaTabs = ({ pestanas = [], activa, onCambiar, contadores = {} }) => {
    const refs = useRef({});
    const mov = useMovimiento();

    const mover = (e) => {
        const i = pestanas.findIndex(p => p.id === activa);
        const teclas = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: pestanas.length - 1 };
        if (!(e.key in teclas)) return;
        e.preventDefault();
        const destino = pestanas[(teclas[e.key] + pestanas.length) % pestanas.length];
        if (!destino) return;
        onCambiar(destino.id);
        refs.current[destino.id]?.focus();
    };

    return (
        <div className="fi-tabs-fila">
            <div role="tablist" className="fi-tabs" aria-label="Secciones de la ficha" onKeyDown={mover}>
                {pestanas.map(p => {
                    const on = p.id === activa;
                    const Icono = ICONOS[p.id];
                    const cuenta = contadores[p.id];
                    return (
                        <button key={p.id} type="button" role="tab" className="fi-tab"
                            id={`fi-tab-${p.id}`}
                            ref={(el) => { refs.current[p.id] = el; }}
                            aria-selected={on}
                            aria-controls={`fi-panel-${p.id}`}
                            tabIndex={on ? 0 : -1}
                            onClick={() => onCambiar(p.id)}>
                            {/* `layoutId` corre la píldora de una pestaña a la otra en vez de
                                hacerla reaparecer del otro lado. */}
                            {on && (
                                <motion.span layoutId="fi-tab-activa" className="fi-tab-fondo"
                                    aria-hidden="true" {...mov.subrayado} />
                            )}
                            <span className="fi-tab-cuerpo">
                                {Icono && <Icono aria-hidden="true" />}
                                {p.label}
                                {/* Fuera del nombre accesible: el numero duplica lo que ya se lee dentro
                                    del panel, y pegado al rotulo haria que la pestaña se anuncie
                                    "Comunicacion 3". */}
                                {cuenta > 0 && (
                                    <small className="fi-tab-cuenta" aria-hidden="true">{cuenta}</small>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default FichaTabs;
