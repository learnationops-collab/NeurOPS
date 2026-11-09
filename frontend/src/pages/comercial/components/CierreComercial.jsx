import React from 'react';
import { ChevronRight } from 'lucide-react';
import MetricaClicable, { abrir } from '../../../components/dashboard/MetricaClicable';
import { Pct } from '../../../components/dashboard/piezasCierres';
import { Tip } from './Shared';
import { CANALES } from './embudoCanales';
import './cierreComercial.css';

/**
 * Panel Cierre del dashboard comercial (09/11/2026, pedido de Mario): a primera vista, cuántas ventas
 * hubo y el close rate por llamada y por presentación, cada uno solo con ventas (pago completo + split
 * pay) y con señas sumadas. Abajo, el mismo close rate por canal (directas / desde triage), que antes
 * estaba en el embudo. Más gráfico que texto: un anillo por lectura, la cuenta va en el tooltip.
 *
 * Lee `bloque.cierres` (`matriz_de_cierres`) y `bloque.cierres_canal`. Las ventas y las señas son
 * agendas en «Venta» y en «Seña», una por lead (`_ultima_por_lead`): no se pisan.
 */
const tasa = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : null);

/** Anillo: ventas (azul) y, a continuación, señas (rosa), sobre el denominador. */
const Anillo = ({ ventas, senas, den, children }) => {
    const r = 46;
    const largo = 2 * Math.PI * r;
    const pv = den ? ventas / den : 0;
    const ps = den ? senas / den : 0;
    return (
        <div className="cc-anillo">
            <svg viewBox="0 0 110 110" aria-hidden="true">
                <circle className="cc-anillo-pista" cx="55" cy="55" r={r} />
                <circle className="cc-anillo-arco cc-anillo-arco--senas" cx="55" cy="55" r={r}
                    style={{ '--fin': largo * (1 - pv - ps), '--largo': largo, '--demora': '380ms' }} />
                <circle className="cc-anillo-arco cc-anillo-arco--ventas" cx="55" cy="55" r={r}
                    style={{ '--fin': largo * (1 - pv), '--largo': largo, '--demora': '160ms' }} />
            </svg>
            <div className="cc-anillo-centro">{children}</div>
        </div>
    );
};

const Lectura = ({ titulo, ayuda, ventas, senas, den, unidad, destino, irA }) => {
    const solo = tasa(ventas, den);
    const con = tasa(ventas + senas, den);
    return (
        <div className="cc-lectura" role="group" aria-label={titulo}>
            <div className="cc-lectura-cab">
                <small className="cc-eyebrow">{titulo}</small>
                <Tip titulo={titulo} texto={`${ayuda} Close rate: ${ventas} ventas de ${den} ${unidad}. `
                    + `Con señas: ${ventas + senas} de ${den}.`} />
            </div>
            <Anillo ventas={ventas} senas={senas} den={den}>
                <MetricaClicable irA={irA} destino={destino} vacio={!ventas} subrayar={false}
                    detalle={`${titulo} · ${ventas} de ${den}`}>
                    <Pct valor={solo} className="cc-pct" />
                </MetricaClicable>
                <small className="cc-frac" title={`${ventas} ventas de ${den} ${unidad}`}>{ventas}/{den}</small>
            </Anillo>
            <div className="cc-con" title={`Ventas + señas: ${ventas + senas} de ${den} ${unidad}`}>
                <i className="cc-punto cc-punto--senas" aria-hidden="true" />
                <small>con señas</small>
                <b className="num">{con === null ? '—' : `${con}%`}</b>
            </div>
        </div>
    );
};

/** Una cifra grande del pie superior: ventas, señas o no cerradas. */
const Conteo = ({ n, rotulo, tono, onClick, titulo }) => {
    const cuerpo = (
        <>
            <Pct valor={String(n ?? 0)} sufijo="" className={`cc-n cc-n--${tono}`} />
            <small className="cc-conteo-rot">{rotulo}</small>
        </>
    );
    return onClick ? (
        <button type="button" className="cc-conteo cc-conteo--clic" onClick={onClick} title={titulo}>
            {cuerpo}<ChevronRight size={13} className="cc-flecha" aria-hidden="true" />
        </button>
    ) : <div className="cc-conteo" title={titulo}>{cuerpo}</div>;
};

