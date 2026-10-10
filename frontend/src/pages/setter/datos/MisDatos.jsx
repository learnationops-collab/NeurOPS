import React from 'react';
import { ArrowRight } from 'lucide-react';
import Cifra from '../../comercial/components/Cifra';
import FlujoEmbudo from '../../comercial/components/FlujoEmbudo';
import { Delta, EsqueletoTablero, Tip, fmt, useMontado } from '../../comercial/components/Shared';
import { DESTINOS_EMBUDO_SETTER, DESTINOS_SETTER } from '../../comercial/components/destinos';
import { COLOR_CANAL, COLOR_FUENTE, NOMBRE_CANAL, etapasParaDibujar, puntaAPunta } from '../../comercial/components/embudoSetter';

/**
 * «Mis datos» del setter (10/10/2026), en el estilo del reporte diario nuevo.
 *
 * Kerwin: «hay muchos datos del reporte diario que no se ven, el embudo está incompleto, hay datos
 * que no cuadran». La pantalla anterior mostraba solo el sistema (ManyChat y las agendas generadas)
 * y del reporte nada. Esta pone las dos fuentes, cada una con su nombre (ver
 * `app/services/setter_mis_datos.py`):
 *
 *   1. Lo que reportó: entrantes, cualificación, aperturas, agendas, bienvenidas y follow-ups.
 *   2. ¿Cuadra con el sistema?: donde las dos fuentes miden lo mismo, juntas y con la diferencia
 *      («reportaste 75 · el sistema registra 68»), y lo que solo sabe el sistema (asistieron, ventas,
 *      comisión).
 *   3. El embudo de punta a punta, del reporte a las ventas.
 *   4. Por canal (anuncios, inbound, las bienvenidas y, si hay reportes viejos, «sin canal»).
 *   5. Follow-ups por etapa, días reportados y los últimos «Win del día».
 *
 * Los números del sistema abren su lista (`irA(destino)`); los del reporte no tienen lista: son lo
 * que el setter cargó, no filas.
 */

const v = (tono) => `var(--${tono})`;

/** Una barra fina partida por canal, como las de los KPIs del formulario. */
const PorCanal = ({ partes }) => {
    const montado = useMontado();
    const total = partes.reduce((a, p) => a + p.n, 0);
    if (!total) return <span className="md-split" aria-hidden="true" />;
    return (
        <span className="md-split" role="img"
            aria-label={partes.filter(p => p.n).map(p => `${NOMBRE_CANAL[p.key]} ${p.n}`).join(', ')}>
            {partes.map(p => (
                <i key={p.key} style={{ width: montado ? `${(p.n / total) * 100}%` : 0, background: COLOR_CANAL[p.key] }} />
            ))}
        </span>
    );
};

const partesDe = (reporte, campo) => ['anuncios', 'inbound'].map(k => ({ key: k, n: reporte.canales[k][campo] }))
    .concat([{ key: 'sin_canal', n: reporte.sin_canal[campo] }]);

/**
 * Una cifra del reporte. El delta va debajo del número y no al lado del rótulo: al lado, en una
 * columna angosta, partía el encabezado en dos líneas y el número de esa columna quedaba más abajo
 * que los de las otras (lo que Kerwin no quiere ver: «se monta» o «queda desparejo»).
 */
const Kpi = ({ rotulo, valor, sub, delta, ayuda, children }) => (
    <div className="md-kpi">
        <div className="md-kpi-cab">
            <span className="t-rotulo">{rotulo}</span>
            {ayuda && <Tip texto={ayuda} titulo={rotulo} />}
        </div>
        <Cifra tag="p" className="md-kpi-n num" valor={valor} />
        {(sub || delta) && (
            <p className="t-cap mut40 num md-kpi-sub">
                {delta && <Delta delta={delta} />}
                {sub && <span>{sub}</span>}
            </p>
        )}
        {children}
    </div>
);

/** Un número que abre su lista, o el número solo si no hay a dónde ir. */
const Abre = ({ irA, destino, children, detalle }) => (irA && destino ? (
    <button type="button" className="md-abre" onClick={() => irA(destino)}
        aria-label={`Ver en la lista: ${detalle || destino.de}`} title={`Ver en la lista: ${detalle || destino.de}`}>
        {children}
        <ArrowRight size={13} aria-hidden="true" />
    </button>
) : <span className="md-abre md-abre--quieto">{children}</span>);

