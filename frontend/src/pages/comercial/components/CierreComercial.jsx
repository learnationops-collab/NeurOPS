import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import MetricaClicable, { abrir } from '../../../components/dashboard/MetricaClicable';
import { Pct } from '../../../components/dashboard/piezasCierres';
import { Tip } from './Shared';
import VsPrevio, { Delta } from './VsPrevio';
import { CANALES } from './embudoCanales';
import './cierreComercial.css';

/**
 * Panel Cierre del dashboard comercial (09/11/2026, pedido de Mario): cuántas ventas, señas y no cerradas hubo, y
 * el close rate por llamada y por presentación, solo ventas y con señas. Abajo, el mismo close rate por canal
 * (directas / desde triage). CADA cifra lleva al lado la del período comparado y el cambio (`VsPrevio`); el
 * período se nombra una vez, en la cabecera del panel.
 *
 * Lee `bloque.cierres` (`matriz_de_cierres`) y `bloque.cierres_canal`, y lo mismo del bloque comparado.
 *
 * 20/11/2026 (ADR-W186, pedido de Mario para la dirección comercial), sin sacar nada de lo que ya mostraba:
 * un aviso con las agendas sin resultado (no cuentan como tomadas, así que bajan las tasas), el camino entero
 * alrededor de la barra de presentación (agendas → se presentaron → presentación → compraron), el close rate
 * por agenda como tercer anillo y como columna en el corte por canal.
 */
const tasa = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : null);
const pctTexto = (x) => (x == null ? '—' : `${x}%`);

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

/** Una fila de la tabla bajo el anillo: la tasa de ahora, la de antes con su cuenta y el cambio. */
const FilaTasa = ({ rotulo, tono, num, den, previoNum, previoDen, vs }) => {
    const ahora = tasa(num, den);
    const antes = previoDen != null ? tasa(previoNum, previoDen) : null;
    return (
        <div className="cc-tasa" role="row"
            title={`${rotulo}: ${num} de ${den}${previoDen != null ? ` · ${vs || 'Período comparado'}: ${previoNum} de ${previoDen}` : ''}`}>
            <span className="cc-tasa-rot" role="rowheader"><i className={`cc-punto cc-punto--${tono}`} />{rotulo}</span>
            <b className={`cc-tasa-n cc-tasa-n--${tono} num`} role="cell">{pctTexto(ahora)}</b>
            {previoDen != null ? (
                <>
                    <span className="cc-tasa-antes num" role="cell">
                        {pctTexto(antes)}<small>{previoNum}/{previoDen}</small>
                    </span>
                    <span role="cell"><Delta actual={ahora} previo={antes} /></span>
                </>
            ) : <><span role="cell" /><span role="cell" /></>}
        </div>
    );
};

const Lectura = ({ titulo, ayuda, ventas, senas, den, unidad, destino, irA, previo, vs }) => {
    const solo = tasa(ventas, den);
    const hayPrevio = previo && previo.den != null;
    return (
        <div className="cc-lectura" role="group" aria-label={titulo}>
            <div className="cc-lectura-cab">
                <small className="cc-titulo">{titulo}</small>
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
            <div className="cc-tabla" role="table" aria-label={`${titulo}: ahora y antes`}>
                {hayPrevio && (
                    <div className="cc-tasa cc-tasa--cab" role="row">
                        <span role="columnheader" /><small role="columnheader">Ahora</small>
                        <small role="columnheader">Antes</small><span role="columnheader" />
                    </div>
                )}
                <FilaTasa rotulo="Ventas" tono="ventas" num={ventas} den={den} vs={vs}
                    previoNum={previo?.ventas} previoDen={hayPrevio ? previo.den : null} />
                <FilaTasa rotulo="+ Señas" tono="senas" num={ventas + senas} den={den} vs={vs}
                    previoNum={hayPrevio ? previo.ventas + previo.senas : null} previoDen={hayPrevio ? previo.den : null} />
            </div>
        </div>
    );
};

/** Una cifra grande de arriba (ventas, señas o no cerradas) con la de antes debajo. */
const Conteo = ({ n, previo, rotulo, tono, onClick, titulo, mejorBaja, vs }) => {
    const cuerpo = (
        <>
            <span className="cc-conteo-fila">
                <Pct valor={String(n ?? 0)} sufijo="" className={`cc-n cc-n--${tono}`} />
                <small className="cc-conteo-rot">{rotulo}</small>
            </span>
            <VsPrevio actual={n ?? 0} previo={previo} texto={String(previo)} mejorBaja={mejorBaja} vs={vs} />
        </>
    );
    return onClick ? (
        <button type="button" className="cc-conteo cc-conteo--clic" onClick={onClick} title={titulo}>
            {cuerpo}<ChevronRight size={14} className="cc-flecha" aria-hidden="true" />
        </button>
    ) : <div className="cc-conteo" title={titulo}>{cuerpo}</div>;
};

