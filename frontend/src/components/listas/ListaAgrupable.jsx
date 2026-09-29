import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { agruparPor } from './agruparPor';
import './listas.css';

/**
 * La misma lista, repartida en grupos colapsables con el subtotal de cada uno en su encabezado.
 *
 * No sabe dibujar una fila: `renderFilas(filas)` lo hace quien la usa, así que la tabla y la vista
 * de tarjetas comparten el agrupamiento sin que este componente conozca ninguna de las dos. La
 * agrupación es `agruparPor`, que es pura y tiene sus propios tests.
 *
 * ## Los grupos arrancan abiertos
 *
 * Porque agrupar es para leer la lista repartida, no para esconderla: si arrancaran cerrados, el
 * primer efecto de activar la agrupación sería que la lista desaparece. Colapsar es el gesto de
 * dejar de mirar un grupo, no el estado inicial.
 *
 * ## Los subtotales cierran con la lista
 *
 * Cada encabezado muestra la cantidad y, cuando las filas tienen monto, la suma de esa dimensión.
 * Suman exactamente el total de la tira de arriba porque las dos cifras se calculan sobre el mismo
 * arreglo de filas visibles: es la misma razón por la que el filtrado de esta pantalla es del lado
 * del cliente.
 *
 * Por eso `filas` son TODAS las filtradas, aunque la lista dibuje de a tandas. `enPagina` —el
 * conjunto de las que ya se dibujaron— recorta sólo lo que se RENDERIZA dentro de cada grupo; los
 * subtotales se siguen calculando sobre el grupo entero. Pasarle el prefijo dibujado en su lugar
 * hacía que la tira dijera «515 clientes · $143.788 por cobrar» y los encabezados sumaran 40
 * registros y $60.225: números por persona lisa y llanamente falsos.
 *
 * ## El movimiento al abrir
 *
 * El cuerpo del grupo entra desplazándose, y la flecha gira. Sin `AnimatePresence` a
 * propósito: el grupo cerrado se desmonta y el fundido de salida no se extraña, mientras que en
 * esta versión de framer-motion `AnimatePresence` dejó overlays sin desmontar dentro del mazo del
 * closer —que es donde esta lista se monta embebida— y la única salida era recargar la página.
 * `useReducedMotion` apaga el movimiento sin apagar el colapso.
 */
const ListaAgrupable = ({ filas, dimension, renderFilas, formatoMonto, colapsadoInicial = [],
    enPagina = null }) => {
    const [cerrados, setCerrados] = useState(() => new Set(colapsadoInicial));
    const quieto = useReducedMotion();

    const grupos = agruparPor(filas, dimension);
    // Sin paginado se dibuja el grupo entero; con paginado, sólo lo que ya entró.
    const aDibujar = (grupo) => (enPagina ? grupo.filas.filter(f => enPagina.has(f)) : grupo.filas);

    const alternar = (clave) => setCerrados(previos => {
        const siguiente = new Set(previos);
        if (siguiente.has(clave)) siguiente.delete(clave);
        else siguiente.add(clave);
        return siguiente;
    });

    return (
        <div className="tabla">
            {grupos.map(grupo => {
                const abierto = !cerrados.has(grupo.clave);
                const idCuerpo = `grupo-${dimension.key}-${grupo.clave}`.replace(/\s+/g, '-');
                return (
                    <div key={grupo.clave}>
                        <button type="button" className="grupo-cab" aria-expanded={abierto}
                            aria-controls={idCuerpo}
                            onClick={() => alternar(grupo.clave)}>
                            <motion.span className="grupo-flecha" aria-hidden="true"
                                animate={{ rotate: abierto ? 0 : -90 }}
                                transition={quieto ? { duration: 0 } : { duration: .2 }}>
                                <ChevronDown size={15} />
                            </motion.span>
                            <span className="grupo-nombre">{grupo.label}</span>
                            <span className="grupo-sub">
                                <span>{grupo.cantidad === 1 ? '1 registro' : `${grupo.cantidad} registros`}</span>
                                {grupo.tieneMonto && <b>{formatoMonto(grupo.monto)}</b>}
                                {grupo.tieneDeuda && grupo.deuda > 0.01 && (
                                    <b style={{ color: 'var(--error)' }}>
                                        {formatoMonto(grupo.deuda)} por cobrar
                                    </b>
                                )}
                            </span>
                        </button>
                        {/* Se anima la opacidad y el desplazamiento, NO el alto: animar el alto
                            obliga a `overflow: hidden`, que queda puesto cuando la animación
                            termina y recorta el levantado de las tarjetas al pasarles el mouse. */}
                        {abierto && (
                            <motion.div className="grupo-cuerpo" id={idCuerpo}
                                initial={quieto ? false : { opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={quieto ? { duration: 0 } : { duration: .22, ease: 'easeOut' }}>
                                {renderFilas(aDibujar(grupo))}
                            </motion.div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ListaAgrupable;