const Reportado = ({ d }) => {
    const { reporte: r, deltas } = d;
    const t = r.totales, tasas = r.tasas, b = r.bienvenidas;
    return (
        <section className="panel caja md-reportado">
            <div className="panel-cab">
                <h2 className="t-h3">Lo que reportaste</h2>
                <Tip titulo="Lo que reportaste"
                    texto={'La suma de tus reportes diarios del período. Los reportes de antes del 10/10 no '
                        + 'separaban por canal: suman acá y en «Por canal» van aparte, como «sin canal».'} />
                <div className="panel-cab-der">
                    <span className="chip num" style={{ '--c': r.reportes ? v('info') : v('warning') }}>
                        {r.reportes ? fmt.plural(r.reportes, 'reporte', 'reportes') : 'Sin reportes en el período'}
                    </span>
                </div>
            </div>
            <div className="md-kpis">
                <Kpi rotulo="Entrantes" valor={fmt.num(t.entrantes)} delta={deltas.entrantes}
                    sub={`${fmt.num(t.no_lead)} no leads · ${fmt.num(t.inabribles)} in-abribles`}>
                    <PorCanal partes={partesDe(r, 'entrantes')} />
                </Kpi>
                <Kpi rotulo="Cualificación" valor={fmt.pct(tasas.cualificacion)} delta={deltas.cualificacion}
                    sub={`${fmt.num(t.cualificados)} de ${fmt.num(t.entrantes)}`}
                    ayuda="Cualificados (entrantes menos no leads e in-abribles) sobre los entrantes." />
                <Kpi rotulo="Apertura" valor={fmt.pct(tasas.apertura)} delta={deltas.apertura}
                    sub={`${fmt.num(t.ap_entrantes)} en entrantes · ${fmt.num(t.ap_dolor)} en dolor`}
                    ayuda="Aperturas (en entrantes y en dolor) sobre los entrantes, como en el formulario." />
                <Kpi rotulo="Agendas" valor={fmt.num(t.agendas)} delta={deltas.agendas}
                    sub={`${fmt.pct(tasas.conversion)} de los cualificados`}>
                    <PorCanal partes={partesDe(r, 'agendas')} />
                </Kpi>
                <Kpi rotulo="Bienvenidas" valor={fmt.pct(tasas.bienvenidas_respuesta)} delta={deltas.bienvenidas_respuesta}
                    sub={b.hechas ? `${fmt.num(b.respondidas)} de ${fmt.num(b.hechas)} respondieron` : 'sin bienvenidas cargadas'}
                    ayuda="De las bienvenidas que hiciste, cuántas respondieron. Los reportes viejos no las traen." />
                <Kpi rotulo="Follow-ups" valor={fmt.num(r.followups_total)} delta={deltas.followups}
                    sub="en entrantes, dolor, oferta y link" />
            </div>
        </section>
    );
};

const DIFERENCIA = (fila) => {
    if (!fila.diferencia) return { texto: 'Cuadra', tono: 'success' };
    const n = fmt.num(Math.abs(fila.diferencia));
    return fila.diferencia > 0
        ? { texto: `${n} más en tu reporte`, tono: 'warning' }
        : { texto: `${n} más en el sistema`, tono: 'info' };
};

const DESTINO_CONTRASTE = { agendas: DESTINOS_EMBUDO_SETTER.generadas, entrantes: { ...DESTINOS_SETTER.leads, de: 'Leads de ManyChat' } };

const Cuadra = ({ d, irA }) => (
    <section className="panel md-cuadra">
        <div className="panel-cab">
            <h2 className="t-h3">¿Cuadra con el sistema?</h2>
            <Tip titulo="¿Cuadra con el sistema?"
                texto={'Tu reporte y el sistema miden cosas parecidas con reglas distintas. Acá van juntos, '
                    + 'cada uno con su definición: la diferencia no es un error de cuenta, es lo que conviene mirar.'} />
        </div>
        <div className="md-contraste">
            {d.contraste.map(fila => {
                const dif = DIFERENCIA(fila);
                return (
                    <div key={fila.key} className="md-contraste-fila">
                        <p className="t-rotulo">{fila.label}</p>
                        <div className="md-contraste-cifras">
                            <div>
                                <p className="t-cap mut">Reportaste</p>
                                <Cifra tag="p" className="md-contraste-n num" valor={fmt.num(fila.reportado)} />
                            </div>
                            <div>
                                <p className="t-cap mut">El sistema registra</p>
                                <Abre irA={irA} destino={DESTINO_CONTRASTE[fila.key]}
                                    detalle={`${fila.label.toLowerCase()} del sistema, ${fila.sistema}`}>
                                    <Cifra className="md-contraste-n num" valor={fmt.num(fila.sistema)} />
                                </Abre>
                            </div>
                            <span className="chip md-contraste-chip" style={{ '--c': v(dif.tono) }}>{dif.texto}</span>
                        </div>
                        <p className="t-cap mut40">{fila.definicion}</p>
                    </div>
                );
            })}
        </div>
    </section>
);

