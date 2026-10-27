// La caja de abajo del chat, en tres modos: Chat, Nota interna (el lead no la ve) y Tarea. Escribir al
// lead desde acá se habilita con el corte de Kommo: por ahora el texto se arma (respuestas rápidas,
// variables) y se copia para pegarlo en Kommo. Los pasos del flujo sí salen: los manda el bot.
import { useEffect, useRef, useState } from 'react';
import { CalendarCheck, Copy, MessageSquare, Mic, Send, StickyNote, Zap } from 'lucide-react';
import { Button, IconButton, Input, Segmented, Select, TextArea, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import Audios from './Audios';
import MenuRayo, { NuevaRapida } from './MenuRayo';
import ModalFlujo from './ModalFlujo';
import useEquipo from './useEquipo';

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

export default function Composer({ contacto, ejecucion, yo, onCambio }) {
    const [modo, setModo] = useState('chat');
    const [texto, setTexto] = useState('');
    const [rayo, setRayo] = useState(false);
    const [audios, setAudios] = useState(false);
    const [nueva, setNueva] = useState(false);
    const [paso, setPaso] = useState(null);
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
    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(texto);
            toast('Copiado: pegalo en Kommo');
        } catch {
            toast('No se pudo copiar', 'error');
        }
    };

    return (
        <div className={`cv-composer cv-composer--${modo}`} ref={caja}>
            {menu && (
                <MenuRayo contacto={contacto} filtro={barra ? texto.slice(1) : ''} onTexto={insertar}
                    onPaso={(id) => { setRayo(false); setTexto(''); setPaso(id); }} onNueva={() => { setRayo(false); setNueva(true); }} />
            )}
            <div className="cv-comp-cab">
                <Segmented size="sm" label="Modo" value={modo} onChange={(m) => { setModo(m); setRayo(false); }} options={MODOS} />
                {modo === 'chat' && (
                    <label className="cv-comp-check" data-tip="Al enviar|Se habilita con el corte de Kommo">
                        <input type="checkbox" checked={pausar} onChange={(e) => setPausar(e.target.checked)} disabled />Pausar el bot al enviar
                    </label>
                )}
            </div>
            {modo === 'tarea' ? <FormTarea contacto={contacto} yo={yo} onHecho={() => { setModo('chat'); onCambio(); }} /> : (
                <div className="cv-comp-fila">
                    {modo === 'chat' && (
                        <>
                            <IconButton size="sm" label="Respuestas rápidas, variables y pasos del flujo" data-tip="Respuestas rápidas y pasos|O escribí /" pressed={rayo} icon={<Zap size={15} />} onClick={() => setRayo((r) => !r)} />
                            <IconButton size="sm" label="Audios" data-tip="Audios del equipo" icon={<Mic size={15} />} onClick={() => setAudios(true)} />
                        </>
                    )}
                    <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label={modo === 'nota' ? 'Nota interna' : 'Mensaje'}
                        placeholder={modo === 'nota' ? 'Nota para el equipo: el lead no la ve' : 'Armá el mensaje: / para respuestas rápidas y pasos del flujo'} />
                    {modo === 'nota'
                        ? <Button variant="primary" disabled={!texto.trim()} onClick={guardarNota}>Guardar</Button>
                        : (
                            <>
                                <IconButton size="sm" label="Copiar" data-tip="Copiar|Para pegarlo en Kommo" icon={<Copy size={14} />} disabled={!texto.trim()} onClick={copiar} />
                                <Button variant="primary" icon={<Send />} disabled data-tip="Enviar|Se habilita con el corte de Kommo">Enviar</Button>
                            </>
                        )}
                </div>
            )}
            {modo === 'chat' && <p className="t-cap mut40 cv-bloqueado">Escribirle al lead desde acá se habilita con el corte de Kommo. Mientras, copiá y pegá en Kommo.</p>}
            {audios && <Audios onCerrar={() => setAudios(false)} />}
            {nueva && <NuevaRapida onCerrar={() => setNueva(false)} onCreada={() => { setNueva(false); toast('Respuesta rápida guardada'); }} />}
            {paso && (
                <ModalFlujo accion="continuar" contacto={contacto} ejecucion={ejecucion} nodoInicial={paso}
                    onCerrar={() => setPaso(null)} onHecho={() => { setPaso(null); onCambio(); }} />
            )}
        </div>
    );
}