/** Un paso del camino: la tasa sobre el paso anterior, su cuenta y la de antes. */
const PasoCamino = ({ rotulo, n, celda, previo, vs, titulo, clase = '' }) => (
    <div className={`cc-paso ${clase}`} title={titulo}>
        <small className="cc-paso-rot">{rotulo}</small>
        <b className="cc-paso-n num">{n}</b>
        {celda && (
            <>
                <span className="cc-pres-riel" aria-hidden="true"><i style={{ '--w': `${celda.pct || 0}%` }} /></span>
                <span className="cc-paso-pct"><b className="num">{pctTexto(celda.pct)}</b><small className="num">{celda.num}/{celda.den}</small></span>
                <VsPrevio actual={celda.pct} previo={previo?.pct} texto={pctTexto(previo?.pct)} vs={vs}
                    detalle={previo ? `${previo.num}/${previo.den}` : null} className="cc-pres-vs" />
            </>
        )}
    </div>
);

const celdaDe = (num, den) => (den ? { num, den, pct: tasa(num, den) } : null);

/** El camino de la agenda a la venta, alrededor de la tasa de presentación (lo que responde el closer en el
 * reporte: «¿presentaste la oferta?»), que conserva su cuenta y la de antes. Muestra dónde se pierde la venta:
 * en que no se presentan, en que no se presenta la oferta o en el cierre. */
const Camino = ({ agendas, c, previoAgendas, p, vs }) => (
    <div className="cc-camino" role="group" aria-label="De la agenda a la venta">
        <PasoCamino rotulo="Agendas" n={agendas} vs={vs} titulo="Agendas del período"
            previo={null} celda={null} />
        <PasoCamino rotulo="Se presentaron" n={c.asistieron} vs={vs} titulo="Llamadas con show up, sobre las agendas"
            celda={celdaDe(c.asistieron, agendas)} previo={p ? celdaDe(p.asistieron, previoAgendas) : null} />
        <PasoCamino rotulo="Presentación" n={c.presentaciones} vs={vs}
            titulo={c.presentacion ? `Presentaron la oferta en ${c.presentacion.num} de ${c.presentacion.den} llamadas con show up` : ''}
            celda={c.presentacion} previo={p?.presentacion} />
        <PasoCamino rotulo="Compraron" n={c.ventas} vs={vs} clase="cc-paso--venta" titulo="Ventas sobre las presentaciones"
            celda={celdaDe(c.ventas, c.presentaciones)} previo={p ? celdaDe(p.ventas, p.presentaciones) : null} />
    </div>
);

/** Las agendas que ya pasaron sin resultado: mientras falten, las tasas son más bajas de lo real. */
const AvisoSinResultado = ({ datos, onVer }) => (datos?.n ? (
    <div className="cc-aviso" role="status">
        <AlertTriangle size={15} aria-hidden="true" />
        <span>
            <b>{datos.n === 1 ? '1 agenda todavía sin resultado' : `${datos.n} agendas todavía sin resultado`}</b>
            {' '}({datos.por_closer.map(x => `${x.nombre} ${x.n}`).join(', ')}): no cuentan como tomadas y las tasas
            pueden estar más bajas de lo real.
        </span>
        {onVer && <button type="button" className="cc-aviso-ver" onClick={onVer}>Ver en Revisar <ChevronRight size={13} aria-hidden="true" /></button>}
    </div>
) : null);

/** Una celda de la tabla por canal: la tasa y, debajo, la de antes con su cambio. */
const CeldaCanal = ({ ahora, antes, clase, titulo }) => (
    <span className="cc-celda" role="cell" title={titulo}>
        <b className={`num ${clase}`}>{pctTexto(ahora)}</b>
        {antes != null && (
            <small className="cc-celda-antes num">{pctTexto(antes)} <Delta actual={ahora} previo={antes} /></small>
        )}
    </span>
);

/** Close rate por canal: barra de ventas + señas sobre las que asistieron de ese canal. */
const FilaCanal = ({ canal, d, p }) => {
    const ancho = (x) => `${d.asistieron ? (x / d.asistieron) * 100 : 0}%`;
    const de = (x, k) => {
        if (!x) return undefined;
        if (k === 'pres') return tasa(x.ventas, x.presentaciones);
        if (k === 'agenda') return x.agendas == null ? undefined : tasa(x.ventas, x.agendas);
        return tasa(x.ventas + (k === 'con' ? x.senas : 0), x.asistieron);
    };
    const celdas = [
        { k: 'agenda', clase: 'cc-canal-v2', t: 'Close rate por agenda' },
        { k: 'solo', clase: 'cc-canal-pct', t: 'Close rate por llamada' },
        { k: 'pres', clase: 'cc-canal-v2', t: 'Close rate por presentación' },
        { k: 'con', clase: 'cc-canal-v2 cc-canal-con', t: 'Ventas + señas, por llamada' },
    ];
    return (
        <div className="cc-canal" role="row" style={{ '--c': canal.color }}>
            <span className="cc-canal-nombre" role="rowheader"
                title={`${canal.nombre}: ${d.ventas} ventas y ${d.senas} señas de ${d.asistieron} llamadas con show up`
                    + ` (${d.presentaciones} presentaciones, ${d.agendas ?? '—'} agendas)`
                    + (d.asistieron < 10 ? '. Con menos de 10 llamadas, una venta mueve mucho el porcentaje.' : '')}>
                <i className="cc-punto" style={{ background: canal.color }} />{canal.nombre}
            </span>
            <span className="cc-canal-riel" aria-hidden="true">
                <i className="cc-canal-v" style={{ '--w': ancho(d.ventas) }} />
                <i className="cc-canal-s" style={{ '--w': ancho(d.senas) }} />
            </span>
            {celdas.map(c => (
                <CeldaCanal key={c.k} clase={c.clase} ahora={de(d, c.k)} antes={p ? de(p, c.k) : undefined}
                    titulo={p ? `${c.t}: ${pctTexto(de(d, c.k))} · antes ${pctTexto(de(p, c.k))}` : c.t} />
            ))}
        </div>
    );
};

