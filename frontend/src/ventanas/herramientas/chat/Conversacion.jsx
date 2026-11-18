// La conversación de General · Equipo: los mensajes (con el día y los seguidos agrupados) y el campo para escribir.
// Baja sola al último mensaje si ya estabas abajo; si estabas leyendo más arriba, no te mueve.
import { useLayoutEffect, useRef, useState } from 'react';
import { MessageCircle, SendHorizontal, X } from 'lucide-react';
import { EmptyState, IconButton, Skeleton, SkeletonRow, TextArea, toast } from '../../../components/standard';
import Mensaje from './Mensaje';
import { conSeparadores } from './formato';

function Escribir({ onEnviar, respondiendo, setRespondiendo, campo }) {
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);

    const enviar = async () => {
        const t = texto.trim();
        if (!t || enviando) return;
        setEnviando(true);
        try {
            await onEnviar(t, respondiendo?.id);
            setTexto('');
            setRespondiendo(null);
        } catch (e) {
            toast(e.response?.data?.error || 'No se pudo enviar. Probá de nuevo.', 'error');
        } finally {
            setEnviando(false);
            campo.current?.focus();
        }
    };

    return (
        <div className="ch-escribir">
            {respondiendo && (
                <div className="ch-escribir__resp">
                    Respondiendo a <b>{respondiendo.autor.nombre}</b>
                    <IconButton size="xs" label="No responder" icon={<X size={13} />} onClick={() => setRespondiendo(null)} />
                </div>
            )}
            <div className="ch-escribir__campo">
                <TextArea bare ref={campo} value={texto} placeholder="Escribí en Equipo…" maxLength={4000} aria-label="Mensaje"
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
                <IconButton label="Enviar" icon={<SendHorizontal size={16} />} onClick={enviar} disabled={!texto.trim() || enviando} />
            </div>
            <p className="ch-escribir__pie">Lo ve todo el equipo, en Work, la Academia y Leadership · Enter envía, Shift+Enter baja de línea</p>
        </div>
    );
}

export default function Conversacion({ mensajes, error, onEnviar }) {
    const caja = useRef(null);
    const abajo = useRef(true);
    const campo = useRef(null);
    const [respondiendo, setRespondiendo] = useState(null);
    const responder = (m) => { setRespondiendo(m); campo.current?.focus(); };

    useLayoutEffect(() => {
        const c = caja.current;
        if (c && abajo.current) c.scrollTop = c.scrollHeight;
    }, [mensajes]);

    const alScroll = () => {
        const c = caja.current;
        abajo.current = c.scrollHeight - c.scrollTop - c.clientHeight < 80;
    };

    return (
        <>
            {error && <p className="ch-error" role="status">{error}</p>}
            <div className="ch-linea" ref={caja} onScroll={alScroll}>
                {mensajes === null ? (
                    <Skeleton label="Cargando el chat…">{[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} avatar cells={['60%']} step={i} />)}</Skeleton>
                ) : mensajes.length === 0 ? (
                    <EmptyState icon={<MessageCircle size={28} />} title="Todavía no hay mensajes">Escribí el primero: lo ve todo el equipo.</EmptyState>
                ) : conSeparadores(mensajes).map(f => (f.tipo === 'dia'
                    ? <div key={f.clave} className="ch-dia">{f.texto}</div>
                    : <Mensaje key={f.clave} m={f.m} seguido={f.seguido} onResponder={responder} />))}
            </div>
            <Escribir onEnviar={onEnviar} respondiendo={respondiendo} setRespondiendo={setRespondiendo} campo={campo} />
        </>
    );
}
