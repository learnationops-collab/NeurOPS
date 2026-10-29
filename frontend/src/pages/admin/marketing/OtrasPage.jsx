import { useCallback, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { Isotipo, PillMenu } from '../../comercial/components/Shared';
import RangoFechas, { esFecha, textoRango } from '../../comercial/components/RangoFechas';
import { ErrorDeCarga } from './esqueletos';
import { Kpi } from './anuncios/TablaAnuncios';
import { PERIODOS, formatear } from './anuncios/metricas';
import { mensajeDeError, pedirTablero } from './anuncios/marketingApi';
import { usePeriodoDeUrl } from './anuncios/usePeriodoDeUrl';
import { SelectorBase, useBaseDeConteo, BASES } from './anuncios/baseDeConteo';
import { useRegistrosMarketing } from './anuncios/useRegistrosMarketing';
import { useDatosCacheados } from '../../../services/cacheDeVistas';
import '../../comercial/comercial.css';
import '../../../components/dashboard/pareja.css';
import './anuncios/anuncios.css';

/**
 * Otras (Kerwin, 28/10/2026): las agendas que no son de Setting ni de Workshop (entrevistas, VSL, Momentum,
 * referidos, sin fuente), con su lista, para que Setting + Workshop + Otras sumen siempre el total de
 * Closing. Con «Contar por: fecha de reunión» ese total son las agendas de Closing, Analizar y Revisar.
 * Las cuentas salen del mismo tablero que las otras dos fuentes (`fuentes.otras`, `fuentes_service.py`).
 */
const OtrasPage = () => {
    const reducir = useReducedMotion();
    const { periodo, rango, cambiar, elegir, textoPeriodo } = usePeriodoDeUrl();
    const { base, elegirBase } = useBaseDeConteo();
    const [version, setVersion] = useState(0);
    const recargar = useCallback(() => setVersion((v) => v + 1), []);

    const { datos, error: fallo, cargando } = useDatosCacheados(`mk:tablero:${base}:${rango.desde}:${rango.hasta}`,
        (signal) => pedirTablero(rango.desde, rango.hasta, { signal, base }),
        { version, onError: (e) => toast.error(mensajeDeError(e, 'No se pudo cargar Otras.')) });
    const error = fallo ? mensajeDeError(fallo, 'No se pudo cargar Otras.') : null;
    const registros = useRegistrosMarketing(rango.desde, rango.hasta, datos?.moneda, base);

    const otras = datos?.fuentes?.otras;
    const fuentes = datos?.fuentes?.fuentes || [];
    const porBase = BASES.find((b) => b.key === base)?.label.toLowerCase();
    const kpis = (() => {
        if (!otras) return [];
        const dinero = (v) => formatear(v, 'money', datos.moneda);
        return [
            { titulo: 'Agendas', valor: formatear(otras.agendas, 'num'), sub: `por ${porBase}`, metrica: 'agendas',
              tip: 'Agendas que no son de Setting ni de Workshop: entrevistas, VSL, Momentum, referidos, sin fuente.' },
            { titulo: 'Show up', valor: otras.pct_show_up === null ? '—' : `${otras.pct_show_up}%`,
              sub: `${otras.show_up} de ${otras.reportadas} con resultado`, metrica: 'reportadas',
              tip: 'Asistieron ÷ citas con resultado (asistieron + no show).' },
            { titulo: 'Ventas', valor: formatear(otras.ventas, 'num'), sub: 'pago completo o split', metrica: 'ventas',
              tip: 'Pagos de venta nueva del período de clientes que no son de Setting ni de Workshop.' },
            { titulo: 'New Cash', valor: dinero(otras.new_cash), sub: 'venta nueva del período', metrica: 'new_cash',
              tip: 'Lo cobrado en pagos de venta nueva de estos clientes.' },
            { titulo: 'Cash total', valor: dinero(otras.cash_total), sub: `${otras.cobros} ${otras.cobros === 1 ? 'cobro' : 'cobros'}`, metrica: 'cash_total',
              tip: 'Todo lo cobrado del período de estos clientes (ventas, cuotas, señas, upsells).' },
        ];
    })();

    const suma = fuentes.map((f) => f.agendas).concat(otras ? [otras.agendas] : []);

    return (
        <div className="mk-espacio">
            <div className="dc-shell dc-shell--embebido mk-shell">
                <div className="mk-wrap">
                    <header className="tope">
                        <div className="tope-id">
                            <Isotipo idGrad="lnGradOtras" />
                            <div>
                                <p className="t-eyebrow">Otras</p>
                                <h1 className="t-h1 mk-h1">Agendas fuera de Setting y Workshop</h1>
                            </div>
                        </div>
                        <div className="tope-meta mk-tope-meta">
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

                    <motion.div className={cargando && datos ? 'mk-recargando' : undefined} aria-busy={cargando}
                        initial={reducir ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 0.7, 0.2, 1] }}>
                        {error && !datos ? <ErrorDeCarga titulo={error} onReintentar={recargar} /> : !datos ? null : !otras ? (
                            <section className="panel" role="status">
                                <p className="t-h3">Todavía no hay datos de Otras</p>
                                <p className="t-sm mut">Probá con otro período.</p>
                            </section>
                        ) : (
                            <div className="vista mk-vista">
                                <div className="pareja mk-fuente-kpis mk-fuente-kpis--cinco" style={{ '--min': '170px', '--g': 'var(--s4)' }}>
                                    {kpis.map((k, i) => (
                                        <Kpi key={k.titulo} titulo={k.titulo} valor={k.valor} sub={k.sub} tip={k.tip} i={i}
                                            onVer={() => registros.abrir('otras', k.metrica, k.titulo)} />
                                    ))}
                                </div>
                                <section className="panel" aria-label="Cómo suman las agendas">
                                    <p className="t-body td-fuerte" style={{ margin: 0 }}>
                                        {fuentes.map((f) => `${f.label} ${formatear(f.agendas, 'num')}`).join(' + ')}
                                        {` + Otras ${formatear(otras.agendas, 'num')} = ${formatear(suma.reduce((a, b) => a + b, 0), 'num')} agendas`}
                                    </p>
                                    <p className="t-sm mut" style={{ margin: 'var(--s2) 0 0' }}>
                                        {base === 'reunion'
                                            ? 'Por fecha de reunión es el total de Closing, Analizar y Revisar (con las descartadas).'
                                            : 'Por fecha de alta: personas con agenda creada en el período, sin las repetidas de una reprogramación.'}
                                    </p>
                                </section>
                                {registros.panel}
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default OtrasPage;
