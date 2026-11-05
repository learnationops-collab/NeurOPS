// Pestaña «Reuniones» (04/11/2026): las notas que Gemini tomó en las sesiones de Meet con el lead
// (diagnóstica, onboarding, scale…). Work las lee del Drive de team@ (app/services/notas_meet/) y las cuelga
// de la agenda o del lead por su email. Pide sus datos aparte de la ficha (`GET /ficha/notas-meet`).

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Video } from 'lucide-react';
import { Chip, EmptyState, IconButton } from '../../standard';
import { Hueso } from '../../huesos/Huesos';
import { Aviso, SeccionColapsable, instanteLegible } from '../piezas';
import { mensajeDeError, obtenerNotasMeet } from '../fichaApi';
import NotaMarkdown from './NotaMarkdown';
import './reuniones.css';

const Nota = ({ n, abierta }) => (
    <SeccionColapsable titulo={n.kind || n.title} abiertaPorDefecto={abierta}
        resumen={[instanteLegible(n.meeting_at), n.appointment_id ? 'de una agenda' : null].filter(Boolean).join(' · ')}>
        <div className="fi-meet">
            <div className="fi-meet-links">
                <a href={n.doc_url} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /> Abrir notas</a>
                {n.recording_url && <a href={n.recording_url} target="_blank" rel="noreferrer"><Video size={14} aria-hidden="true" /> Grabación</a>}
                {n.kind && <Chip subtle>{n.title}</Chip>}
            </div>
            {n.summary && <p className="t-sm fi-meet-resumen">{n.summary}</p>}
            <details className="fi-meet-todo">
                <summary className="t-sm">Nota completa</summary>
                <NotaMarkdown texto={n.content} />
            </details>
        </div>
    </SeccionColapsable>
);

const TabReuniones = ({ ficha }) => {
    const appointmentId = ficha?.identidad?.appointment_id ?? null;
    const clientId = ficha?.identidad?.client_id ?? null;
    const [notas, setNotas] = useState(null);
    const [error, setError] = useState(null);

    const cargar = useCallback((signal) => {
        setError(null);
        obtenerNotasMeet({ appointmentId, clientId, signal })
            .then(d => setNotas(d.notas || []))
            .catch((err) => { if (!signal?.aborted) setError(mensajeDeError(err)); });
    }, [appointmentId, clientId]);

    useEffect(() => {
        const ctrl = new AbortController();
        cargar(ctrl.signal);
        return () => ctrl.abort();
    }, [cargar]);

    if (error) {
        return (
            <Aviso tono="error" titulo="No se pudieron cargar las notas de las reuniones">
                {error} <IconButton icon={<RefreshCw size={14} />} label="Reintentar" size="xs" onClick={() => cargar()} />
            </Aviso>
        );
    }
    if (notas == null) {
        return <div style={{ display: 'grid', gap: 'var(--s3)' }}>{[0, 1, 2].map(i => <Hueso key={i} alto={44} />)}</div>;
    }
    if (!notas.length) {
        return (
            <EmptyState icon={<Video />} title="Sin notas de reuniones">
                Cuando una sesión de Meet con este lead tenga notas de Gemini, aparecen acá.
            </EmptyState>
        );
    }
    return (
        <div style={{ display: 'grid', gap: 'var(--s3)' }}>
            {notas.map((n, i) => <Nota key={n.id} n={n} abierta={i === 0} />)}
        </div>
    );
};

export default TabReuniones;
