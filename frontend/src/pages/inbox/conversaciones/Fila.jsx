// Una fila de la bandeja: quién es, en qué etapa va (la barrita de `Indicadores`, ADR-W238), si
// califica, cuánto hace que espera, la tarea que vence y a quién está asignada. Se decide a quién atender
// sin abrir el chat. Lo no leído va en negrita con su cuenta. También: el borrador sin mandar, el seguimiento
// programado y cuánto falta para que Instagram no deje escribirle (últimas 24 h).
import { AlarmClock, Bot, Check, Clock, PencilLine, Repeat2, Search, User, X } from 'lucide-react';
import { Avatar, Chip } from '../../../components/standard';
import Funnel from './Funnel';
import { avisoCierre, cierreMin, esperaMin, esperaSeguimiento, examenDe, haceDias, quien, seguimientosDe, vistaPrevia } from './colas';
import IconoCanal from './IconoCanal';
import { colorDe, corto, faseDe } from './fasesSetting';
import { EtapaMini, Ventana } from './Indicadores';
import Cronometro from './Cronometro';

export function hora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date().toDateString() === d.toDateString();
    return d.toLocaleString('es', hoy ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });
}

export function Asignado({ asignado, yo, mini }) {
    if (mini) {
        if (!asignado) return <span className="cv-item-ico cv-asignado--sin" data-tip="Sin asignar"><User size={12} aria-hidden="true" /></span>;
        return <span className="cv-item-asig" data-tip={`Asignada a|${asignado.id === yo ? 'vos' : asignado.username}`}><Avatar name={asignado.username} size="xs" /></span>;
    }
    if (!asignado) return <span className="cv-asignado cv-asignado--sin"><User size={12} aria-hidden="true" />Sin asignar</span>;
    const mio = asignado.id === yo;
    return (
        <span className={`cv-asignado${mio ? ' cv-asignado--mio' : ''}`}>
            <Avatar name={asignado.username} size="xs" />{mio ? 'Vos' : asignado.username}
        </span>
    );
}

