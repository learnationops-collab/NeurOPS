import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Tags } from 'lucide-react';
import { Columnas } from './SerieDiaria';
import CajaDeTabla from './CajaDeTabla';
import { Kpi } from './TablaAnuncios';
import { ErrorDeCarga, EsqueletoKpis, EsqueletoPanelTabla, HuesosSerie } from '../esqueletos';
import EnlaceMeta from './EnlaceMeta';
import { enlaceAdministrador } from './enlacesMeta';
import { dinero, formatear } from './metricas';
import { serieDeFuente } from './fuentes';
import { EsqueletoTarjetasFuente, TarjetasFuente } from './FuentesResumen';
import { useRegistrosMarketing } from './useRegistrosMarketing';
import { mensajeDeError, pedirWorkshopDelPeriodo } from './marketingApi';
import { useDatosCacheados } from '../../../../services/cacheDeVistas';

/**
 * Rendimiento › Workshop: los anuncios de Meta que llevan a la clase en vivo (embudo «workshop») en el
 * período. No tienen palabra clave de ManyChat, así que no están en la tabla de Setting: acá van su
 * gasto, impresiones, clics y lo que trajeron a las landings (visitas y clics al grupo de WhatsApp, por
 * el id de la campaña en `utm_campaign`). Por taller, en Workshop Intelligence › Embudo.
 *
 * «Ver en Meta» abre el Administrador de anuncios con estas campañas elegidas (y cada fila, la suya);
 * «Corregir embudos» lleva a la pestaña Meta Ads de acá, donde se cambia el embudo de un anuncio.
 *
 * Su pedido sale apenas se abre, sin esperar al tablero: KPIs y tabla aparecen con lo suyo, y el gráfico
 * por día (que sale de los `embudos` del tablero) espera solo a ese dato.
 */