const Despues = ({ d, irA }) => {
    const s = d.sistema, c = d.comision;
    return (
        <section className="panel md-despues">
            <div className="panel-cab">
                <h2 className="t-h3">Lo que pasó después</h2>
                <Tip titulo="Lo que pasó después"
                    texto={'Del sistema: lo que pasó con las agendas que generaste en el período (una por persona). '
                        + 'La comisión es la del mes en curso, sea cual sea el período elegido.'} />
            </div>
            <div className="md-despues-grid pareja" style={{ '--min': '150px' }}>
                <div className="md-stat">
                    <p className="t-rotulo">Asistieron</p>
                    <Abre irA={irA} destino={DESTINOS_EMBUDO_SETTER.asistieron} detalle={`asistieron, ${s.asistieron}`}>
                        <Cifra className="md-stat-n num" valor={fmt.num(s.asistieron)} />
                    </Abre>
                    <p className="t-cap mut40 num">
                        show up {fmt.pct(s.show_up)} · {fmt.plural(s.generadas, 'generada', 'generadas')}
                        {d.deltas.show_up && <> <Delta delta={d.deltas.show_up} /></>}
                    </p>
                </div>
                <div className="md-stat">
                    <p className="t-rotulo">Ventas originadas</p>
                    <Abre irA={irA} destino={DESTINOS_EMBUDO_SETTER.ventas} detalle={`ventas originadas, ${s.ventas}`}>
                        <Cifra className="md-stat-n num" valor={fmt.num(s.ventas)} />
                    </Abre>
                    <p className="t-cap mut40 num">
                        pago completo o split pay{s.senas ? ` · ${fmt.plural(s.senas, 'seña', 'señas')} aparte` : ''}
                        {d.deltas.ventas && <> <Delta delta={d.deltas.ventas} /></>}
                    </p>
                </div>
                <div className="md-stat">
                    <p className="t-rotulo">Comisión del mes</p>
                    <Cifra tag="p" className="md-stat-n num" valor={c ? fmt.money(c.commission) : '—'}
                        style={{ color: v('success') }} />
                    <p className="t-cap mut40 num">
                        {c ? `${Math.round(c.rate * 100)}% de ${fmt.money(c.cash_neto)} cobrados netos` : 'sin comisión'}
                    </p>
                </div>
            </div>
            {/* De dónde salen esos números: las generadas, cuántas ya tienen show up o no show (el
                denominador del show up) y cuántas no —canceladas, reagendadas o todavía sin pasar—,
                que es lo que más pesa cuando «asistieron» se ve bajo en un período en curso. */}
            <div className="datos md-despues-datos">
                {irA ? (
                    <button type="button" className="dato" onClick={() => irA(DESTINOS_EMBUDO_SETTER.generadas)}
                        aria-label={`Ver en la lista: agendas generadas, ${s.generadas}`}>
                        <span className="dato-nom">Agendas generadas</span>
                        <span className="dato-v num">{fmt.num(s.generadas)}</span>
                    </button>
                ) : (
                    <div className="dato">
                        <span className="dato-nom">Agendas generadas</span>
                        <span className="dato-v num">{fmt.num(s.generadas)}</span>
                    </div>
                )}
                <div className="dato">
                    <span className="dato-nom">Con resultado (asistió o no show)</span>
                    <span className="dato-v num">{fmt.num(s.realizadas)}</span>
                </div>
                <div className="dato">
                    <span className="dato-nom">Sin resultado todavía, canceladas o reagendadas</span>
                    <span className="dato-v num">{fmt.num(Math.max(0, s.generadas - s.realizadas))}</span>
                </div>
                <div className="dato">
                    <span className="dato-nom">Leads de ManyChat que agendaron con vos</span>
                    <span className="dato-v num">{fmt.num(s.agendaron)}</span>
                </div>
            </div>
        </section>
    );
};

const Leyenda = ({ canales = true }) => (
    <div className="leyenda md-leyenda">
        <span><i style={{ background: COLOR_FUENTE.reporte }} />Reporte</span>
        <span><i style={{ background: COLOR_FUENTE.sistema }} />Sistema</span>
        {canales && <span><i style={{ background: COLOR_CANAL.anuncios }} />Anuncios</span>}
        {canales && <span><i style={{ background: COLOR_CANAL.inbound }} />Inbound</span>}
    </div>
);

