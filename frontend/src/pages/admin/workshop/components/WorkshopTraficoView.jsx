import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, Eye, MessageCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { useDatosCacheados } from '../../../../services/cacheDeVistas';
import Cifra from '../../../comercial/components/Cifra';
import { PanelCab, PillMenu, Segmented, Tip } from '../../../comercial/components/Shared';
import RangoFechas, { esFecha, textoRango } from '../../../comercial/components/RangoFechas';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import { CifraConCuenta, useVerRegistros } from '../../../../components/standard';
import EsqueletoLista from '../../../../components/listas/EsqueletoLista';
import { ErrorDeCarga, EsqueletoKpis, HuesosSerie } from '../../marketing/esqueletos';
import SerieVisitas from '../trafico/SerieVisitas';
import { EnCabecera } from './CabeceraWorkshop';
import DetalleVisitas from '../trafico/DetalleVisitas';
import ContenidoTrafico from '../trafico/ContenidoTrafico';
import { AGRUPACIONES, FACETAS_RANKING, buscarRanking, claveRanking, columnasRanking, filasRanking } from '../trafico/columnas';
import { PERIODOS, PERIODO_POR_DEFECTO, fechaHora, num, pct, rangoDePeriodo } from '../trafico/trafico';
import '../../../../components/dashboard/pareja.css';
import '../trafico/trafico.css';
import '../../marketing/anuncios/anuncios.css';

/*
 * Tráfico de las landings de institute-site: el único lugar con este dato desde el 16/10/2026 (antes
 * había otra vista en Marketing, con un endpoint de admin que al director de marketing le daba error).
 *
 * Visitas: cada carga de página que la landing reporta a /api/v1/metrics/track-visit. Clics al grupo:
 * el botón que lleva al grupo de WhatsApp del evento (live-class*, live, acceso, crear-evento). Se miden
 * desde que institute-site empezó a mandarlos, así que la tasa solo usa las visitas posteriores a ese
 * primer clic (ver app/api/workshop_trafico.py). La grabación (/replay/) sale de sus sesiones.
 *
 * Estilo del dashboard comercial y Marketing (`.dc-shell`): período con `PillMenu` + `RangoFechas` (en la
 * URL: `periodo`, `desde`, `hasta`), KPIs con `Cifra`, la serie por día y dos `ListaConfigurable`: el
 * ranking (por landing, fuente o campaña) y el detalle de cada visita.
 *
 * Carga: el período, los rótulos y los títulos se ven al instante; los KPIs, la serie y el ranking
 * esperan el resumen, y el detalle de visitas sale en paralelo con su propio pedido (antes esperaba al
 * resumen para empezar). Cada uno con su esqueleto; recargar deja lo que se ve, atenuado.
 */

const AYUDA = {
    visitas: 'Cada vez que alguien abre una landing de institute-site. Si la misma persona recarga, cuenta dos veces: es tráfico, no personas.',
    landings: 'Cuántas landings distintas tuvieron al menos una visita en el período.',
    clics: 'Clics al botón que lleva al grupo de WhatsApp del evento. Es la entrada a la clase en vivo: quien no entra al grupo no recibe el link.',
    tasa: 'De las visitas a landings con botón al grupo, qué porcentaje hizo clic. Solo cuenta las visitas posteriores al primer clic medido.',
    serie: 'Visitas de todas las landings, día por día (hora de La Paz). Pasá el mouse por un día para ver también los clics al grupo.',
    ranking: 'Qué trae el tráfico: cada landing, cada fuente (utm_source) o cada campaña (utm_campaign), con su parte del total y su tasa al grupo.',
};

// `lista` (visitas · clics · landings): el ojo abre las filas que suman la cifra; `cuenta`: la tasa dice su «N de M».
const Kpi = ({ titulo, valor, sub, tip, i, lista = null, cuenta = null, onVer = null }) => {
    const reducir = useReducedMotion();
    const cifra = <Cifra valor={valor} className="kpi-n" desdeAnterior />;
    return (
        <motion.section className="kpi wf-kpi"
            initial={reducir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: i * 0.05, ease: [0.22, 0.7, 0.2, 1] }}>
            <div className="kpi-cab">
                <p className="t-eyebrow">{titulo}</p>
                <Tip texto={tip} titulo={titulo} />
                {onVer && lista && (
                    <button type="button" className="mk-kpi-ver" onClick={() => onVer(lista, titulo)}
                        aria-label={`Ver los registros de ${titulo}`} data-tip="Ver las filas que suman esta cifra">
                        <Eye size={15} aria-hidden="true" />
                    </button>
                )}
            </div>
            <div className="kpi-cifra">
                {cuenta ? <CifraConCuenta cuenta={cuenta} onVer={onVer}>{cifra}</CifraConCuenta> : cifra}
                <p className="kpi-sub">{sub}</p>
            </div>
        </motion.section>
    );
};

