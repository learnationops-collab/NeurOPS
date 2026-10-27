// La ficha de la derecha: la sub-etapa del embudo, el responsable (se reasigna a mano), las tareas, las
// variables (las guardó el flujo; se corrigen y el bot usa el valor nuevo) y su recorrido por los flujos.
import { useState } from 'react';
import { Bot } from 'lucide-react';
import { Avatar, Panel, Select, toast } from '../../../components/standard';
import { rotuloPaso } from '../estadoFlujo';
import { inboxApi } from '../api';
import { EJECUCION } from './AccionesFlujo';
import { ETAPAS } from './colas';
import { momento } from './Feed';
import useEquipo from './useEquipo';

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

export default function FichaLead({ contacto, avance, asignado, tareas, recorrido, yo, onCambio }) {
    const equipo = useEquipo();
    const variables = contacto.variables || {};
    const editadas = variables._editadas || {};
    const campos = [...new Set([...BASICAS, ...Object.keys(variables).filter((k) => !k.startsWith('_'))])];
    const abiertas = tareas.filter((t) => !t.hecha);

    const hacer = (pedido, error) => pedido.then(onCambio).catch((e) => toast(e.response?.data?.message || error, 'error'));

    return (
        <Panel as="aside" size="sm" className="cv-ficha" aria-label="Ficha del lead">
            <section className="cv-ficha-sec">
                <span className="t-rotulo">Sub-etapa</span>
                <Select label="Sub-etapa" value={avance?.etapa || ''} onChange={(etapa) => hacer(inboxApi.moverEtapa(contacto.id, etapa), 'No se pudo mover')}
                    options={ETAPAS.map((e) => ({ value: e.value, label: e.label, iconColor: e.color }))} />
            </section>
            <section className="cv-ficha-sec">
                <span className="t-rotulo">Responsable</span>
                <Select label="Responsable" value={asignado ? String(asignado.id) : ''}
                    onChange={(id) => hacer(inboxApi.asignar(contacto.id, id ? Number(id) : null), 'No se pudo reasignar')}
                    options={[{ value: '', label: 'Sin asignar' }, ...equipo.map((s) => ({ value: String(s.id), label: s.id === yo ? `${s.nombre} (vos)` : s.nombre }))]} />
            </section>
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
            <section className="cv-ficha-sec">
                <span className="t-rotulo">Variables</span>
                <dl className="cv-vars">
                    {campos.map((k) => (
                        <Variable key={`${k}:${variables[k] ?? ''}`} campo={k} valor={variables[k]} origen={editadas[k]}
                            onGuardar={(campo, valor) => hacer(inboxApi.corregirVariable(contacto.id, campo, valor), 'No se pudo guardar')} />
                    ))}
                </dl>
                <p className="t-cap mut40">Las guardó el flujo. Si corregís una, el bot usa tu valor.</p>
            </section>
            <section className="cv-ficha-sec">
                <span className="t-rotulo">Recorrido</span>
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
            </section>
        </Panel>
    );
}