export function Califica({ valor, mini }) {
    if (mini) {
        if (valor == null) return null;
        return <span className="cv-item-ico" style={{ color: valor ? 'var(--success)' : 'var(--error)' }} data-tip={valor ? 'Califica' : 'No califica'}>
            {valor ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}</span>;
    }
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
// Dos líneas (ADR-W238): quién es, su examen, cuánto espera y la hora; debajo, lo último que se dijo y, a la derecha,
// en íconos, la etapa, la ventana si se cierra, tareas y seguimientos, las etiquetas como puntos y a quién está asignada.
// `fases`: las del filtro; los seguimientos hechos se cuentan en esas (todas si no hay, ADR-W254).
export default function Fila({ c, elegida, ahora, yo, conAsignado, borrador, onElegir, eligiendo, marcada, onMarcar, fases }) {
    const espera = esperaMin(c, ahora);
    const cierre = cierreMin(c, ahora);
    const examen = examenDe(c);
    const nombre = quien(c);
    const hechos = seguimientosDe(c, fases);
    return (
        <li>
            <button type="button" className={`cv-item${c.sin_leer ? ' cv-item--nuevo' : ''}${marcada ? ' cv-item--marcada' : ''}`}
                aria-pressed={eligiendo ? marcada : elegida} data-conversacion={c.id} onClick={() => (eligiendo ? onMarcar(c.id) : onElegir(c.id))}>
                {eligiendo && <span className="cv-item-check" aria-hidden="true">{marcada && <Check size={12} strokeWidth={3} />}</span>}
                {/* Solo la red, grande (Mario, 26/11/2026): las iniciales no decían nada. */}
                <span className="cv-item-avatar cv-item-avatar--red">
                    <IconoCanal c={c} size={17} />
                </span>
                <span className="cv-item-cuerpo">
                    <span className="cv-item-cab">
                        <strong data-tip={c.nombre_real && c.nombre && c.nombre !== c.nombre_real ? `En el perfil|${c.nombre}` : undefined}>{nombre}</strong>
                        {examen && <span className="cv-item-examen">{examen}</span>}
                        <Funnel funnel={c.funnel} mini />
                        <Califica valor={c.califica} mini />
                        <span className="cv-item-der">
                            {espera != null && <Cronometro desde={c.ultimo_en} />}
                            <span className="mut cv-item-hora">{hora(c.ultimo_en)}</span>
                        </span>
                    </span>
                    <span className="cv-item-texto mut">
                        {c.ultimo_de === 'motor' ? <Bot size={12} aria-label="Bot" /> : c.ultimo_de === 'otro' ? <User size={12} aria-label="Equipo" /> : null}
                        {c.coincide
                            ? <span className="cv-coincide" data-tip={`Lo que le escribió el equipo|${c.coincide.texto}`}><Search size={11} aria-hidden="true" />{c.coincide.texto}</span>
                            : borrador && !elegida
                            ? <span className="cv-borrador"><PencilLine size={11} aria-hidden="true" />{borrador}</span>
                            : <span>{vistaPrevia(c)}</span>}
                        <span className="cv-item-der">
                            <EtapaMini fase={c.fase} etapas={c.etapas} compacta />
                            {cierre != null && cierre <= avisoCierre(c) && <Ventana contacto={c} queda={cierre} aviso={avisoCierre(c)} mini />}
                            <Vence tarea={c.tarea} ahora={ahora} />
                            {c.toca && (
                                <span className="cv-item-ico cv-item-ico--toca" data-tip={`Toca seguimiento|${c.toca}`}><AlarmClock size={12} aria-hidden="true" /></span>
                            )}
                            {/* Le escribiste y no contestó (Mario, 27/11/2026): cuántos seguimientos van desde su última respuesta y
                                hace cuánto fue tu último mensaje. Sin seguimiento, en rojo. */}
                            {esperaSeguimiento(c) ? (
                                <span className={`cv-item-racha${c.racha.n ? '' : ' cv-item-racha--cero'}`}
                                    data-tip={`Sin respuesta|Tu último mensaje: ${haceDias(c.racha.ultimo, ahora)} · ${c.racha.n ? `${c.racha.n} ${c.racha.n === 1 ? 'seguimiento' : 'seguimientos'} desde su última respuesta` : 'todavía sin seguimiento'}`}>
                                    <Repeat2 size={11} aria-hidden="true" />{c.racha.n}<em>{haceDias(c.racha.ultimo, ahora, true)}</em>
                                </span>
                            ) : hechos.n > 0 && (
                                <span className="cv-item-fu" data-tip={`Seguimientos hechos|${hechos.n}${fases?.length ? ' en esa etapa' : ''} · el último ${hora(hechos.en)}${hechos.resp ? ', contestó' : ', sin respuesta'}`}>
                                    <Repeat2 size={11} aria-hidden="true" />{hechos.n}
                                </span>
                            )}
                            {c.seguimiento && (
                                <span className="cv-item-ico" data-tip={`Seguimiento programado|Sale ${hora(c.seguimiento)} si no responde`}><AlarmClock size={12} aria-hidden="true" /></span>
                            )}
                            {(c.etiquetas || []).length > 0 && (
                                <span className="cv-item-tags" data-tip={`Etiquetas|${c.etiquetas.map((e) => e.name).join(' · ')}`}>
                                    {c.etiquetas.slice(0, 4).map((e) => <i key={e.id} style={{ '--c': e.color || 'var(--text-muted)' }} />)}
                                </span>
                            )}
                            {conAsignado && <Asignado asignado={c.asignado} yo={yo} mini />}
                            {c.sin_leer > 0 && <i className="cv-sin-leer" aria-label={`${c.sin_leer} sin leer`}>{c.sin_leer}</i>}
                        </span>
                    </span>
                </span>
            </button>
        </li>
    );
}
