import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../../services/api';
import { useDatosCacheados } from '../../../../services/cacheDeVistas';
import { Accordion, CifraConCuenta } from '../../../../components/standard';
import { dinero, formatear } from '../anuncios/metricas';
import { WORKSHOP, parte } from './comparacion';
import { puenteRoas, talleresDelPeriodo } from './calculoPuente';
import './puenteRoas.css';

/**
 * Por qué difieren los dos ROAS de Workshop, en una cuenta que se lee sin tooltips (Kerwin, 29/10/2026, ADR-W027): arranca en el ROAS
 * de «Todos» (todo lo cobrado del período ÷ gasto de Meta del período), resta tres cosas con su nombre y llega al ROAS de los talleres
 * del período (lo que cobraron ÷ lo que se gastó en ellos). Va en un desplegable cerrado: cerrado se ven sus dos cifras.
 * Las cuentas, en `calculoPuente.js`. Sin talleres en el período, o con un segmento elegido, no se dibuja.
 * Cada cifra mostrada es el ROAS redondeado de ese tramo y cada resta es la diferencia de los redondeados: lo que se ve suma exacto.
 */
const PASOS = {
    anterior: { texto: 'cobros de ventas anteriores', titulo: 'Cobrado de ventas anteriores' },
    cohorte: { texto: 'cobrado fuera de estos talleres', titulo: 'Cobrado del período fuera de los talleres' },
    gasto: { texto: 'gasto de los talleres', titulo: 'Gasto de los talleres' },
};

const redondo = (v) => Math.round(v * 100) / 100;
const veces = (v) => formatear(v, 'veces');
const signo = (v) => `${v < -0.005 ? '−' : '+'}${Math.abs(v).toFixed(2)}x`;
const tono = (v) => (v < -0.005 ? 'var(--error)' : v > 0.005 ? 'var(--success)' : 'var(--text-muted)');
const dia = (iso) => iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/');

const Fila = ({ valor, color, children, cuenta, onClick = null }) => {
    const cuerpo = (
        <>
            <b className="num mk-puente-valor" style={{ color }}>{valor}</b>
            <span className="mk-puente-texto">{children}</span>
            {cuenta && <small className="mk-puente-cuenta num">{cuenta}</small>}
        </>
    );
    return onClick
        ? <button type="button" className="mk-puente-fila mk-puente-fila--abre" onClick={onClick}>{cuerpo}</button>
        : <div className="mk-puente-fila">{cuerpo}</div>;
};

export const CuentaDelPuente = ({ puente, fuente, rango, moneda, onVer, fechas, compacta = false }) => {
    const d = (v) => dinero(v, moneda);
    const [anterior, cohorte, gasto] = puente.pasos;
    // Lo que se muestra: el ROAS de cada tramo redondeado, y cada resta como diferencia de redondeados.
    const r0 = redondo(puente.todos);
    const r1 = redondo(puente.todos + anterior.delta);
    const r2 = redondo(puente.todos + anterior.delta + cohorte.delta);
    const r3 = redondo(puente.talleres);
    const restas = { anterior: r1 - r0, cohorte: r2 - r1, gasto: r3 - r2 };
    const cuentas = {
        anterior: `${d(anterior.de)} de ${d(anterior.sobre)} cobrados`,
        cohorte: `${d(cohorte.de - cohorte.a)} de ${d(cohorte.de)} del período`,
        gasto: `${d(gasto.a)} de talleres · ${d(gasto.de)} del período`,
    };
    const cantidad = `${puente.cantidad} ${puente.cantidad === 1 ? 'taller' : 'talleres'}`;
    const enWorkshop = `/admin/workshops?tab=resumen&rf=periodo&rd=${rango.desde}&rh=${rango.hasta}`;
    return (
        <div className={`mk-puente-caja${compacta ? ' mk-puente-caja--compacta' : ''}`}>
            {compacta && <p className="mk-puente-titulo">¿Por qué difieren los dos ROAS?</p>}
            <Fila color={WORKSHOP.color} cuenta={`${d(fuente.cash_total)} ÷ ${d(gasto.de)}`} valor={compacta ? veces(r0) : (
                <CifraConCuenta color={WORKSHOP.color} rotulo="Todo lo cobrado del período"
                    cuenta={{ a: parte(d(fuente.cash_total), 'cash_total'), b: parte(`${d(gasto.de)} gastados`, 'gasto') }} onVer={onVer}>
                    {veces(r0)}
                </CifraConCuenta>
            )}>
                <b>Todos</b> · cobrado del período ÷ gasto del período
            </Fila>
            {puente.pasos.map((p) => (
                <Fila key={p.id} valor={signo(restas[p.id])} color={tono(restas[p.id])} cuenta={cuentas[p.id]}
                    onClick={onVer && p.lista ? () => onVer(p.lista, PASOS[p.id].titulo) : null}>
                    {PASOS[p.id].texto}
                </Fila>
            ))}
            <div className="mk-puente-fila mk-puente-fila--total">
                <b className="num mk-puente-valor" style={{ color: WORKSHOP.color }}>
                    <span className="mk-puente-igual" aria-hidden="true">=</span>
                    <Link to={enWorkshop} className="mk-puente-enlace" data-tip={`Ver los talleres: ${fechas}`}>{veces(r3)}</Link>
                </b>
                <span className="mk-puente-texto"><b>Workshop</b> · {cantidad}: cobrado de los talleres ÷ gasto de los talleres</span>
                <small className="mk-puente-cuenta num">{`${d(puente.cobradoTalleres)} ÷ ${d(puente.invertido)}`}</small>
            </div>
        </div>
    );
};

/** Las cuentas del puente: los talleres del período y los tres pasos. `puente` es null si falta algo con qué dividir. */
export const usePuente = (fuente, rango) => {
    const { datos: eventos } = useDatosCacheados('ws:events', (signal) => api.get('workshop/events', { signal }).then((r) => r.data));
    const talleres = useMemo(() => talleresDelPeriodo(Array.isArray(eventos) ? eventos : [], rango.desde, rango.hasta), [eventos, rango.desde, rango.hasta]);
    const puente = useMemo(
        () => (fuente ? puenteRoas({ cash: fuente.cash_total, anterior: fuente.cash_anterior, gasto: fuente.gasto }, talleres) : null),
        [fuente, talleres],
    );
    return { puente, fechas: talleres.map((t) => dia(t.date)).join(', ') };
};

const PuenteRoas = ({ fuente, rango, moneda, onVer = null }) => {
    const { puente, fechas } = usePuente(fuente, rango);
    if (!puente) return null;
    const meta = (
        <>
            <span>Todos <b className="num" style={{ color: WORKSHOP.color }}>{veces(redondo(puente.todos))}</b></span>
            <span>Workshop <b className="num" style={{ color: WORKSHOP.color }}>{veces(redondo(puente.talleres))}</b></span>
        </>
    );
    return (
        <section className="mk-puente" aria-label="Por qué difieren los dos ROAS">
            <Accordion items={[{
                key: 'puente', title: '¿Por qué difieren los dos ROAS?', meta,
                children: () => <CuentaDelPuente puente={puente} fuente={fuente} rango={rango} moneda={moneda} onVer={onVer} fechas={fechas} />,
            }]} />
        </section>
    );
};

export default PuenteRoas;
