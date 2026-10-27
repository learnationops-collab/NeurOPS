// La vista Embudo: una columna por sub-etapa (Con el bot · En conversación · Link enviado · Agendó), con
// la etapa a la que pertenece arriba. Arrastrar una tarjeta a otra columna la mueve; tocarla abre el chat.
import { useState } from 'react';
import { Avatar, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import { ETAPAS, quien } from './colas';
import { Califica, Vence, hora } from './Fila';
import { Puntos } from './Progreso';

const TRAMO = { auto: 'Automática', manual: 'Manual', agenda: 'Agendamiento' };

export default function Embudo({ lista, ahora, onAbrir, onMovida }) {
    const [arrastra, setArrastra] = useState(null);
    const [sobre, setSobre] = useState(null);

    const soltar = async (etapa) => {
        const c = lista.find((x) => x.id === arrastra);
        setArrastra(null);
        setSobre(null);
        if (!c || c.etapa === etapa) return;
        try {
            await inboxApi.moverEtapa(c.id, etapa);
            toast(`${quien(c)} → ${ETAPAS.find((e) => e.value === etapa).label}`);
            onMovida();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo mover', 'error');
        }
    };

    return (
        <div className="cv-embudo">
            {ETAPAS.map((e) => {
                const cs = lista.filter((c) => c.etapa === e.value);
                return (
                    <section key={e.value} className={`cv-col${sobre === e.value ? ' cv-col--sobre' : ''}`} style={{ '--c': e.color }}
                        onDragOver={(ev) => { ev.preventDefault(); setSobre(e.value); }} onDragLeave={() => setSobre(null)} onDrop={() => soltar(e.value)}>
                        <header className="cv-col-cab">
                            <span className="t-rotulo">{TRAMO[e.tramo]}</span>
                            <b>{e.label}</b>
                            <span className="t-cap mut">{cs.length === 1 ? '1 lead' : `${cs.length} leads`}</span>
                        </header>
                        <ul>
                            {cs.map((c) => (
                                <li key={c.id}>
                                    <button type="button" className="cv-kcard" draggable onDragStart={() => setArrastra(c.id)} onDragEnd={() => setArrastra(null)} onClick={() => onAbrir(c.id)}>
                                        <span className="cv-kcard-cab">
                                            <strong>{quien(c)}</strong>
                                            {c.sin_leer > 0 && <i className="cv-sin-leer">{c.sin_leer}</i>}
                                            <span className="mut cv-item-hora">{hora(c.ultimo_en)}</span>
                                        </span>
                                        <span className="cv-kcard-texto mut">{c.ultimo_texto || '…'}</span>
                                        <span className="cv-kcard-pie">
                                            <Puntos etapas={c.etapas} />
                                            <Califica valor={c.califica} />
                                            <Vence tarea={c.tarea} ahora={ahora} />
                                            {c.asignado ? <Avatar name={c.asignado.username} size="xs" data-tip={c.asignado.username} /> : <span className="cv-asignado--sin t-cap">Sin asignar</span>}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}
