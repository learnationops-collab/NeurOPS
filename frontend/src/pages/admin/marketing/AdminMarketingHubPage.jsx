import { useCallback, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useParamsGuardados } from '../../../hooks/useParamsGuardados';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { Isotipo, PillMenu, Segmented } from '../../comercial/components/Shared';
import RangoFechas, { esFecha, textoRango } from '../../comercial/components/RangoFechas';
import UTMGenerator from '../../../components/operations/UTMGenerator';
import EntrantesVista from './entrantes/EntrantesVista';
import TablaAnuncios, { EsqueletoTablaAnuncios } from './anuncios/TablaAnuncios';
import { ErrorDeCarga } from './esqueletos';
import ConexionMeta from './anuncios/ConexionMeta';
import { TarjetasFuente } from './anuncios/FuentesResumen';
import { useRegistrosMarketing } from './anuncios/useRegistrosMarketing';
import { SelectorBase, useBaseDeConteo } from './anuncios/baseDeConteo';
import AvisoSinCampana from './anuncios/AvisoSinCampana';
import { useEstadoDeMeta } from './anuncios/useEstadoDeMeta';
import { PERIODOS, PERIODO_POR_DEFECTO, rangoDePeriodo } from './anuncios/metricas';
import { agruparPalabraClave, archivarPalabraClave, mensajeDeError, pedirTablero } from './anuncios/marketingApi';
import { useDatosCacheados } from '../../../services/cacheDeVistas';
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
 * Rendimiento es solo Setting (24/10/2026): sus cifras y la tabla de palabras clave. La comparación Setting vs
 * Workshop y el gasto por embudo viven en «Todos» (/admin/todos) y los anuncios de Workshop (la clase en
 * vivo), en Workshop › Rendimiento; un link viejo con `embudo=workshop` lleva allá.
 *
 * Meta Ads (16/10/2026) desglosa campaña › conjunto › anuncio y cada fila abre el Administrador de
 * anuncios de Meta (otra pestaña: el token es de solo lectura). Lo que se cambie allá se trae solo al
 * volver (`useEstadoDeMeta`), en cualquier pestaña, y recarga lo que se esté mirando.
 *
 * Carga (17/10/2026): la cabecera y las pestañas se ven al instante; cada bloque
 * muestra su esqueleto hasta que llega SU dato (el tablero, o el pedido propio de Workshop, Entrantes
 * y Meta Ads, que salen en paralelo). Recargar deja lo que se ve, atenuado.
 *
 * La pestaña y el período viven en la URL (`tab`, `periodo`, `desde`, `hasta`), así
 * un link lleva a lo mismo que se estaba mirando.
 */

