// La lista del Chat (ADR-W175, mockup docs/mockups/chat-cruzado): Learnito, quién está conectado, General · Equipo y
// las conversaciones directas (la más reciente arriba, con lo no leído). Con «+» se elige a alguien del equipo
// para empezar una. La conversación recién abierta, sin mensajes todavía, va arriba mientras está abierta.
import { useState } from 'react';
import { Hash, Plus, Search, Sparkles, X } from 'lucide-react';
import { IconButton } from '../../../components/standard';
import { FilaConectados, Foto } from './Conectados';

function Nueva({ personas, onElegir, onCerrar }) {
    const [texto, setTexto] = useState('');
    const q = texto.trim().toLowerCase();
    const gente = personas.filter(p => !q || p.nombre.toLowerCase().includes(q) || p.email.includes(q)).slice(0, 30);
    return (
        <div className="ch-nueva">
            <div className="ch-buscar">
                <Search size={14} aria-hidden="true" />
                <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="¿Con quién?" aria-label="Buscar a alguien del equipo"
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } if (e.key === 'Enter' && gente[0]) onElegir(gente[0]); }} />
                <IconButton size="xs" label="Cerrar" icon={<X size={13} />} onClick={onCerrar} />
            </div>
            <div className="ch-arroba">
                {gente.length === 0 && <small className="ch-nueva__vacio">Nadie con ese nombre.</small>}
                {gente.map(p => (
                    <button type="button" key={p.email} onClick={() => onElegir(p)}>
                        <Foto p={p} size="xs" conectado={false} /><span>{p.nombre}<small>{p.email}</small></span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function ListaConversaciones({ chat, abierta, conLearnito, onElegir }) {
    const [nueva, setNueva] = useState(false);
    const directos = [...chat.bandeja.directos];
    if (abierta.con && !directos.some(d => d.con.email === abierta.con.email)) {
        directos.unshift({ con: abierta.con, ultimo: null, sin_leer: 0 });
    }
    const abrir = (p) => { setNueva(false); onElegir({ tipo: 'directa', con: { nombre: p.nombre, email: p.email, foto: p.foto, sistema: p.sistema } }); };

    return (
        <nav className="ch-lista" aria-label="Conversaciones">
            {conLearnito && (
                <button type="button" className="ch-fila ch-fila--learnito" aria-current={abierta.tipo === 'learnito'} onClick={() => onElegir({ tipo: 'learnito' })}>
                    <span className="ch-fila__l"><Sparkles size={15} aria-hidden="true" /></span>
                    <span className="ch-fila__nom">Learnito<small>Preguntá o etiquetalo en el canal</small></span>
                </button>
            )}
            <FilaConectados conectados={chat.conectados} onAbrir={abrir} />
            <p className="ch-sec">General</p>
            <button type="button" className="ch-fila" aria-current={abierta.tipo === 'equipo'} onClick={() => onElegir({ tipo: 'equipo' })}>
                <Hash size={15} aria-hidden="true" />
                <span className="ch-fila__nom">Equipo<small>Todo el equipo, en los tres servicios</small></span>
                {chat.bandeja.equipo > 0 && <span className="ch-cuenta">{chat.bandeja.equipo}</span>}
            </button>
            <p className="ch-sec">
                Conversaciones
                <IconButton size="xs" label="Nueva conversación" pressed={nueva} icon={<Plus size={13} />} onClick={() => setNueva(v => !v)} />
            </p>
            {nueva && <Nueva personas={chat.personas} onElegir={abrir} onCerrar={() => setNueva(false)} />}
            {directos.length === 0 && !nueva && <p className="ch-lista__vacio">Tocá a alguien conectado o «+» para escribirle.</p>}
            {directos.map(d => (
                <button type="button" key={d.con.email} className="ch-fila" aria-current={abierta.con?.email === d.con.email} onClick={() => abrir(d.con)}>
                    <Foto p={d.con} size="xs" conectado={!!d.con.sistema} />
                    <span className="ch-fila__nom">{d.con.nombre}
                        <small>{d.ultimo ? `${d.ultimo.mio ? 'Vos: ' : ''}${d.ultimo.texto || 'Adjunto'}` : 'Conversación nueva'}</small>
                    </span>
                    {d.sin_leer > 0 && <span className="ch-cuenta">{d.sin_leer}</span>}
                </button>
            ))}
        </nav>
    );
}
