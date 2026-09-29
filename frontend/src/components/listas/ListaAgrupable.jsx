import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { agruparPor } from './agruparPor';
import { usePaginaProgresiva } from './usePaginaProgresiva';
import './listas.css';

/**
 * La misma lista, repartida en grupos colapsables con el subtotal de cada uno en su encabezado.
 *
 * No sabe dibujar una fila: `renderFilas(filas, desde)` lo hace quien la usa, así que la tabla y la
 * vista de tarjetas comparten el agrupamiento sin que este componente conozca ninguna de las dos. La
 * agrupación es `agruparPor`, que es pura y tiene sus propios tests.
 *
 * ## Los grupos arrancan cerrados
 *
 * Agrupar es para ELEGIR qué parte de la lista mirar, no para leerla entera repartida. Lo pidió así
 * el usuario el 29/sep/2026: "al agrupar aparezcan colapsados … de manera de que el closer o el
 * administrador comercial pueda abrir la pestaña que desea revisar … y no tiene que minimizar todos
 * para poder elegir cuál ver". Con los grupos abiertos, agrupar por closer con 13 closers era la
 * misma lista de 515 filas con 13 separadores: para llegar al grupo que se buscaba había que cerrar
 * los otros doce. Cerrados, la lista es un índice —nombre, cantidad y subtotal de cada grupo— y un
 * click abre el que interesa.
 *
 * La excepción es el grupo ÚNICO: si hay uno solo no hay nada que elegir, y mostrarlo cerrado sería
 * un click de más para ver la lista entera. Es un valor por defecto, no una regla: el usuario lo
 * puede cerrar, y si un filtro después deja más grupos, ese vuelve a cerrado como los demás.
 *
 * Lo que el usuario abre o cierra a mano se recuerda POR CLAVE de grupo mientras no cambie la
 * dimensión: cambiar un filtro o la búsqueda rearma los grupos, pero el que estaba abierto sigue
 * abierto. Cambiar de dimensión vuelve todo a cerrado, porque las claves de "por closer" no
 * significan nada en "por fuente".
 *
 * ## Los subtotales cierran con la lista
 *
 * Cada encabezado muestra la cantidad y, cuando las filas tienen monto, la suma de esa dimensión.
 * Suman exactamente el total de la tira de arriba porque las dos cifras se calculan sobre el mismo
 * arreglo de filas visibles: es la misma razón por la que el filtrado de esta pantalla es del lado
 * del cliente.
 *
 * Por eso `filas` son TODAS las filtradas, y los subtotales se calculan sobre el grupo entero
 * aunque el grupo esté cerrado o dibuje de a tandas. Calcularlos sobre lo dibujado hacía que la tira
 * dijera «515 clientes · $143.788 por cobrar» y los encabezados sumaran 40 registros y $60.225:
 * números por persona lisa y llanamente falsos. Con todo cerrado no se dibuja ninguna fila, y los
 * encabezados tienen que seguir cerrando igual.
 *
 * ## Cada grupo abierto pagina sus propias filas
 *
 * Con `renderPie`, el cuerpo de cada grupo abierto dibuja de a tandas con su propio
 * `usePaginaProgresiva` y su propio pie, y `renderFilas` recibe en `desde` cuántas filas del grupo
 * ya estaban, para que el escalonado de la entrada se cuente dentro de la tanda que llega. Paginar
 * la lista entera y recortar cada grupo —como se hacía cuando arrancaban abiertos— no sirve con
 * los grupos cerrados: el pie global quedaba a la vista debajo de los encabezados, cargaba todas las
 * páginas sin dibujar nada, y al abrir un grupo aparecían sus 200 filas de golpe. Así, abrir un
 * grupo es como entrar a una lista corta: entran las primeras filas una por una y el resto llega al
 * bajar. Sin `renderPie` el grupo se dibuja entero: no hay un pie con alto que el
 * `IntersectionObserver` pueda ver.
 *
 * `filas` tiene que ser estable entre renders (un `useMemo`): los grupos se memorizan sobre ella, y
 * un grupo cuyas filas cambian de identidad vuelve a su primera tanda.
 *
 * ## El movimiento al abrir
 *
 * El cuerpo del grupo entra desplazándose, la flecha gira y las filas entran escalonadas. Sin
 * `AnimatePresence` a propósito: el grupo cerrado se desmonta y el fundido de salida no se extraña,
 * mientras que en esta versión de framer-motion `AnimatePresence` dejó overlays sin desmontar dentro
 * del mazo del closer —que es donde esta lista se monta embebida— y la única salida era recargar la
 * página. `useReducedMotion` apaga el movimiento sin apagar el colapso.
 */

/* El cuerpo de un grupo abierto. Es un componente aparte y declarado en el módulo porque cada grupo
   necesita SU `usePaginaProgresiva` (un hook no se puede llamar dentro de un `map`), y porque un
   componente declarado dentro de otro es un tipo nuevo en cada render: React desmontaría el cuerpo
   —y con él la página cargada— cada vez que se abre o cierra otro grupo. Se monta al abrir y se
   desmonta al cerrar, así que reabrir un grupo vuelve a su primera tanda y las filas entran de nuevo. */
const CuerpoGrupo = ({ filas, renderFilas, renderPie }) => {
    const { pagina, hayMas, pie, dibujadas } = usePaginaProgresiva(filas);
    if (!renderPie) return renderFilas(filas, 0);
    return (
        <>
            {renderFilas(pagina, dibujadas)}
            {hayMas && <div ref={pie} aria-hidden="true">{renderPie()}</div>}
        </>
    );
};

const ListaAgrupable = ({ filas, dimension, renderFilas, renderPie, formatoMonto }) => {
    // Lo que el usuario eligió a mano, clave del grupo → abierto. Lo que no está acá toma el valor
    // por defecto (cerrado, salvo el grupo único). Se vacía al cambiar de dimensión, ajustando el
    // estado durante el render —el patrón de React para "recalcular estado cuando cambia una
    // entrada"— y no en un efecto, que habría dibujado un cuadro con los grupos abiertos de la
    // dimensión anterior. Se compara la `key` y no el objeto: una dimensión armada en línea cambia
    // de identidad en cada render y el reinicio no convergería.
    const claveDimension = dimension?.key;
    const [deDimension, setDeDimension] = useState(claveDimension);
    const [elegidos, setElegidos] = useState(() => new Map());
    if (deDimension !== claveDimension) {
        setDeDimension(claveDimension);
        setElegidos(new Map());
    }
    const quieto = useReducedMotion();

    // Memorizados: cada grupo abierto pagina su arreglo `filas` por identidad, y recalcularlos en
    // cada render lo devolvería a la primera tanda cada vez que se abre o cierra OTRO grupo.
    const grupos = useMemo(() => agruparPor(filas, dimension), [filas, dimension]);
    const porDefecto = grupos.length === 1;
    const estaAbierto = (clave) => (elegidos.has(clave) ? elegidos.get(clave) : porDefecto);

    const alternar = (clave) => setElegidos(previos => {
        const siguiente = new Map(previos);
        siguiente.set(clave, !(previos.has(clave) ? previos.get(clave) : porDefecto));
        return siguiente;
    });

    return (
        <div className="tabla">
            {grupos.map(grupo => {
                const abierto = estaAbierto(grupo.clave);
                const idCuerpo = `grupo-${claveDimension}-${grupo.clave}`.replace(/\s+/g, '-');
                return (
                    <div key={grupo.clave} className="grupo">
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
                                <CuerpoGrupo filas={grupo.filas} renderFilas={renderFilas}
                                    renderPie={renderPie} />
                            </motion.div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ListaAgrupable;
