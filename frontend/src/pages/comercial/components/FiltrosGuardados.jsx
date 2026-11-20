import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, IconButton, Input } from '../../../components/standard';
import { useEnPantalla } from '../../../components/ui/useEnPantalla';
import useEstadoGuardado from '../../../hooks/useEstadoGuardado';
import { modoCumple } from './filtroFacetas';

/** Las condiciones de un filtro sin vacíos y en orden: dos filtros iguales dan el mismo texto. */
const huella = (facetas, modo) => JSON.stringify([modoCumple(modo), Object.keys(facetas || {}).sort()
    .filter(k => (facetas[k] || []).length).map(k => [k, [...facetas[k]].sort()])]);

/** «Cumple · Closer, Fuente ×3»: qué guarda un filtro, sin listar cada valor. */
const resumenDe = (def, g) => {
    const partes = def.facetas.filter(fa => (g.facetas[fa.key] || []).length)
        .map(fa => (g.facetas[fa.key].length > 1 ? `${fa.label} ×${g.facetas[fa.key].length}` : fa.label));
    return `${g.modo === 'no_cumple' ? 'No cumple' : 'Cumple'} · ${partes.join(', ') || 'sin condiciones'}`;
};

/**
 * «Filtros guardados» (20/11/2026, pedido de Kerwin): guarda el Filtro completo de una tabla con un nombre y lo
 * vuelve a poner con un clic. Son de cada persona (`useEstadoGuardado`, por usuario y navegador). Los de Agendas
 * sirven en Analizar y en Revisar › Agendas, que comparten el filtro.
 *
 * `onAplicar({facetas, modo})` reemplaza el filtro de la pantalla por el guardado.
 */
const FiltrosGuardados = ({ tabla, def, facetas, modo, onAplicar }) => {
    const [guardados, poner] = useEstadoGuardado('cm_filtros_guardados', { lista: [] });
    const [abierto, setAbierto] = useState(false);
    const [nombre, setNombre] = useState('');
    const [error, setError] = useState('');
    const [editando, setEditando] = useState(null);
    const caja = useRef(null);
    const enPantalla = useEnPantalla();

    const lista = (guardados.lista || []).filter(g => g.tabla === tabla);
    const actual = huella(facetas, modo);
    const activo = lista.find(g => huella(g.facetas, g.modo) === actual);
    const condiciones = def.facetas.reduce((a, fa) => a + ((facetas || {})[fa.key]?.length || 0), 0);

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        const escape = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [abierto]);

    const escribir = (nueva) => poner({ lista: nueva });

    const guardar = () => {
        const n = nombre.trim();
        if (!n) { setError('Escribí un nombre'); return; }
        const limpio = Object.fromEntries(Object.entries(facetas || {}).filter(([, v]) => (v || []).length));
        const nuevo = { id: `${Date.now()}`, tabla, nombre: n, facetas: limpio, modo: modoCumple(modo) };
        // Un nombre que ya existe en la tabla se reemplaza: es «guardar los cambios» de ese filtro.
        const resto = (guardados.lista || []).filter(g => !(g.tabla === tabla && g.nombre.toLowerCase() === n.toLowerCase()));
        escribir([...resto, nuevo]);
        setNombre('');
        setError('');
        toast.success(`Filtro «${n}» guardado`);
    };

    const borrar = (g) => {
        const antes = guardados.lista || [];
        escribir(antes.filter(x => x.id !== g.id));
        // react-hot-toast, el de esta pantalla: el aviso lleva su «Deshacer», que vuelve a poner la lista de antes.
        toast((t) => (
            <span className="fila" style={{ gap: 10 }}>
                {`Filtro «${g.nombre}» borrado`}
                <Button variant="ghost" onClick={() => { escribir(antes); toast.dismiss(t.id); }}>Deshacer</Button>
            </span>
        ), { duration: 6000 });
    };

    const renombrar = () => {
        const n = editando?.texto.trim();
        if (n) escribir((guardados.lista || []).map(x => (x.id === editando.id ? { ...x, nombre: n } : x)));
        setEditando(null);
    };

    const aplicar = (g) => {
        onAplicar({ facetas: g.facetas, modo: g.modo });
        setAbierto(false);
    };

    return (
        <div ref={caja} style={{ position: 'relative' }}>
            <button type="button" className={`pastilla${activo ? ' pastilla--on' : ''}`} aria-haspopup="menu"
                aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
                <Bookmark size={15} />
                {activo ? activo.nombre : 'Filtros guardados'}
                {!activo && lista.length > 0 && <span className="mut40 num" style={{ fontSize: 11.5 }}>{lista.length}</span>}
                <ChevronDown size={14} />
            </button>
            {abierto && (
                <div ref={enPantalla} className="menu" role="menu" aria-label="Filtros guardados"
                    style={{ minWidth: 300, maxWidth: 'min(340px, calc(100vw - 32px))', padding: 6 }}>
                    {lista.length === 0 && (
                        <p className="t-cap mut40" style={{ padding: '6px 10px' }}>
                            Todavía no guardaste filtros en esta tabla.
                        </p>
                    )}
                    {lista.map(g => (editando?.id === g.id ? (
                        <div key={g.id} className="fila" style={{ gap: 6, padding: '4px 6px' }}>
                            <Input autoFocus value={editando.texto} aria-label="Nuevo nombre"
                                onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') renombrar(); if (e.key === 'Escape') setEditando(null); }} />
                            <IconButton icon={<Check size={14} />} label="Guardar el nombre" size="sm" onClick={renombrar} />
                        </div>
                    ) : (
                        <div key={g.id} className="fila" style={{ gap: 4, alignItems: 'center' }}>
                            <button type="button" className="menu-item" role="menuitemradio" aria-checked={activo?.id === g.id}
                                style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }} onClick={() => aplicar(g)}>
                                <span className="trunc">{g.nombre}</span>
                                <small className="mut40 trunc">{resumenDe(def, g)}</small>
                            </button>
                            <IconButton icon={<Pencil size={13} />} label={`Renombrar ${g.nombre}`} size="xs"
                                onClick={() => setEditando({ id: g.id, texto: g.nombre })} />
                            <IconButton icon={<Trash2 size={13} />} label={`Borrar ${g.nombre}`} size="xs" danger
                                onClick={() => borrar(g)} />
                        </div>
                    )))}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '6px 0', paddingTop: 8 }}>
                        {condiciones === 0 ? (
                            <p className="t-cap mut40" style={{ padding: '0 6px' }}>
                                Elegí condiciones en «Filtro completo» para guardarlas acá.
                            </p>
                        ) : (
                            <>
                                <div className="fila" style={{ gap: 6, padding: '0 6px' }}>
                                    <Input value={nombre} placeholder="Workshop de Jean Carlo" aria-label="Nombre del filtro"
                                        invalid={!!error}
                                        onChange={(e) => { setNombre(e.target.value); setError(''); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }} />
                                    <Button variant="primary" onClick={guardar}>Guardar</Button>
                                </div>
                                <p className={`t-cap ${error ? '' : 'mut40'}`}
                                    style={{ padding: '4px 6px 0', color: error ? 'var(--error)' : undefined }}>
                                    {error || `Guarda ${condiciones === 1 ? 'la condición' : `las ${condiciones} condiciones`} de ahora y si es Cumple o No cumple.`}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FiltrosGuardados;
