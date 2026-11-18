// La caja de abajo del chat, en tres modos: Chat, Nota interna (el lead no la ve) y Tarea. En Chat el
// mensaje (o un audio del equipo) sale por Instagram a nombre de quien lo manda (17/11/2026); los pasos del
// flujo los manda el bot. Enter envía (Shift+Enter, salto de línea), y lo enviado se ve al instante (`useEnvio`).
// Lo escrito y no mandado queda como borrador de esa conversación (`borradores.js`).
import { useEffect, useRef, useState } from 'react';
import { AlarmClock, CalendarCheck, MessageSquare, Mic, Send, Sparkles, StickyNote, Zap } from 'lucide-react';
import { Button, IconButton, Input, Segmented, Select, TextArea, toast } from '../../../components/standard';
import { useLearnito } from '../../../sesion/LearnitoContext';
import { inboxApi } from '../api';
import Audios from './Audios';
import { borradorDe, guardarBorrador } from './borradores';
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

// El lead de la conversación de Learnito abierta desde el Inbox: preguntar por otro arranca una nueva.
const conversacionDeLearnito = { contacto: null };

export default function Composer({ contacto, ejecucion, seguimientos, yo, onCambio, onEnviar, onLearnito }) {
    const [modo, setModo] = useState('chat');
    const [texto, setTexto] = useState(() => borradorDe(contacto.id));
    const [rayo, setRayo] = useState(false);
    const [audios, setAudios] = useState(false);
    const [nueva, setNueva] = useState(false);
    const [paso, setPaso] = useState(null);
    const [programar, setProgramar] = useState(false);
    const [preguntando, setPreguntando] = useState(false);
    const learnito = useLearnito();
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

    // El borrador se guarda al dejar de escribir, no en cada tecla (la lista se vuelve a pintar con cada cambio).
    useEffect(() => {
        const t = setTimeout(() => guardarBorrador(contacto.id, texto), 400);
        return () => clearTimeout(t);
    }, [contacto.id, texto]);

    const insertar = (t) => { setTexto((x) => (x.startsWith('/') ? t : x ? `${x} ${t}` : t)); setRayo(false); };
    const guardarNota = async () => {
        try {
            await inboxApi.crearNota(contacto.id, texto.trim());
            setTexto('');
            guardarBorrador(contacto.id, '');
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo guardar la nota', 'error');
        }
    };
    const ventana = ventanaDe(contacto.ultimo_entrante_en);
    // Sale al instante en el chat; si Instagram no lo acepta, queda ahí con Reintentar.
    const enviar = (cuerpo, rotulo) => {
        if (cuerpo.texto) {
            setTexto('');
            guardarBorrador(contacto.id, '');
        }
        onEnviar({ ...cuerpo, pausar }, rotulo || cuerpo.texto);
    };
    const enviarAudio = (a) => enviar({ audio_id: a.id }, `🎤 ${a.nombre}`);
    const puedeEnviar = ventana.estado !== 'cerrada';
    // Abre Learnito (el mismo cerebro de siempre) con el contexto del lead. Lo escrito en la caja va como lo que se
    // quiere saber. Con otro lead, o con la conversación agotada, arranca otra conversación de Learnito.
    const preguntarALearnito = async () => {
        setPreguntando(true);
        try {
            const p = await inboxApi.preguntaLearnito(contacto.id, texto.startsWith('/') ? '' : texto);
            const nueva = conversacionDeLearnito.contacto !== contacto.id || Boolean(learnito.agotada);
            conversacionDeLearnito.contacto = contacto.id;
            onLearnito();
            const error = await learnito.enviar(p.pregunta, p.muestra, { nueva });
            if (error) toast(error, 'error');
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo preguntar a Learnito', 'error');
        } finally {
            setPreguntando(false);
        }
    };
    const audioDelMenu = (a) => { setRayo(false); setTexto((x) => (x.startsWith('/') ? '' : x)); enviarAudio(a); };
    // Enter envía (o guarda la nota); Shift+Enter, salto de línea. Con el menú «/» abierto no manda el atajo.
    const alTeclear = (e) => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
        e.preventDefault();
        if (!texto.trim() || barra) return;
        if (modo === 'nota') guardarNota();
        else if (puedeEnviar) enviar({ texto });
    };

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
                            {learnito && (
                                <IconButton size="sm" label="Preguntar a Learnito" data-tip="Preguntar a Learnito|Qué info del programa te sirve para este lead. Si escribiste algo, es lo que querés saber" icon={<Sparkles size={15} />}
                                    disabled={preguntando || learnito.enviando} onClick={preguntarALearnito} />
                            )}
                            <IconButton size="sm" label="Seguimiento si no responde" data-tip="Seguimiento|Sale solo si no responde en el tiempo que elijas" icon={<AlarmClock size={15} />}
                                disabled={ventana.estado === 'cerrada'} onClick={() => setProgramar(true)} />
                        </>
                    )}
                    <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label={modo === 'nota' ? 'Nota interna' : 'Mensaje'}
                        onKeyDown={alTeclear}
                        placeholder={modo === 'nota' ? 'Nota para el equipo: el lead no la ve · Enter guarda' : 'Escribile al lead · Enter envía, Shift+Enter salta de línea · / respuestas rápidas'} />
                    {modo === 'nota'
                        ? <Button variant="primary" disabled={!texto.trim()} onClick={guardarNota}>Guardar</Button>
                        : <Button variant="primary" icon={<Send />} disabled={!texto.trim() || !puedeEnviar} data-tip="Enviar|Enter" onClick={() => enviar({ texto })}>Enviar</Button>}
                </div>
            )}
            {modo === 'chat' && ventana.aviso && <p className="t-cap mut40 cv-bloqueado">{ventana.aviso}</p>}
            {audios && <Audios onCerrar={() => setAudios(false)} onMandar={puedeEnviar ? (a) => { enviarAudio(a); setAudios(false); } : null} />}
            {programar && (
                <ProgramarSeguimiento contacto={contacto} textoInicial={texto.startsWith('/') ? '' : texto} pausar={pausar}
                    onCerrar={() => setProgramar(false)} onHecho={() => { setProgramar(false); setTexto(''); guardarBorrador(contacto.id, ''); onCambio(); }} />
            )}
            {nueva && <NuevaRapida onCerrar={() => setNueva(false)} onCreada={() => { setNueva(false); toast('Respuesta rápida guardada'); }} />}
            {paso && (
                <ModalFlujo accion="continuar" contacto={contacto} ejecucion={ejecucion} nodoInicial={paso}
                    onCerrar={() => setPaso(null)} onHecho={() => { setPaso(null); onCambio(); }} />
            )}
        </div>
    );
}
