// Una fila de la bandeja: quién es, en qué va (los tres puntos: automática, manual, agendamiento), si
// califica, cuánto hace que espera, la tarea que vence y a quién está asignada. Se decide a quién atender
// sin abrir el chat. Lo no leído va en negrita con su cuenta.
import { Bot, Check, Clock, User, X } from 'lucide-react';
import { Avatar, Chip } from '../../../components/standard';
import { colorEspera, esperaMin, examenDe, quien, textoEspera } from './colas';
import { Etiqueta } from './Etiquetas';
import { Puntos } from './Progreso';

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

export default function Fila({ c, elegida, ahora, yo, conAsignado, onElegir }) {
    const espera = esperaMin(c, ahora);
    const examen = examenDe(c);
    return (
        <li>
            <button type="button" className={`cv-item${c.sin_leer ? ' cv-item--nuevo' : ''}`} aria-pressed={elegida} onClick={() => onElegir(c.id)}>
                <Avatar name={c.username || c.nombre || '?'} size="sm" />
                <span className="cv-item-cuerpo">
                    <span className="cv-item-cab">
                        <strong>{quien(c)}</strong>
                        {examen && <Chip subtle className="cv-examen">{examen}</Chip>}
                        <span className="mut cv-item-hora">{hora(c.ultimo_en)}</span>
                    </span>
                    <span className="cv-item-texto mut">
                        {c.ultimo_de === 'motor' ? <Bot size={12} aria-label="Bot" /> : c.ultimo_de === 'otro' ? <User size={12} aria-label="Equipo" /> : null}
                        <span>{c.ultimo_texto || '…'}</span>
                        {c.sin_leer > 0 && <i className="cv-sin-leer" aria-label={`${c.sin_leer} sin leer`}>{c.sin_leer}</i>}
                    </span>
                    <span className="cv-item-chips">
                        <Puntos etapas={c.etapas} />
                        <Califica valor={c.califica} />
                        {espera != null && (
                            <Chip subtle color={colorEspera(espera)} icon={<Clock />} data-tip={`Espera respuesta|Desde ${hora(c.ultimo_en)}`}>
                                espera {textoEspera(espera)}
                            </Chip>
                        )}
                        <Vence tarea={c.tarea} ahora={ahora} />
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
