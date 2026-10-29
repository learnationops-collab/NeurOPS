import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { Isotipo, PillMenu, Segmented } from '../../comercial/components/Shared';
import RangoFechas, { esFecha, textoRango } from '../../comercial/components/RangoFechas';
import { ErrorDeCarga } from './esqueletos';
import EmbudosResumen from './anuncios/EmbudosResumen';
import AvisoSinCampana from './anuncios/AvisoSinCampana';
import { PERIODOS } from './anuncios/metricas';
import { mensajeDeError, pedirTablero } from './anuncios/marketingApi';
import { usePeriodoDeUrl } from './anuncios/usePeriodoDeUrl';
import ResumenTodos, { EsqueletoResumen } from './todos/ResumenTodos';
import MetricaPorMetrica from './todos/MetricaPorMetrica';
import SegmentosVista from './todos/SegmentosVista';
import { SETTING, WORKSHOP, gruposDe } from './todos/comparacion';
import { useRegistrosMarketing } from './anuncios/useRegistrosMarketing';
import { SelectorBase, useBaseDeConteo } from './anuncios/baseDeConteo';
import { useDatosCacheados } from '../../../services/cacheDeVistas';
import '../../comercial/comercial.css';
import '../../../components/dashboard/pareja.css';
import './anuncios/anuncios.css';
import './todos/todos.css';

/**
 * Todos (24/10/2026): Setting y Workshop juntos y comparados, con el diseño de Kerwin. Tres vistas:
 *
 *  - Resumen: las cuatro cifras que más separan a las dos fuentes y el embudo normalizado a 1.000 leads.
 *  - Métrica por métrica: cada cifra de las dos fuentes lado a lado, con quién gana (y por cuánto).
 *  - Segmentos: la matriz A/B/C/D × Setting/Workshop, con su filtro (28/10/2026).
 *  - Gasto en Meta: cuánto se gastó en cada embudo y día por día.
 *
 * Es lo que era «General» en el Rendimiento de Marketing; se separó para que Setting y Workshop muestren
 * cada uno solo lo suyo. Usa el mismo tablero que Setting (misma clave de caché). El período y la vista
 * viven en la URL (`periodo`, `desde`, `hasta`, `vista`).
 */
const VISTAS = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'detalle', label: 'Métrica por métrica' },
    { key: 'segmentos', label: 'Segmentos' },
    { key: 'meta', label: 'Gasto en Meta' },
];

