// La caja de abajo del chat, en tres modos: Chat, Nota interna (el lead no la ve) y Tarea. En Chat el
// mensaje (o un audio del equipo) sale por Instagram a nombre de quien lo manda (17/11/2026); los pasos del
// flujo los manda el bot. Enter envía (Shift+Enter, salto de línea), y lo enviado se ve al instante (`useEnvio`).
// Lo escrito y no mandado queda como borrador de esa conversación (`borradores.js`). Arriba, en una fila (ADR-W238):
// los modos, las herramientas (rápidas, audios, seguimiento y Learnito, resaltado) y el seguimiento programado;
// debajo, la caja a todo el ancho. «Pausar el bot» vive en la tarjeta del lead (`pausar`). Al pasar a una etapa
// con varios mensajes, el guión para elegir cuál pegar (`selector`). `pegar`: {texto, n} que entra en la caja.
import { useEffect, useRef, useState } from 'react';
import { AlarmClock, CalendarCheck, ChevronDown, ChevronUp, MessageSquare, Mic, ScrollText, Send, StickyNote, AlertTriangle, X, Zap } from 'lucide-react';
import { Button, Chip, IconButton, Input, Segmented, Select, TextArea, toast } from '../../../components/standard';
import { useLearnito } from '../../../sesion/LearnitoContext';
import LearnitoLead from './LearnitoLead';
import { inboxApi } from '../api';
import Audios from './Audios';
import { borradorDe, guardarBorrador } from './borradores';
import MenuRayo, { NuevaRapida } from './MenuRayo';
import ModalFlujo from './ModalFlujo';
import { ListaSeguimientos, ProgramarSeguimiento } from './Seguimientos';
import { CasillaSeguimiento, useMarca, valorDeMarca } from './MarcaSeguimiento';
import useEquipo from './useEquipo';
import { faseDe } from './fasesSetting';
import { LETRAS, completarGuia, faltaCompletar, notaDe, partes, pasosDe, siguienteId, useGuia, useLinkAgenda, visibles } from '../guia/useGuia';
import { linkInstagram, ventanaDe } from './ventana';
import { esWhatsapp } from './colas';