const PuntaAPunta = ({ d, irA }) => {
    const etapas = etapasParaDibujar(d.embudo, irA
        ? (e) => (DESTINOS_EMBUDO_SETTER[e.key] ? () => irA(DESTINOS_EMBUDO_SETTER[e.key]) : undefined)
        : null);
    const final = puntaAPunta(d.embudo);
    const primera = d.embudo[0], ultima = d.embudo[d.embudo.length - 1];
    return (
        <section className="panel md-embudo">
            <div className="panel-cab">
                <h2 className="t-h3">Tu embudo, de punta a punta</h2>
                <Tip titulo="Tu embudo, de punta a punta"
                    texto={'De los entrantes a las agendas es lo que reportaste; de las generadas a las ventas, lo que '
                        + 'registra el sistema. Cada píldora es la etapa sobre la anterior; la punteada compara las '
                        + 'agendas que reportaste con las que el sistema registra.'} />
                <div className="panel-cab-der">
                    <span className="t-cap mut num">
                        {fmt.num(primera.n)} {primera.label.toLowerCase()} → {fmt.plural(ultima.n, 'venta', 'ventas')}
                        {final !== null && ` · ${final}%`}
                    </span>
                </div>
            </div>
            <FlujoEmbudo etapas={etapas} />
            <Leyenda />
        </section>
    );
};

const Canal = ({ clave, datos, nota }) => (
    <div className="md-canal" style={{ '--c': COLOR_CANAL[clave] }}>
        <span className="chip md-canal-chip" style={{ '--c': COLOR_CANAL[clave] }}>
            <i className="md-punto" />{NOMBRE_CANAL[clave]}
        </span>
        <FlujoEmbudo color={COLOR_CANAL[clave]} etapas={[
            { key: 'entrantes', label: 'Entrantes', n: datos.entrantes },
            { key: 'cualificados', label: 'Cualificados', n: datos.cualificados },
        ]} />
        <div className="datos">
            <div className="dato"><span className="dato-nom">No leads</span><span className="dato-v num">{fmt.num(datos.no_lead)}</span></div>
            <div className="dato"><span className="dato-nom">In-abribles</span><span className="dato-v num">{fmt.num(datos.inabribles)}</span></div>
            <div className="dato">
                <span className="dato-nom">Aperturas · {fmt.pct(datos.apertura)}</span>
                <span className="dato-v num">{fmt.num(datos.aperturas)}</span>
            </div>
            <div className="dato"><span className="dato-nom">Agendas</span><span className="dato-v num">{fmt.num(datos.agendas)}</span></div>
        </div>
        {nota && <p className="t-cap mut40">{nota}</p>}
    </div>
);

const Bienvenidas = ({ b, tasas }) => (
    <div className="md-canal" style={{ '--c': 'var(--ch-bnv)' }}>
        <span className="chip md-canal-chip" style={{ '--c': 'var(--ch-bnv)' }}><i className="md-punto" />Bienvenidas</span>
        <FlujoEmbudo color="var(--ch-bnv)" etapas={[
            { key: 'hechas', label: 'Hechas', n: b.hechas },
            { key: 'respondidas', label: 'Respondidas', n: b.respondidas },
            { key: 'aperturas', label: 'Aperturas', n: b.aperturas },
        ]} />
        <div className="datos">
            <div className="dato"><span className="dato-nom">Respuesta</span><span className="dato-v num">{fmt.pct(tasas.bienvenidas_respuesta)}</span></div>
            <div className="dato"><span className="dato-nom">Apertura</span><span className="dato-v num">{fmt.pct(tasas.bienvenidas_apertura)}</span></div>
        </div>
    </div>
);

const PorCanales = ({ r }) => {
    const conSinCanal = r.sin_canal.entrantes > 0 || r.sin_canal.agendas > 0;
    return (
        <section className="panel md-canales">
            <div className="panel-cab">
                <h2 className="t-h3">Por canal</h2>
                <Tip titulo="Por canal"
                    texto={'Anuncios e inbound se abren sobre sus entrantes; las bienvenidas, sobre las que hiciste. '
                        + 'Lo de los reportes de antes del 10/10 va en «Sin canal»: no se reparte inventando.'} />
            </div>
            <div className="md-canales-grid pareja" style={{ '--min': '220px', '--g': '12px' }}>
                <Canal clave="anuncios" datos={r.canales.anuncios} />
                <Canal clave="inbound" datos={r.canales.inbound} />
                {conSinCanal && (
                    <Canal clave="sin_canal" datos={r.sin_canal}
                        nota="Reportes de antes del formulario nuevo: no separaban por canal." />
                )}
                <Bienvenidas b={r.bienvenidas} tasas={r.tasas} />
            </div>
        </section>
    );
};

