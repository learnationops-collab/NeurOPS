// Una fila de la bandeja: quién es, en qué etapa va (la barrita de `Indicadores`, ADR-W238), si
// califica, cuánto hace que espera, la tarea que vence y a quién está asignada. Se decide a quién atender
// sin abrir el chat. Lo no leído va en negrita con su cuenta. También: el borrador sin mandar, el seguimiento
// programado y cuánto falta para que Instagram no deje escribirle (últimas 24 h).
import { AlarmClock, Bot, Check, Clock, PencilLine, User, X } from 'lucide-react';
import { Avatar, Chip } from '../../../components/standard';
import { avisoCierre, cierreMin, esperaMin, examenDe, quien, vistaPrevia } from './colas';
import IconoCanal from './IconoCanal';
import { Etiqueta } from './Etiquetas';
import { colorDe, corto, faseDe } from './fasesSetting';
import { EtapaMini, Espera, Ventana } from './Indicadores';

export function hora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date().toDateString() === d.toDateString();
    return d.toLocaleString('es', hoy ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });
}

export function Asignado({ asignado, yo }) {
    if (!asignado) return <span className="cv-asignado cv-asignado--sin"><User size={12} aria-hidden="true" />Sin asignar</span>;
    const mio = asignado.id === yo;
    return (
        <span className={`cv-asignado${mio ? ' cv-asignado--mio' : ''}`}>
            <Avatar name={asignado.username} size="xs" />{mio ? 'Vos' : asignado.username}
        </span>
    );
}

export function Califica({ valor }) {
    if (valor === true) return <Chip subtle color="var(--success)" icon={<Check />}>Califica</Chip>;
    if (valor === false) return <Chip subtle color="var(--error)" icon={<X />}>No califica</Chip>;
    return null;
}

export function Vence({ tarea, ahora }) {
    if (!tarea) return null;
    const tarde = tarea.vence && new Date(tarea.vence) < ahora;
    const cuando = tarea.vence ? hora(tarea.vence) : 'sin fecha';
    return <span className={`cv-vence${tarde ? ' cv-vence--tarde' : ''}`} data-tip={`Tarea|${tarea.titulo}`}><Clock size={11} aria-hidden="true" />{cuando}</span>;
}

// La fase del setting, con el color de su etapa (ADR-W184).
export function ChipFase({ fase }) {
    if (!fase) return null;
    const f = faseDe(fase);
    return <Chip subtle color={colorDe(f)} className="cv-fase" data-tip={`Etapa del setting|${f.n} · ${f.label}`}>{f.n} {corto(f)}</Chip>;
}

// `eligiendo`: con «Elegir» puesto, tocar la fila la marca para etiquetarla (1426) en lugar de abrirla.
export default function Fila({ c, elegida, ahora, yo, conAsignado, borrador, onElegir, eligiendo, marcada, onMarcar }) {
    const espera = esperaMin(c, ahora);
    const cierre = cierreMin(c, ahora);
    const examen = examenDe(c);
    return (
        <li>
            <button type="button" className={`cv-item${c.sin_leer ? ' cv-item--nuevo' : ''}${marcada ? ' cv-item--marcada' : ''}`}
                aria-pressed={eligiendo ? marcada : elegida} data-conversacion={c.id} onClick={() => (eligiendo ? onMarcar(c.id) : onElegir(c.id))}>
                {eligiendo && <span className="cv-item-check" aria-hidden="true">{marcada && <Check size={12} strokeWidth={3} />}</span>}
                <Avatar name={c.username || c.nombre || '?'} size="sm" />
                <span className="cv-item-cuerpo">
                    <span className="cv-item-cab">
                        <IconoCanal c={c} />
                        <strong>{quien(c)}</strong>
                        {examen && <Chip subtle className="cv-examen">{examen}</Chip>}
                        <span className="mut cv-item-hora">{hora(c.ultimo_en)}</span>
                    </span>
                    <span className="cv-item-texto mut">
                        {c.ultimo_de === 'motor' ? <Bot size={12} aria-label="Bot" /> : c.ultimo_de === 'otro' ? <User size={12} aria-label="Equipo" /> : null}
                        {borrador && !elegida
                            ? <span className="cv-borrador"><PencilLine size={11} aria-hidden="true" />Borrador: {borrador}</span>
                            : <span>{vistaPrevia(c)}</span>}
                        {c.sin_leer > 0 && <i className="cv-sin-leer" aria-label={`${c.sin_leer} sin leer`}>{c.sin_leer}</i>}
                    </span>
                    <span className="cv-item-chips">
                        <EtapaMini fase={c.fase} etapas={c.etapas} />
                        <Califica valor={c.califica} />
                        <Espera min={espera} desde={hora(c.ultimo_en)} />
                        <Vence tarea={c.tarea} ahora={ahora} />
                        {cierre != null && cierre <= avisoCierre(c) && <Ventana contacto={c} queda={cierre} aviso={avisoCierre(c)} />}
                        {c.toca && (
                            <Chip subtle color="var(--brand-secondary)" icon={<AlarmClock />}
                                data-tip="Toca seguimiento|Lo pide la cadencia de su fase en Embudos: el lead no contestó">
                                {c.toca}
                            </Chip>
                        )}
                        {c.seguimiento && (
                            <span className="cv-vence" data-tip={`Seguimiento programado|Sale ${hora(c.seguimiento)} si no responde`}>
                                <AlarmClock size={11} aria-hidden="true" />{hora(c.seguimiento)}
                            </span>
                        )}
                    </span>
                    {(conAsignado || (c.etiquetas || []).length > 0) && (
                        <span className="cv-item-pie">
                            {conAsignado && <Asignado asignado={c.asignado} yo={yo} />}
                            {(c.etiquetas || []).map((e) => <Etiqueta key={e.id} e={e} />)}
                        </span>
                    )}
                </span>
            </button>
        </li>
    );
}