const KPIS = ['Visitas', 'Landings', 'Clics al grupo', 'Visita → grupo'];

const Ranking = ({ datos, medido }) => {
    const [agrupacion, setAgrupacion] = useState('landing');
    const total = datos?.totales?.visitas || 0;
    const columnas = useMemo(() => columnasRanking(agrupacion, total, medido), [agrupacion, total, medido]);
    const filas = datos ? filasRanking(datos, agrupacion) : [];
    const clave = useMemo(() => claveRanking(agrupacion), [agrupacion]);
    const buscador = useMemo(() => buscarRanking(agrupacion), [agrupacion]);
    return (
        <section className="panel wf-panel" aria-label="Qué trae el tráfico">
            <PanelCab titulo="Qué trae el tráfico" tip={AYUDA.ranking}>
                <Segmented chico opciones={AGRUPACIONES} valor={agrupacion} onChange={setAgrupacion}
                    ariaLabel="Agrupar el tráfico" />
            </PanelCab>
            {/* `key`: cada agrupación tiene sus columnas (y su elección guardada): se monta de nuevo. */}
            {!datos ? (
                <EsqueletoLista key={agrupacion} columnas={columnas} facetas={FACETAS_RANKING[agrupacion]}
                    claveGuardado={`ws_trafico_${agrupacion}_cols`} filas={8} label="Cargando qué trae el tráfico…" />
            ) : (
                <ListaConfigurable key={agrupacion} columnas={columnas} facetas={FACETAS_RANKING[agrupacion]}
                    filas={filas} clave={clave} buscar={buscador}
                    buscarPlaceholder="Buscar…" claveGuardado={`ws_trafico_${agrupacion}_cols`}
                    ordenInicial={{ key: 'visitas', dir: 'desc' }} vacio="Sin visitas en este período." />
            )}
        </section>
    );
};

