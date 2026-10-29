import { useCallback, useMemo } from 'react';
import { useEstadoGuardado } from '../../../../hooks/useEstadoGuardado';
import { NIVELES, claveDeAnuncio, claveDeCampana, claveDeConjunto } from './metricas';

/**
 * Los filtros de la tabla de Rendimiento, recordados por usuario (norma del 28/10/2026, `useEstadoGuardado`):
 * búsqueda, archivadas, «solo con gasto», «solo activas», orden, nivel y las filas elegidas de cada nivel.
 * Se guardan las elegidas como listas y se devuelven como `Set`; las que ya no existen en el período
 * (otro rango, una palabra archivada) se descartan al devolverlas, para que no filtren en silencio.
 */
const CLAVE = 'mk_rendimiento_filtros';
const NIVELES_VALIDOS = NIVELES.map((n) => n.key);
const ORDEN_INICIAL = { clave: 'entrantes', dir: 'desc' };
const INICIAL = {
    busqueda: '', verArchivados: false, soloConGasto: false, soloActivas: false, orden: ORDEN_INICIAL,
    nivel: 'anuncios', elegidas: { campanas: [], conjuntos: [], anuncios: [] },
};

const textos = (v) => (Array.isArray(v) ? v.filter((k) => typeof k === 'string') : []);

const normalizar = (m) => ({
    busqueda: typeof m.busqueda === 'string' ? m.busqueda : '',
    verArchivados: m.verArchivados === true,
    soloConGasto: m.soloConGasto === true,
    soloActivas: m.soloActivas === true,
    orden: m.orden && typeof m.orden.clave === 'string' && ['asc', 'desc'].includes(m.orden.dir) ? m.orden : ORDEN_INICIAL,
    nivel: NIVELES_VALIDOS.includes(m.nivel) ? m.nivel : INICIAL.nivel,
    elegidas: { campanas: textos(m.elegidas?.campanas), conjuntos: textos(m.elegidas?.conjuntos), anuncios: textos(m.elegidas?.anuncios) },
});
const OPCIONES = { normalizar };

/** `filas`: las palabras clave del período; con ellas se descartan las elegidas que ya no existen. */
export const useFiltrosTabla = (filas) => {
    const [f, poner] = useEstadoGuardado(CLAVE, INICIAL, OPCIONES);

    const elegidas = useMemo(() => {
        const campanas = new Set(); const conjuntos = new Set(); const anuncios = new Set();
        filas.forEach((x) => {
            campanas.add(claveDeCampana(x.campana));
            conjuntos.add(claveDeConjunto(x.campana, x.conjunto));
            anuncios.add(claveDeAnuncio(x));
        });
        const vivas = (guardadas, todas) => new Set(guardadas.filter((k) => todas.has(k)));
        return {
            campanas: vivas(f.elegidas.campanas, campanas), conjuntos: vivas(f.elegidas.conjuntos, conjuntos),
            anuncios: vivas(f.elegidas.anuncios, anuncios),
        };
    }, [filas, f.elegidas]);

    // Mismo contrato que el `useState` de antes: valor o función de lo anterior.
    const set = useMemo(() => Object.fromEntries(['busqueda', 'verArchivados', 'soloConGasto', 'soloActivas', 'orden', 'nivel']
        .map((nombre) => [nombre, (v) => poner((prev) => ({ [nombre]: typeof v === 'function' ? v(prev[nombre]) : v }))])), [poner]);
    const setElegidas = useCallback((v) => poner((prev) => {
        const actual = { campanas: new Set(prev.elegidas.campanas), conjuntos: new Set(prev.elegidas.conjuntos), anuncios: new Set(prev.elegidas.anuncios) };
        const nuevo = typeof v === 'function' ? v(actual) : v;
        return { elegidas: { campanas: [...nuevo.campanas], conjuntos: [...nuevo.conjuntos], anuncios: [...nuevo.anuncios] } };
    }), [poner]);

    return {
        busqueda: f.busqueda, setBusqueda: set.busqueda,
        verArchivados: f.verArchivados, setVerArchivados: set.verArchivados,
        soloConGasto: f.soloConGasto, setSoloConGasto: set.soloConGasto,
        soloActivas: f.soloActivas, setSoloActivas: set.soloActivas,
        orden: f.orden, setOrden: set.orden,
        nivel: f.nivel, setNivel: set.nivel,
        elegidas, setElegidas,
    };
};

export default useFiltrosTabla;
