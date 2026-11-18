// La herramienta «Chat» (ventanas/herramientas.js, ADR-W171): el chat del equipo de la Academia dentro de Work,
// como la ventana ChatCenter de allá (mockup docs/mockups/chat-cruzado). A la izquierda, Learnito, quién está
// conectado y los canales (por ahora, General · Equipo); al medio, la conversación; a la derecha, los conectados
// por servicio. Learnito es el mismo de siempre (LearnitoContext): su conversación se abre acá adentro.
import { useState } from 'react';
import { Hash, PanelLeft, Sparkles, Users } from 'lucide-react';
import '../../../pages/agendas_v2/thalamus.css';
import { useAuth } from '../../../contexts/AuthContext';
import { useApariencia } from '../../../context/AparienciaContext';
import { puedeUsarLearnito } from '../../../sesion/learnito';
import { IconButton } from '../../../components/standard';
import LearnitoChat from '../../../pages/copiloto/LearnitoChat';
import Conversacion from './Conversacion';
import { Conectados, FilaConectados } from './Conectados';
import useChatEquipo from './useChatEquipo';
import './chat.css';

function Learnito() {
    const { modo, modoGuardado } = useApariencia();
    const m = modo || modoGuardado || 'oscuro';
    return (
        <div className="thalamus ch-learnito" data-tema="learnation" data-tema-modo={m} data-theme={m === 'claro' ? 'light' : 'dark'}>
            <LearnitoChat />
        </div>
    );
}

export default function ChatVentana({ item }) {
    const { user } = useAuth();
    const conLearnito = puedeUsarLearnito(user);
    const [vista, setVista] = useState('equipo');
    const [lista, setLista] = useState(true);
    const [lado, setLado] = useState(true);
    const minimizada = item?.estado === 'minimizada';
    const chat = useChatEquipo({ minimizada, mirando: vista === 'equipo' && !minimizada });
    const elegir = (v) => { setVista(v); if (window.matchMedia('(max-width: 640px)').matches) setLista(false); };

    return (
        <div className={`ch${lista ? '' : ' ch--sin-lista'}${lado && vista === 'equipo' ? '' : ' ch--sin-lado'}`}>
            <nav className="ch-lista" aria-label="Conversaciones">
                {conLearnito && (
                    <button type="button" className="ch-fila ch-fila--learnito" aria-current={vista === 'learnito'} onClick={() => elegir('learnito')}>
                        <span className="ch-fila__l"><Sparkles size={15} aria-hidden="true" /></span>
                        <span className="ch-fila__nom">Learnito<small>Preguntale lo que quieras</small></span>
                    </button>
                )}
                <FilaConectados conectados={chat.conectados} />
                <p className="ch-sec">General</p>
                <button type="button" className="ch-fila" aria-current={vista === 'equipo'} onClick={() => elegir('equipo')}>
                    <Hash size={15} aria-hidden="true" />
                    <span className="ch-fila__nom">Equipo<small>Todo el equipo, en los tres servicios</small></span>
                    {chat.nuevos > 0 && vista !== 'equipo' && <span className="ch-cuenta">{chat.nuevos}</span>}
                </button>
            </nav>

            <section className="ch-detalle">
                <header className="ch-cab">
                    <IconButton size="sm" label={lista ? 'Ocultar la lista' : 'Mostrar la lista'} pressed={lista}
                        icon={<PanelLeft size={16} />} onClick={() => setLista(v => !v)} />
                    <div className="ch-cab__txt">
                        {vista === 'learnito'
                            ? <><b><Sparkles size={14} aria-hidden="true" /> Learnito</b><small>Lo ves solo vos · el mismo de la ventana de Learnito</small></>
                            : <><b><Hash size={14} aria-hidden="true" /> Equipo</b><small>El chat General de la Academia</small></>}
                    </div>
                    {vista === 'equipo' && (
                        <IconButton size="sm" label="Conectados" pressed={lado} icon={<Users size={16} />} onClick={() => setLado(v => !v)} />
                    )}
                </header>
                {vista === 'learnito'
                    ? <Learnito />
                    : <Conversacion mensajes={chat.mensajes} error={chat.error} onEnviar={chat.enviar} />}
            </section>

            <aside className="ch-lado" aria-label="Conectados">
                <Conectados conectados={chat.conectados} />
            </aside>
        </div>
    );
}
