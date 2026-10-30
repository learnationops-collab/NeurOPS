// «Compartidos conmigo»: los leads en los que alguien me nombró con «@» en su chat (GET /api/avisos/compartidos),
// sean míos o no. Se abren en su ficha para mirar y contestar en Comunicación; sin tocar la agenda
// (la ficha va en solo lectura: la única acción es la nota).

import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { Chip, EmptyState, FieldError, Panel, Skeleton, SkeletonPanel } from '../standard';
import { formatAgendaDateTime } from '../../utils/datetime';
import FichaLeadModal from '../ficha/FichaLeadModal';

export function useCompartidos() {
    const [lista, setLista] = useState(null);
    const [error, setError] = useState(null);
    const cargar = useCallback(() => api.get('/avisos/compartidos')
        .then((res) => { setLista(res.data?.compartidos || []); setError(null); })
        .catch((err) => setError(err?.response?.data?.message || 'No se pudieron cargar los leads compartidos.')), []);
    useEffect(() => { cargar(); }, [cargar]);
    return { lista, error, cargar };
}

export default function CompartidosConmigo() {
    const { lista, error, cargar } = useCompartidos();
    const [abierto, setAbierto] = useState(null);
    const cerrar = () => { setAbierto(null); cargar(); };

    return (
        <div className="dc-shell dc-shell--embebido">
            <div style={{ display: 'grid', gap: 'var(--s4)', padding: 'var(--s4)', paddingBottom: 120 }}>
                {error && <FieldError>{error}</FieldError>}
                {!lista ? (!error && <Skeleton label="Cargando los leads compartidos"><SkeletonPanel rows={3} /></Skeleton>) : lista.length === 0 ? (
                    <EmptyState title="Nadie te compartió un lead todavía">
                        Cuando alguien te nombre con @ en el chat de un lead, aparece acá para que contestes.
                    </EmptyState>
                ) : (
                    <Panel>
                        <h3 className="t-sm">{`${lista.length} ${lista.length === 1 ? 'lead compartido' : 'leads compartidos'} contigo`}</h3>
                        {lista.map((l) => (
                            <div key={l.person_uuid} role="button" tabIndex={0} onClick={() => setAbierto(l)}
                                onKeyDown={(e) => { if (e.key === 'Enter') setAbierto(l); }}
                                style={{ display: 'grid', gap: 'var(--s1)', padding: 'var(--s3) 0', cursor: 'pointer',
                                    borderTop: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)', alignItems: 'center' }}>
                                    <span className="t-sm" style={{ fontWeight: 700 }}>{l.nombre || 'Lead'}</span>
                                    <span className="t-cap mut">{[l.de && `de ${l.de}`, formatAgendaDateTime(l.cuando)].filter(Boolean).join(' · ')}</span>
                                    {l.sin_leer && <Chip color="var(--brand-secondary)">Nuevo</Chip>}
                                </div>
                                {l.texto && <small className="t-cap mut" style={{ whiteSpace: 'pre-wrap' }}>{l.texto}</small>}
                            </div>
                        ))}
                    </Panel>
                )}
            </div>
            {abierto && (
                <FichaLeadModal clientId={abierto.client_id} personUuid={abierto.client_id ? null : abierto.person_uuid}
                    pestanaInicial="com" soloLectura onCerrar={cerrar} onCambio={cargar} />
            )}
        </div>
    );
}
