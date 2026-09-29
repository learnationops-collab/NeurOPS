import { useCallback, useEffect, useState } from 'react';

/**
 * Scroll infinito que pagina el DIBUJADO, no la carga de datos.
 *
 * Las filas siguen llegando todas juntas del backend y el filtrado sigue siendo del lado del
 * cliente (ver el docstring de `tablasDef.js`): eso es lo que hace que los contadores de las
 * facetas, el "mostrando X de Y" y la tira de totales cierren sobre el mismo conjunto. Lo único
 * que se hace de a poco es renderizar. Con 515 registros, dibujarlos de una eran ~500 ms en los
 * que la pantalla quedaba dura; con esto entra la primera página y el resto llega al bajar.
 *
 * El reset va por IDENTIDAD del arreglo y no por su largo. `visibles` es un `useMemo`, así que
 * cambia de identidad en cuanto cambia una faceta, un chip o el buscador — que es exactamente
 * cuando hay que volver a la primera página. Compararlo por largo dejaba al usuario mirando 40
 * filas de un filtro nuevo que tenía 3.
 *
 * Se ajusta durante el render y no en un efecto por lo mismo que los filtros de `Revisar`: es el
 * patrón de React para "recalcular estado cuando cambia una entrada", y un efecto habría dibujado
 * un cuadro con la página vieja del filtro nuevo.
 */

export const TAMANO_PAGINA = 40;

/** Sin `IntersectionObserver` (jsdom, navegadores viejos) se dibuja todo: es preferible una
 *  lista lenta a una lista que nunca termina de aparecer porque el sentinel no avisa. */
const HAY_OBSERVER = typeof IntersectionObserver !== 'undefined';

// Un solo arreglo vacío para todos los renders. Con `filas || []` cada render creaba uno nuevo,
// así que `conjunto !== todas` daba true siempre y el reset en fase de render no convergía nunca:
// cualquier consumidor que pasara `filas` en `null` reventaba con "Too many re-renders".
const VACIO = [];

export const usePaginaProgresiva = (filas, tamano = TAMANO_PAGINA) => {
    const todas = filas || VACIO;
    const [cuantas, setCuantas] = useState(tamano);
    const [conjunto, setConjunto] = useState(todas);
    // El pie es una ref de CALLBACK y no una `useRef`, y eso no es un detalle: cambiar la
    // agrupación remonta el árbol entero de la lista (la `key` de su `motion.div` incluye la
    // dimensión), así que el nodo del pie es OTRO. Con una `useRef`, `pie.current` apuntaba al
    // nodo nuevo pero el efecto no se volvía a correr —ninguna de sus dependencias cambia cuando
    // cambia una ref—, y el observador se quedaba mirando un nodo ya desprendido del DOM: el
    // scroll infinito moría para siempre y quedaban 475 clientes inalcanzables. Guardar el nodo
    // en estado hace que el efecto se reenganche cada vez que el nodo cambia.
    const [nodoPie, setNodoPie] = useState(null);
    const pie = useCallback((nodo) => setNodoPie(nodo), []);

    if (conjunto !== todas) {
        setConjunto(todas);
        setCuantas(tamano);
    }

    const hayMas = HAY_OBSERVER && cuantas < todas.length;

    useEffect(() => {
        if (!hayMas || !nodoPie) return undefined;
        // El margen adelanta la página siguiente a que el pie se vea: así el usuario que baja
        // rápido no llega nunca al borde de lo dibujado.
        const observer = new IntersectionObserver(
            (entradas) => { if (entradas.some(e => e.isIntersecting)) setCuantas(c => c + tamano); },
            { rootMargin: '400px 0px' });
        observer.observe(nodoPie);
        return () => observer.disconnect();
        // `cuantas` está en las dependencias a propósito: al crecer la página el pie baja pero
        // puede seguir dentro del margen, y el observador no vuelve a avisar si la intersección
        // no CAMBIA. Recrearlo fuerza la llamada inicial y la lista sigue cargando sola mientras
        // el pie siga a la vista.
    }, [hayMas, tamano, cuantas, nodoPie]);

    return {
        pagina: hayMas ? todas.slice(0, cuantas) : todas,
        hayMas,
        pie,
        /** Cuántas filas ya estaban: el escalonado de la entrada se cuenta DENTRO de la página
         *  que llega, no sobre el índice global, o la fila 500 entraría 20 segundos después. */
        dibujadas: todas.length ? cuantas - tamano : 0,
        tamano,
    };
};

export default usePaginaProgresiva;