const CierreComercial = ({ cierres, previo, previoCanal, vsLabel, porCanal, destinos, irA, onVerNoCerradas,
    agendas = null, previoAgendas = null, sinResultado = null, children = null }) => {
    const c = cierres;
    const p = previo;
    const abrirLista = (d) => abrir(irA, d);
    const verSinResultado = sinResultado?.n && irA
        ? abrirLista({ tabla: 'agendas', filtro: { estado: sinResultado.filtros }, de: 'Sin resultado' }) : null;
    const conAgenda = agendas != null;
    return (
        <div className="cc">
            <AvisoSinResultado datos={sinResultado} onVer={verSinResultado} />
            <div className="cc-conteos">
                <Conteo n={c.ventas} previo={p?.ventas} rotulo="ventas" tono="ventas" vs={vsLabel}
                    titulo={`${c.ventas_completo} pago completo + ${c.ventas_split} split pay`}
                    onClick={c.ventas ? abrirLista(destinos.sin_senas.por_llamada) : undefined} />
                <Conteo n={c.senas} previo={p?.senas} rotulo="señas" tono="senas" vs={vsLabel} titulo="Señas sin completar"
                    onClick={c.senas ? abrirLista(destinos.solo_senas.por_llamada) : undefined} />
                <Conteo n={c.no_cerradas?.num} previo={p?.no_cerradas?.num} rotulo="no cerradas" tono="no" mejorBaja
                    vs={vsLabel} titulo="Asistieron y no compraron ni dejaron seña"
                    onClick={c.no_cerradas?.num ? (onVerNoCerradas || abrirLista(destinos.no_cerradas)) : undefined} />
            </div>
            {conAgenda
                ? <Camino agendas={agendas} c={c} previoAgendas={previoAgendas} p={p} vs={vsLabel} />
                : <PasoCamino rotulo="Presentación" n={c.presentaciones} celda={c.presentacion} previo={p?.presentacion} vs={vsLabel} />}
            <div className={`cc-lecturas${conAgenda ? ' cc-lecturas--3' : ''}`}>
                {conAgenda && (
                    <Lectura titulo="Por agenda" unidad="agendas" irA={irA} vs={vsLabel}
                        ayuda="Sobre todas las agendas del período, también las de quienes no se presentaron."
                        ventas={c.ventas} senas={c.senas} den={agendas}
                        destino={destinos.sin_senas.por_llamada}
                        previo={p && previoAgendas != null ? { ventas: p.ventas, senas: p.senas, den: previoAgendas } : null} />
                )}
                <Lectura titulo="Por llamada" unidad="llamadas con show up" irA={irA} vs={vsLabel}
                    ayuda="Sobre todas las llamadas a las que el lead se presentó."
                    ventas={c.ventas} senas={c.senas} den={c.asistieron}
                    destino={destinos.sin_senas.por_llamada}
                    previo={p ? { ventas: p.ventas, senas: p.senas, den: p.asistieron } : null} />
                <Lectura titulo="Por presentación" unidad="presentaciones" irA={irA} vs={vsLabel}
                    ayuda="Sobre las llamadas donde se llegó a presentar la oferta."
                    ventas={c.ventas} senas={c.senas} den={c.presentaciones}
                    destino={destinos.sin_senas.por_presentacion}
                    previo={p ? { ventas: p.ventas, senas: p.senas, den: p.presentaciones } : null} />
            </div>
            {porCanal && (
                <div className="cc-canales" role="table" aria-label="Close rate por canal">
                    <div className="cc-canal cc-canal--cab" role="row">
                        <span role="columnheader" /><span role="columnheader" />
                        <small role="columnheader">Agenda</small>
                        <small role="columnheader">Llamada</small>
                        <small role="columnheader">Present.</small>
                        <small role="columnheader" className="cc-canal-con">+ Señas</small>
                    </div>
                    {CANALES.map(k => porCanal[k.clave] && (
                        <FilaCanal key={k.clave} canal={k} d={porCanal[k.clave]} p={previoCanal?.[k.clave]} />
                    ))}
                </div>
            )}
            {/* Lo que el tablero suma debajo, dentro del mismo panel (la tira «1ª y 2ª llamada», ADR-W144). */}
            {children}
        </div>
    );
};

export default CierreComercial;