const pct = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}%`);

const Celdas = ({ fila, moneda, landings }) => (
    <>
        <td className="mk-num num">{formatear(fila.gasto, 'money', moneda)}</td>
        <td className="mk-num num">{formatear(fila.impresiones, 'num')}</td>
        <td className="mk-num num">{formatear(fila.clics, 'num')}</td>
        <td className="mk-num num">{pct(fila.ctr)}</td>
        <td className="mk-num num">{formatear(fila.cpc, 'money', moneda)}</td>
        <td className="mk-num num">{formatear(fila.cpm, 'money', moneda)}</td>
        <td className="mk-num num">{landings ? formatear(fila.visitas, 'num') : ''}</td>
        <td className="mk-num num">{landings ? formatear(fila.clics_whatsapp, 'num') : ''}</td>
        <td className="mk-num num">{landings ? formatear(fila.costo_whatsapp, 'money', moneda) : ''}</td>
    </>
);

// Los clics al grupo de WhatsApp son los Leads de la tarjeta de la fuente (arriba): no se repiten acá.
const KPIS = ['Clics', 'Visitas a la landing'];
const TITULO = 'Campañas, conjuntos y anuncios de Workshop';

const RendimientoWorkshop = ({ desde, hasta, moneda, embudos, fuente, cuentas, version = 0, irAMeta, base }) => {
    const registros = useRegistrosMarketing(desde, hasta, moneda, base);
    const [abiertasDe, setAbiertasDe] = useState({ de: null, mapa: {} });
    const [intento, setIntento] = useState(0);

    // Recordado por período (cacheDeVistas): volver a Workshop no lo vuelve a pedir.
    const { datos, error: fallo } = useDatosCacheados(`mk:workshop:${desde}:${hasta}`,
        (signal) => pedirWorkshopDelPeriodo(desde, hasta, { signal }), { version: version + intento });
    const error = fallo ? mensajeDeError(fallo, 'No se pudieron traer los anuncios de Workshop.') : null;

    // Con cada dato nuevo, la campaña que más gastó abierta.
    const abiertas = abiertasDe.de === datos ? abiertasDe.mapa
        : (datos?.campanas.length ? { [datos.campanas[0].campana_id]: true } : {});

    // Gasto, agendas y costo por agenda por día: la serie de Workshop con lo mismo que la de Setting.
    const dias = useMemo(() => (embudos && fuente ? serieDeFuente(embudos, fuente, desde, hasta) : null),
        [embudos, fuente, desde, hasta]);

    const grafico = (titulo, key, label, color, formato, vacio) => (
        <section className="panel mk-panel-serie">
            <div className="panel-cab">
                <div className="mk-cab-txt">
                    <p className="t-eyebrow">{titulo} · Workshop</p>
                </div>
            </div>
            {!dias ? <HuesosSerie /> : (
                <Columnas dias={dias} capas={[{ key, label, color }]} formato={formato}
                    etiqueta={`${titulo} de Workshop`} vacio={vacio} />
            )}
        </section>
    );
    const serie = (
        <div className="mk-series3">
            {grafico('Importe gastado por día', 'gasto', 'Gastado', 'var(--info)', (v) => dinero(v, moneda),
                'Los anuncios de Workshop no gastaron en estos días.')}
            {grafico('Agendas por día', 'agendas', 'Agendas', 'var(--cat-2)', (v) => Number(v).toLocaleString('en-US'),
                'No se agendó nadie de Workshop en el período.')}
            {grafico('Costo por agenda por día', 'costo_agenda', 'Costo por agenda', 'var(--warning)', (v) => dinero(v, moneda),
                'Sin agendas o sin gasto en estos días.')}
        </div>
    );

    if (error && !datos) {
        return <ErrorDeCarga titulo={error} onReintentar={() => setIntento((n) => n + 1)} />;
    }
    if (!datos) {
        return (
            <div className="vista mk-vista">
                <EsqueletoTarjetasFuente />
                <EsqueletoKpis titulos={KPIS} lineas={2} label="Cargando los anuncios de Workshop…" />
                {serie}
                <EsqueletoPanelTabla titulo={TITULO} sub="Los que llevan a la clase en vivo." filas={4} />
            </div>
        );
    }

    const t = datos.totales;
    // El gasto ya está en las tarjetas de la fuente (arriba): acá, el tráfico que trajo.
    const kpis = [
        { titulo: KPIS[0], valor: formatear(t.clics, 'num'),
          sub: `CTR ${pct(t.ctr)} · ${formatear(t.cpc, 'money', moneda)} por clic · CPM ${formatear(t.cpm, 'money', moneda)}`,
          tip: 'Todos los clics. El CPC es por clic en el enlace.' },
        { titulo: KPIS[1], valor: formatear(t.visitas, 'num'),
          sub: 'de los anuncios de Workshop (utm_campaign)',
          tip: 'Visitas a la landing desde estas campañas.' },
    ];
    const alternar = (id) => setAbiertasDe({ de: datos, mapa: { ...abiertas, [id]: !abiertas[id] } });
    const cuenta = cuentas?.[0];
    const deCampana = (c) => enlaceAdministrador(cuenta, 'campana', { campanas: [c.campana_id] });
    const deAnuncio = (c, a) => enlaceAdministrador(cuenta, 'anuncio', { campanas: [c.campana_id], anuncios: [a.meta_ad_id] });

    return (
        <div className="vista mk-vista">
            {embudos && !fuente ? null : (
                <TarjetasFuente fuente={fuente} moneda={moneda} onVer={(metrica, titulo) => registros.abrir('workshop', metrica, titulo)} />
            )}
            {registros.panel}
            <div className="pareja mk-kpis" style={{ '--min': '220px', '--g': 'var(--s4)' }}>
                {kpis.map((k, i) => <Kpi key={k.titulo} {...k} i={i} />)}
            </div>

            {serie}

            <section className="panel mk-panel-tabla">
                <div className="panel-cab mk-tabla-barra">
                    <div className="mk-cab-txt">
                        <h2 className="t-h3">{TITULO}</h2>
                        <p className="t-cap mut40">
                            Los que llevan a la clase en vivo.
                        </p>
                    </div>
                    <div className="panel-cab-der">
                        <button type="button" className="btn btn--linea btn--sm" onClick={irAMeta}
                            title="¿Falta un anuncio o sobra? Se cambia su embudo en la pestaña Meta Ads">
                            <Tags aria-hidden="true" />
                            Corregir embudos
                        </button>
                        <EnlaceMeta href={datos.campanas.length
                            ? enlaceAdministrador(cuenta, 'campana', { campanas: datos.campanas.map((c) => c.campana_id) })
                            : enlaceAdministrador(cuenta)}>
                            Ver en Meta
                        </EnlaceMeta>
                    </div>
                </div>
                {!datos.campanas.length ? (
                    <p className="t-cap mut mk-vacio">
                        {datos.anuncios_workshop
                            ? 'Los anuncios de Workshop no gastaron en el período.'
                            : 'Todavía no hay anuncios clasificados como Workshop.'}
                    </p>
                ) : (
                    <CajaDeTabla>
                        <table className="mk-tabla mk-tabla--meta mk-tabla--ws">
                            <thead>
                                <tr>
                                    <th className="mk-col-nombre" scope="col">Campaña › conjunto › anuncio</th>
                                    <th scope="col" className="mk-num">Gastado</th>
                                    <th scope="col" className="mk-num">Impresiones</th>
                                    <th scope="col" className="mk-num">Clics</th>
                                    <th scope="col" className="mk-num">CTR</th>
                                    <th scope="col" className="mk-num">CPC (enlace)</th>
                                    <th scope="col" className="mk-num">CPM</th>
                                    <th scope="col" className="mk-num">Visitas</th>
                                    <th scope="col" className="mk-num">Clics al grupo</th>
                                    <th scope="col" className="mk-num">Por clic al grupo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {datos.campanas.map((c) => (
                                    <Fragment key={c.campana_id}>
                                        <tr className="mk-ws-campana">
                                            <th className="mk-col-nombre" scope="row">
                                                <span className="mk-ws-nombre">
                                                    <button type="button" className="mk-ws-abrir" onClick={() => alternar(c.campana_id)}
                                                        aria-expanded={!!abiertas[c.campana_id]}>
                                                        {abiertas[c.campana_id] ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                                                        <span className="trunc" title={c.nombre}>{c.nombre}</span>
                                                    </button>
                                                    <EnlaceMeta href={deCampana(c)} className="ibtn mk-ibtn-meta"
                                                        rotulo={`Abrir campaña ${c.nombre} en Meta`} />
                                                </span>
                                            </th>
                                            <Celdas fila={c} moneda={moneda} landings />
                                        </tr>
                                        {abiertas[c.campana_id] && c.conjuntos.map((s) => (
                                            <Fragment key={`${c.campana_id}-${s.nombre}`}>
                                                <tr className="mk-ws-conjunto">
                                                    <th className="mk-col-nombre" scope="row"><span className="trunc" title={s.nombre}>{s.nombre || 'Sin conjunto'}</span></th>
                                                    <Celdas fila={s} moneda={moneda} />
                                                </tr>
                                                {s.anuncios.map((a) => (
                                                    <tr key={a.meta_ad_id} className="mk-ws-anuncio">
                                                        <th className="mk-col-nombre" scope="row">
                                                            <span className="mk-ws-nombre">
                                                                <span className="trunc" title={a.nombre}>{a.nombre}</span>
                                                                <EnlaceMeta href={deAnuncio(c, a)} className="ibtn mk-ibtn-meta"
                                                                    rotulo={`Abrir anuncio ${a.nombre} en Meta`} />
                                                            </span>
                                                        </th>
                                                        <Celdas fila={a} moneda={moneda} />
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="mk-ws-total">
                                    <th className="mk-col-nombre" scope="row">Total de Workshop</th>
                                    <Celdas fila={t} moneda={moneda} landings />
                                </tr>
                            </tfoot>
                        </table>
                    </CajaDeTabla>
                )}
            </section>
        </div>
    );
};

export default RendimientoWorkshop;
