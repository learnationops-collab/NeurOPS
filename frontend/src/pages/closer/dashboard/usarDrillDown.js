import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * De un dato del dashboard de performance a la lista que lo compone.
 *
 * La lista ya existe: es la sección Revisar del dashboard comercial, que carga las agendas, las
 * ventas y la cartera del período y las acota a la persona que corresponde (el backend decide el
 * alcance a partir de la sesión, ver `alcance_de` en app/api/comercial.py). Acá no se pide ningún
 * endpoint nuevo: se navega a esa pantalla con el filtro en la query string.
 *
 * El filtro viaja por la URL y no por estado porque este dashboard es OTRA pantalla, en otra ruta:
 * es el mismo mecanismo que arregló la pérdida del filtro entre los dos montajes embebidos.
 *
 * Devuelve `null` cuando esta persona no tiene a dónde ir —no hay una ruta del dashboard comercial
 * para su rol— y entonces los datos simplemente no se hacen cliqueables, en vez de ofrecer un
 * botón que lleva a un 403.
 */

/** Dónde vive el dashboard comercial para cada rol (ver las rutas en App.jsx). */
const RUTA_COMERCIAL = {
    closer: '/closer/mis-datos',
    admin: '/admin/comercial',
    director_comercial: '/admin/comercial',
};

const AVISO_RANGO_LIBRE = 'El rango libre de este dashboard no viaja a la lista: la lista se abre '
    + 'con el mes en curso. Volvé a elegir el rango allá si hace falta.';

export const usarDrillDown = ({ period, closerId }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const ruta = RUTA_COMERCIAL[user?.role] || null;

    /**
     * `opciones.miembroId` pisa la persona del filtro de arriba. Lo necesita el ranking del
     * equipo, donde cada fila es otro closer y el selector sigue en "todos".
     */
    return useCallback((tabla, filtro, opciones = {}) => {
        if (!ruta) return;
        const notas = [filtro?.__aviso, period === 'custom' ? AVISO_RANGO_LIBRE : null]
            .filter(Boolean);
        // Mismo payload que el drill-down interno del dashboard comercial: las condiciones más los
        // metadatos `__` que la lista usa para decir de dónde vino el filtro.
        const carga = Object.fromEntries(
            Object.entries({ ...filtro, __aviso: notas.join(' ') || null })
                .filter(([, v]) => v !== null && v !== undefined));

        const q = new URLSearchParams({ s: 'revisar', rol: 'closers', t: tabla, ft: '1' });
        // El período tiene los mismos ids en las dos pantallas a propósito (`PERIODOS` en
        // comercial.py sale del mismo `_range_for_period`), así que viaja tal cual. El rango libre
        // es la excepción: allá no hay selector de fechas, así que cae al mes en curso y se avisa.
        if (period && period !== 'custom') q.set('p', period);
        const miembro = opciones.miembroId ?? closerId;
        if (miembro && miembro !== 'all') q.set('m', String(miembro));
        if (Object.keys(carga).length) q.set('f', JSON.stringify(carga));

        navigate(`${ruta}?${q.toString()}`);
    }, [navigate, ruta, period, closerId]);
};

/** ¿Hay a dónde llevar para esta persona? Lo usan las tarjetas para no pintar botones inertes. */
export const hayListaComercial = (rol) => Boolean(RUTA_COMERCIAL[rol]);

export default usarDrillDown;
