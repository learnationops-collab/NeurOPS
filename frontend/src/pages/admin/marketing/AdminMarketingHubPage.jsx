import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { Isotipo, PillMenu, Segmented } from '../../comercial/components/Shared';
import RangoFechas, { esFecha, textoRango } from '../../comercial/components/RangoFechas';
import UTMGenerator from '../../../components/operations/UTMGenerator';
import EntrantesVista from './entrantes/EntrantesVista';
import ConversacionesVista from './conversaciones/ConversacionesVista';
import TablaAnuncios, { EsqueletoTablaAnuncios } from './anuncios/TablaAnuncios';
import { ErrorDeCarga } from './esqueletos';
import ConexionMeta from './anuncios/ConexionMeta';
import EmbudosResumen from './anuncios/EmbudosResumen';
import RendimientoWorkshop from './anuncios/RendimientoWorkshop';
import { useEstadoDeMeta } from './anuncios/useEstadoDeMeta';
import { PERIODOS, PERIODO_POR_DEFECTO, rangoDePeriodo } from './anuncios/metricas';
import { agruparPalabraClave, archivarPalabraClave, mensajeDeError, pedirTablero } from './anuncios/marketingApi';
import '../../comercial/comercial.css';
import '../../../components/dashboard/pareja.css';
import './anuncios/anuncios.css';

/**
 * El espacio de Marketing (dirección de marketing y admin), con el estilo del dashboard comercial.
 *
 * «Anuncios» es la tabla de rendimiento por palabra clave de ManyChat, al estilo del Administrador de
 * anuncios de Meta (14/10/2026). Reemplaza a la «Gestión de anuncios» vieja (Estructura de campañas ›
 * conjuntos › anuncios cargada a mano, Inversión por período y Rend. por anuncio): ahora el anuncio se
 * crea solo cuando ManyChat manda una palabra clave nueva y el gasto llega de Meta Ads («Meta Ads»).
 * «Webhooks» y «Generador UTM» siguen como estaban. «Tráfico landings» vive solo en Workshop desde el
 * 16/10/2026 (acá pedía un endpoint de admin y al director de marketing le daba error); el link viejo
 * lleva allá.
 *
 * Rendimiento separa el gasto por embudo (15/10/2026): «Todo» (resumen por embudo + la tabla de palabras
 * clave), «Setting» (la tabla sola) y «Workshop» (los anuncios que llevan a la clase en vivo).
 *
 * Meta Ads (16/10/2026) desglosa campaña › conjunto › anuncio y cada fila abre el Administrador de
 * anuncios de Meta (otra pestaña: el token es de solo lectura). Lo que se cambie allá se trae solo al
 * volver (`useEstadoDeMeta`), en cualquier pestaña, y recarga lo que se esté mirando.
 *
 * Carga (17/10/2026): la cabecera, las pestañas y el selector de embudo se ven al instante; cada bloque
 * muestra su esqueleto hasta que llega SU dato (el tablero, o el pedido propio de Workshop, Entrantes,
 * Conversaciones y Meta Ads, que salen en paralelo). Recargar deja lo que se ve, atenuado.
 *
 * La pestaña, el embudo y el período viven en la URL (`tab`, `embudo`, `periodo`, `desde`, `hasta`), así
 * un link lleva a lo mismo que se estaba mirando.
 */

const PESTANAS = [
    { key: 'anuncios', label: 'Rendimiento' },
    { key: 'entrantes', label: 'Entrantes' },
    { key: 'conversaciones', label: 'Conversaciones' },
    { key: 'meta', label: 'Meta Ads' },
    { key: 'utms', label: 'Generador UTM' },
];
// «Webhooks» pasó a ser «Entrantes» (16/10/2026): un link viejo abre la nueva.
const PESTANA_VIEJA = { webhooks: 'entrantes' };
const CON_PERIODO = ['anuncios', 'entrantes', 'conversaciones', 'meta'];
// Rendimiento por embudo (15/10/2026): «Todo» suma el resumen por embudo arriba de la tabla de
// palabras clave; «Setting» es esa tabla sola y «Workshop», los anuncios que llevan a la clase.
const EMBUDOS_DE_RENDIMIENTO = [
    { key: 'todo', label: 'Todo' },
    { key: 'setting', label: 'Setting' },
    { key: 'workshop', label: 'Workshop' },
];

