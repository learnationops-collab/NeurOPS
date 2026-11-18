// La herramienta «Chat» (ventanas/herramientas.js, ADR-W171 y W174): el chat del equipo de la Academia dentro de
// Work, con la forma del mockup docs/mockups/chat-cruzado. A la izquierda, Learnito, quién está conectado y los
// canales (por ahora, General · Equipo); al medio, la conversación; a la derecha, los conectados por servicio o
// Learnito al costado (la chispa de un mensaje lo abre ahí con ese mensaje citado). Learnito es el de siempre
// (LearnitoContext): su conversación es la misma en la lista, al costado y en su ventana.
import { useState } from 'react';
import { Hash, PanelLeft, Search, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { puedeUsarLearnito } from '../../../sesion/learnito';
import { useLearnito } from '../../../sesion/LearnitoContext';
import { IconButton } from '../../../components/standard';
import LearnitoChat from '../../../pages/copiloto/LearnitoChat';
import Conversacion from './Conversacion';
import { Conectados, FilaConectados } from './Conectados';
import LearnitoAlCostado from './LearnitoAlCostado';
import TemaLearnito from './TemaLearnito';
import useChatEquipo from './useChatEquipo';
import './chat.css';

export default function ChatVentana({ item }) {
    const { user } = useAuth();
    const conLearnito = puedeUsarLearnito(user);
    const learnito = useLearnito();
    const [vista, setVista] = useState('equipo');
    const [lista, setLista] = useState(true);
    const [lado, setLado] = useState('conectados');      // 'conectados' | 'learnito' | null
    const [cita, setCita] = useState(null);              // el mensaje sobre el que se le pregunta a Learnito
    const [buscando, setBuscando] = useState(false);
    const minimizada = item?.estado === 'minimizada';
    const chat = useChatEquipo({ minimizada, mirando: vista === 'equipo' && !minimizada });
    const enEquipo = vista === 'equipo';
    const elegir = (v) => { setVista(v); setBuscando(false); if (window.matchMedia('(max-width: 640px)').matches) setLista(false); };
    const alternar = (l) => setLado(v => (v === l ? null : l));

    const preguntarSobre = (m) => {
        setCita(m);
        setLado('learnito');
        const que = m.texto || m.tarjeta?.titulo || 'este mensaje';
        learnito.setBorrador(`Sobre el mensaje de ${m.autor.nombre} en Equipo («${que.slice(0, 280)}»): `);
    };

    return (
        <div className={`ch${lista ? '' : ' ch--sin-lista'}${lado && enEquipo ? '' : ' ch--sin-lado'}${lado === 'learnito' ? ' ch--lado-l' : ''}`}>
            <nav className="ch-lista" aria-label="Conversaciones">
                {conLearnito && (
                    <button type="button" className="ch-fila ch-fila--learnito" aria-current={vista === 'learnito'} onClick={() => elegir('learnito')}>
                        <span className="ch-fila__l"><Sparkles size={15} aria-hidden="true" /></span>
                        <span className="ch-fila__nom">Learnito<small>Preguntá o etiquetalo en el canal</small></span>
                    </button>
                )}
                <FilaConectados conectados={chat.conectados} />
                <p className="ch-sec">General</p>
                <button type="button" className="ch-fila" aria-current={enEquipo} onClick={() => elegir('equipo')}>
                    <Hash size={15} aria-hidden="true" />
                    <span className="ch-fila__nom">Equipo<small>Todo el equipo, en los tres servicios</small></span>
                    {chat.nuevos > 0 && !enEquipo && <span className="ch-cuenta">{chat.nuevos}</span>}
                </button>
            </nav>

            <section className="ch-detalle">
                <header className="ch-cab">
                    <IconButton size="sm" label={lista ? 'Ocultar la lista' : 'Mostrar la lista'} pressed={lista}
                        icon={<PanelLeft size={16} />} onClick={() => setLista(v => !v)} />
                    <div className="ch-cab__txt">
                        {enEquipo
                            ? <><b><Hash size={14} aria-hidden="true" /> Equipo</b><small>El chat General de la Academia</small></>
                            : <><b><Sparkles size={14} aria-hidden="true" /> Learnito</b><small>Lo ves solo vos · el mismo de la ventana de Learnito</small></>}
                    </div>
                    {enEquipo && (
                        <>
                            <IconButton size="sm" label="Buscar en la conversación" pressed={buscando} icon={<Search size={16} />} onClick={() => setBuscando(v => !v)} />
                            <IconButton size="sm" label="Conectados" pressed={lado === 'conectados'} icon={<Users size={16} />} onClick={() => alternar('conectados')} />
                            {conLearnito && (
                                <IconButton size="sm" label="Learnito al costado" pressed={lado === 'learnito'} icon={<Sparkles size={16} />} onClick={() => alternar('learnito')} />
                            )}
                        </>
                    )}
                </header>
                {enEquipo
                    ? <Conversacion chat={chat} conLearnito={conLearnito} buscando={buscando} onCerrarBusqueda={() => setBuscando(false)} onPreguntar={preguntarSobre} />
                    : <TemaLearnito className="ch-learnito"><LearnitoChat /></TemaLearnito>}
            </section>

            <aside className="ch-lado" aria-label={lado === 'learnito' ? 'Learnito al costado' : 'Conectados'}>
                {/* Solo en Equipo: con la vista Learnito abierta, su chat no se monta dos veces */}
                {enEquipo && (lado === 'learnito' && conLearnito
                    ? <LearnitoAlCostado cita={cita} onSinCita={() => setCita(null)} onCompartir={chat.enviar} />
                    : <Conectados conectados={chat.conectados} />)}
            </aside>
        </div>
    );
}
