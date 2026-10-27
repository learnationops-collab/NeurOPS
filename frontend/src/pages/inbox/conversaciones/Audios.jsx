// La biblioteca de audios del equipo: se escuchan, se suben (hasta 8 MB) y se borran los propios.
// Mandar uno por Instagram se habilita con el corte de Kommo; mientras, «Mandar» queda apagado.
import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Send, Trash2, Upload } from 'lucide-react';
import { Button, EmptyState, IconButton, Input, Modal, ModalHeader, toast } from '../../../components/standard';
import { inboxApi } from '../api';

const duracion = (s) => (s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

// La duración la mide el navegador antes de subirlo.
function medir(archivo) {
    return new Promise((ok) => {
        const a = new Audio();
        a.preload = 'metadata';
        a.onloadedmetadata = () => { ok(Number.isFinite(a.duration) ? a.duration : null); URL.revokeObjectURL(a.src); };
        a.onerror = () => ok(null);
        a.src = URL.createObjectURL(archivo);
    });
}

function Subir({ onSubido }) {
    const [archivo, setArchivo] = useState(null);
    const [nombre, setNombre] = useState('');
    const [subiendo, setSubiendo] = useState(false);
    const subir = async (e) => {
        e.preventDefault();
        setSubiendo(true);
        try {
            const form = new FormData();
            form.append('archivo', archivo);
            form.append('nombre', nombre.trim());
            const d = await medir(archivo);
            if (d) form.append('duracion', String(d));
            onSubido(await inboxApi.subirAudio(form));
            setArchivo(null);
            setNombre('');
        } catch (err) {
            toast(err.response?.data?.message || 'No se pudo subir', 'error');
        } finally {
            setSubiendo(false);
        }
    };
    return (
        <form className="cv-audio-subir" onSubmit={subir}>
            <label className="cv-audio-archivo">
                <Upload size={14} aria-hidden="true" />{archivo ? archivo.name : 'Elegir audio'}
                <input type="file" accept="audio/*" onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setArchivo(f);
                    if (f && !nombre) setNombre(f.name.replace(/\.[^.]+$/, ''));
                }} />
            </label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" aria-label="Nombre del audio" />
            <Button type="submit" variant="primary" disabled={!archivo || !nombre.trim() || subiendo}>Subir</Button>
        </form>
    );
}

export default function Audios({ onCerrar }) {
    const [audios, setAudios] = useState(null);
    const [elegido, setElegido] = useState(null);
    const [sonando, setSonando] = useState(null);
    const reproductor = useRef(null);
    useEffect(() => {
        inboxApi.audios().then(setAudios).catch(() => setAudios([]));
        return () => { reproductor.current?.pause(); };
    }, []);

    const escuchar = async (a) => {
        reproductor.current?.pause();
        if (sonando === a.id) { setSonando(null); return; }
        try {
            const url = URL.createObjectURL(await inboxApi.archivoAudio(a.id));
            const audio = new Audio(url);
            audio.onended = () => { setSonando(null); URL.revokeObjectURL(url); };
            reproductor.current = audio;
            await audio.play();
            setSonando(a.id);
        } catch {
            toast('No se pudo reproducir', 'error');
        }
    };
    const borrar = async (a) => {
        try {
            await inboxApi.borrarAudio(a.id);
            setAudios((l) => l.filter((x) => x.id !== a.id));
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo borrar', 'error');
        }
    };

    return (
        <Modal onClose={onCerrar} className="cv-audios" labelledBy="cv-audios-t">
            <ModalHeader icon={<Mic size={18} />} title="Audios" titleId="cv-audios-t" subtitle="Los audios del equipo" onClose={onCerrar} />
            <Subir onSubido={(a) => setAudios((l) => [a, ...(l || [])])} />
            {audios === null ? <EmptyState>Cargando…</EmptyState> : !audios.length ? <EmptyState>Todavía no hay audios. Subí el primero.</EmptyState> : (
                <ul className="cv-audio-lista">
                    {audios.map((a) => (
                        <li key={a.id} className={elegido === a.id ? 'cv-audio--elegido' : ''}>
                            <IconButton size="sm" label={sonando === a.id ? 'Pausar' : `Escuchar ${a.nombre}`} icon={sonando === a.id ? <Pause size={13} /> : <Play size={13} />} onClick={() => escuchar(a)} />
                            <button type="button" className="cv-audio-info" aria-pressed={elegido === a.id} onClick={() => setElegido(a.id)}>
                                <b>{a.nombre}</b>
                                <span>{[duracion(a.duracion), a.autor && `subido por ${a.autor}`].filter(Boolean).join(' · ')}</span>
                            </button>
                            {a.puede_borrar && <IconButton size="sm" danger label={`Borrar ${a.nombre}`} icon={<Trash2 size={13} />} onClick={() => borrar(a)} />}
                        </li>
                    ))}
                </ul>
            )}
            <div className="cv-modal-pie">
                <span className="t-cap mut cv-bloqueado">Mandar audios desde acá se habilita con el corte de Kommo.</span>
                <Button onClick={onCerrar}>Cerrar</Button>
                <Button variant="primary" icon={<Send />} disabled>Mandar</Button>
            </div>
        </Modal>
    );
}
