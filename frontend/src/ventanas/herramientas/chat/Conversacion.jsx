// Una conversación (General · Equipo o una directa, ADR-W175): los mensajes (con el día y los seguidos agrupados), la búsqueda (2 letras o
// más: los 50 más recientes que lo tienen, en todo el canal) y el campo para escribir. Un mensaje con @Learnito
// le pregunta en el canal (useLearnitoEnCanal). Baja sola al último mensaje si ya estabas abajo.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Search, Sparkles, X } from 'lucide-react';
import { EmptyState, IconButton, Skeleton, SkeletonRow } from '../../../components/standard';
import Escribir from './Escribir';
import Mensaje from './Mensaje';
import { conSeparadores } from './formato';
import useLearnitoEnCanal from './useLearnitoEnCanal';

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Buscador({ buscar, donde, onCerrar, children }) {
    const [texto, setTexto] = useState('');
    const [hallados, setHallados] = useState(null);
    const corto = texto.trim().length < 2;
    useEffect(() => {
        if (corto) return undefined;
        const id = setTimeout(() => buscar(texto.trim()).then(setHallados).catch(() => setHallados([])), 300);
        return () => clearTimeout(id);
    }, [texto, corto, buscar]);
    return (
        <>
            <div className="ch-buscar">
                <Search size={15} aria-hidden="true" />
                <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`Buscar en ${donde} (2 letras o más)`}
                    aria-label="Buscar en la conversación" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } }} />
                <IconButton size="xs" label="Cerrar la búsqueda" icon={<X size={13} />} onClick={onCerrar} />
            </div>
            {children(corto ? null : hallados)}
        </>
    );
}

export default function Conversacion({ chat, donde, directa, conLearnito, buscando, onCerrarBusqueda, onPreguntar }) {
    const caja = useRef(null);
    const abajo = useRef(true);
    const campo = useRef(null);
    const [respondiendo, setRespondiendo] = useState(null);
    const { pensando, preguntar } = useLearnitoEnCanal(chat.enviar, donde);
    const responder = (m) => { setRespondiendo(m); campo.current?.focus(); };

    // «@Nombre» conocidos, del más largo al más corto (así «@Ana María» gana a «@Ana»).
    const menciones = useMemo(() => {
        const nombres = ['Learnito', ...chat.personas.map(p => p.nombre)].sort((a, b) => b.length - a.length).map(escapar);
        return new RegExp(`(@(?:${nombres.join('|')}))`, 'g');
    }, [chat.personas]);

    useLayoutEffect(() => {
        const c = caja.current;
        if (c && abajo.current) c.scrollTop = c.scrollHeight;
    }, [chat.mensajes, pensando]);

    const alScroll = () => {
        const c = caja.current;
        abajo.current = c.scrollHeight - c.scrollTop - c.clientHeight < 80;
    };

    const enviar = async (texto, { parentId, menciones: correos, cita }) => {
        const enviado = await chat.enviar(texto, { parentId, menciones: correos });
        if (conLearnito && /@Learnito/i.test(texto) && enviado) preguntar(texto, enviado.id, cita);
    };

    const lista = (mensajes) => conSeparadores(mensajes).map(f => (f.tipo === 'dia'
        ? <div key={f.clave} className="ch-dia">{f.texto}</div>
        : <Mensaje key={f.clave} m={f.m} seguido={f.seguido} menciones={menciones} onResponder={responder}
            onReaccionar={chat.reaccionar} onPreguntar={conLearnito ? onPreguntar : null} />));

    const linea = (
        <div className="ch-linea" ref={caja} onScroll={alScroll}>
            {chat.mensajes === null ? (
                <Skeleton label="Cargando el chat…">{[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} avatar cells={['60%']} step={i} />)}</Skeleton>
            ) : chat.mensajes.length === 0 ? (
                <EmptyState icon={<MessageCircle size={28} />} title="Todavía no hay mensajes">
                    {directa ? 'Escribí el primero: lo ven solo ustedes dos.' : 'Escribí el primero: lo ve todo el equipo.'}
                </EmptyState>
            ) : lista(chat.mensajes)}
            {pensando && (
                <div className="ch-msg ch-msg--l">
                    <div className="ch-msg__av"><span className="ch-av-l"><Sparkles size={14} aria-hidden="true" /></span></div>
                    <div className="ch-msg__cuerpo"><div className="ch-msg__cab"><b>Learnito</b></div><span className="ch-escribiendo"><i /><i /><i /></span></div>
                </div>
            )}
        </div>
    );

    return (
        <>
            {chat.error && <p className="ch-error" role="status">{chat.error}</p>}
            {buscando ? (
                <Buscador buscar={chat.buscar} donde={donde} onCerrar={onCerrarBusqueda}>
                    {(hallados) => (hallados === null ? linea : (
                        <div className="ch-linea">
                            {hallados.length ? lista(hallados) : <EmptyState icon={<Search size={26} />} title="Nada con ese texto" />}
                        </div>
                    ))}
                </Buscador>
            ) : linea}
            <Escribir personas={directa ? [] : chat.personas} directa={directa} conLearnito={conLearnito} respondiendo={respondiendo} setRespondiendo={setRespondiendo}
                campo={campo} onEnviar={enviar} pensando={pensando} />
        </>
    );
}