const WorkshopTraficoView = () => {
    const [params, setParams] = useSearchParams();
    const reducir = useReducedMotion();
    const periodo = PERIODOS.some((p) => p.key === params.get('periodo')) ? params.get('periodo') : PERIODO_POR_DEFECTO;
    const pDesde = params.get('desde');
    const pHasta = params.get('hasta');
    const rango = useMemo(() => {
        if (periodo === 'personalizado' && esFecha(pDesde) && esFecha(pHasta)) return { desde: pDesde, hasta: pHasta };
        return rangoDePeriodo(periodo === 'personalizado' ? PERIODO_POR_DEFECTO : periodo);
    }, [periodo, pDesde, pHasta]);

    const [version, setVersion] = useState(0);

    const cambiar = useCallback((cambios) => {
        const siguiente = new URLSearchParams(params);
        Object.entries(cambios).forEach(([k, v]) => (v ? siguiente.set(k, v) : siguiente.delete(k)));
        setParams(siguiente, { replace: true });
    }, [params, setParams]);

    // Recordado por período (cacheDeVistas): volver a la pestaña no lo vuelve a pedir.
    const { datos, error: fallo, cargando } = useDatosCacheados(`ws:trafico:${rango.desde}:${rango.hasta}`,
        (signal) => api.get('/workshop/landing/trafico', { params: { desde: rango.desde, hasta: rango.hasta }, signal }).then((r) => r.data),
        { version, onError: () => toast.error('No se pudo cargar el tráfico de las landings.') });
    const error = fallo ? 'No se pudo cargar el tráfico de las landings.' : null;

    const recargar = useCallback(() => setVersion((v) => v + 1), []);

    const registros = useVerRegistros();
    const ver = useCallback((lista, titulo) => registros.abrir({
        titulo, subtitulo: textoRango(rango),
        contenido: <ContenidoTrafico tipo={lista} desde={rango.desde} hasta={rango.hasta} datos={datos} medido={Boolean(datos?.whatsapp_medido_desde)} />,
    }), [registros.abrir, rango, datos]);

    const t = datos?.totales || {};
    // Sin resumen todavía se da por medido: así no aparece y desaparece el aviso de abajo.
    const medido = !datos || Boolean(datos.whatsapp_medido_desde);
    const diasDelRango = datos?.por_dia?.length || 0;
    const kpis = !datos ? [] : [
        { titulo: KPIS[0], valor: num(t.visitas ?? 0), tip: AYUDA.visitas, lista: 'visitas',
            sub: diasDelRango ? `${num(Math.round((t.visitas || 0) / diasDelRango))} por día` : '—' },
        { titulo: KPIS[1], valor: num(t.landings ?? 0), tip: AYUDA.landings, lista: 'landings',
            sub: `${num(t.visitas_landings_whatsapp ?? 0)} con botón al grupo` },
        { titulo: KPIS[2], valor: medido ? num(t.clics_whatsapp ?? 0) : '—', tip: AYUDA.clics, lista: medido ? 'clics' : null,
            sub: medido ? `medidos desde el ${fechaHora(datos.whatsapp_medido_desde)}` : 'sin medir todavía' },
        { titulo: KPIS[3], valor: pct(t.tasa_whatsapp), tip: AYUDA.tasa,
            cuenta: t.tasa_whatsapp == null ? null : {
                a: { t: `${num(t.clics_whatsapp)} clics`, m: 'clics', titulo: KPIS[2] },
                b: { t: `${num(t.visitas_medidas)} visitas con botón al grupo`, m: null },
            },
            sub: 'de las visitas con botón al grupo' },
    ];

    const textoPeriodo = periodo === 'personalizado' ? textoRango(rango) : PERIODOS.find((p) => p.key === periodo)?.label;

    return (
        <div className="dc-shell dc-shell--embebido wf-trafico">
            {/* El período y su recargar van a la línea de la cabecera de Workshop. */}
            <EnCabecera>
                <div className="fila wf-barra">
                    <PillMenu icono={<CalendarDays />} texto={textoPeriodo} rotulo="Período"
                        detalle={periodo === 'personalizado' ? null : textoRango(rango)}
                        opciones={PERIODOS} valor={periodo} ancho={230}
                        onChange={(key) => cambiar(key === 'personalizado'
                            ? { periodo: key, desde: rango.desde, hasta: rango.hasta }
                            : { periodo: key === PERIODO_POR_DEFECTO ? null : key, desde: null, hasta: null })}
                        pie={periodo === 'personalizado' && (
                            <RangoFechas desde={rango.desde} hasta={rango.hasta} rotulo="Período"
                                onCambiar={({ desde, hasta }) => {
                                    if (esFecha(desde) && esFecha(hasta)) cambiar({ periodo: 'personalizado', desde, hasta });
                                }} />
                        )} />
                    <button type="button" className="ibtn" onClick={recargar} disabled={cargando}
                        title="Volver a cargar el tráfico" aria-label="Volver a cargar el tráfico">
                        <RefreshCw className={cargando ? 'wf-gira' : ''} aria-hidden="true" />
                    </button>
                </div>
            </EnCabecera>

            {error && !datos ? (
                <ErrorDeCarga titulo={error} onReintentar={recargar} />
            ) : (
                <motion.div className={`wf-vista${cargando && datos ? ' wf-recargando' : ''}`} aria-busy={cargando}
                    initial={reducir ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 0.7, 0.2, 1] }}>
                    {!medido && (
                        <p className="wf-aviso" role="note">
                            <MessageCircle size={15} aria-hidden="true" />
                            <span>Los clics al grupo de WhatsApp todavía no se miden: la tasa queda vacía hasta que llegue el primero.</span>
                        </p>
                    )}

                    {!datos ? (
                        <EsqueletoKpis titulos={KPIS} className="pareja wf-kpis" kpi="kpi wf-kpi" min="230px"
                            label="Cargando el tráfico de las landings…" />
                    ) : (
                        <div className="pareja wf-kpis" style={{ '--min': '230px', '--g': 'var(--s4)' }}>
                            {kpis.map((k, i) => <Kpi key={k.titulo} {...k} i={i} onVer={ver} />)}
                        </div>
                    )}

                    <section className="panel wf-panel" aria-label="Visitas por día">
                        <PanelCab titulo="Visitas por día" tip={AYUDA.serie} />
                        {!datos ? <HuesosSerie prefijo="wf" /> : <SerieVisitas dias={datos.por_dia || []} />}
                    </section>

                    <Ranking datos={datos} medido={medido} />

                    {registros.panel}
                    <DetalleVisitas desde={rango.desde} hasta={rango.hasta} version={version} onBorrada={recargar} />
                </motion.div>
            )}
        </div>
    );
};

export default WorkshopTraficoView;