const AdminMarketingHubPage = () => {
    const [params, setParams] = useSearchParams();
    const reducir = useReducedMotion();
    const pedida = PESTANA_VIEJA[params.get('tab')] || params.get('tab');
    const pestana = PESTANAS.some((p) => p.key === pedida) ? pedida : 'anuncios';
    const periodo = PERIODOS.some((p) => p.key === params.get('periodo')) ? params.get('periodo') : PERIODO_POR_DEFECTO;
    const embudo = EMBUDOS_DE_RENDIMIENTO.some((e) => e.key === params.get('embudo')) ? params.get('embudo') : 'todo';
    const rango = useMemo(() => {
        if (periodo === 'personalizado' && esFecha(params.get('desde')) && esFecha(params.get('hasta'))) {
            return { desde: params.get('desde'), hasta: params.get('hasta') };
        }
        return rangoDePeriodo(periodo === 'personalizado' ? PERIODO_POR_DEFECTO : periodo);
    }, [periodo, params]);

    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [version, setVersion] = useState(0);

    const cambiar = useCallback((cambios) => {
        const siguiente = new URLSearchParams(params);
        Object.entries(cambios).forEach(([k, v]) => (v ? siguiente.set(k, v) : siguiente.delete(k)));
        setParams(siguiente, { replace: true });
    }, [params, setParams]);

    useEffect(() => {
        const control = new AbortController();
        setCargando(true);
        pedirTablero(rango.desde, rango.hasta, { signal: control.signal })
            .then((d) => { setDatos(d); setError(null); })
            .catch((e) => {
                if (e?.name === 'CanceledError') return;
                const mensaje = mensajeDeError(e, 'No se pudo cargar la tabla de anuncios.');
                setError(mensaje);
                toast.error(mensaje);
            })
            .finally(() => { if (!control.signal.aborted) setCargando(false); });
        return () => control.abort();
    }, [rango.desde, rango.hasta, version]);

    const recargar = useCallback(() => setVersion((v) => v + 1), []);
    const estadoMeta = useEstadoDeMeta({ meta: datos?.meta, onActualizado: recargar });
    const cuentas = datos?.meta?.cuentas || [];

    const archivar = async (fila, archivado) => {
        try {
            await archivarPalabraClave(fila.clave, archivado);
            setDatos((d) => ({ ...d, filas: d.filas.map((f) => (f.clave === fila.clave ? { ...f, archivado } : f)) }));
            toast.success(archivado ? `«${fila.nombre}» archivada: ya no suma en la tabla.` : `«${fila.nombre}» vuelve a la tabla.`);
        } catch (e) {
            toast.error(mensajeDeError(e, 'No se pudo archivar.'));
        }
    };

    // Devuelve si se guardó (el editor se cierra solo entonces). Se recarga la tabla: cambian los grupos y,
    // al volver a la automática, la campaña sale de Meta.
    const agrupar = async (fila, campana, conjunto) => {
        try {
            const r = await agruparPalabraClave(fila.clave, campana, conjunto);
            toast.success(r.campana ? `«${fila.nombre}» quedó en ${r.campana} › ${r.conjunto}.` : `«${fila.nombre}» vuelve a la campaña de Meta.`);
            recargar();
            return true;
        } catch (e) {
            toast.error(mensajeDeError(e, 'No se pudo guardar la campaña.'));
            return false;
        }
    };

    const opcionesPeriodo =PERIODOS.map((p) => ({ ...p }));
    const textoPeriodo = periodo === 'personalizado'
        ? textoRango(rango)
        : PERIODOS.find((p) => p.key === periodo)?.label;

    if (params.get('tab') === 'trafico') return <Navigate to="/admin/workshops?tab=trafico" replace />;

    return (
        <div className="mk-espacio">
            <div className="dc-shell dc-shell--embebido mk-shell">
                <div className="mk-wrap">
                    <header className="tope">
                        <div className="tope-id">
                            <Isotipo idGrad="lnGradMarketing" />
                            <div>
                                <p className="t-eyebrow">Marketing</p>
                                <h1 className="t-h1 mk-h1">{PESTANAS.find((p) => p.key === pestana).label}</h1>
                            </div>
                        </div>
                        {CON_PERIODO.includes(pestana) && (
                            <div className="tope-meta mk-tope-meta">
                                <PillMenu icono={<CalendarDays />} texto={textoPeriodo} rotulo="Período"
                                    detalle={periodo === 'personalizado' ? null : textoRango(rango)}
                                    opciones={opcionesPeriodo} valor={periodo} ancho={230}
                                    onChange={(key) => cambiar(key === 'personalizado'
                                        ? { periodo: key, desde: rango.desde, hasta: rango.hasta }
                                        : { periodo: key, desde: null, hasta: null })}
                                    pie={periodo === 'personalizado' && (
                                        <RangoFechas desde={rango.desde} hasta={rango.hasta} rotulo="Período"
                                            onCambiar={({ desde, hasta }) => {
                                                if (esFecha(desde) && esFecha(hasta)) cambiar({ periodo: 'personalizado', desde, hasta });
                                            }} />
                                    )} />
                                <button type="button" className="ibtn" onClick={recargar} disabled={cargando}
                                    title="Volver a cargar" aria-label="Volver a cargar">
                                    <RefreshCw className={cargando ? 'mk-gira' : ''} aria-hidden="true" />
                                </button>
                            </div>
                        )}
                    </header>

                    <div className="barra">
                        <Segmented opciones={PESTANAS} valor={pestana} ariaLabel="Secciones de Marketing"
                            onChange={(key) => cambiar({ tab: key === 'anuncios' ? null : key })} />
                    </div>

                    <motion.div key={pestana}
                        initial={reducir ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 0.7, 0.2, 1] }}>
                        {pestana === 'anuncios' && (
                            <div className={cargando && datos ? 'mk-recargando' : undefined} aria-busy={cargando}>
                                <div className="mk-embudo-selector">
                                    <Segmented chico ariaLabel="Embudo" opciones={EMBUDOS_DE_RENDIMIENTO} valor={embudo}
                                        onChange={(key) => cambiar({ embudo: key === 'todo' ? null : key })} />
                                </div>
                                {error && !datos && embudo !== 'workshop' ? (
                                    <ErrorDeCarga titulo={error} onReintentar={recargar} />
                                ) : (
                                    <>
                                        {embudo === 'todo' && (
                                            <EmbudosResumen embudos={datos ? datos.embudos || [] : null} desde={rango.desde} hasta={rango.hasta}
                                                moneda={datos?.moneda} onElegir={(key) => cambiar({ embudo: key })}
                                                cuentas={cuentas} irAMeta={() => cambiar({ tab: 'meta' })} />
                                        )}
                                        {embudo === 'workshop' ? (
                                            <RendimientoWorkshop desde={rango.desde} hasta={rango.hasta} moneda={datos?.moneda}
                                                embudos={datos ? datos.embudos || [] : (error ? [] : null)} cuentas={cuentas} version={version}
                                                irAMeta={() => cambiar({ tab: 'meta' })} />
                                        ) : !datos ? <EsqueletoTablaAnuncios /> : (
                                            <TablaAnuncios datos={datos} onArchivar={archivar} onAgrupar={agrupar}
                                                irAMeta={() => cambiar({ tab: 'meta' })} />
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                        {pestana === 'entrantes' && (
                            <EntrantesVista desde={rango.desde} hasta={rango.hasta} version={version} />
                        )}
                        {pestana === 'conversaciones' && (
                            <ConversacionesVista desde={rango.desde} hasta={rango.hasta} version={version} />
                        )}
                        {pestana === 'meta' && (
                            <ConexionMeta desde={rango.desde} hasta={rango.hasta} filasTablero={datos?.filas}
                                moneda={datos?.moneda} cuentas={cuentas} estadoMeta={estadoMeta} version={version}
                                onCambio={recargar} />
                        )}
                    </motion.div>
                </div>
            </div>

            {/* El generador de UTM es Tailwind y va FUERA del `.dc-shell` (su reset de botones le borraría los
                estilos), sobre su propia superficie oscura. */}
            {pestana === 'utms' && (
                <div className="mk-wrap mk-wrap--legado">
                    <div className="mk-legado">
                        <UTMGenerator />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminMarketingHubPage;