const MODOS = [
    { value: 'chat', label: 'Chat', icon: <MessageSquare size={13} /> },
    { value: 'nota', label: 'Nota', icon: <StickyNote size={13} /> },
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

// Los pasos de la etapa a la que se pasó, de la Guía (ADR-W197): tocar una opción la pega en la caja (no sale sola).
function Guion({ fase, contacto, onElegir }) {
    const f = faseDe(fase);
    const guia = useGuia();
    const link = useLinkAgenda();
    const nota = notaDe(guia, fase);
    const noleads = fase === 'nolead' ? guia?.contenido?.quien?.noleads || [] : [];
    const elegir = (p, j) => onElegir({ texto: completarGuia(p.op[j].x, contacto, link), clave: `${fase}:${p.id}:${j}`,
        pasaA: p.avanza ? siguienteId(fase) : null });
    return (
        <div className="cv-guion">
            <div className="cv-guion-cab">
                <ScrollText size={14} aria-hidden="true" />
                <b>Pasaste a {f.n} · {f.label}: elegí qué mandar</b>
                <IconButton size="xs" label="Cerrar el guión" icon={<X size={12} />} onClick={() => onElegir(null)} />
            </div>
            {nota && <p className="cv-guion-ojo"><AlertTriangle size={12} aria-hidden="true" />{nota}</p>}
            {noleads.length > 0 && <p className="cv-guion-ojo"><AlertTriangle size={12} aria-hidden="true" />No es lead: {noleads.join(', ')}.</p>}
            <div className="cv-guion-ops">
                {visibles(pasosDe(guia, fase)).flatMap((p) => p.op.map((o, j) => (
                    <button key={`${p.id}:${j}`} type="button" className="cv-guion-op" onClick={() => elegir(p, j)}>
                        <b>{p.t}{p.op.length > 1 || p.porRespuesta ? ` · ${p.porRespuesta ? o.si : LETRAS[j]}` : ''}{p.uso === 'solo si' && p.cuando ? ` · solo si ${p.cuando}` : p.uso === 'opcional' ? ' · opcional' : ''}</b>
                        <span>{o.x}</span>
                    </button>
                )))}
            </div>
        </div>
    );
}

const programados = (items) => (items || []).filter((s) => s.estado === 'programado' || (s.estado === 'error' && !s.cadencia) || s.vigente);
const cuando = (iso) => new Date(iso).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Composer({ contacto, mensajes, pausar = true, fase, ejecucion, seguimientos, yo, onCambio, onEnviar, onEnviarVarios, onLearnito, pegar, selector, onSelector }) {
    const [modo, setModo] = useState('chat');
    const [texto, setTexto] = useState(() => borradorDe(contacto.id));
    const [rayo, setRayo] = useState(false);
    const [audios, setAudios] = useState(false);
    const [nueva, setNueva] = useState(false);
    const [paso, setPaso] = useState(null);
    const [programar, setProgramar] = useState(false);
    const [preguntando, setPreguntando] = useState(false);
    const learnito = useLearnito();
    const [verSeguimientos, setVerSeguimientos] = useState(false);
    const marca = useMarca(contacto.id);
    // Lo que se eligió de la Guía entra en la caja (reemplaza lo escrito): se revisa y se manda. `deGuia` recuerda
    // qué paso y opción era (para medir cuál responde más) y si al mandarlo el lead pasa de etapa.
    const [deGuia, setDeGuia] = useState(null);
    const elegirDeGuia = (e) => { setModo('chat'); setTexto(e.texto); setDeGuia(e.clave ? e : null); };
    const [pegado, setPegado] = useState(null);
    if (pegar !== pegado) {
        setPegado(pegar);
        if (pegar?.texto) elegirDeGuia(pegar);
    }
    const pendientes = programados(seguimientos);
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
    const ventana = ventanaDe(contacto.ultimo_entrante_en, undefined, esWhatsapp(contacto));
    // Sale al instante en el chat; si Instagram no lo acepta, queda ahí con Reintentar.
    // La casilla Seguimiento va con lo que sale ahora (ADR-W255); en varios mensajes, solo con el primero.
    const conMarca = (cuerpo) => {
        const seguimiento = valorDeMarca(mensajes, marca);
        marca.reiniciar();
        return seguimiento === undefined ? cuerpo : { ...cuerpo, seguimiento };
    };
    const enviar = (cuerpo, rotulo) => {
        if (cuerpo.texto) {
            setTexto('');
            guardarBorrador(contacto.id, '');
        }
        return onEnviar(conMarca({ ...cuerpo, pausar }), rotulo || cuerpo.texto);
    };
    // Lo pegado de la Guía: sin [corchetes] sin completar, una línea en blanco separa los mensajes, el primero lleva
    // la marca de la opción y, si el paso «pasa a la siguiente», el lead cambia de etapa al salir.
    const enviarTexto = async () => {
        if (!deGuia) { enviar({ texto }); return; }
        if (faltaCompletar(texto)) { toast('Completá lo que está entre [corchetes] antes de mandar', 'error'); return; }
        const elegido = deGuia;
        const lista = partes(texto);
        setDeGuia(null);
        setTexto('');
        guardarBorrador(contacto.id, '');
        // Salen de a uno, con unos segundos entre cada uno (`useEnvio`); el primero lleva la marca de la Guía.
        const ok = await onEnviarVarios(lista.map((t, i) => [i === 0 ? conMarca({ texto: t, pausar, guia: elegido.clave }) : { texto: t, pausar }, t]));
        if (!ok) return;
        if (elegido.pasaA) {
            try {
                await inboxApi.moverFase(contacto.id, elegido.pasaA);
                onCambio();
            } catch (e) {
                toast(e.response?.data?.message || 'No se pudo pasar de etapa', 'error');
            }
        }
    };
    const enviarAudio = (a) => enviar({ audio_id: a.id }, `🎤 ${a.nombre}`);
    const puedeEnviar = ventana.estado !== 'cerrada';
    // Abre Learnito (el mismo cerebro de siempre) con el contexto del lead. Lo escrito en la caja va como lo que se
    // quiere saber. Con otro lead, o con la conversación agotada, arranca otra conversación de Learnito.
    const preguntarALearnito = async (intencion, pedido) => {
        setPreguntando(true);
        try {
            const p = await inboxApi.preguntaLearnito(contacto.id, pedido, intencion);
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
        else if (puedeEnviar) enviarTexto();
    };

    return (
        <div className={`cv-composer cv-composer--${modo}`} ref={caja}>
            {verSeguimientos && <ListaSeguimientos items={seguimientos} contacto={contacto} onCambio={onCambio} />}
            {selector && modo === 'chat' && <Guion fase={selector} contacto={contacto} onElegir={onSelector} />}
            {menu && (
                <MenuRayo contacto={contacto} fase={fase} filtro={barra ? texto.slice(1) : ''} onTexto={insertar}
                    onGuia={(e) => { setRayo(false); elegirDeGuia(e); }}
                    onPaso={(id) => { setRayo(false); setTexto(''); setPaso(id); }} onNueva={() => { setRayo(false); setNueva(true); }}
                    onAudio={puedeEnviar ? audioDelMenu : null} />
            )}
            <div className="cv-comp-cab">
                {/* Solo el modo elegido lleva su nombre; los otros, el ícono (Mario, 27/11/2026: así entra todo en una línea). */}
                <Segmented size="sm" label="Modo" className="cv-modos" value={modo} onChange={(m) => { setModo(m); setRayo(false); }}
                    options={MODOS.map((o) => (o.value === modo ? o : { ...o, label: null, props: { 'aria-label': o.label, 'data-tip': o.label } }))} />
                {modo === 'chat' && (
                    <span className="cv-comp-tools">
                        <IconButton size="sm" label="Respuestas rápidas, variables y pasos del flujo" data-tip="Respuestas rápidas y pasos|O escribí /" pressed={rayo} icon={<Zap size={15} />} onClick={() => setRayo((r) => !r)} />
                        <IconButton size="sm" label="Audios" data-tip="Audios del equipo" icon={<Mic size={15} />} onClick={() => setAudios(true)} />
                        <IconButton size="sm" label="Seguimiento si no responde" data-tip="Seguimiento|Sale solo si no responde en el tiempo que elijas" icon={<AlarmClock size={15} />}
                            disabled={ventana.estado === 'cerrada'} onClick={() => setProgramar(true)} />
                        {learnito && (
                            <LearnitoLead contacto={contacto} ocupado={preguntando || learnito.enviando} borrador={texto} onElegir={preguntarALearnito} />
                        )}
                    </span>
                )}
                {pendientes.length > 0 && (
                    <Chip as="button" type="button" subtle color="#7D63E6" icon={<AlarmClock />} aria-expanded={verSeguimientos}
                        data-tip="Seguimiento programado|Tocalo para verlo o cancelarlo" onClick={() => setVerSeguimientos((v) => !v)}>
                        {pendientes.length > 1 ? `${pendientes.length} seguimientos` : pendientes[0].vigente ? (pendientes[0].cadencia ? pendientes[0].texto : 'Toca seguimiento · mandalo') :pendientes[0].estado === 'error' ? 'No salió' : cuando(pendientes[0].enviar_en)}
                        {verSeguimientos ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                    </Chip>
                )}
                {/* Enviar sube a esta fila (Mario, 26/11): la caja de abajo queda a todo el ancho para escribir. */}
                {modo === 'nota' && <Button variant="primary" size="sm" className="cv-comp-enviar" disabled={!texto.trim()} onClick={guardarNota}>Guardar</Button>}
                {modo === 'chat' && <CasillaSeguimiento mensajes={mensajes} marca={marca} />}
                {modo === 'chat' && (
                    // Redondo, solo la flecha (Mario, 27/11/2026: que todo entre en una línea).
                    <Button variant="primary" size="sm" className="cv-comp-enviar cv-comp-enviar--ico" icon={<Send />} disabled={!texto.trim() || !puedeEnviar}
                        aria-label="Enviar" data-tip="Enviar|Enter envía · Shift+Enter, otra línea" onClick={enviarTexto} />
                )}
            </div>
            {modo === 'tarea' ? <FormTarea contacto={contacto} yo={yo} onHecho={() => { setModo('chat'); onCambio(); }} /> : (
                <div className="cv-comp-fila">
                    <TextArea value={texto} onChange={(e) => { setTexto(e.target.value); if (!e.target.value) setDeGuia(null); }} aria-label={modo === 'nota' ? 'Nota interna' : 'Mensaje'}
                        onKeyDown={alTeclear}
                        placeholder={modo === 'nota' ? 'Nota para el equipo…' : 'Escribir…  / para atajos'} />
                </div>
            )}
            {modo === 'chat' && ventana.aviso && (
                <p className="t-cap mut40 cv-bloqueado">
                    {ventana.aviso}
                    {ventana.enInstagram && linkInstagram(contacto) && (
                        <> <a href={linkInstagram(contacto)} target="_blank" rel="noopener noreferrer">Abrir el chat en Instagram</a></>
                    )}
                </p>
            )}
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