const PESTANAS = [
    // «Rendimiento» también era una pestaña de Workshop (28/10/2026): cada nombre dice qué mide.
    { key: 'anuncios', label: 'Palabras clave' },
    { key: 'entrantes', label: 'Entrantes' },
    // «Conversaciones» (mensajes del flujo) se quitó el 28/10/2026: ahora se maneja desde el Inbox. Un link viejo cae en Palabras clave.
    { key: 'meta', label: 'Meta Ads' },
    { key: 'utms', label: 'Generador UTM' },
];
// «Webhooks» pasó a ser «Entrantes» (16/10/2026): un link viejo abre la nueva.
const PESTANA_VIEJA = { webhooks: 'entrantes' };
const CON_PERIODO = ['anuncios', 'entrantes', 'meta'];
const AdminMarketingHubPage = () => {
    // La pestaña y el período se recuerdan por usuario: sin parámetros en el link, se abre donde se dejó.
    const [params, setParams] = useParamsGuardados('mk_setting_url', ['tab', 'periodo', 'desde', 'hasta']);
    const reducir = useReducedMotion();
    const pedida = PESTANA_VIEJA[params.get('tab')] || params.get('tab');
    const pestana = PESTANAS.some((p) => p.key === pedida) ? pedida : 'anuncios';
    const periodo = PERIODOS.some((p) => p.key === params.get('periodo')) ? params.get('periodo') : PERIODO_POR_DEFECTO;
    const rango = useMemo(() => {
        if (periodo === 'personalizado' && esFecha(params.get('desde')) && esFecha(params.get('hasta'))) {
            return { desde: params.get('desde'), hasta: params.get('hasta') };
        }
        return rangoDePeriodo(periodo === 'personalizado' ? PERIODO_POR_DEFECTO : periodo);
    }, [periodo, params]);

    const [version, setVersion] = useState(0);
    const { base, elegirBase } = useBaseDeConteo();

    const cambiar = useCallback((cambios) => {
        const siguiente = new URLSearchParams(params);
        Object.entries(cambios).forEach(([k, v]) => (v ? siguiente.set(k, v) : siguiente.delete(k)));
        setParams(siguiente, { replace: true });
    }, [params, setParams]);

    // El tablero queda recordado por período: ir y volver entre pestañas o vistas no lo vuelve a pedir.
    const { datos, error: fallo, cargando, setDatos } = useDatosCacheados(`mk:tablero:${base}:${rango.desde}:${rango.hasta}`,
        (signal) => pedirTablero(rango.desde, rango.hasta, { signal, base }),
        { version, onError: (e) => toast.error(mensajeDeError(e, 'No se pudo cargar la tabla de anuncios.')) });
    const error = fallo ? mensajeDeError(fallo, 'No se pudo cargar la tabla de anuncios.') : null;

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

    // Va debajo de los KPIs del tablero (Kerwin, 19/10/2026: los KPIs arriba).
    // null = el tablero todavía no llegó (esqueleto); [] = llegó sin `fuentes` (un servidor viejo): no se dibuja.
    const fuentes = datos ? datos.fuentes?.fuentes || [] : null;
    const fuenteDe = (key) => fuentes?.find((f) => f.key === key) || null;
    // Palabras con gasto sin campaña vigente en el Inbox (24/10/2026).
    const avisoSinCampana = <AvisoSinCampana sinCampana={datos?.fuentes?.sin_campana} moneda={datos?.moneda} />;
    const registros = useRegistrosMarketing(rango.desde, rango.hasta, datos?.moneda, base);
    const resumenSetting = !(fuentes && !fuenteDe('setting'))
        ? <TarjetasFuente fuente={fuenteDe('setting')} moneda={datos?.moneda} sinRepetidos
            onVer={(metrica, titulo) => registros.abrir('setting', metrica, titulo)} /> : null;

    if (params.get('tab') === 'trafico') return <Navigate to="/admin/workshops?tab=trafico" replace />;
    if (params.get('embudo') === 'workshop') {
        const destino = new URLSearchParams(params);
        destino.delete('embudo');
        destino.set('tab', 'rendimiento');
        return <Navigate to={`/admin/workshops?${destino}`} replace />;
    }

    return (
        <div className="mk-espacio">
            <div className="dc-shell dc-shell--embebido mk-shell">
                <div className="mk-wrap">
                    <header className="tope">
                        <div className="tope-id">
                            <Isotipo idGrad="lnGradMarketing" />
                            <div>
                                <p className="t-eyebrow">Setting</p>
                                <h1 className="t-h1 mk-h1">{PESTANAS.find((p) => p.key === pestana).label}</h1>
                            </div>
                        </div>
                        {CON_PERIODO.includes(pestana) && (
                            <div className="tope-meta mk-tope-meta">
                                {pestana === 'anuncios' && avisoSinCampana}
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
                                {pestana === 'anuncios' && <SelectorBase base={base} onChange={elegirBase} />}
                                <button type="button" className="ibtn" onClick={recargar} disabled={cargando}
                                    title="Volver a cargar" aria-label="Volver a cargar">
                                    <RefreshCw className={cargando ? 'mk-gira' : ''} aria-hidden="true" />
                                </button>
                            </div>
                        )}
                    </header>

                    <div className="barra">
                        <Segmented opciones={PESTANAS} valor={pestana} ariaLabel="Secciones de Setting"
                            onChange={(key) => cambiar({ tab: key === 'anuncios' ? null : key })} />
                    </div>

                    <motion.div key={pestana}
                        initial={reducir ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 0.7, 0.2, 1] }}>
                        {pestana === 'anuncios' && (
                            <div className={cargando && datos ? 'mk-recargando' : undefined} aria-busy={cargando}>
                                {/* La tabla es por palabra clave y su gasto no conoce al lead: no se parte por segmento. */}
                                <p className="t-cap mut mk-nota">
                                    No se parte por segmento: el gasto de Meta no conoce al lead.{' '}
                                    <Link className="link-btn" to={`/admin/todos?vista=segmentos&periodo=${periodo}&desde=${rango.desde}&hasta=${rango.hasta}`}>
                                        Ver por segmento
                                    </Link>
                                </p>
                                {error && !datos ? (
                                    <ErrorDeCarga titulo={error} onReintentar={recargar} />
                                ) : !datos ? <EsqueletoTablaAnuncios bajoKpis={resumenSetting} /> : (
                                    <>
                                        <TablaAnuncios datos={datos} onArchivar={archivar} onAgrupar={agrupar} estadoMeta={estadoMeta}
                                            irAMeta={() => cambiar({ tab: 'meta' })} bajoKpis={resumenSetting}
                                            agendasDeFuente={base === 'reunion' ? fuenteDe('setting') : null}
                                            onVerAgendas={(metrica, titulo) => registros.abrir('setting', metrica, titulo)} />
                                        {registros.panel}
                                    </>
                                )}
                            </div>
                        )}
                        {pestana === 'entrantes' && (
                            <EntrantesVista desde={rango.desde} hasta={rango.hasta} version={version} />
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
