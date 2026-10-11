import React from 'react';
import { ChevronDown } from 'lucide-react';
import Cifra from './Cifra';
import FlujoEmbudo from './FlujoEmbudo';
import { Segmented, Tip, fmt, useMontado } from './Shared';
import MetricaClicable, { abrir } from '../../../components/dashboard/MetricaClicable';
import { DESTINOS_SETTER as S } from './destinos';
import { COLOR_CANAL, COLOR_FUENTE, NOMBRE_CANAL, etapasParaDibujar, puntaAPunta } from './embudoSetter';
import { Delta, Gruesa, Panel, PanelCab, Tile, Vacio, v } from './PiezasAnalizar';
import './dashboardSetters.css';

/**
 * Analizar → Dashboard con Setters: el MISMO tablero para la dirección (una persona o el equipo) y
 * para el setter en su «Mis datos» (10/10/2026).
 *
 * El diseño es el de main —tiles arriba, Cualificación y Conversión con las barras gruesas— porque el
 * dueño lo prefirió («mejor organizado para ver lo más importante, ordenado y con poco texto»), con
 * los datos corregidos: la conversación sale del reporte diario y lo que pasa después de la agenda,
 * del sistema (ver `app/services/setter_analitica.py`). De lo que se hizo para «Mis datos» se quedan
 * el embudo de punta a punta, los follow-ups (con su respuesta, en lugar de los toques de ManyChat),
 * Por canal y la Constancia con los wins.
 *
 * Las pestañas General · Anuncios · Inbound (`canal`, en la URL) cambian solo lo que el reporte separa
 * por canal; lo demás —bienvenidas, follow-ups, el sistema— es uno solo y lo dice su tooltip. No hay
 * pedido nuevo: el backend manda las tres vistas en el mismo resumen.
 *
 * Poco texto (pedido explícito): rótulos cortos, números grandes y la explicación en el tooltip.
 * Los números del sistema abren su lista en Revisar; los del reporte no tienen lista, son lo que el
 * setter cargó.
 */

const VISTAS = [
    { key: 'general', label: 'General' },
    { key: 'anuncios', label: 'Anuncios' },
    { key: 'inbound', label: 'Inbound' },
];

/** El tooltip de algo que no se separa por canal, mirado desde una pestaña de canal. */
const enCanalNo = (texto, canal) => (canal ? `${texto.replace(/\.$/, '')}, sin separar por canal.` : texto);

/* ============================================================
   CONVERSACIÓN (el reporte)
   ============================================================ */

const PanelCualificacion = ({ r }) => (
    <Panel id="p-cualificacion" cab={
        <PanelCab titulo="Cualificación" ayuda="Cómo se reparten los entrantes reportados.">
            <span className="t-cap mut40 num">{fmt.plural(r.entrantes, 'entrante', 'entrantes')}</span>
        </PanelCab>
    }>
        <div className="gruesa--sm ds-barras">
            <Gruesa i={0} label="Cualificados" cuenta={fmt.num(r.cualificados)}
                help="Entrantes menos no leads e in-abribles." pct={fmt.pct(r.cualificacion)}
                tone="success" w={r.cualificacion} />
            <Gruesa i={1} label="No leads" cuenta={fmt.num(r.no_lead)}
                help="Entrantes marcados como no lead en el reporte." pct={fmt.pct(r.no_lead_pct)}
                tone="warning" w={r.no_lead_pct} />
            <Gruesa i={2} label="In-abribles" cuenta={fmt.num(r.inabribles)}
                help="Entrantes marcados como in-abribles en el reporte." pct={fmt.pct(r.inabribles_pct)}
                tone="error" w={r.inabribles_pct} />
        </div>
    </Panel>
);

