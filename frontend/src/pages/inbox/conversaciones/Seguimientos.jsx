// Seguimientos condicionales del chat (Estrategia 16/11/2026): «si no responde en X horas, mandarle esto».
// `ProgramarSeguimiento` es el modal (texto o audio de la biblioteca, y cuándo); `ListaSeguimientos`, lo
// programado y lo último resuelto, arriba de la caja. Los manda el reloj del motor (`seguimientos.py`).
import { useEffect, useState } from 'react';
import { AlarmClock, X } from 'lucide-react';
import { Button, IconButton, Modal, ModalHeader, Segmented, Select, TextArea, toast } from '../../../components/standard';
import { inboxApi } from '../api';

const CUANDO = [
    { value: '1', label: '1 h' }, { value: '3', label: '3 h' }, { value: '24', label: '24 h' },
    { value: '48', label: '2 días' }, { value: '72', label: '3 días' },
];
const ESTADO = { enviado: 'Salió', cancelado: 'Cancelado', error: 'No salió', aviso: 'Toca' };
const hora = (iso) => new Date(iso).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function ProgramarSeguimiento({ contacto, textoInicial, pausar, onCerrar, onHecho }) {
    const [que, setQue] = useState('texto');
    const [texto, setTexto] = useState(textoInicial || '');
    const [audio, setAudio] = useState('');
    const [audios, setAudios] = useState([]);
    const [horas, setHoras] = useState('24');
    const [enviando, setEnviando] = useState(false);
    useEffect(() => { inboxApi.audios().then(setAudios).catch(() => setAudios([])); }, []);

    const listo = que === 'texto' ? texto.trim() : audio;
    const programar = async () => {
        setEnviando(true);
        try {
            const cuerpo = que === 'texto' ? { texto } : { audio_id: Number(audio) };
            const s = await inboxApi.programarSeguimiento(contacto.id, { ...cuerpo, horas: Number(horas), pausar });
            toast(`Programado para ${hora(s.enviar_en)} si no responde`);
            onHecho();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo programar', 'error');
            setEnviando(false);
        }
    };
    return (
        <Modal onClose={onCerrar} className="cv-seg-modal" labelledBy="cv-seg-t">
            <ModalHeader icon={<AlarmClock size={18} />} titleId="cv-seg-t" title="Seguimiento si no responde"
                subtitle="Sale solo a la hora elegida. Si el lead escribe antes, se cancela." onClose={onCerrar} />
            <div className="cv-seg-form">
                <Segmented size="sm" label="Qué mandar" value={que} onChange={setQue}
                    options={[{ value: 'texto', label: 'Texto' }, { value: 'audio', label: 'Audio' }]} />
                {que === 'texto'
                    ? <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensaje del seguimiento" placeholder="Ej.: ¿Pudiste ver el link? Si querés lo vemos juntos" maxLength={1000} />
                    : <Select label="Audio" value={audio} onChange={setAudio}
                        options={[{ value: '', label: audios.length ? 'Elegí un audio' : 'No hay audios: subí uno desde Audios' }, ...audios.map((a) => ({ value: String(a.id), label: a.nombre }))]} />}
                <Segmented size="sm" label="Si no responde en" value={horas} onChange={setHoras} options={CUANDO} />
            </div>
            <div className="barra">
                <Button onClick={onCerrar}>Cancelar</Button>
                <div className="barra-der">
                    <Button variant="primary" icon={<AlarmClock />} disabled={!listo || enviando} onClick={programar}>Programar</Button>
                </div>
            </div>
        </Modal>
    );
}

export function ListaSeguimientos({ items, onCambio }) {
    if (!items?.length) return null;
    const cancelar = async (s) => {
        try {
            await inboxApi.cancelarSeguimiento(s.id);
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo cancelar', 'error');
        }
    };
    // Los programados, lo que no salió (lo que salió ya se ve en el chat) y el «toca seguimiento» vigente de la
    // cadencia de la fase (ADR-W204). Lo viejo de la cadencia que no salió no se muestra: ya pasó.
    const visibles = items.filter((s) => s.estado === 'programado' || (s.estado === 'error' && !s.cadencia) || s.vigente);
    if (!visibles.length) return null;
    return (
        <ul className="cv-seg-lista">
            {visibles.map((s) => (
                <li key={s.id} className={`cv-seg cv-seg--${s.estado}`}>
                    <AlarmClock size={13} aria-hidden="true" />
                    <span>
                        {s.vigente ? <><b>{s.texto}</b>{s.detalle ? `: ${s.detalle}` : ' (lo pide la cadencia de su fase)'}</> : (
                            <>
                                {s.estado === 'programado' ? <>Si no responde, <b>{hora(s.enviar_en)}</b>: </> : <><b>{ESTADO[s.estado]}</b> ({s.detalle}): </>}
                                {s.audio ? `🎤 ${s.audio}` : `«${s.texto}»`}
                            </>
                        )}
                    </span>
                    {s.estado === 'programado' && <IconButton size="xs" label="Cancelar el seguimiento" icon={<X size={12} />} onClick={() => cancelar(s)} />}
                </li>
            ))}
        </ul>
    );
}
