import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { Isotipo, PillMenu } from '../../comercial/components/Shared';
import RangoFechas, { esFecha, textoRango } from '../../comercial/components/RangoFechas';
import { ErrorDeCarga } from './esqueletos';
import EmbudosResumen from './anuncios/EmbudosResumen';
import { CompararFuentes } from './anuncios/FuentesResumen';
import AvisoSinCampana from './anuncios/AvisoSinCampana';
import { PERIODOS } from './anuncios/metricas';
import { mensajeDeError, pedirTablero } from './anuncios/marketingApi';
import { usePeriodoDeUrl } from './anuncios/usePeriodoDeUrl';
import { useDatosCacheados } from '../../../services/cacheDeVistas';
import '../../comercial/comercial.css';
import '../../../components/dashboard/pareja.css';
import './anuncios/anuncios.css';

/**
 * Todos (24/10/2026): Setting y Workshop juntos y comparados. Es lo que era «General» en el Rendimiento de
 * Marketing (la comparación Setting vs Workshop, el gasto por embudo y el aviso de palabras sin campaña);
 * se separó para que Setting y Workshop muestren cada uno solo lo suyo.
 *
 * Usa el mismo tablero que Setting (misma clave de caché); el período vive en la URL.
 */
const TodosPage = () => {
    const navigate = useNavigate();
    const reducir = useReducedMotion();
    const { periodo, rango, cambiar, elegir, textoPeriodo } = usePeriodoDeUrl();
    const [version, setVersion] = useState(0);
    const recargar = useCallback(() => setVersion((v) => v + 1), []);

    const { datos, error: fallo, cargando } = useDatosCacheados(`mk:tablero:${rango.desde}:${rango.hasta}`,
        (signal) => pedirTablero(rango.desde, rango.hasta, { signal }),
        { version, onError: (e) => toast.error(mensajeDeError(e, 'No se pudo cargar la comparación.')) });
    const error = fallo ? mensajeDeError(fallo, 'No se pudo cargar la comparación.') : null;

    // null = el tablero todavía no llegó (esqueleto); [] = llegó sin `fuentes` (un servidor viejo): no se dibuja.
    const fuentes = datos ? datos.fuentes?.fuentes || [] : null;
    // Cada tarjeta de embudo lleva a su espacio, con el mismo período: Setting a su tabla y Workshop a su Rendimiento.
    const irAEmbudo = (key) => {
        const mismoPeriodo = `periodo=${periodo}&desde=${rango.desde}&hasta=${rango.hasta}`;
        navigate(key === 'workshop' ? `/admin/workshops?tab=rendimiento&${mismoPeriodo}` : `/admin/marketing?${mismoPeriodo}`);
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
                            <PillMenu icono={<CalendarDays />} texto={textoPeriodo} rotulo="Período"
                                detalle={periodo === 'personalizado' ? null : textoRango(rango)}
                                opciones={PERIODOS} valor={periodo} ancho={230} onChange={elegir}
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
                    </header>

                    <motion.div className={cargando && datos ? 'mk-recargando' : undefined} aria-busy={cargando}
                        initial={reducir ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 0.7, 0.2, 1] }}>
                        {error && !datos ? (
                            <ErrorDeCarga titulo={error} onReintentar={recargar} />
                        ) : (
                            <div className="vista mk-vista">
                                <AvisoSinCampana sinCampana={datos?.fuentes?.sin_campana} moneda={datos?.moneda} />
                                {!fuentes?.length && fuentes ? null : <CompararFuentes fuentes={fuentes} moneda={datos?.moneda} />}
                                <EmbudosResumen embudos={datos ? datos.embudos || [] : null} desde={rango.desde} hasta={rango.hasta}
                                    moneda={datos?.moneda} onElegir={irAEmbudo}
                                    cuentas={datos?.meta?.cuentas || []} irAMeta={() => navigate('/admin/marketing?tab=meta')} />
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default TodosPage;
