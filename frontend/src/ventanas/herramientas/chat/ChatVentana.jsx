// La herramienta «Chat» (ventanas/herramientas.js, ADR-W171, W174 y W175): el chat del equipo de la Academia dentro
// de Work, con la forma del mockup docs/mockups/chat-cruzado. A la izquierda, la lista (ListaConversaciones); al
// medio, la conversación abierta: General · Equipo, una directa con alguien del equipo o Learnito; a la derecha,
// los conectados por servicio o Learnito al costado (la chispa de un mensaje lo abre ahí con ese mensaje citado).
// Learnito es el de siempre (LearnitoContext): su conversación es la misma en la lista, al costado y en su ventana.
import { useState } from 'react';
import { Hash, PanelLeft, Search, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { puedeUsarLearnito } from '../../../sesion/learnito';
import { useLearnito } from '../../../sesion/LearnitoContext';
import { IconButton } from '../../../components/standard';
import LearnitoChat from '../../../pages/copiloto/LearnitoChat';
import Conversacion from './Conversacion';
import { Conectados, Foto } from './Conectados';
import LearnitoAlCostado from './LearnitoAlCostado';
import ListaConversaciones from './ListaConversaciones';
import TemaLearnito from './TemaLearnito';
import { SISTEMAS, estadoDe, hace } from './formato';
import useChatEquipo from './useChatEquipo';
import './chat.css';

function Titulo({ abierta, chat }) {
    if (abierta.tipo === 'learnito') {
        return <><b><Sparkles size={14} aria-hidden="true" /> Learnito</b><small>Lo ves solo vos · el mismo de la ventana de Learnito</small></>;
    }
    if (abierta.tipo === 'directa') {
        // Dónde está ahora (no cuando se abrió): conectada, o cuándo se la vio.
        const email = abierta.con.email;
        const vivo = (chat.conectados || []).find(p => p.email === email);
        const visto = chat.desconectados.find(p => p.email === email)?.visto
            || chat.bandeja.directos.find(d => d.con.email === email)?.con.visto;
        const s = SISTEMAS[vivo?.sistema];
        const sub = s ? `Conectado en ${s.nombre}${vivo.estado ? ` · ${estadoDe(vivo.estado)}` : ''}` : visto ? `Visto ${hace(visto)}` : 'Conversación directa';
        return <><b><Foto p={vivo || abierta.con} size="xs" conectado={!!s} /> {abierta.con.nombre}</b><small>{sub}</small></>;
    }
    return <><b><Hash size={14} aria-hidden="true" /> Equipo</b><small>El chat General de la Academia</small></>;
}

export default function ChatVentana({ item }) {
    const { user } = useAuth();
    const conLearnito = puedeUsarLearnito(user);
    const learnito = useLearnito();
    const [abierta, setAbierta] = useState({ tipo: 'equipo' });   // {tipo: equipo | directa | learnito, con?}
    const [lista, setLista] = useState(true);
    const [lado, setLado] = useState('conectados');      // 'conectados' | 'learnito' | null
    const [cita, setCita] = useState(null);              // el mensaje sobre el que se le pregunta a Learnito
    const [buscando, setBuscando] = useState(false);
    const minimizada = item?.estado === 'minimizada';
    const conversando = abierta.tipo !== 'learnito';
    const chat = useChatEquipo({ minimizada, con: abierta.tipo === 'directa' ? abierta.con.email : null });
    const donde = abierta.tipo === 'directa' ? `la conversación con ${abierta.con.nombre}` : 'Equipo';

    const elegir = (a) => { setAbierta(a); setBuscando(false); setCita(null); if (window.matchMedia('(max-width: 640px)').matches) setLista(false); };
    const alternar = (l) => setLado(v => (v === l ? null : l));
    // Abrir a alguien desde los conectados de la derecha.
    const abrirCon = (p) => elegir({ tipo: 'directa', con: { nombre: p.nombre, email: p.email, foto: p.foto, sistema: p.sistema } });

    const preguntarSobre = (m) => {
        setCita(m);
        setLado('learnito');
        const que = m.texto || m.tarjeta?.titulo || 'este mensaje';
        learnito.setBorrador(`Sobre el mensaje de ${m.autor.nombre} en ${donde} («${que.slice(0, 280)}»): `);
    };

    return (
        <div className={`ch${lista ? '' : ' ch--sin-lista'}${lado && conversando ? '' : ' ch--sin-lado'}${lado === 'learnito' ? ' ch--lado-l' : ''}`}>
            <ListaConversaciones chat={chat} abierta={abierta} conLearnito={conLearnito} onElegir={elegir} />

            <section className="ch-detalle">
                <header className="ch-cab">
                    <IconButton size="sm" label={lista ? 'Ocultar la lista' : 'Mostrar la lista'} pressed={lista}
                        icon={<PanelLeft size={16} />} onClick={() => setLista(v => !v)} />
                    <div className="ch-cab__txt"><Titulo abierta={abierta} chat={chat} /></div>
                    {conversando && (
                        <>
                            <IconButton size="sm" label="Buscar en la conversación" pressed={buscando} icon={<Search size={16} />} onClick={() => setBuscando(v => !v)} />
                            <IconButton size="sm" label="Conectados" pressed={lado === 'conectados'} icon={<Users size={16} />} onClick={() => alternar('conectados')} />
                            {conLearnito && (
                                <IconButton size="sm" label="Learnito al costado" pressed={lado === 'learnito'} icon={<Sparkles size={16} />} onClick={() => alternar('learnito')} />
                            )}
                        </>
                    )}
                </header>
                {conversando
                    ? <Conversacion key={abierta.con?.email || 'equipo'} chat={chat} donde={donde} directa={abierta.tipo === 'directa' ? abierta.con.nombre : null} conLearnito={conLearnito}
                        buscando={buscando} onCerrarBusqueda={() => setBuscando(false)} onPreguntar={preguntarSobre} />
                    : <TemaLearnito className="ch-learnito"><LearnitoChat /></TemaLearnito>}
            </section>

            <aside className="ch-lado" aria-label={lado === 'learnito' ? 'Learnito al costado' : 'Conectados'}>
                {/* Solo en una conversación: con la vista Learnito abierta, su chat no se monta dos veces */}
                {conversando && (lado === 'learnito' && conLearnito
                    ? <LearnitoAlCostado cita={cita} donde={donde} onSinCita={() => setCita(null)} onCompartir={chat.enviar} />
                    : <Conectados conectados={chat.conectados} desconectados={chat.desconectados} onAbrir={abrirCon} />)}
            </aside>
        </div>
    );
}
