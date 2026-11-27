// Seguimientos condicionales del chat (Estrategia 16/11/2026): «si no responde en X horas, mandarle esto».
// `ProgramarSeguimiento` es el modal (texto o audio de la biblioteca, y cuándo); `ListaSeguimientos`, lo
// programado y lo último resuelto, arriba de la caja. Los manda el reloj del motor (`seguimientos.py`).
import { useEffect, useState } from 'react';
import { AlarmClock, Send, X } from 'lucide-react';
import { Button, IconButton, Modal, ModalHeader, Segmented, Select, TextArea, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import { esWhatsapp } from './colas';
import { linkInstagram, ventanaDe } from './ventana';

// Dentro de las 24 h del último mensaje del lead sale solo; después queda como «Toca seguimiento» y lo manda la
// persona con un clic (ADR-W282, ADR-W283). Hasta los 7 días.
const CUANDO = [
    { value: '1', label: '1 h' }, { value: '3', label: '3 h' }, { value: '12', label: '12 h' },
    { value: '24', label: '24 h' }, { value: '48', label: '2 días' }, { value: '72', label: '3 días' },
];
const desdeUltimoH = (c) => (c.ultimo_entrante_en ? (Date.now() - new Date(c.ultimo_entrante_en)) / 3600000 : Infinity);
// Sale solo si cae antes de las 24 h (con un margen para no rozar el cierre).
const saleSolo = (c, h) => desdeUltimoH(c) + h < 24 - 0.25;
const ESTADO = { enviado: 'Salió', cancelado: 'Cancelado', error: 'No salió', aviso: 'Toca' };
const hora = (iso) => new Date(iso).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function ProgramarSeguimiento({ contacto, textoInicial, pausar, onCerrar, onHecho }) {
    const [que, setQue] = useState('texto');
    const [texto, setTexto] = useState(textoInicial || '');
    const [audio, setAudio] = useState('');
    const [audios, setAudios] = useState([]);
    const [pasadas] = useState(() => desdeUltimoH(contacto));
    const wa = esWhatsapp(contacto);
    // WhatsApp no tiene la respuesta de una persona: solo lo que sale dentro de las 24 h. Instagram, hasta 7 días.
    const opciones = CUANDO.filter((o) => (wa ? saleSolo(contacto, Number(o.value)) : pasadas + Number(o.value) < 7 * 24));
    const [horas, setHoras] = useState(opciones.find((o) => o.value === '24')?.value || opciones.at(-1)?.value || '');
    const aviso = horas && !saleSolo(contacto, Number(horas));
    const [enviando, setEnviando] = useState(false);
    useEffect(() => { inboxApi.audios().then(setAudios).catch(() => setAudios([])); }, []);

    const listo = (que === 'texto' ? texto.trim() : audio) && horas;
    const programar = async () => {
        setEnviando(true);
        try {
            const cuerpo = que === 'texto' ? { texto } : { audio_id: Number(audio) };
            const s = await inboxApi.programarSeguimiento(contacto.id, { ...cuerpo, horas: Number(horas), pausar });
            toast(aviso ? `Te avisa ${hora(s.enviar_en)} si no responde, para que lo mandes vos` : `Programado para ${hora(s.enviar_en)} si no responde`);
            onHecho();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo programar', 'error');
            setEnviando(false);
        }
    };
    return (
        <Modal onClose={onCerrar} className="cv-seg-modal" labelledBy="cv-seg-t">
            <ModalHeader icon={<AlarmClock size={18} />} titleId="cv-seg-t" title="Seguimiento si no responde"
                subtitle="Si el lead escribe antes, se cancela." onClose={onCerrar} />
            <div className="cv-seg-form">
                <Segmented size="sm" label="Qué mandar" value={que} onChange={setQue}
                    options={[{ value: 'texto', label: 'Texto' }, { value: 'audio', label: 'Audio' }]} />
                {que === 'texto'
                    ? <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensaje del seguimiento" placeholder="Ej.: ¿Pudiste ver el link? Si querés lo vemos juntos" maxLength={1000} />
                    : <Select label="Audio" value={audio} onChange={setAudio}
                        options={[{ value: '', label: audios.length ? 'Elegí un audio' : 'No hay audios: subí uno desde Audios' }, ...audios.map((a) => ({ value: String(a.id), label: a.nombre }))]} />}
                {opciones.length
                    ? <Segmented size="sm" label="Si no responde en" value={horas} onChange={setHoras} options={opciones} />
                    : <p className="t-cap mut40">Le queda poca ventana: escribile vos ahora.</p>}
                {horas && (
                    <p className="t-cap mut40">
                        {aviso
                            ? 'A esa hora ya pasaron 24 h desde su último mensaje: no sale solo. Te queda en «Toca seguimiento» con este texto y lo mandás con un clic.'
                            : 'Sale solo a esa hora.'}
                    </p>
                )}
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

// El programado que pasó las 24 h (ADR-W283): «Mandar» lo manda la persona ahora, como si lo escribiera; sin la
// aprobación de Human Agent, el link al chat de Instagram.
function MandarAviso({ s, contacto, onCambio }) {
    const [enviando, setEnviando] = useState(false);
    const ventana = ventanaDe(contacto.ultimo_entrante_en, undefined, esWhatsapp(contacto));
    if (ventana.enInstagram) {
        const link = linkInstagram(contacto);
        return link ? <a className="t-cap" href={link} target="_blank" rel="noopener noreferrer">Abrir en Instagram</a> : null;
    }
    if (ventana.estado === 'cerrada') return null;
    const mandar = async () => {
        setEnviando(true);
        try {
            await inboxApi.mandarSeguimiento(s.id);
            toast('Seguimiento enviado');
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo mandar', 'error');
            setEnviando(false);
        }
    };
    return <Button size="xs" variant="primary" icon={<Send />} disabled={enviando} onClick={mandar}>Mandar</Button>;
}

export function ListaSeguimientos({ items, contacto, onCambio }) {
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
                        {s.vigente && !s.cadencia ? <><b>Toca seguimiento</b>: {s.audio ? `🎤 ${s.audio}` : `«${s.texto}»`}</> : s.vigente ? <><b>{s.texto}</b>{s.detalle ? `: ${s.detalle}` : ' (lo pide la cadencia de su fase)'}</> : (
                            <>
                                {s.estado === 'programado' ? <>Si no responde, <b>{hora(s.enviar_en)}</b>: </> : <><b>{ESTADO[s.estado]}</b> ({s.detalle}): </>}
                                {s.audio ? `🎤 ${s.audio}` : `«${s.texto}»`}
                            </>
                        )}
                    </span>
                    {s.vigente && !s.cadencia && contacto && <MandarAviso s={s} contacto={contacto} onCambio={onCambio} />}
                    {s.estado === 'programado' && <IconButton size="xs" label="Cancelar el seguimiento" icon={<X size={12} />} onClick={() => cancelar(s)} />}
                </li>
            ))}
        </ul>
    );
}
