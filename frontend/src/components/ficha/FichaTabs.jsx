import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, FileText, History, MessageSquare, PhoneCall, Wallet } from 'lucide-react';
import useMovimiento from './piezas/useMovimiento';

/**
 * Tablist de la ficha: texto con ícono y subrayado.
 *
 * Se probó como control segmentado (píldoras en un riel, como `.tabs` del tablero) y
 * competía por atención con el contenido: con seis pestañas se comía una franja entera
 * del modal. Una línea fina deja el peso visual donde importa, que es la ficha.
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

    // En pantallas angostas el riel scrollea y la activa puede quedar fuera de vista: si la
    // ficha abre en una pestaña que no se ve, parece vacía.
    //
    // Se mueve el riel a mano en vez de `scrollIntoView`: ese desplaza TODOS los ancestros que
    // scrollean, y el modal es uno — al abrir en una pantalla baja se llevaba la cabecera
    // fuera de vista y no se veía de quién era la ficha.
    const riel = useRef(null);
    useEffect(() => {
        const caja = riel.current;
        const tab = refs.current[activa];
        if (!caja || !tab) return;
        const izq = tab.offsetLeft;
        const der = izq + tab.offsetWidth;
        if (izq < caja.scrollLeft) caja.scrollLeft = izq - 12;
        else if (der > caja.scrollLeft + caja.clientWidth) caja.scrollLeft = der - caja.clientWidth + 12;
    }, [activa]);

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
        <div role="tablist" className="fi-tabs" ref={riel}
            aria-label="Secciones de la ficha" onKeyDown={mover}>
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
                        {Icono && <Icono aria-hidden="true" />}
                        {p.label}
                        {/* Fuera del nombre accesible: el número duplica lo que ya se lee
                            dentro del panel, y pegado al rótulo haría que la pestaña se
                            anuncie "Comunicación 3". */}
                        {cuenta > 0 && (
                            <small className="fi-tab-cuenta" aria-hidden="true">{cuenta}</small>
                        )}
                        {/* `layoutId` corre el subrayado de una pestaña a la otra en vez de
                            hacerlo reaparecer del otro lado. */}
                        {on && (
                            <motion.span layoutId="fi-tab-sub" className="fi-tab-sub"
                                aria-hidden="true" {...mov.subrayado} />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default FichaTabs;
