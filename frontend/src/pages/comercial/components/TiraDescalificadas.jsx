import React from 'react';
import { Tip, fmt } from './Shared';
import MetricaClicable from '../../../components/dashboard/MetricaClicable';
import './reparto-estados.css';

/**
 * Cuántos leads se descalifican y quién lo hace, debajo del panel Estados (23/10/2026).
 *
 *   · Por el closer: agendas que el closer descalificó (botón «Descalificado» de la confirmación, o el
 *     «No Lead» de antes, que es lo mismo). Son agendas: están en el total del panel y llevan a
 *     Revisar con su filtro.
 *   · Por el formulario: leads que el formulario de agenda cortó porque eligieron una opción que
 *     descalifica. Nunca llegaron a ser una agenda ni a tener closer, así que no están en el total y
 *     no tienen lista. Con un closer elegido el backend manda `null` y esta cifra no se dibuja: esos
 *     leads no son de nadie.
 *
 * `datos`: `{closer, formulario}` tal como lo manda `descalificados_service.resumen`.
 */

const DESTINO_DEL_CLOSER = {
    tabla: 'agendas', filtro: { estado: 'Descalificada' }, de: 'Descalificadas por el closer',
};

const Celda = ({ rotulo, n, ayuda, irA, destino }) => (
    <span className="est-desc-celda">
        <MetricaClicable irA={irA} destino={destino} detalle={`${rotulo}, ${n}`} vacio={n === 0} subrayar={false}>
            <b className="est-desc-n num">{fmt.num(n)}</b>
        </MetricaClicable>
        <small className="est-desc-rot">{rotulo}</small>
        <Tip texto={ayuda} titulo={rotulo} />
    </span>
);

const TiraDescalificadas = ({ datos, irA }) => {
    if (!datos) return null;
    const { closer, formulario } = datos;
    return (
        <div className="est-desc" role="group" aria-label="Leads descalificados">
            <small className="est-desc-tit">Descalificados</small>
            <Celda rotulo="Por el closer" n={closer} irA={irA} destino={DESTINO_DEL_CLOSER}
                ayuda="Agendas que el closer marcó como no calificadas." />
            {formulario !== null && formulario !== undefined && (
                <Celda rotulo="Por el formulario" n={formulario}
                    ayuda="Leads que el formulario no dejó agendar: no calificaban y no llegaron a un closer." />
            )}
        </div>
    );
};

export default TiraDescalificadas;
