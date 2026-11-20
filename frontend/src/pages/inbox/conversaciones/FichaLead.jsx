// La ficha de la derecha, debajo de la tarjeta del lead (ADR-W184): las tareas, las notas para la venta (plegadas:
// abren una ventana), las variables (las guardó el flujo; se corrigen y el bot usa el valor nuevo) y el recorrido
// (los flujos y los cambios de etapa del setting), estas dos plegables. La etapa y el responsable están en la tarjeta.
import { useState } from 'react';
import { Bot, ChevronDown, ChevronUp, Highlighter, Maximize2 } from 'lucide-react';
import { Avatar, Chip, Modal, ModalHeader, Panel, toast } from '../../../components/standard';
import { rotuloPaso } from '../estadoFlujo';
import { inboxApi } from '../api';
import { EJECUCION } from './AccionesFlujo';
import { faseDe } from './fasesSetting';
import { momento } from './Feed';

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

function Plegable({ titulo, resumen, abierto, onAlternar, children }) {
    return (
        <section className="cv-ficha-sec">
            <button type="button" className="cv-plegable" aria-expanded={abierto} onClick={onAlternar}>
                <span className="t-rotulo">{titulo}</span>{resumen && <span className="t-cap mut40">· {resumen}</span>}
                {abierto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {abierto && children}
        </section>
    );
}

function NotasVenta({ citas, quien }) {
    const [abierta, setAbierta] = useState(false);
    return (
        <section className="cv-ficha-sec">
            <button type="button" className="cv-plegable" onClick={() => setAbierta(true)} disabled={!citas.length}>
                <span className="t-rotulo">Notas para la venta</span><Chip subtle color="var(--warning)">{citas.length}</Chip>
                {citas.length > 0 && <Maximize2 size={12} />}
            </button>
            <p className="t-cap mut cv-nota-venta-ult">{citas.length ? `«${citas[0].texto}»` : 'Seleccioná parte de un mensaje del lead para anotarlo.'}</p>
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
        </section>
    );
}

export default function FichaLead({ contacto, tareas, recorrido, fases = [], citas = [], onCambio }) {
    const [plegables, setPlegables] = useState([]);
    const alternar = (k) => setPlegables((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
    const variables = contacto.variables || {};
    const editadas = variables._editadas || {};
    const campos = [...new Set([...BASICAS, ...Object.keys(variables).filter((k) => !k.startsWith('_'))])];
    const abiertas = tareas.filter((t) => !t.hecha);

    const hacer = (pedido, error) => pedido.then(onCambio).catch((e) => toast(e.response?.data?.message || error, 'error'));

    return (
        <Panel as="aside" size="sm" className="cv-ficha" aria-label="Ficha del lead">
            <section className="cv-ficha-sec">
                <span className="t-rotulo">Tareas</span>
                {abiertas.length ? (
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
                ) : <p className="t-cap mut">Sin tareas. Se crean desde la caja de abajo del chat.</p>}
            </section>
            <NotasVenta citas={citas} quien={contacto.username ? `@${contacto.username}` : contacto.nombre || 'el lead'} />
            <Plegable titulo="Variables" resumen={`${campos.filter((k) => variables[k] != null && variables[k] !== '').length} de ${campos.length} cargadas`}
                abierto={plegables.includes('vars')} onAlternar={() => alternar('vars')}>
                <dl className="cv-vars">
                    {campos.map((k) => (
                        <Variable key={`${k}:${variables[k] ?? ''}`} campo={k} valor={variables[k]} origen={editadas[k]}
                            onGuardar={(campo, valor) => hacer(inboxApi.corregirVariable(contacto.id, campo, valor), 'No se pudo guardar')} />
                    ))}
                </dl>
                <p className="t-cap mut40">Las guardó el flujo. Si corregís una, el bot usa tu valor.</p>
            </Plegable>
            <Plegable titulo="Recorrido" resumen={recorrido[0] ? `${recorrido[0].flujo}, ${(EJECUCION[recorrido[0].estado]?.texto || recorrido[0].estado).toLowerCase()}` : null}
                abierto={plegables.includes('rec')} onAlternar={() => alternar('rec')}>
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
                ) : <p className="t-cap mut">No pasó por ningún flujo.</p>}
            </Plegable>
        </Panel>
    );
}
