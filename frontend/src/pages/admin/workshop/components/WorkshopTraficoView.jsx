import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, MessageCircle, RefreshCw } from 'lucide-react';
import api from '../../../../services/api';
import Cifra from '../../../comercial/components/Cifra';
import { EsqueletoTablero, PanelCab, PillMenu, Segmented, Tip } from '../../../comercial/components/Shared';
import RangoFechas, { esFecha, textoRango } from '../../../comercial/components/RangoFechas';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import SerieVisitas from '../trafico/SerieVisitas';
import { EnCabecera } from './CabeceraWorkshop';
import DetalleVisitas from '../trafico/DetalleVisitas';
import { AGRUPACIONES, FACETAS_RANKING, buscarRanking, claveRanking, columnasRanking, filasRanking } from '../trafico/columnas';
import { PERIODOS, PERIODO_POR_DEFECTO, fechaHora, num, pct, rangoDePeriodo } from '../trafico/trafico';
import '../../../../components/dashboard/pareja.css';
import '../trafico/trafico.css';

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
 */

const AYUDA = {
    visitas: 'Cada vez que alguien abre una landing de institute-site. Si la misma persona recarga, cuenta dos veces: es tráfico, no personas.',
    landings: 'Cuántas landings distintas tuvieron al menos una visita en el período.',
    clics: 'Clics al botón que lleva al grupo de WhatsApp del evento. Es la entrada a la clase en vivo: quien no entra al grupo no recibe el link.',
    tasa: 'De las visitas a landings con botón al grupo, qué porcentaje hizo clic. Solo cuenta las visitas posteriores al primer clic medido.',
    serie: 'Visitas de todas las landings, día por día (hora de La Paz). Pasá el mouse por un día para ver también los clics al grupo.',
    ranking: 'Qué trae el tráfico: cada landing, cada fuente (utm_source) o cada campaña (utm_campaign), con su parte del total y su tasa al grupo.',
};

const Kpi = ({ titulo, valor, sub, tip, i }) => {
    const reducir = useReducedMotion();
    return (
        <motion.section className="kpi wf-kpi"
            initial={reducir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: i * 0.05, ease: [0.22, 0.7, 0.2, 1] }}>
            <div className="kpi-cab">
                <p className="t-eyebrow">{titulo}</p>
                <Tip texto={tip} titulo={titulo} />
            </div>
            <div className="kpi-cifra">
                <Cifra valor={valor} className="kpi-n" desdeAnterior />
                <p className="kpi-sub">{sub}</p>
            </div>
        </motion.section>
    );
};

const Ranking = ({ datos, medido }) => {
    const [agrupacion, setAgrupacion] = useState('landing');
    const total = datos?.totales?.visitas || 0;
    const columnas = useMemo(() => columnasRanking(agrupacion, total, medido), [agrupacion, total, medido]);
    const filas = filasRanking(datos, agrupacion);
    const clave = useMemo(() => claveRanking(agrupacion), [agrupacion]);
    const buscador = useMemo(() => buscarRanking(agrupacion), [agrupacion]);
    return (
        <section className="panel wf-panel" aria-label="Qué trae el tráfico">
            <PanelCab titulo="Qué trae el tráfico" tip={AYUDA.ranking}>
                <Segmented chico opciones={AGRUPACIONES} valor={agrupacion} onChange={setAgrupacion}
                    ariaLabel="Agrupar el tráfico" />
            </PanelCab>
            {/* `key`: cada agrupación tiene sus columnas (y su elección guardada): se monta de nuevo. */}
            <ListaConfigurable key={agrupacion} columnas={columnas} facetas={FACETAS_RANKING[agrupacion]}
                filas={filas} clave={clave} buscar={buscador}
                buscarPlaceholder="Buscar…" claveGuardado={`ws_trafico_${agrupacion}_cols`}
                ordenInicial={{ key: 'visitas', dir: 'desc' }} vacio="Sin visitas en este período." />
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
        api.get('/workshop/landing/trafico', { params: { desde: rango.desde, hasta: rango.hasta }, signal: control.signal })
            .then((r) => { setDatos(r.data); setError(null); })
            .catch((e) => {
                if (e?.name !== 'CanceledError') setError('No se pudo cargar el tráfico de las landings.');
            })
            .finally(() => { if (!control.signal.aborted) setCargando(false); });
        return () => control.abort();
    }, [rango.desde, rango.hasta, version]);

    const recargar = useCallback(() => setVersion((v) => v + 1), []);

    const t = datos?.totales || {};
    const medido = Boolean(datos?.whatsapp_medido_desde);
    const diasDelRango = datos?.por_dia?.length || 0;
    const kpis = [
        { titulo: 'Visitas', valor: num(t.visitas ?? 0), tip: AYUDA.visitas,
            sub: diasDelRango ? `${num(Math.round((t.visitas || 0) / diasDelRango))} por día` : '—' },
        { titulo: 'Landings', valor: num(t.landings ?? 0), tip: AYUDA.landings,
            sub: `${num(t.visitas_landings_whatsapp ?? 0)} con botón al grupo` },
        { titulo: 'Clics al grupo', valor: medido ? num(t.clics_whatsapp ?? 0) : '—', tip: AYUDA.clics,
            sub: medido ? `medidos desde el ${fechaHora(datos.whatsapp_medido_desde)}` : 'sin medir todavía' },
        { titulo: 'Visita → grupo', valor: pct(t.tasa_whatsapp), tip: AYUDA.tasa,
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
                <section className="panel"><p className="t-body">{error}</p></section>
            ) : !datos ? (
                <EsqueletoTablero rotulo="Cargando el tráfico de las landings…" />
            ) : (
                <motion.div className={`wf-vista${cargando ? ' wf-recargando' : ''}`} aria-busy={cargando}
                    initial={reducir ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 0.7, 0.2, 1] }}>
                    {!medido && (
                        <p className="wf-aviso" role="note">
                            <MessageCircle size={15} aria-hidden="true" />
                            <span>Los clics al grupo de WhatsApp todavía no se miden: la tasa queda vacía hasta que llegue el primero.</span>
                        </p>
                    )}

                    <div className="pareja wf-kpis" style={{ '--min': '230px', '--g': 'var(--s4)' }}>
                        {kpis.map((k, i) => <Kpi key={k.titulo} {...k} i={i} />)}
                    </div>

                    <section className="panel wf-panel" aria-label="Visitas por día">
                        <PanelCab titulo="Visitas por día" tip={AYUDA.serie} />
                        <SerieVisitas dias={datos.por_dia || []} />
                    </section>

                    <Ranking datos={datos} medido={medido} />

                    <DetalleVisitas desde={rango.desde} hasta={rango.hasta} version={version} onBorrada={recargar} />
                </motion.div>
            )}
        </div>
    );
};

export default WorkshopTraficoView;
