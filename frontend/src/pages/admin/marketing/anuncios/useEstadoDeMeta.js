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
 *     además, no repite si se sincronizó hace menos de 3);
 *   · sola cada CADA_MIN minutos mientras la pestaña esté a la vista (23/10/2026: las campañas que se
 *     pausan o se prenden en Meta no esperaban a que alguien volviera de allá).
 * Las corridas solas no avisan salvo que algo haya cambiado; si fallan, `fallo` lo dice (la tabla lo muestra). `onActualizado(resumen)` recarga lo que
 * se esté mirando.
 */
const VIEJA_MIN = 15;
const CADA_MIN = 5;

const esVieja = (iso) => !iso || Date.now() - new Date(`${iso}Z`).getTime() > VIEJA_MIN * 60000;

export const useEstadoDeMeta = ({ meta, onActualizado }) => {
    const activo = !!meta?.conectado && !meta?.muestra;
    const [actualizando, setActualizando] = useState(false);
    const [fallo, setFallo] = useState(null);
    const enCurso = useRef(false);
    const avisar = useRef(onActualizado);
    useEffect(() => { avisar.current = onActualizado; }, [onActualizado]);

    const actualizar = useCallback(async ({ forzar = false, silencioso = false } = {}) => {
        if (enCurso.current) return null;
        enCurso.current = true;
        setActualizando(true);
        try {
            const r = await sincronizarEstadoMeta(forzar);
            setFallo(null);
            if (!r || r.omitido) return r;
            if (r.cambios) {
                toast.success(`Meta: ${r.cambios} ${r.cambios === 1 ? 'anuncio cambió' : 'anuncios cambiaron'} (nombre, estado o grupo).`);
            } else if (!silencioso) {
                toast.success('Al día con Meta: sin cambios de nombre ni de estado.');
            }
            avisar.current?.(r);
            return r;
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No se pudo actualizar desde Meta.');
            setFallo(mensaje);
            if (!silencioso) toast.error(mensaje);
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

    // Mientras se mira la pantalla, el estado de las campañas se refresca solo.
    useEffect(() => {
        if (!activo) return undefined;
        const id = setInterval(() => {
            if (document.visibilityState !== 'hidden') actualizar({ silencioso: true });
        }, CADA_MIN * 60000);
        return () => clearInterval(id);
    }, [activo, actualizar]);

    useVueltaDeMeta(() => actualizar({ forzar: true, silencioso: true }), { activo });

    return { activo, actualizar, actualizando, fallo };
};

export default useEstadoDeMeta;
