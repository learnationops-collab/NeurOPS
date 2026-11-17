// La caja de abajo del chat, en tres modos: Chat, Nota interna (el lead no la ve) y Tarea. En Chat el
// mensaje (o un audio del equipo) sale por Instagram a nombre de quien lo manda (17/11/2026); los pasos del
// flujo los manda el bot. Ctrl+Enter envía.
import { useEffect, useRef, useState } from 'react';
import { AlarmClock, CalendarCheck, MessageSquare, Mic, Send, StickyNote, Zap } from 'lucide-react';
import { Button, IconButton, Input, Segmented, Select, TextArea, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import Audios from './Audios';
import MenuRayo, { NuevaRapida } from './MenuRayo';
import ModalFlujo from './ModalFlujo';
import { ListaSeguimientos, ProgramarSeguimiento } from './Seguimientos';
import useEquipo from './useEquipo';
import { ventanaDe } from './ventana';

const MODOS = [
    { value: 'chat', label: 'Chat', icon: <MessageSquare size={13} /> },
    { value: 'nota', label: 'Nota interna', icon: <StickyNote size={13} /> },
    { value: 'tarea', label: 'Tarea', icon: <CalendarCheck size={13} /> },
];

// Mañana a las 10, en la hora de quien la crea (formato de <input type="datetime-local">).
function manana() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;
}

function FormTarea({ contacto, yo, onHecho }) {
    const equipo = useEquipo();
    const [titulo, setTitulo] = useState('');
    const [vence, setVence] = useState(manana);
    const [para, setPara] = useState(String(yo || ''));
    const crear = async (e) => {
        e.preventDefault();
        try {
            await inboxApi.crearTarea(contacto.id, { titulo: titulo.trim(), vence: vence ? new Date(vence).toISOString() : null, asignada_a: Number(para) || null });
            setTitulo('');
            toast('Tarea creada');
            onHecho();
        } catch (err) {
            toast(err.response?.data?.message || 'No se pudo crear la tarea', 'error');
        }
    };
    return (
        <form className="cv-comp-tarea" onSubmit={crear}>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: volver a escribirle con el precio" aria-label="Tarea" />
            <Input type="datetime-local" value={vence} onChange={(e) => setVence(e.target.value)} aria-label="Vence" />
            <Select label="Para" value={para} onChange={setPara} options={equipo.map((s) => ({ value: String(s.id), label: s.id === yo ? 'Vos' : s.nombre }))} />
            <Button type="submit" variant="primary" disabled={!titulo.trim()}>Crear tarea</Button>
        </form>
    );
}