/** Close rate por canal: barra de ventas + señas sobre las que asistieron de ese canal. */
const FilaCanal = ({ canal, d }) => {
    const solo = tasa(d.ventas, d.asistieron);
    const con = tasa(d.ventas + d.senas, d.asistieron);
    const pres = tasa(d.ventas, d.presentaciones);
    const ancho = (x) => `${d.asistieron ? (x / d.asistieron) * 100 : 0}%`;
    return (
        <div className="cc-canal" style={{ '--c': canal.color }}
            title={`${canal.nombre}: ${d.ventas} ventas y ${d.senas} señas de ${d.asistieron} llamadas con show up`
                + ` (${d.presentaciones} presentaciones)`}>
            <span className="cc-canal-nombre"><i className="cc-punto" style={{ background: canal.color }} />{canal.nombre}</span>
            <span className="cc-canal-riel" aria-hidden="true">
                <i className="cc-canal-v" style={{ '--w': ancho(d.ventas) }} />
                <i className="cc-canal-s" style={{ '--w': ancho(d.senas) }} />
            </span>
            <b className="cc-canal-pct num">{solo === null ? '—' : `${solo}%`}</b>
            <small className="cc-canal-sub num">
                <span title="Por presentación">{pres === null ? '—' : `${pres}%`}</span>
                <span className="cc-canal-con" title="Con señas, por llamada">{con === null ? '—' : `${con}%`}</span>
            </small>
        </div>
    );
};

const CierreComercial = ({ cierres, porCanal, destinos, irA, onVerNoCerradas }) => {
    const c = cierres;
    const abrirLista = (d) => abrir(irA, d);
    return (
        <div className="cc">
            <div className="cc-conteos">
                <Conteo n={c.ventas} rotulo="ventas" tono="ventas"
                    titulo={`${c.ventas_completo} pago completo + ${c.ventas_split} split pay`}
                    onClick={c.ventas ? abrirLista(destinos.sin_senas.por_llamada) : undefined} />
                <Conteo n={c.senas} rotulo="señas" tono="senas" titulo="Señas sin completar"
                    onClick={c.senas ? abrirLista(destinos.solo_senas.por_llamada) : undefined} />
                <Conteo n={c.no_cerradas?.num} rotulo="no cerradas" tono="no"
                    titulo="Asistieron y no compraron ni dejaron seña"
                    onClick={c.no_cerradas?.num ? (onVerNoCerradas || abrirLista(destinos.no_cerradas)) : undefined} />
            </div>
            <div className="cc-lecturas">
                <Lectura titulo="Por llamada" unidad="llamadas con show up" irA={irA}
                    ayuda="Sobre todas las llamadas a las que el lead se presentó."
                    ventas={c.ventas} senas={c.senas} den={c.asistieron}
                    destino={destinos.sin_senas.por_llamada} />
                <Lectura titulo="Por presentación" unidad="presentaciones" irA={irA}
                    ayuda="Sobre las llamadas donde se llegó a presentar la oferta."
                    ventas={c.ventas} senas={c.senas} den={c.presentaciones}
                    destino={destinos.sin_senas.por_presentacion} />
            </div>
            {porCanal && (
                <div className="cc-canales" role="group" aria-label="Close rate por canal">
                    <div className="cc-canal cc-canal--cab" aria-hidden="true">
                        <span /><span />
                        <small>llamada</small>
                        <small className="cc-canal-sub"><span>present.</span><span className="cc-canal-con">c/ señas</span></small>
                    </div>
                    {CANALES.map(k => porCanal[k.clave] && (
                        <FilaCanal key={k.clave} canal={k} d={porCanal[k.clave]} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default CierreComercial;
