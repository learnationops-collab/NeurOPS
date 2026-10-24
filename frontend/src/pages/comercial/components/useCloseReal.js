import { useEffect, useMemo, useState } from 'react';
import { getComparativasReales } from '../comercialApi';

const KEY_REAL = 'close_rate_real';

/**
 * El close rate real de cada closer, pedido aparte (rastrea cada cobro hasta su llamada y no se
 * paga en cada carga de Comparativas). Solo se pide cuando alguien lo mira: es la lectura del
 * close rate que eligió en el desplegable.
 *
 * Devuelve los `datos` con el valor ya pegado en cada fila y en el equipo, y si está cargando.
 * Cambiar el período (o la comparación) descarta lo cargado.
 */
export const useCloseReal = (datos, filtros, config) => {
    const [cargado, setCargado] = useState({ clave: null, reales: null });
    const [fallo, setFallo] = useState(false);

    const tiene = datos?.metricas?.some(m => m.key === KEY_REAL);
    const activo = Boolean(tiene && config.cierre === KEY_REAL);

    // El período del que son los datos: si cambia, lo cargado ya no sirve.
    const clave = datos?.dates ? JSON.stringify(datos.dates) : null;

    useEffect(() => {
        if (!activo || !clave || cargado.clave === clave) return undefined;
        let vigente = true;
        setFallo(false);
        getComparativasReales(filtros)
            .then(reales => { if (vigente) setCargado({ clave, reales }); })
            .catch(() => { if (vigente) setFallo(true); });
        return () => { vigente = false; };
    }, [activo, clave]); // eslint-disable-line react-hooks/exhaustive-deps

    const reales = cargado.clave === clave ? cargado.reales : null;
    const conReales = useMemo(() => {
        if (!datos || !reales) return datos;
        const pegar = (fila, r) => (r ? {
            ...fila,
            [KEY_REAL]: r[KEY_REAL],
            real_detalle: `${r.cierres_reales ?? 0} de ${r.base_real ?? 0}`,
            deltas: { ...(fila.deltas || {}), ...(r.deltas || {}) },
        } : fila);
        return {
            ...datos,
            filas: datos.filas.map(f => pegar(f, reales.filas?.[f.id])),
            equipo: pegar(datos.equipo, reales.equipo),
        };
    }, [datos, reales]);

    return { datos: conReales, cargando: activo && !reales && !fallo, fallo: activo && fallo };
};