const FOLLOWUPS = [['entrantes', 'Entrantes'], ['dolor', 'Dolor'], ['oferta', 'Oferta'], ['link', 'Link']];

const Followups = ({ r, delta }) => (
    <section className="panel md-fu">
        <div className="panel-cab">
            <h2 className="t-h3">Follow-ups</h2>
            <Tip titulo="Follow-ups" texto="Los seguimientos que reportaste, por la etapa en la que estaba cada lead." />
            <div className="panel-cab-der">
                <span className="t-cap mut num">{fmt.num(r.followups_total)} en total</span>
                {delta && <Delta delta={delta} />}
            </div>
        </div>
        <FlujoEmbudo bandas={false} etapas={FOLLOWUPS.map(([k, label]) => ({ key: k, label, n: r.followups[k] }))} />
        <p className="t-cap mut num md-fu-pie">
            {r.reportes
                ? `${fmt.num(Math.round((r.followups_total / r.reportes) * 10) / 10)} por día reportado · `
                    + `${fmt.pct(r.followups_total ? Math.round((r.followups.entrantes / r.followups_total) * 1000) / 10 : null)} en entrantes`
                : 'Sin reportes en el período.'}
        </p>
    </section>
);

const ESTADO_DIA = {
    reportado: { tono: 'success', texto: 'reportado' },
    falta: { tono: 'warning', texto: 'sin reporte' },
    finde: { tono: 'idle', texto: 'fin de semana' },
    no_laborable: { tono: 'info', texto: 'no laborable' },
};

const Constancia = ({ dias, wins }) => (
    <section className="panel md-constancia">
        <div className="panel-cab">
            <h2 className="t-h3">Constancia</h2>
            <Tip titulo="Constancia"
                texto="Los días con reporte contra los hábiles del período (de lunes a viernes). Un día no laborable no cuenta." />
        </div>
        <div className="md-constancia-cab">
            <p className="md-stat-n num">
                <Cifra valor={fmt.num(dias.reportados)} /><span className="mut40"> / {fmt.num(dias.habiles)}</span>
            </p>
            <p className="t-cap mut num">
                días reportados sobre hábiles
                {dias.en_fin_de_semana ? ` · ${fmt.plural(dias.en_fin_de_semana, 'en fin de semana', 'en fin de semana')}` : ''}
                {dias.no_laborables ? ` · ${fmt.plural(dias.no_laborables, 'no laborable', 'no laborables')}` : ''}
            </p>
        </div>
        {dias.detalle.length > 0 && (
            <div className="md-dias" role="list" aria-label="Día por día">
                {dias.detalle.map(dia => (
                    <i key={dia.fecha} role="listitem" className={`md-dia md-dia--${dia.estado}`}
                        style={{ '--c': v(ESTADO_DIA[dia.estado].tono) }}
                        title={`${fmt.fecha(dia.fecha)} · ${ESTADO_DIA[dia.estado].texto}`}
                        aria-label={`${fmt.fecha(dia.fecha)}, ${ESTADO_DIA[dia.estado].texto}`} />
                ))}
            </div>
        )}
        <p className="t-rotulo md-wins-tit">Wins del período</p>
        {wins.length ? (
            <ul className="md-wins">
                {wins.map(w => (
                    <li key={`${w.fecha}-${w.texto}`}>
                        <span className="t-cap mut40 num">{fmt.fecha(w.fecha)}</span>
                        <span className="t-sm">{w.texto}</span>
                    </li>
                ))}
            </ul>
        ) : <p className="t-cap mut40">Sin wins cargados en el período.</p>}
    </section>
);

const MisDatos = ({ datos, irA = null }) => {
    if (!datos) return <EsqueletoTablero rotulo="Cargando tus datos…" />;
    return (
        <>
            <Reportado d={datos} />
            <div className="grid-2">
                <Cuadra d={datos} irA={irA} />
                <Despues d={datos} irA={irA} />
            </div>
            <PuntaAPunta d={datos} irA={irA} />
            <PorCanales r={datos.reporte} />
            <div className="grid-2">
                <Followups r={datos.reporte} delta={datos.deltas.followups} />
                <Constancia dias={datos.dias} wins={datos.wins} />
            </div>
        </>
    );
};

export default MisDatos;