export default function Composer({ contacto, ejecucion, seguimientos, yo, onCambio }) {
    const [modo, setModo] = useState('chat');
    const [texto, setTexto] = useState('');
    const [rayo, setRayo] = useState(false);
    const [audios, setAudios] = useState(false);
    const [nueva, setNueva] = useState(false);
    const [paso, setPaso] = useState(null);
    const [programar, setProgramar] = useState(false);
    const [pausar, setPausar] = useState(true);
    const caja = useRef(null);
    const barra = texto.startsWith('/');
    const menu = modo === 'chat' && (rayo || barra);

    useEffect(() => {
        if (!menu) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) { setRayo(false); if (barra) setTexto(''); } };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [menu, barra]);

    const insertar = (t) => { setTexto((x) => (x.startsWith('/') ? t : x ? `${x} ${t}` : t)); setRayo(false); };
    const guardarNota = async () => {
        try {
            await inboxApi.crearNota(contacto.id, texto.trim());
            setTexto('');
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo guardar la nota', 'error');
        }
    };
    const [enviando, setEnviando] = useState(false);
    const ventana = ventanaDe(contacto.ultimo_entrante_en);
    const enviar = async (cuerpo) => {
        setEnviando(true);
        try {
            await inboxApi.escribir(contacto.id, { ...cuerpo, pausar });
            if (cuerpo.texto) setTexto('');
            onCambio();
            return true;
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo enviar', 'error');
            return false;
        } finally {
            setEnviando(false);
        }
    };
    const puedeEnviar = ventana.estado !== 'cerrada' && !enviando;
    const audioDelMenu = async (a) => { setRayo(false); setTexto((x) => (x.startsWith('/') ? '' : x)); if (await enviar({ audio_id: a.id })) toast(`Audio enviado: ${a.nombre}`); };

    return (
        <div className={`cv-composer cv-composer--${modo}`} ref={caja}>
            <ListaSeguimientos items={seguimientos} onCambio={onCambio} />
            {menu && (
                <MenuRayo contacto={contacto} filtro={barra ? texto.slice(1) : ''} onTexto={insertar}
                    onPaso={(id) => { setRayo(false); setTexto(''); setPaso(id); }} onNueva={() => { setRayo(false); setNueva(true); }}
                    onAudio={puedeEnviar ? audioDelMenu : null} />
            )}
            <div className="cv-comp-cab">
                <Segmented size="sm" label="Modo" value={modo} onChange={(m) => { setModo(m); setRayo(false); }} options={MODOS} />
                {modo === 'chat' && (
                    <label className="cv-comp-check" data-tip="Al enviar|El bot deja de hablarle 24 h y corta el flujo abierto">
                        <input type="checkbox" checked={pausar} onChange={(e) => setPausar(e.target.checked)} />Pausar el bot al enviar
                    </label>
                )}
            </div>
            {modo === 'tarea' ? <FormTarea contacto={contacto} yo={yo} onHecho={() => { setModo('chat'); onCambio(); }} /> : (
                <div className="cv-comp-fila">
                    {modo === 'chat' && (
                        <>
                            <IconButton size="sm" label="Respuestas rápidas, variables y pasos del flujo" data-tip="Respuestas rápidas y pasos|O escribí /" pressed={rayo} icon={<Zap size={15} />} onClick={() => setRayo((r) => !r)} />
                            <IconButton size="sm" label="Audios" data-tip="Audios del equipo" icon={<Mic size={15} />} onClick={() => setAudios(true)} />
                            <IconButton size="sm" label="Seguimiento si no responde" data-tip="Seguimiento|Sale solo si no responde en el tiempo que elijas" icon={<AlarmClock size={15} />}
                                disabled={ventana.estado === 'cerrada'} onClick={() => setProgramar(true)} />
                        </>
                    )}
                    <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label={modo === 'nota' ? 'Nota interna' : 'Mensaje'}
                        onKeyDown={(e) => { if (modo === 'chat' && e.key === 'Enter' && (e.ctrlKey || e.metaKey) && texto.trim() && puedeEnviar) enviar({ texto }); }}
                        placeholder={modo === 'nota' ? 'Nota para el equipo: el lead no la ve' : 'Escribile al lead: / para respuestas rápidas y pasos del flujo'} />
                    {modo === 'nota'
                        ? <Button variant="primary" disabled={!texto.trim()} onClick={guardarNota}>Guardar</Button>
                        : <Button variant="primary" icon={<Send />} disabled={!texto.trim() || !puedeEnviar} data-tip="Enviar|Ctrl+Enter" onClick={() => enviar({ texto })}>Enviar</Button>}
                </div>
            )}
            {modo === 'chat' && ventana.aviso && <p className="t-cap mut40 cv-bloqueado">{ventana.aviso}</p>}
            {audios && <Audios onCerrar={() => setAudios(false)} onMandar={puedeEnviar ? async (a) => { if (await enviar({ audio_id: a.id })) setAudios(false); } : null} />}
            {programar && (
                <ProgramarSeguimiento contacto={contacto} textoInicial={texto.startsWith('/') ? '' : texto} pausar={pausar}
                    onCerrar={() => setProgramar(false)} onHecho={() => { setProgramar(false); setTexto(''); onCambio(); }} />
            )}
            {nueva && <NuevaRapida onCerrar={() => setNueva(false)} onCreada={() => { setNueva(false); toast('Respuesta rápida guardada'); }} />}
            {paso && (
                <ModalFlujo accion="continuar" contacto={contacto} ejecucion={ejecucion} nodoInicial={paso}
                    onCerrar={() => setPaso(null)} onHecho={() => { setPaso(null); onCambio(); }} />
            )}
        </div>
    );
}
