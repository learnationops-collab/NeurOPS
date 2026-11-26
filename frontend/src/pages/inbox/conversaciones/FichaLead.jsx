// La ficha de la derecha, debajo de la tarjeta del lead (ADR-W184, reordenada en ADR-W238): cuatro filas con ícono y
// cuenta. Tareas (las abiertas, abajo), notas para la venta (la última, abajo; tocarla abre la ventana con todas),
// variables (una barra de cuántas tiene; se corrigen y el bot usa el valor nuevo) y recorrido (flujos y etapas).
import { Children, useState } from 'react';
import { Bot, Braces, CalendarCheck, ChevronDown, Highlighter, Route } from 'lucide-react';
import { Avatar, Chip, Modal, ModalHeader, Panel, toast } from '../../../components/standard';
import { rotuloPaso } from '../estadoFlujo';
import { inboxApi } from '../api';
import { EJECUCION } from './AccionesFlujo';
import { faseDe } from './fasesSetting';
import { momento } from './Feed';
import MisStats from './MisStats';

const ABIERTA = ['en_curso', 'esperando_respuesta', 'esperando_tiempo'];
const BASICAS = ['nombre', 'examen', 'pais', 'fecha_examen', 'intentos', 'whatsapp'];

function Variable({ campo, valor, origen, onGuardar }) {
    const [v, setV] = useState(valor ?? '');
    return (
        <div className="cv-var">
            <dt>{`{${campo}}`}</dt>
            <dd>
                <input value={v} placeholder="—" aria-label={campo} onChange={(e) => setV(e.target.value)}
                    onBlur={() => { if (String(valor ?? '') !== v.trim()) onGuardar(campo, v.trim()); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            </dd>
            <span className="cv-var-origen">
                {origen ? <span data-tip={`Lo cargó ${origen}`}><Avatar name={origen} size="xs" /></span>
                    : valor != null && valor !== '' ? <span data-tip="Lo guardó el flujo"><Bot size={13} /></span> : null}
            </span>
        </div>
    );
}

// Una fila de la ficha: ícono, título y, a la derecha, su cuenta o resumen. Plegable o no (`onAlternar`).
function Fila({ icono: Icono, titulo, cuenta, resumen, color, abierto, onAlternar, tip, children }) {
    const cab = (
        <>
            <span className="cv-ficha-ico" style={{ '--c': color }}><Icono size={13} aria-hidden="true" /></span>
            <span className="cv-ficha-tit">{titulo}</span>
            {resumen}
            {cuenta != null && <span className={`cv-ficha-n${cuenta ? '' : ' cv-ficha-n--0'}`}>{cuenta}</span>}
            {onAlternar && <ChevronDown size={13} className="cv-ficha-flecha" aria-hidden="true" />}
        </>
    );
    return (
        <section className="cv-ficha-sec">
            {onAlternar
                ? <button type="button" className="cv-ficha-cab" aria-expanded={abierto} onClick={onAlternar} data-tip={tip}>{cab}</button>
                : <div className="cv-ficha-cab" data-tip={tip}>{cab}</div>}
            {Children.toArray(children).length > 0 && <div className="cv-ficha-cuerpo">{children}</div>}
        </section>
    );
}

function NotasVenta({ citas, quien }) {
    const [abierta, setAbierta] = useState(false);
    return (
        <Fila icono={Highlighter} titulo="Notas" color="var(--warning)" cuenta={citas.length}
            tip={citas.length ? undefined : 'Notas para la venta|Resaltá parte de un mensaje del lead y anotalo para el closer'}>
            {citas.length > 0 && (
                <button type="button" className="cv-nota-venta-ult" onClick={() => setAbierta(true)} data-tip="Ver todas">«{citas[0].texto}»</button>
            )}
            {abierta && (
                <Modal onClose={() => setAbierta(false)} className="cv-notas-venta" labelledBy="cv-nv-t">
                    <ModalHeader icon={<Highlighter size={18} />} titleId="cv-nv-t" title={`Notas para la venta · ${quien}`}
                        subtitle="Lo que resaltaron de sus mensajes. El closer las ve en la ficha del lead › Comunicación." onClose={() => setAbierta(false)} />
                    <ul className="cv-notas-venta-lista">
                        {citas.map((c) => (
                            <li key={c.id} className="cv-nota-venta">
                                <Chip subtle color="var(--warning)">{c.tipo}</Chip>
                                <q>{c.texto}</q>
                                {c.comentario && <span>{c.comentario}</span>}
                                <span className="t-cap mut40">{c.autor || 'Equipo'} · {momento(c.en)}</span>
                            </li>
                        ))}
                    </ul>
                </Modal>
            )}
        </Fila>
    );
}

export default function FichaLead({ contacto, tareas, recorrido, fases = [], citas = [], onCambio }) {
    const [plegables, setPlegables] = useState([]);
    const alternar = (k) => setPlegables((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
    const variables = contacto.variables || {};
    const editadas = variables._editadas || {};
    const campos = [...new Set([...BASICAS, ...Object.keys(variables).filter((k) => !k.startsWith('_'))])];
    const cargadas = campos.filter((k) => variables[k] != null && variables[k] !== '').length;
    const abiertas = tareas.filter((t) => !t.hecha);
    const ultimo = recorrido[0];

    const hacer = (pedido, error) => pedido.then(onCambio).catch((e) => toast(e.response?.data?.message || error, 'error'));

    return (
        <Panel as="aside" size="sm" className="cv-ficha" aria-label="Ficha del lead">
            <Fila icono={CalendarCheck} titulo="Tareas" color="var(--brand-secondary)" cuenta={abiertas.length}
                tip={abiertas.length ? undefined : 'Tareas|Se crean desde la pestaña Tarea, abajo del chat'}>
                {abiertas.length > 0 && (
                    <ul className="cv-tareas">
                        {abiertas.map((t) => {
                            const tarde = t.vence && new Date(t.vence) < new Date();
                            return (
                                <li key={t.id}>
                                    <input type="checkbox" aria-label={`Hecha: ${t.titulo}`} onChange={() => hacer(inboxApi.cambiarTarea(t.id, true), 'No se pudo marcar')} />
                                    <span>{t.titulo}</span>
                                    {t.vence && <small className={tarde ? 'cv-vence--tarde' : ''}>{momento(t.vence)}</small>}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Fila>
            <NotasVenta citas={citas} quien={contacto.username ? `@${contacto.username}` : contacto.nombre || 'el lead'} />
            <Fila icono={Braces} titulo="Variables" color="var(--info)" abierto={plegables.includes('vars')} onAlternar={() => alternar('vars')}
                tip={`Variables|${cargadas} de ${campos.length} cargadas`}
                resumen={<span className="cv-ficha-barra" style={{ '--p': campos.length ? cargadas / campos.length : 0 }}><i /></span>}>
                {plegables.includes('vars') && (
                    <>
                        <dl className="cv-vars">
                            {campos.map((k) => (
                                <Variable key={`${k}:${variables[k] ?? ''}`} campo={k} valor={variables[k]} origen={editadas[k]}
                                    onGuardar={(campo, valor) => hacer(inboxApi.corregirVariable(contacto.id, campo, valor), 'No se pudo guardar')} />
                            ))}
                        </dl>
                        <p className="t-cap mut40">Si corregís una, el bot usa tu valor.</p>
                    </>
                )}
            </Fila>
            <Fila icono={Route} titulo="Recorrido" color="#7D63E6" abierto={plegables.includes('rec')} onAlternar={() => alternar('rec')}
                tip={ultimo ? `Último flujo|${ultimo.flujo}, ${(EJECUCION[ultimo.estado]?.texto || ultimo.estado).toLowerCase()}` : 'Recorrido|No pasó por ningún flujo'}
                cuenta={recorrido.length + fases.length}>
                {plegables.includes('rec') && (
                    <>
                        {fases.length > 0 && (
                            <ol className="cv-recorrido">
                                {fases.map((x, i) => (
                                    <li key={`f${i}`} style={{ '--c': '#7D63E6' }}>
                                        <strong>{faseDe(x.fase).n} · {faseDe(x.fase).label}</strong>
                                        <span>{x.por || 'Equipo'}</span>
                                        <span className="mut40">{momento(x.en)}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                        {recorrido.length ? (
                            <ol className="cv-recorrido">
                                {recorrido.map((e, i) => {
                                    const est = EJECUCION[e.estado] || { texto: e.estado };
                                    return (
                                        <li key={i} style={{ '--c': est.color }}>
                                            <strong>{e.flujo}</strong>
                                            <span>{est.texto}{e.paso && ABIERTA.includes(e.estado) ? ` en ${rotuloPaso(e.paso)}` : ''}</span>
                                            {e.detalle && <span className="mut">{e.detalle}</span>}
                                            <span className="mut40">{momento(e.iniciada_en)}</span>
                                        </li>
                                    );
                                })}
                            </ol>
                        ) : <p className="t-cap mut">Sin flujos.</p>}
                    </>
                )}
            </Fila>
            <MisStats />
        </Panel>
    );
}
