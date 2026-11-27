// El sidebar de Learnito (ADR-W251): «Nueva conversación» arriba y todas las conversaciones de quien pregunta, las
// fijadas primero. Cada una se abre con un toque; su «⋯» la fija, la renombra o la borra (ADR-W252).
import { useEffect, useRef, useState } from 'react';
import { Check, MessageSquarePlus, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { useLearnito } from '../../sesion/LearnitoContext';

const cuando = (iso) => {
    const d = new Date(iso);
    const dias = Math.floor((Date.now() - d) / 864e5);
    if (dias < 1) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    if (dias < 7) return d.toLocaleDateString('es', { weekday: 'short' });
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
};

function Item({ c, actual, onAbrir, ordenar, borrar }) {
    const [editando, setEditando] = useState(false);
    const [titulo, setTitulo] = useState(c.titulo || '');
    const [menu, setMenu] = useState(false);
    const [seguro, setSeguro] = useState(false);
    const caja = useRef(null);
    useEffect(() => {
        if (!menu) return undefined;
        const fuera = (e) => { if (!caja.current?.contains(e.target)) { setMenu(false); setSeguro(false); } };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [menu]);
    const guardar = () => {
        setEditando(false);
        if (titulo.trim() !== (c.titulo || '')) ordenar(c.id, { titulo: titulo.trim() });
    };
    if (editando) {
        return (
            <li className="lt-item lt-item--edita">
                <input autoFocus value={titulo} maxLength={120} aria-label="Nombre de la conversación" onChange={(e) => setTitulo(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={guardar} onKeyDown={(e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false); }} />
                <button type="button" className="lt-ico" aria-label="Guardar" onMouseDown={(e) => e.preventDefault()} onClick={guardar}><Check size={13} /></button>
            </li>
        );
    }
    const hacer = (fn) => () => { setMenu(false); setSeguro(false); fn(); };
    return (
        <li className={`lt-item${actual ? ' is-actual' : ''}`} ref={caja}>
            <button type="button" className="lt-abrir" onClick={() => onAbrir(c.id)} aria-current={actual || undefined}
                onDoubleClick={() => { setTitulo(c.titulo || ''); setEditando(true); }}>
                <span className="lt-titulo">{c.titulo || 'Sin título'}</span>
                <span className="lt-fecha">{cuando(c.fecha)}</span>
            </button>
            <button type="button" className="lt-mas" aria-label="Opciones de la conversación" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <MoreHorizontal size={15} />
            </button>
            {menu && (
                <div className="lt-menu" role="menu">
                    <button type="button" role="menuitem" onClick={hacer(() => ordenar(c.id, { fijada: !c.fijada }))}>
                        {c.fijada ? <PinOff size={14} /> : <Pin size={14} />}{c.fijada ? 'Desfijar' : 'Fijar arriba'}
                    </button>
                    <button type="button" role="menuitem" onClick={hacer(() => { setTitulo(c.titulo || ''); setEditando(true); })}>
                        <Pencil size={14} />Renombrar
                    </button>
                    <button type="button" role="menuitem" className={`lt-borrar${seguro ? ' is-seguro' : ''}`}
                        onClick={seguro ? hacer(() => borrar(c.id)) : () => setSeguro(true)}>
                        <Trash2 size={14} />{seguro ? '¿Seguro? Tocá para borrar' : 'Borrar'}
                    </button>
                </div>
            )}
            {c.fijada && <Pin size={11} className="lt-pin" aria-hidden="true" />}
        </li>
    );
}

export default function LearnitoLateral() {
    const { historial, cargarHistorial, abrir, ordenar, borrar, conversacion, reiniciar, enviando } = useLearnito();
    const [error, setError] = useState(null);
    // Al abrir y cada vez que arranca una conversación nueva (aparece su id), la lista se pone al día.
    useEffect(() => { cargarHistorial(); }, [cargarHistorial, conversacion]);
    const onAbrir = async (id) => {
        if (id === conversacion || enviando) return;
        setError(await abrir(id));
    };
    const fijadas = historial.filter((c) => c.fijada);
    const resto = historial.filter((c) => !c.fijada);
    const lista = (items) => items.map((c) => <Item key={c.id} c={c} actual={c.id === conversacion} onAbrir={onAbrir} ordenar={ordenar} borrar={async (id) => setError(await borrar(id))} />);
    return (
        <nav className="lt" aria-label="Conversaciones con Learnito">
            <button type="button" className="lt-nueva" onClick={reiniciar} disabled={enviando || !conversacion}>
                <MessageSquarePlus size={15} aria-hidden="true" />Nueva conversación
            </button>
            <div className="lt-lista">
                {fijadas.length > 0 && <><span className="lt-rotulo">Fijadas</span><ul>{lista(fijadas)}</ul></>}
                {resto.length > 0 && <><span className="lt-rotulo">Recientes</span><ul>{lista(resto)}</ul></>}
                {!historial.length && <p className="lt-vacio">Tus conversaciones van a aparecer acá.</p>}
            </div>
            {error && <p className="lt-error" role="alert">{error}</p>}
        </nav>
    );
}
