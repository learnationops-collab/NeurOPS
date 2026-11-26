// La vista Embudo por etapa del setting (ADR-W184): una columna por fase, de 1 Apertura a 8 Confirmación, y las
// salidas (No lead, In-abrible). Arriba de cada una, su etapa (Automática, Manual, Agendamiento) con su color.
// Arrastrar una tarjeta a otra columna la mueve de fase; tocarla abre el chat.
import { useState } from 'react';
import { Avatar, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import { quien, vistaPrevia } from './colas';
import { Califica, Vence, hora } from './Fila';
import { FASES, TRAMOS, colorDe, corto, faseDe } from './fasesSetting';
import { Puntos } from './Progreso';

export default function Embudo({ lista, ahora, onAbrir, onMovida }) {
    const [arrastra, setArrastra] = useState(null);
    const [sobre, setSobre] = useState(null);

    const soltar = async (fase) => {
        const c = lista.find((x) => x.id === arrastra);
        setArrastra(null);
        setSobre(null);
        if (!c || c.fase === fase) return;
        try {
            await inboxApi.moverFase(c.id, fase);
            toast(`${quien(c)} → ${faseDe(fase).label}`);
            onMovida();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo mover', 'error');
        }
    };

    return (
        <div className="cv-embudo cv-embudo--fases">
            {FASES.map((f) => {
                const cs = lista.filter((c) => c.fase === f.id);
                return (
                    <section key={f.id} className={`cv-col${sobre === f.id ? ' cv-col--sobre' : ''}`} style={{ '--c': colorDe(f) }}
                        onDragOver={(ev) => { ev.preventDefault(); setSobre(f.id); }} onDragLeave={() => setSobre(null)} onDrop={() => soltar(f.id)}>
                        <header className="cv-col-cab">
                            <span className="t-rotulo">{TRAMOS[f.tramo].nombre}</span>
                            <b>{f.n} · {corto(f)}</b>
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
                                        <span className="cv-kcard-texto mut">{vistaPrevia(c)}</span>
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
