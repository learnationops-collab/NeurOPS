// El sidebar de Learnito (ADR-W251): «Nueva conversación» arriba y todas las conversaciones de quien pregunta, las
// fijadas primero. Cada una se abre con un toque; al pasar el mouse, fijarla (pin) y renombrarla (lápiz).
import { useEffect, useState } from 'react';
import { Check, MessageSquarePlus, Pencil, Pin, PinOff } from 'lucide-react';
import { useLearnito } from '../../sesion/LearnitoContext';

const cuando = (iso) => {
    const d = new Date(iso);
    const dias = Math.floor((Date.now() - d) / 864e5);
    if (dias < 1) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    if (dias < 7) return d.toLocaleDateString('es', { weekday: 'short' });
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
};

function Item({ c, actual, onAbrir, ordenar }) {
    const [editando, setEditando] = useState(false);
    const [titulo, setTitulo] = useState(c.titulo || '');
    const guardar = () => {
        setEditando(false);
        if (titulo.trim() !== (c.titulo || '')) ordenar(c.id, { titulo: titulo.trim() });
    };
    if (editando) {
        return (
            <li className="lt-item lt-item--edita">
                <input autoFocus value={titulo} maxLength={120} aria-label="Nombre de la conversación" onChange={(e) => setTitulo(e.target.value)}
                    onBlur={guardar} onKeyDown={(e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false); }} />
                <button type="button" className="lt-ico" aria-label="Guardar" onMouseDown={(e) => e.preventDefault()} onClick={guardar}><Check size={13} /></button>
            </li>
        );
    }
    return (
        <li className={`lt-item${actual ? ' is-actual' : ''}`}>
            <button type="button" className="lt-abrir" onClick={() => onAbrir(c.id)} aria-current={actual || undefined}>
                <span className="lt-titulo">{c.titulo || 'Sin título'}</span>
                <span className="lt-fecha">{cuando(c.fecha)}</span>
            </button>
            <span className="lt-acciones">
                <button type="button" className="lt-ico" data-tip={c.fijada ? 'Desfijar' : 'Fijar arriba'} aria-label={c.fijada ? 'Desfijar' : 'Fijar'}
                    onClick={() => ordenar(c.id, { fijada: !c.fijada })}>{c.fijada ? <PinOff size={13} /> : <Pin size={13} />}</button>
                <button type="button" className="lt-ico" data-tip="Renombrar" aria-label="Renombrar"
                    onClick={() => { setTitulo(c.titulo || ''); setEditando(true); }}><Pencil size={13} /></button>
            </span>
            {c.fijada && <Pin size={11} className="lt-pin" aria-hidden="true" />}
        </li>
    );
}

export default function LearnitoLateral() {
    const { historial, cargarHistorial, abrir, ordenar, conversacion, reiniciar, enviando } = useLearnito();
    const [error, setError] = useState(null);
    // Al abrir y cada vez que arranca una conversación nueva (aparece su id), la lista se pone al día.
    useEffect(() => { cargarHistorial(); }, [cargarHistorial, conversacion]);
    const onAbrir = async (id) => {
        if (id === conversacion || enviando) return;
        setError(await abrir(id));
    };
    const fijadas = historial.filter((c) => c.fijada);
    const resto = historial.filter((c) => !c.fijada);
    const lista = (items) => items.map((c) => <Item key={c.id} c={c} actual={c.id === conversacion} onAbrir={onAbrir} ordenar={ordenar} />);
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