const PanelConversion = ({ r, canal }) => (
    <Panel id="p-conversion" cab={
        <PanelCab titulo="Conversión" ayuda="Las mismas agendas reportadas, medidas desde tres puntos del embudo.">
            <span className="t-cap mut40 num">{fmt.plural(r.agendas, 'agenda', 'agendas')}</span>
        </PanelCab>
    }>
        <div className="gruesa--sm ds-barras">
            <Gruesa i={0} label="Conv. final" cuenta={`sobre ${fmt.num(r.entrantes)}`}
                help="Agendas reportadas sobre entrantes reportados, de punta a punta."
                pct={fmt.pct(r.conversion)} tone="warning" w={r.conversion} />
            <Gruesa i={1} label="De cualificado a agenda" cuenta={`sobre ${fmt.num(r.cualificados)}`}
                help="Agendas sobre cualificados, como en el formulario del reporte."
                pct={fmt.pct(r.conv_cualificados)} tone="info" w={r.conv_cualificados} />
            <Gruesa i={2} label="De link a agenda"
                cuenta={canal ? 'sin separar por canal' : `sobre ${fmt.num(r.link)}`}
                help={canal ? 'El link es un total del reporte: sin separar por canal.'
                    : 'Agendas sobre los links de agenda enviados.'}
                pct={fmt.pct(r.conv_link)} tone="success" w={r.conv_link} />
        </div>
    </Panel>
);

const Leyenda = ({ canal }) => (canal ? (
    <div className="leyenda">
        <span title="Lo que cargó el setter para este canal"><i style={{ background: COLOR_CANAL[canal] }} />{NOMBRE_CANAL[canal]}</span>
    </div>
) : (
    <div className="leyenda">
        <span title="Lo que cargó el setter"><i style={{ background: COLOR_FUENTE.reporte }} />Reporte</span>
        <span title="Lo que registra el sistema"><i style={{ background: COLOR_FUENTE.sistema }} />Sistema</span>
        <span title="Agendas reportadas de anuncios"><i style={{ background: COLOR_CANAL.anuncios }} />Anuncios</span>
        <span title="Agendas reportadas de inbound"><i style={{ background: COLOR_CANAL.inbound }} />Inbound</span>
    </div>
));

/**
 * El embudo de punta a punta («me gusta, reemplazá el embudo de main por este»): del reporte hasta
 * las agendas y del sistema desde las generadas hasta las ventas. En una pestaña de canal quedan las
 * etapas que el reporte separa por canal; dolor, oferta, link y el sistema son uno solo y mezclarlos
 * con un canal daría conversiones de más de 100%.
 */
const PanelEmbudo = ({ bloque, r, canal, irA }) => {
    const etapas = canal
        ? [{ key: 'entrantes', label: 'Entrantes', n: r.entrantes, color: COLOR_CANAL[canal] },
            { key: 'cualificados', label: 'Cualificados', n: r.cualificados, color: COLOR_CANAL[canal] },
            { key: 'agendas', label: 'Agendas', n: r.agendas, color: COLOR_CANAL[canal] }]
        : etapasParaDibujar(bloque.funnel, irA ? (e) => abrir(irA, S[e.key]) : null);
    const final = puntaAPunta(etapas);
    const primera = etapas[0], ultima = etapas[etapas.length - 1];
    return (
        <Panel id="p-embudo-set" cab={
            <PanelCab titulo="Embudo de punta a punta"
                ayuda={canal ? 'Solo lo que el reporte separa por canal; el resto se ve en General.'
                    : 'Del reporte hasta las agendas; del sistema, de las generadas a las ventas.'}>
                <span className="t-cap mut num" title={`De ${primera.label.toLowerCase()} a ${ultima.label.toLowerCase()}`}>
                    {fmt.num(primera.n)} → {fmt.num(ultima.n)}{final !== null && ` · ${final}%`}
                </span>
            </PanelCab>
        }>
            <FlujoEmbudo etapas={etapas} color={canal ? COLOR_CANAL[canal] : undefined} />
            <Leyenda canal={canal} />
        </Panel>
    );
};

/* ============================================================
   FOLLOW-UPS
   ============================================================ */

const ETAPAS_FU = { entrantes: 'Entrantes', dolor: 'Dolor', oferta: 'Oferta', link: 'Link' };

