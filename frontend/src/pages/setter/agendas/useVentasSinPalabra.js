import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { agregarAnuncio } from './BuscadorAnuncio';

/**
 * Las ventas de los leads del setter y su palabra clave (`ventas_palabra_clave_service`). Lo comparten
 * «Pendientes» (las que faltan) y «Completadas» (las que ya la tienen) de Mis agendas, para que asignar
 * una la pase de una lista a la otra sin pedir de nuevo.
 */
export const useVentasSinPalabra = (anunciosIniciales) => {
    const [datos, setDatos] = useState(null);
    // Los anuncios que se crean al escribir una palabra clave nueva se suman a los de la bandeja.
    const [creados, setCreados] = useState([]);
    const anuncios = useMemo(() => creados.reduce(agregarAnuncio, anunciosIniciales || []), [creados, anunciosIniciales]);

    const cargar = useCallback(async () => {
        try {
            const res = await api.get('/setter/palabras-clave/ventas');
            // Solo con la forma de esta respuesta (un backend viejo, o un mock, no la tiene): si no, nada.
            if (Array.isArray(res.data?.pendientes) && Array.isArray(res.data?.completadas) && res.data?.resumen) {
                setDatos(res.data);
            }
        } catch {
            setDatos((d) => d || { pendientes: [], completadas: [], resumen: { clientes: 0, monto: 0 }, error: true });
        }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    /** {ok, aviso, siguiente (el grupo que sigue, para enfocarlo)} o {error}. */
    const asignar = async (grupo, anuncio, instagram) => {
        try {
            const res = await api.post('/setter/palabras-clave/ventas', {
                grupo: grupo.grupo,
                ...(anuncio.id ? { ad_id: anuncio.id } : { palabra_clave: anuncio.keyword }),
                ...(instagram !== undefined ? { instagram } : {}),
            });
            const palabra = res.data?.anuncio?.keyword || anuncio.keyword;
            if (!anuncio.id && res.data?.anuncio) setCreados((c) => [...c, res.data.anuncio]);
            const hecho = {
                ...grupo, instagram: res.data?.instagram || grupo.instagram, palabras: [palabra], elegida: true,
                pagos: grupo.pagos.map((p) => ({ ...p, palabra_clave: palabra })),
            };
            const lista = datos.pendientes;
            const i = lista.findIndex((g) => g.grupo === grupo.grupo);
            if (i < 0) {
                // Un cambio: el cliente queda donde estaba, con la palabra clave nueva.
                setDatos((d) => ({ ...d, completadas: d.completadas.map((g) => (g.grupo === grupo.grupo ? hecho : g)) }));
                return { ok: true, cambio: true, aviso: `Ahora las ventas de ${grupo.cliente} van a ${palabra}.` };
            }
            const siguiente = lista[i + 1] || lista[i - 1] || null;
            const sinPalabra = grupo.pagos.filter((p) => !p.palabra_clave).reduce((s, p) => s + p.monto, 0);
            setDatos((d) => ({
                ...d,
                pendientes: d.pendientes.filter((g) => g.grupo !== grupo.grupo),
                completadas: [hecho, ...d.completadas.filter((g) => g.grupo !== grupo.grupo)],
                resumen: { clientes: d.resumen.clientes - 1, monto: Math.max(0, d.resumen.monto - sinPalabra) },
            }));
            const quedan = lista.length - 1;
            return {
                ok: true,
                aviso: `${palabra} quedó en las ventas de ${grupo.cliente}. ${quedan ? `Te ${quedan === 1 ? 'queda' : 'quedan'} ${quedan}.` : 'No queda ninguna.'}`,
                siguiente: siguiente?.grupo || null,
            };
        } catch (err) {
            return { error: err?.response?.data?.error || 'No se pudo asignar: probá de nuevo.' };
        }
    };

    /** El cliente es del workshop, no de un DM: sus pagos dejan de ser de Setting y salen de las dos listas. */
    const pasarAWorkshop = async (grupo) => {
        try {
            await api.post('/setter/palabras-clave/ventas/workshop', { grupo: grupo.grupo });
            setDatos((d) => ({
                ...d,
                pendientes: d.pendientes.filter((g) => g.grupo !== grupo.grupo),
                completadas: d.completadas.filter((g) => g.grupo !== grupo.grupo),
                resumen: { ...d.resumen, clientes: Math.max(0, d.resumen.clientes - (d.pendientes.some((g) => g.grupo === grupo.grupo) ? 1 : 0)) },
            }));
            return { ok: true, aviso: `${grupo.cliente} pasó a Workshop.` };
        } catch (err) {
            return { error: err?.response?.data?.error || 'No se pudo pasar a Workshop: probá de nuevo.' };
        }
    };

    return { datos, anuncios, asignar, pasarAWorkshop, faltan: datos?.pendientes?.length ?? 0 };
};

export default useVentasSinPalabra;
