import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import api from '../../../services/api';
import { Tip } from '../../comercial/components/Shared';
import TarjetaVenta, { dinero } from './TarjetaVenta';
import { agregarAnuncio } from './BuscadorAnuncio';

/**
 * «Tus ventas sin palabra clave», debajo de las agendas en «Mis agendas» (Kerwin, 17/10/2026: «esas
 * ventas deben aparecer en los setters para que ellos decidan de qué palabra clave vino cada una,
 * agrupado por cliente»). Un cliente por tarjeta: la palabra clave va a TODOS sus pagos y Marketing
 * los suma a ese anuncio (`ventas_palabra_clave_service`). Al asignar, la tarjeta se va y el foco
 * pasa a la siguiente, como con las agendas. Las que ya tienen palabra clave, plegadas abajo.
 */
const VentasSinPalabra = ({ anuncios: anunciosIniciales }) => {
    const [datos, setDatos] = useState(null);
    // Los anuncios que se crean al escribir una palabra clave nueva se suman a los de la bandeja.
    const [creados, setCreados] = useState([]);
    const anuncios = useMemo(() => creados.reduce(agregarAnuncio, anunciosIniciales || []), [creados, anunciosIniciales]);
    const [verHechas, setVerHechas] = useState(false);
    // El cliente con palabra clave que se está cambiando (18/10/2026: «debería haber forma de cambiarla
    // si es incorrecta»): se abre su tarjeta en la lista de abajo.
    const [cambiando, setCambiando] = useState(null);
    const cambioRef = useRef(null);
    // Al abrir el cambio, el foco va a su buscador: se escribe la palabra clave nueva y Enter.
    useEffect(() => { if (cambiando) cambioRef.current?.focus(); }, [cambiando]);
    const [aviso, setAviso] = useState('');
    const tarjetas = useRef(new Map());

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
                setCambiando(null);
                setAviso(`Ahora las ventas de ${grupo.cliente} van a ${palabra}.`);
                return { ok: true };
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
            setAviso(`${palabra} quedó en las ventas de ${grupo.cliente}. ${quedan ? `Te ${quedan === 1 ? 'queda' : 'quedan'} ${quedan}.` : 'No queda ninguna.'}`);
            if (siguiente) requestAnimationFrame(() => tarjetas.current.get(siguiente.grupo)?.focus());
            return { ok: true };
        } catch (err) {
            return { error: err?.response?.data?.error || 'No se pudo asignar: probá de nuevo.' };
        }
    };

    if (!datos) return null;
    const { pendientes, completadas, resumen } = datos;
    if (!pendientes.length && !completadas.length) return null;

    return (
        <section className="mv-ventas" aria-labelledby="mv-titulo">
            <div className="mv-cab">
                <h2 id="mv-titulo" className="ma-mes-titulo">
                    Ventas sin palabra clave <span className="num">· {pendientes.length}</span>
                </h2>
                <Tip titulo="Ventas sin palabra clave"
                    texto="Ventas de tus leads que Marketing no sabe de qué anuncio vinieron." />
                {resumen.monto > 0 && <span className="mv-monto num">{dinero(resumen.monto)} sin anuncio</span>}
            </div>
            <span className="sr" aria-live="polite">{aviso}</span>

            {pendientes.length > 0 ? (
                <ul className="ma-lista">
                    <AnimatePresence initial={false}>
                        {pendientes.map((g, i) => (
                            <TarjetaVenta key={g.grupo} grupo={g} orden={i} anuncios={anuncios} onAsignar={asignar}
                                ref={(el) => { if (el) tarjetas.current.set(g.grupo, el); else tarjetas.current.delete(g.grupo); }} />
                        ))}
                    </AnimatePresence>
                </ul>
            ) : (
                <p className="mv-vacio"><Check size={16} aria-hidden="true" />Todas tus ventas tienen su palabra clave.</p>
            )}

            {completadas.length > 0 && (
                <div className="mv-hechas">
                    <button type="button" className="mv-hechas-btn" aria-expanded={verHechas}
                        onClick={() => setVerHechas((v) => !v)}>
                        <ChevronDown size={15} aria-hidden="true" className={verHechas ? 'mv-girada' : undefined} />
                        {`${completadas.length} ${completadas.length === 1 ? 'cliente' : 'clientes'} con palabra clave`}
                    </button>
                    {verHechas && (
                        <ul className="mv-hechas-lista">
                            {completadas.map((g) => (cambiando === g.grupo ? (
                                <TarjetaVenta key={g.grupo} grupo={g} anuncios={anuncios} onAsignar={asignar}
                                    onCancelar={() => setCambiando(null)} ref={cambioRef} />
                            ) : (
                                <li key={g.grupo} className="mv-hecha">
                                    <span className="trunc">{g.cliente}</span>
                                    <span className="num">{dinero(g.total)}</span>
                                    <small className="mv-con trunc" title={g.elegida ? 'La elegiste vos' : 'La encontró ManyChat'}>
                                        {g.palabras.join(' · ')}
                                    </small>
                                    {g.cambiable && (
                                        <button type="button" className="ma-ig-cambiar" onClick={() => setCambiando(g.grupo)}
                                            aria-label={`Cambiar la palabra clave de ${g.cliente}`}>
                                            Cambiar
                                        </button>
                                    )}
                                </li>
                            )))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
};

export default VentasSinPalabra;