/**
 * Los follow-ups por etapa y cuántos respondieron (reemplaza la «Tenacidad del seguimiento», que
 * contaba toques de ManyChat). Sin respondidos en el reporte la respuesta es «—»: no se deduce.
 */
const PanelSeguimientos = ({ fu, delta, canal }) => {
    const montado = useMontado();
    const tope = Math.max(1, ...fu.etapas.map(e => e.hechos));
    return (
        <Panel id="p-followups" cab={
            <PanelCab titulo="Follow-ups"
                ayuda={enCanalNo('Seguimientos reportados por etapa, y qué parte respondió.', canal)}>
                <span className="t-cap mut40 num" title="Respuesta de todos los follow-ups del período">
                    {fmt.num(fu.total)} · {fmt.pct(fu.respuesta)} resp.
                </span>
                <Delta delta={delta} actual={fmt.num(fu.total)} />
            </PanelCab>
        }>
            {fu.total === 0 ? <Vacio texto="Sin follow-ups en el período." /> : (
                <div className="ds-fu">
                    {fu.etapas.map((e, i) => (
                        <div key={e.key} className="ds-fu-col">
                            <Cifra tag="b" className="ds-fu-n num" valor={fmt.num(e.hechos)} />
                            <span className="ds-fu-pista" aria-hidden="true">
                                <i style={{ height: montado ? `${Math.max(4, (e.hechos / tope) * 100)}%` : 0,
                                    transitionDelay: `${i * 70}ms` }} />
                            </span>
                            <small className="ds-fu-rotulo">{ETAPAS_FU[e.key]}</small>
                            <span className={`ds-fu-resp num${e.respuesta === null ? ' ds-fu-resp--vacia' : ''}`}
                                title={e.respondidos === null
                                    ? 'El reporte no trae cuántos respondieron'
                                    : `${fmt.num(e.respondidos)} de ${fmt.num(e.hechos)} respondieron`}>
                                {fmt.pct(e.respuesta)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
};

/* ============================================================
   DESPUÉS DE LA AGENDA (el sistema)
   ============================================================ */

const Caja = ({ rotulo, ayuda, valor, sub, color, irA, destino, detalle }) => (
    <div className="ds-caja" style={color ? { '--c': color } : undefined}>
        <span className="ds-caja-cab">
            <span className="t-rotulo">{rotulo}</span>
            <Tip texto={ayuda} titulo={rotulo} />
        </span>
        {/* La cantidad y, al lado, su porcentaje: en la misma línea, así la caja no crece. */}
        <span className="ds-caja-cifras">
            <MetricaClicable irA={irA} destino={destino} detalle={detalle} subrayar={false} vacio={valor === '0'}>
                <Cifra className="ds-caja-n num" valor={valor} />
            </MetricaClicable>
            {sub && <span className="t-cap mut num ds-caja-sub">{sub}</span>}
        </span>
    </div>
);

const Baja = () => <span className="ds-baja" aria-hidden="true"><ChevronDown size={16} /></span>;

const PanelDespues = ({ b, comision, canal, irA }) => (
    <Panel id="p-despues" cab={
        <PanelCab titulo="Después de la agenda"
            ayuda={enCanalNo('Del sistema: las agendas generadas, una por persona, y en qué terminaron.', canal)} />
    }>
        <div className="ds-despues">
            <Caja rotulo="Agendas" valor={fmt.num(b.generadas)} irA={irA} destino={S.generadas}
                detalle={`agendas generadas, ${b.generadas}`} color={v('brand-secondary')}
                ayuda="Reservadas en el período, por fecha de creación y una por persona." />
            <Baja />
            <div className="ds-despues-estados">
                <Caja rotulo="Canceladas" valor={fmt.num(b.canceladas)} sub={fmt.pct(b.canceladas_pct)}
                    irA={irA} destino={S.canceladas} detalle={`canceladas, ${b.canceladas}`} color={v('idle')}
                    ayuda="Canceladas; el % es sobre las agendas generadas." />
                <Caja rotulo="Reagendadas" valor={fmt.num(b.reagendadas)} sub={fmt.pct(b.reagendadas_pct)}
                    irA={irA} destino={S.reagendadas} detalle={`reagendadas, ${b.reagendadas}`} color={v('info')}
                    ayuda="Reagendadas; el % es sobre las agendas generadas." />
                <Caja rotulo="No show" valor={fmt.num(b.no_show)} sub={fmt.pct(b.no_show_pct)}
                    irA={irA} destino={S.no_show} detalle={`no show, ${b.no_show}`} color={v('error')}
                    ayuda="No se presentaron; el % es sobre las agendas con resultado." />
                <Caja rotulo="Show up" valor={fmt.num(b.asistieron)} sub={fmt.pct(b.show_up)}
                    irA={irA} destino={S.asistieron} detalle={`show up, ${b.asistieron}`} color={v('success')}
                    ayuda="Asistieron; el % es sobre las agendas con resultado." />
            </div>
            <Baja />
            <div className="ds-despues-fin">
                <Caja rotulo="Ventas" valor={fmt.num(b.ventas_originadas)} sub={fmt.pct(b.cierre)}
                    irA={irA} destino={S.ventas} detalle={`ventas originadas, ${b.ventas_originadas}`}
                    color={v('success')} ayuda="Pago completo o split pay; el % es sobre las que asistieron." />
                <Caja rotulo="Comisión del mes" valor={comision ? fmt.money(comision.commission) : '—'}
                    color={v('success')}
                    sub={comision ? `${comision.rate !== null ? `${Math.round(comision.rate * 100)}% de ` : ''}`
                        + `${fmt.money(comision.cash_neto)} netos` : null}
                    ayuda="Del mes en curso, sea cual sea el período elegido." />
            </div>
        </div>
    </Panel>
);

/* ============================================================
   POR CANAL
   ============================================================ */

const DatoCanal = ({ nombre, valor, ayuda }) => (
    <div className="dato" title={ayuda}>
        <span className="dato-nom">{nombre}</span>
        <span className="dato-v num">{valor}</span>
    </div>
);

const Canal = ({ clave, d, activo }) => (
    <div className="ds-canal" style={{ '--c': COLOR_CANAL[clave] }} data-activo={activo ? '1' : undefined}>
        <span className="ds-canal-cab">
            <span className="chip" style={{ '--c': COLOR_CANAL[clave] }}><i className="ds-punto" />{NOMBRE_CANAL[clave]}</span>
            <Tip titulo={NOMBRE_CANAL[clave]} texto={clave === 'sin_canal'
                ? 'Reportes de antes del formulario por canal: no se reparten.'
                : `Lo que el reporte cargó para ${NOMBRE_CANAL[clave].toLowerCase()}.`} />
        </span>
        <FlujoEmbudo color={COLOR_CANAL[clave]} etapas={[
            { key: 'entrantes', label: 'Entrantes', n: d.entrantes },
            { key: 'cualificados', label: 'Cualificados', n: d.cualificados },
        ]} />
        <div className="datos">
            <DatoCanal nombre="No leads" valor={fmt.num(d.no_lead)} ayuda="Entrantes marcados como no lead." />
            <DatoCanal nombre="In-abribles" valor={fmt.num(d.inabribles)} ayuda="Entrantes marcados como in-abribles." />
            <DatoCanal nombre={`Aperturas · ${fmt.pct(d.apertura)}`} valor={fmt.num(d.aperturas)}
                ayuda="Aperturas en entrantes y en dolor, y su tasa sobre entrantes." />
            <DatoCanal nombre="Agendas" valor={fmt.num(d.agendas)} ayuda="Agendas reportadas en el canal." />
        </div>
    </div>
);

const Bienvenidas = ({ b }) => (
    <div className="ds-canal" style={{ '--c': 'var(--ch-bnv)' }}>
        <span className="ds-canal-cab">
            <span className="chip" style={{ '--c': 'var(--ch-bnv)' }}><i className="ds-punto" />Bienvenidas</span>
            <Tip titulo="Bienvenidas" texto="Las bienvenidas del reporte: hechas, respondidas y aperturas." />
        </span>
        <FlujoEmbudo color="var(--ch-bnv)" etapas={[
            { key: 'hechas', label: 'Hechas', n: b.hechas },
            { key: 'respondidas', label: 'Respondidas', n: b.respondidas },
            { key: 'aperturas', label: 'Aperturas', n: b.aperturas },
        ]} />
        <div className="datos">
            <DatoCanal nombre="Respuesta" valor={fmt.pct(b.respuesta)} ayuda="Respondidas sobre hechas." />
            <DatoCanal nombre="Apertura" valor={fmt.pct(b.apertura)} ayuda="Aperturas sobre respondidas." />
        </div>
    </div>
);

const PanelCanales = ({ bloque, canal }) => {
    const conSinCanal = bloque.sin_canal.entrantes > 0 || bloque.sin_canal.agendas > 0;
    return (
        <Panel id="p-canales" cab={
            <PanelCab titulo="Por canal" ayuda="Anuncios e inbound sobre sus entrantes; las bienvenidas, sobre las hechas." />
        }>
            <div className="pareja" style={{ '--min': '220px', '--g': '12px' }}>
                <Canal clave="anuncios" d={bloque.canales.anuncios} activo={canal === 'anuncios'} />
                <Canal clave="inbound" d={bloque.canales.inbound} activo={canal === 'inbound'} />
                {conSinCanal && <Canal clave="sin_canal" d={bloque.sin_canal} />}
                <Bienvenidas b={bloque.bienvenidas} />
            </div>
        </Panel>
    );
};

/* ============================================================
   CONSTANCIA Y WINS
   ============================================================ */

const ESTADO_DIA = {
    reportado: { tono: 'success', texto: 'reportado' },
    falta: { tono: 'warning', texto: 'sin reporte' },
    finde: { tono: 'idle', texto: 'fin de semana' },
    no_laborable: { tono: 'info', texto: 'no laborable' },
};

const PanelConstancia = ({ dias, wins }) => (
    <Panel id="p-constancia" cab={
        <PanelCab titulo="Constancia" ayuda="Días con reporte sobre los hábiles del período; los no laborables no cuentan." />
    }>
        <div className="ds-constancia">
            <div className="ds-constancia-dias">
                <p className="ds-constancia-n num"
                    title={`${fmt.plural(dias.en_fin_de_semana, 'reporte', 'reportes')} en fin de semana · `
                        + `${fmt.plural(dias.no_laborables, 'día no laborable', 'días no laborables')}`}>
                    <Cifra valor={fmt.num(dias.reportados)} /><span className="mut40"> / {fmt.num(dias.habiles)}</span>
                </p>
                <small className="t-rotulo">días con reporte</small>
                {dias.detalle.length > 0 && (
                    <div className="ds-dias" role="list" aria-label="Día por día">
                        {dias.detalle.map(dia => (
                            <i key={dia.fecha} role="listitem" className={`ds-dia ds-dia--${dia.estado}`}
                                style={{ '--c': v(ESTADO_DIA[dia.estado].tono) }}
                                title={`${fmt.fecha(dia.fecha)} · ${ESTADO_DIA[dia.estado].texto}`}
                                aria-label={`${fmt.fecha(dia.fecha)}, ${ESTADO_DIA[dia.estado].texto}`} />
                        ))}
                    </div>
                )}
            </div>
            <div className="ds-wins">
                <span className="ds-caja-cab">
                    <span className="t-rotulo">Wins</span>
                    <Tip titulo="Wins" texto="Los últimos «Win del día» del reporte." />
                </span>
                {wins.length ? (
                    <ul>
                        {wins.map(w => (
                            <li key={`${w.fecha}-${w.texto}`} title={w.texto}>
                                <span className="t-cap mut40 num">{fmt.fecha(w.fecha)}</span>
                                <span className="t-sm ds-win">{w.texto}</span>
                            </li>
                        ))}
                    </ul>
                ) : <Vacio texto="Sin wins en el período." />}
            </div>
        </div>
    </Panel>
);

/* ============================================================
   TABLERO
   ============================================================ */

const DashboardSetters = ({ bloque, deltas = {}, deltasCanales = {}, comision = null, canal = null,
    onCanal = null, irA }) => {
    // Una pestaña de canal sin datos de canal (un payload viejo) cae en General.
    const enCanal = canal && bloque.canales?.[canal] ? canal : null;
    const r = enCanal ? bloque.canales[enCanal] : bloque;
    const dr = enCanal ? (deltasCanales?.[enCanal] || {}) : deltas;
    const bnv = bloque.bienvenidas;

    return (
        <>
            {onCanal && (
                <div className="fila ds-vistas">
                    <Segmented opciones={VISTAS} valor={enCanal || 'general'} ariaLabel="Canal"
                        onChange={(k) => onCanal(k === 'general' ? null : k)} />
                </div>
            )}

            <div className="ds-tiles-caja"><div className="ds-tiles">
                <Tile label="Entrantes" valor={fmt.num(r.entrantes)} color={v('info')}
                    help="Mensajes nuevos reportados en el período." delta={dr.entrantes}
                    humo={[v('info'), v('brand-primary'), v('info'), v('brand-navy')]}
                    sub={`${fmt.num(r.no_lead)} no leads · ${fmt.num(r.inabribles)} in-abribles`}
                    baja="p-cualificacion" />
                <Tile label="Cualificación" valor={fmt.pct(r.cualificacion)} color={v('success')}
                    help="Entrantes menos no leads e in-abribles, sobre los entrantes." delta={dr.cualificacion}
                    humo={[v('success'), v('info'), v('brand-primary'), v('success')]}
                    sub={`${fmt.num(r.cualificados)} de ${fmt.num(r.entrantes)}`} baja="p-cualificacion" />
                <Tile label="Apertura" valor={fmt.pct(r.apertura)} color={v('warning')}
                    help="Aperturas en entrantes y en dolor, sobre los entrantes." delta={dr.apertura}
                    humo={[v('warning'), v('brand-primary'), v('warning'), v('brand-navy')]}
                    sub={`${fmt.num(r.aperturas)} de ${fmt.num(r.entrantes)}`} baja="p-canales" />
                <Tile label="Agendas" valor={fmt.num(r.agendas)} color={v('brand-secondary')}
                    help="Agendas reportadas en el período." delta={dr.agendas}
                    humo={[v('brand-secondary'), v('brand-secondary-light'), v('brand-primary'), v('brand-navy')]}
                    sub={`${fmt.pct(r.conversion)} de los entrantes`} baja="p-conversion" />
                <Tile label="Bienvenidas" valor={fmt.pct(bnv.respuesta)} color="var(--ch-bnv)"
                    help={enCanalNo('Bienvenidas respondidas sobre las hechas.', enCanal)}
                    delta={deltas.bienvenidas_respuesta}
                    humo={['var(--ch-bnv)', v('brand-primary'), 'var(--ch-bnv)', v('brand-navy')]}
                    sub={`${fmt.num(bnv.respondidas)} de ${fmt.num(bnv.hechas)}`} baja="p-canales" />
            </div></div>

            <div className="grid-2">
                <PanelCualificacion r={r} />
                <PanelConversion r={r} canal={enCanal} />
            </div>

            <PanelEmbudo bloque={bloque} r={r} canal={enCanal} irA={irA} />

            <div className="grid-2">
                <PanelSeguimientos fu={bloque.followups} delta={deltas.followups_total} canal={enCanal} />
                <PanelDespues b={bloque} comision={comision} canal={enCanal} irA={irA} />
            </div>

            <PanelCanales bloque={bloque} canal={enCanal} />

            <PanelConstancia dias={bloque.dias} wins={bloque.wins} />
        </>
    );
};

export default DashboardSetters;
