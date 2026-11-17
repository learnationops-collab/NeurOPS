// Las propuestas de cambios de estructura arriba de la grilla de Flujos (ADR-W147). Quien aprueba ve las
// pendientes y las abre para revisar; el setter ve las suyas con la respuesta. Sin propuestas no ocupa lugar.
import { useEffect, useState } from 'react';
import { GitPullRequest } from 'lucide-react';
import { Button, Chip, Panel } from '../../../components/standard';
import { inboxApi } from '../api';

const ESTADO = { pendiente: ['Pendiente', 'var(--warning)'], aprobada: ['Aprobada', 'var(--success)'], rechazada: ['Rechazada', 'var(--danger)'] };
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '');

export default function Propuestas({ onAbrir }) {
    const [datos, setDatos] = useState(null);
    useEffect(() => { inboxApi.propuestas().then(setDatos).catch(() => setDatos(null)); }, []);
    if (!datos?.propuestas?.length) return null;
    const revisa = datos.puede_revisar;
    return (
        <Panel as="section" className="fl-propuestas" size="sm">
            <h3 className="t-rotulo"><GitPullRequest size={14} aria-hidden="true" /> {revisa ? `Propuestas para revisar (${datos.propuestas.length})` : 'Tus propuestas'}</h3>
            <ul>
                {datos.propuestas.map((p) => {
                    const [texto, color] = ESTADO[p.estado] || ESTADO.pendiente;
                    return (
                        <li key={p.id}>
                            <div>
                                <b>{p.flujo}</b> <span className="mut">· {revisa ? `${p.autor} · ` : ''}{fecha(p.creada_en)}</span>
                                <p className="t-cap">{p.nota}</p>
                                {p.respuesta && <p className="t-cap mut">{p.revisor}: {p.respuesta}</p>}
                            </div>
                            <Chip subtle color={color}>{p.desactualizada && p.estado === 'pendiente' ? 'Desactualizada' : texto}</Chip>
                            <Button onClick={() => onAbrir(p.id)}>{revisa ? 'Revisar' : 'Ver'}</Button>
                        </li>
                    );
                })}
            </ul>
        </Panel>
    );
}