const TodosPage = () => {
    const navigate = useNavigate();
    const reducir = useReducedMotion();
    const { periodo, rango, cambiar, elegir, textoPeriodo, params } = usePeriodoDeUrl('mk_todos_url', ['vista']);
    const vista = VISTAS.some((v) => v.key === params.get('vista')) ? params.get('vista') : 'resumen';
    const [version, setVersion] = useState(0);
    const { base, elegirBase } = useBaseDeConteo();
    const recargar = useCallback(() => setVersion((v) => v + 1), []);

    const { datos, error: fallo, cargando } = useDatosCacheados(`mk:tablero:${base}:${rango.desde}:${rango.hasta}`,
        (signal) => pedirTablero(rango.desde, rango.hasta, { signal, base }),
        { version, onError: (e) => toast.error(mensajeDeError(e, 'No se pudo cargar la comparación.')) });
    const error = fallo ? mensajeDeError(fallo, 'No se pudo cargar la comparación.') : null;

    const setting = datos?.fuentes?.fuentes?.find((f) => f.key === SETTING.key);
    const workshop = datos?.fuentes?.fuentes?.find((f) => f.key === WORKSHOP.key);
    const registros = useRegistrosMarketing(rango.desde, rango.hasta, datos?.moneda, base);
    const grupos = useMemo(() => (setting && workshop ? gruposDe(setting, workshop, datos?.moneda) : null), [setting, workshop, datos?.moneda]);
    const sinFuentes = datos && !grupos;

    const elegirVista = (key) => cambiar({ vista: key === 'resumen' ? null : key });
    // Cada tarjeta de embudo lleva a su espacio, con el mismo período: Setting a su tabla y Workshop a su Rendimiento.
    const irAEmbudo = (key) => {
        const mismoPeriodo = `periodo=${periodo}&desde=${rango.desde}&hasta=${rango.hasta}`;
        navigate(key === 'workshop' ? `/admin/workshops?tab=rendimiento&${mismoPeriodo}` : `/admin/marketing?${mismoPeriodo}`);
    };

    const aviso = <AvisoSinCampana sinCampana={datos?.fuentes?.sin_campana} moneda={datos?.moneda} />;
    const contenido = () => {
        if (error && !datos) return <ErrorDeCarga titulo={error} onReintentar={recargar} />;
        if (vista === 'meta') {
            return (
                <EmbudosResumen embudos={datos ? datos.embudos || [] : null} desde={rango.desde} hasta={rango.hasta}
                    moneda={datos?.moneda} onElegir={irAEmbudo}
                    cuentas={datos?.meta?.cuentas || []} irAMeta={() => navigate('/admin/marketing?tab=meta')} />
            );
        }
        if (vista === 'segmentos') {
            return (
                <>
                    <SegmentosVista rango={rango} version={version} params={params} cambiar={cambiar} abrirRegistros={registros.abrir} />
                    {registros.panel}
                </>
            );
        }
        if (!datos) return <EsqueletoResumen />;
        if (sinFuentes) {
            return (
                <section className="panel" role="status">
                    <p className="t-h3">Todavía no hay datos de Setting y Workshop para comparar</p>
                    <p className="t-sm mut">Probá con otro período.</p>
                </section>
            );
        }
        return (
            <div className="vista mk-vista">
                {vista === 'detalle'
                    ? <MetricaPorMetrica grupos={grupos} moneda={datos.moneda} onVer={registros.abrir} />
                    : <ResumenTodos grupos={grupos} setting={setting} workshop={workshop} moneda={datos.moneda} onVer={registros.abrir} />}
                {registros.panel}
            </div>
        );
    };

    return (
        <div className="mk-espacio">
            <div className="dc-shell dc-shell--embebido mk-shell">
                <div className="mk-wrap">
                    <header className="tope">
                        <div className="tope-id">
                            <Isotipo idGrad="lnGradTodos" />
                            <div>
                                <p className="t-eyebrow">Todos</p>
                                <h1 className="t-h1 mk-h1">Setting vs Workshop</h1>
                            </div>
                        </div>
                        <div className="tope-meta mk-tope-meta">
                            {aviso}
                            <PillMenu icono={<CalendarDays />} texto={textoPeriodo} rotulo="Período"
                                detalle={periodo === 'personalizado' ? null : textoRango(rango)}
                                opciones={PERIODOS} valor={periodo} ancho={230} onChange={elegir}
                                pie={periodo === 'personalizado' && (
                                    <RangoFechas desde={rango.desde} hasta={rango.hasta} rotulo="Período"
                                        onCambiar={({ desde, hasta }) => {
                                            if (esFecha(desde) && esFecha(hasta)) cambiar({ periodo: 'personalizado', desde, hasta });
                                        }} />
                                )} />
                            <SelectorBase base={base} onChange={elegirBase} />
                            <button type="button" className="ibtn" onClick={recargar} disabled={cargando}
                                title="Volver a cargar" aria-label="Volver a cargar">
                                <RefreshCw className={cargando ? 'mk-gira' : ''} aria-hidden="true" />
                            </button>
                        </div>
                    </header>

                    <div className="td-leyenda" aria-label="Quién es quién">
                        <span><i style={{ background: SETTING.color }} />{SETTING.label}</span>
                        <span><i style={{ background: WORKSHOP.color }} />{WORKSHOP.label}</span>
                    </div>
                    <p className="t-cap mut40"><b>Habla de:</b> los anuncios de Meta de Setting y de Workshop, {textoPeriodo?.toLowerCase()}
                        {periodo === 'personalizado' ? '' : ` (${textoRango(rango)})`}. No es por taller.</p>
                    <div className="barra">
                        <Segmented opciones={VISTAS} valor={vista} ariaLabel="Vistas de Todos" onChange={elegirVista} />
                    </div>

                    <motion.div key={vista} className={cargando && datos ? 'mk-recargando' : undefined} aria-busy={cargando}
                        initial={reducir ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 0.7, 0.2, 1] }}>
                        {contenido()}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default TodosPage;
