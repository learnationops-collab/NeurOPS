// Una fila de la bandeja: quién es, para qué examen, en qué paso del flujo quedó, cuánto hace que
// espera y a quién está asignada. Se decide a quién atender sin abrir el chat.
import { AlertTriangle, Bot, Clock, PauseCircle, User } from 'lucide-react';
import { Avatar, Chip } from '../../../components/standard';
import { rotuloPaso } from '../estadoFlujo';
import { colorEspera, esperaMin, examenDe, flujoCortado, quien, textoEspera } from './colas';
import { Etiqueta } from './Etiquetas';

export function hora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date().toDateString() === d.toDateString();
    return d.toLocaleString('es', hoy ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });
}

const CORTE = { error: 'Error', ventana_vencida: 'Venció la ventana de 24 h' };

export function Asignado({ asignado, yo }) {
    if (!asignado) return <span className="cv-asignado cv-asignado--sin"><User size={12} aria-hidden="true" />Sin asignar</span>;
    const mio = asignado.id === yo;
    return (
        <span className={`cv-asignado${mio ? ' cv-asignado--mio' : ''}`}>
            <Avatar name={asignado.username} size="xs" />{mio ? 'Vos' : asignado.username}
        </span>
    );
}

export default function Fila({ c, elegida, ahora, yo, onElegir }) {
    const espera = esperaMin(c, ahora);
    const examen = examenDe(c);
    const corte = flujoCortado(c) ? (c.ejecucion ? CORTE[c.ejecucion.estado] : 'Ningún flujo arrancó') : null;
    return (
        <li>
            <button type="button" className={`cv-item${c.califica === false ? ' cv-item--apagada' : ''}`} aria-pressed={elegida} onClick={() => onElegir(c.id)}>
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
                    </span>
                    <span className="cv-item-chips">
                        {corte && <Chip subtle color={c.ejecucion?.estado === 'error' ? 'var(--error)' : 'var(--warning)'} icon={<AlertTriangle />}>{corte}</Chip>}
                        {c.ejecucion?.estado === 'pendiente' && <Chip subtle color="var(--warning)" icon={<Clock />} data-tip="Pendiente|Arranca cuando el lead vuelva a escribir">Pendiente</Chip>}
                        {c.paso && <Chip subtle color="var(--info)">{rotuloPaso(c.paso)}</Chip>}
                        {espera != null && (
                            <Chip subtle color={colorEspera(espera)} icon={<Clock />} data-tip={`Espera respuesta|Desde ${hora(c.ultimo_en)}`}>
                                espera {textoEspera(espera)}
                            </Chip>
                        )}
                        {c.bot_pausado && <Chip subtle color="var(--warning)" icon={<PauseCircle />}>Bot pausado</Chip>}
                        {c.califica === true && <Chip subtle color="var(--success)">Califica</Chip>}
                        {c.califica === false && <Chip subtle color="var(--idle)">No califica</Chip>}
                    </span>
                    <span className="cv-item-pie">
                        <Asignado asignado={c.asignado} yo={yo} />
                        {(c.etiquetas || []).map((e) => <Etiqueta key={e.id} e={e} />)}
                    </span>
                </span>
            </button>
        </li>
    );
}
