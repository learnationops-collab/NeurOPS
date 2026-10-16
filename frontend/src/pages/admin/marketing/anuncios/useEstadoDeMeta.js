import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useVueltaDeMeta } from './enlacesMeta';
import { mensajeDeError, sincronizarEstadoMeta } from './marketingApi';

/**
 * Que lo que se cambia en Meta se vea acá (Kerwin, 16/10/2026): la sincronización liviana
 * (`POST /marketing/anuncios/meta/estado`: nombres, estados, campaña, conjunto y el gasto de los
 * últimos días, sin tocar lo clasificado a mano) corre
 *   · con el botón «Actualizar» (`actualizar({ forzar: true })`);
 *   · sola al volver a la pestaña después de haber abierto Meta desde la página (`useVueltaDeMeta`,
 *     a lo sumo una vez por minuto);
 *   · sola al abrir Marketing si lo último que se trajo tiene más de VIEJA_MIN minutos (el servidor,
 *     además, no repite si se sincronizó hace menos de 3).
 * Las corridas solas no avisan salvo que algo haya cambiado. `onActualizado(resumen)` recarga lo que
 * se esté mirando.
 */
const VIEJA_MIN = 15;

const esVieja = (iso) => !iso || Date.now() - new Date(`${iso}Z`).getTime() > VIEJA_MIN * 60000;

export const useEstadoDeMeta = ({ meta, onActualizado }) => {
    const activo = !!meta?.conectado && !meta?.muestra;
    const [actualizando, setActualizando] = useState(false);
    const enCurso = useRef(false);
    const avisar = useRef(onActualizado);
    useEffect(() => { avisar.current = onActualizado; }, [onActualizado]);

    const actualizar = useCallback(async ({ forzar = false, silencioso = false } = {}) => {
        if (enCurso.current) return null;
        enCurso.current = true;
        setActualizando(true);
        try {
            const r = await sincronizarEstadoMeta(forzar);
            if (!r || r.omitido) return r;
            if (r.cambios) {
                toast.success(`Meta: ${r.cambios} ${r.cambios === 1 ? 'anuncio cambió' : 'anuncios cambiaron'} (nombre, estado o grupo).`);
            } else if (!silencioso) {
                toast.success('Al día con Meta: sin cambios de nombre ni de estado.');
            }
            avisar.current?.(r);
            return r;
        } catch (e) {
            if (!silencioso) toast.error(mensajeDeError(e, 'No se pudo actualizar desde Meta.'));
            return null;
        } finally {
            enCurso.current = false;
            setActualizando(false);
        }
    }, []);

    const revisado = useRef(false);
    useEffect(() => {
        if (!activo || revisado.current) return;
        revisado.current = true;
        if (esVieja(meta?.ultima_sincronizacion)) actualizar({ silencioso: true });
    }, [activo, meta?.ultima_sincronizacion, actualizar]);

    useVueltaDeMeta(() => actualizar({ forzar: true, silencioso: true }), { activo });

    return { activo, actualizar, actualizando };
};

export default useEstadoDeMeta;
