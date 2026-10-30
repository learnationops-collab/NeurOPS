// «Abandonos» del espacio del triage: leads que dejaron sus datos en un link y no terminaron de agendar
// (GET /api/triage/abandonos, últimas 48 h). El triage los contacta primero: WhatsApp, y marca si habló o
// no contestó. Cuando el lead agenda, sale solo de la lista (su intento pasa a ser una agenda).

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { Button, Chip, EmptyState, FieldError, Panel, Segmented, Skeleton, SkeletonPanel } from '../../../components/standard';
import { formatAgendaDateTime } from '../../../utils/datetime';

const VISTAS = [
    { value: 'por_contactar', label: 'Por contactar' },
    { value: 'hechos', label: 'Hechos' },
];

const CONTACTO = {
    contactado: ['Contactado', 'var(--success)'],
    no_contesta: ['No contesta', 'var(--warning)'],
};

const whatsapp = (telefono) => `https://wa.me/${(telefono || '').replace(/\D/g, '')}`;

function useAbandonos() {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const cargar = useCallback(() => api.get('/triage/abandonos')
        .then((res) => { setDatos(res.data); setError(null); })
        .catch((err) => setError(err?.response?.data?.message || 'No se pudieron cargar los abandonos.')), []);
    useEffect(() => { cargar(); }, [cargar]);

    const marcar = async (id, estado) => {
        try {
            await api.post(`/triage/abandonos/${id}/contacto`, { estado });
            await cargar();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'No se pudo guardar.');
            cargar();
        }
    };
    return { datos, error, marcar };
}

const Abandono = ({ a, onMarcar }) => {
    const hecho = CONTACTO[a.contacto];
    return (
        <div style={{ display: 'grid', gap: 'var(--s2)', padding: 'var(--s3) 0', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)', alignItems: 'center' }}>
                <span className="t-sm" style={{ fontWeight: 700 }}>{a.nombre || 'Lead'}</span>
                <span className="t-cap mut">{[formatAgendaDateTime(a.hora), a.telefono].filter(Boolean).join(' · ')}</span>
                {a.segmento && <Chip subtle>{`Segmento ${a.segmento}`}</Chip>}
                <Chip subtle>{a.hasta_donde}</Chip>
                {(a.setter || a.origen) && <Chip subtle>{`Origen: ${a.setter || a.origen}`}</Chip>}
                {hecho && <Chip color={hecho[1]} subtle>{`${hecho[0]}${a.contacto_por ? ` · ${a.contacto_por}` : ''}`}</Chip>}
            </div>
            {a.respuestas.length > 0 && (
                <small className="t-cap mut">{a.respuestas.map((r) => `${r.pregunta}: ${r.respuesta}`).join(' · ')}</small>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)' }}>
                {a.telefono && (
                    <a className="ui-btn ui-btn--secondary ui-btn--sm" href={whatsapp(a.telefono)} target="_blank" rel="noreferrer">WhatsApp</a>
                )}
                {!a.contacto ? (
                    <>
                        <Button onClick={() => onMarcar(a.id, 'contactado')}>Contactado</Button>
                        <Button onClick={() => onMarcar(a.id, 'no_contesta')}>No contesta</Button>
                    </>
                ) : (
                    <Button variant="ghost" onClick={() => onMarcar(a.id, null)}>Deshacer</Button>
                )}
            </div>
        </div>
    );
};

export default function TriageAbandonos() {
    const { datos, error, marcar } = useAbandonos();
    const [vista, setVista] = useState('por_contactar');
    const lista = (datos?.abandonos || []).filter((a) => (vista === 'hechos' ? a.contacto : !a.contacto));
    const porContactar = (datos?.abandonos || []).filter((a) => !a.contacto).length;

    return (
        <div className="dc-shell dc-shell--embebido">
            <div style={{ display: 'grid', gap: 'var(--s4)', padding: 'var(--s4)', paddingBottom: 120 }}>
                <Segmented value={vista} onChange={setVista} label="Abandonos"
                    options={VISTAS.map((v) => (v.value === 'por_contactar' ? { ...v, label: `${v.label} · ${porContactar}` } : v))} />
                {error && <FieldError>{error}</FieldError>}
                {!datos ? (!error && <Skeleton label="Cargando los abandonos"><SkeletonPanel rows={4} /></Skeleton>) : lista.length === 0 ? (
                    <EmptyState title={vista === 'hechos' ? 'Todavía no marcaste ninguno' : 'No hay abandonos por contactar'}>
                        {`Son los leads que dejaron sus datos y no agendaron en las últimas ${datos.horas} horas. Si agendan, salen solos.`}
                    </EmptyState>
                ) : (
                    <Panel>
                        <h3 className="t-sm">{`${lista.length} ${lista.length === 1 ? 'lead sin agendar' : 'leads sin agendar'}`}</h3>
                        {lista.map((a) => <Abandono key={a.id} a={a} onMarcar={marcar} />)}
                    </Panel>
                )}
            </div>
        </div>
    );
}
