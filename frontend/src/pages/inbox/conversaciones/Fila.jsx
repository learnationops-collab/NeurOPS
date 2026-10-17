// Una fila de la bandeja: quién es, para qué examen, en qué paso del flujo quedó y cuánto hace que
// espera. Se decide a quién atender sin abrir el chat.
import { Bot, Clock, PauseCircle, User } from 'lucide-react';
import { Avatar, Chip } from '../../../components/standard';
import { rotuloPaso } from '../estadoFlujo';
import { colorEspera, esperaMin, examenDe, quien, textoEspera } from './colas';

export function hora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date().toDateString() === d.toDateString();
    return d.toLocaleString('es', hoy ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });
}

export default function Fila({ c, elegida, ahora, onElegir }) {
    const espera = esperaMin(c, ahora);
    const examen = examenDe(c);
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
                        {c.paso && <Chip subtle color="var(--brand-secondary)">{rotuloPaso(c.paso)}</Chip>}
                        {espera != null && (
                            <Chip subtle color={colorEspera(espera)} icon={<Clock />} data-tip={`Espera respuesta|Desde ${hora(c.ultimo_en)}`}>
                                espera {textoEspera(espera)}
                            </Chip>
                        )}
                        {c.bot_pausado && <Chip subtle color="var(--warning)" icon={<PauseCircle />}>Bot pausado</Chip>}
                        {c.califica === true && <Chip subtle color="var(--success)">Califica</Chip>}
                        {c.califica === false && <Chip subtle color="var(--idle)">No califica</Chip>}
                    </span>
                </span>
            </button>
        </li>
    );
}
