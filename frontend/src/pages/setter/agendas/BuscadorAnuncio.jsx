import React, { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/**
 * El buscador de la palabra clave del anuncio: un combobox (patrón ARIA "combobox" con "listbox").
 *
 * Pedido de Kerwin (10/10/2026): "debe tener un buscador, que le permita comenzar a escribir el
 * anuncio y seleccionarlo mucho más rápidamente". Antes era un `<select>` con 78 anuncios.
 *
 * Teclado, pensado para vaciar la bandeja sin el mouse:
 *   · escribir filtra al instante (sin importar mayúsculas ni tildes) y resalta la coincidencia;
 *   · ↑ ↓ recorren la lista (abren la lista si está cerrada), Inicio y Fin van a los extremos;
 *   · Enter elige la opción activa; con un solo resultado, Enter la elige Y asigna (`onConfirmar`);
 *   · con un anuncio ya elegido y la lista cerrada, Enter asigna;
 *   · Tab con la lista abierta acepta la opción activa y sigue al botón de asignar;
 *   · Escape cierra la lista y, si ya estaba cerrada, borra lo escrito.
 *
 * El orden lo da el backend (activos, los más usados por el setter, los más nuevos); al filtrar,
 * los que EMPIEZAN con lo escrito van primero, sin perder ese orden entre ellos.
 */

/** Sin tildes y en minúsculas, un carácter por carácter: así los índices sirven para resaltar. */
const plano = (texto) => Array.from(String(texto || ''))
    .map(c => (c.normalize('NFD')[0] || c).toLowerCase()).join('');

export const filtrarAnuncios = (anuncios, consulta) => {
    const q = plano(consulta).trim();
    if (!q) return anuncios;
    const empiezan = [];
    const contienen = [];
    anuncios.forEach((a) => {
        const k = plano(a.keyword);
        const n = plano(a.nombre);
        if (k.startsWith(q) || n.startsWith(q)) empiezan.push(a);
        else if (k.includes(q) || n.includes(q)) contienen.push(a);
    });
    return [...empiezan, ...contienen];
};

/** El texto con la parte que coincide en `<mark>`. */
export const Resaltado = ({ texto, consulta }) => {
    const q = plano(consulta).trim();
    const i = q ? plano(texto).indexOf(q) : -1;
    if (i < 0) return texto;
    const chars = Array.from(texto);
    return (
        <>
            {chars.slice(0, i).join('')}
            <mark>{chars.slice(i, i + q.length).join('')}</mark>
            {chars.slice(i + q.length).join('')}
        </>
    );
};

const BuscadorAnuncio = forwardRef(({ anuncios, elegido, onElegir, onConfirmar, deshabilitado,
    etiqueta = 'Palabra clave del anuncio', onAbrir }, ref) => {
    const id = useId();
    const [texto, setTexto] = useState(elegido?.keyword || '');
    const [abierta, setAbierta] = useState(false);
    const [activa, setActiva] = useState(0);
    const cajaRef = useRef(null);
    const listaRef = useRef(null);
    const campoRef = useRef(null);
    // Quien lo usa solo necesita darle el foco (la tarjeta siguiente, después de asignar).
    useImperativeHandle(ref, () => ({ focus: () => campoRef.current?.focus() }), []);

    // Lo elegido desde afuera (la sugerencia de la agenda) se ve en el campo.
    useEffect(() => { if (elegido) setTexto(elegido.keyword); }, [elegido?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Con un anuncio elegido el campo muestra su palabra clave: abrir la lista ahí muestra todos, no
    // solo el que ya está.
    const consulta = elegido && texto === elegido.keyword ? '' : texto;
    const opciones = useMemo(() => filtrarAnuncios(anuncios, consulta), [anuncios, consulta]);

    useEffect(() => { onAbrir?.(abierta); }, [abierta]); // eslint-disable-line react-hooks/exhaustive-deps

    // La opción activa a la vista cuando se recorre con las flechas.
    useEffect(() => {
        if (!abierta) return;
        listaRef.current?.querySelector(`[data-i="${activa}"]`)?.scrollIntoView?.({ block: 'nearest' });
    }, [activa, abierta]);

    // Un clic afuera cierra la lista sin elegir.
    useEffect(() => {
        if (!abierta) return undefined;
        const alTocar = (e) => { if (!cajaRef.current?.contains(e.target)) setAbierta(false); };
        document.addEventListener('pointerdown', alTocar);
        return () => document.removeEventListener('pointerdown', alTocar);
    }, [abierta]);

    const elegir = (anuncio, { confirmar = false } = {}) => {
        setTexto(anuncio.keyword);
        setAbierta(false);
        onElegir(anuncio);
        if (confirmar) onConfirmar?.(anuncio);
    };

    const alEscribir = (e) => {
        setTexto(e.target.value);
        setActiva(0);
        setAbierta(true);
        // Lo escrito ya no es lo que estaba elegido: hasta elegir de nuevo no hay anuncio.
        if (elegido && e.target.value !== elegido.keyword) onElegir(null);
    };

    const alTeclear = (e) => {
        const n = opciones.length;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!abierta) { setAbierta(true); setActiva(e.key === 'ArrowDown' ? 0 : Math.max(0, n - 1)); return; }
            if (!n) return;
            setActiva(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
        } else if ((e.key === 'Home' || e.key === 'End') && abierta && n) {
            e.preventDefault();
            setActiva(e.key === 'Home' ? 0 : n - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (abierta && n) {
                // Con un solo resultado no hay nada que dudar: elige y asigna en el mismo Enter.
                elegir(opciones[Math.min(activa, n - 1)], { confirmar: n === 1 });
            } else if (!abierta && elegido) {
                onConfirmar?.(elegido);
            } else if (!abierta && texto.trim()) {
                setAbierta(true);
            }
        } else if (e.key === 'Escape') {
            if (abierta) { e.preventDefault(); setAbierta(false); } else if (texto) { e.preventDefault(); setTexto(''); onElegir(null); }
        } else if (e.key === 'Tab' && abierta && n && texto.trim()) {
            // Tab acepta lo activo y deja que el foco siga su camino (al botón de asignar).
            elegir(opciones[Math.min(activa, n - 1)]);
        }
    };

    const idLista = `${id}-lista`;
    const idOpcion = (i) => `${id}-op-${i}`;
    const mostrar = abierta && !deshabilitado;

    return (
        <div className={`ma-combo${mostrar ? ' ma-combo--abierta' : ''}`} ref={cajaRef}>
            <label className="k" htmlFor={`${id}-campo`}>{etiqueta}</label>
            <div className="ma-campo">
                <Search size={15} aria-hidden="true" />
                <input ref={campoRef} id={`${id}-campo`} type="text" role="combobox" autoComplete="off" spellCheck={false}
                    aria-autocomplete="list" aria-expanded={mostrar} aria-controls={idLista}
                    aria-activedescendant={mostrar && opciones.length ? idOpcion(Math.min(activa, opciones.length - 1)) : undefined}
                    placeholder="Escribí el anuncio…" value={texto} disabled={deshabilitado}
                    onChange={alEscribir} onKeyDown={alTeclear}
                    // Con algo ya puesto (la sugerencia de la agenda), escribir lo reemplaza en vez
                    // de seguirlo: "APROBACIONgu" no encuentra nada.
                    onFocus={(e) => { if (e.target.value) e.target.select(); }}
                    onClick={() => !deshabilitado && setAbierta(true)} />
                {texto && !deshabilitado && (
                    <button type="button" className="ma-limpiar" aria-label="Borrar lo escrito" tabIndex={-1}
                        onClick={() => { setTexto(''); onElegir(null); setAbierta(true); campoRef.current?.focus(); }}>
                        <X size={14} />
                    </button>
                )}
                {mostrar && (
                    <ul className="ma-lista-op" id={idLista} role="listbox" aria-label="Anuncios" ref={listaRef}>
                        {opciones.length === 0 && (
                            <li className="ma-op ma-op--vacia" role="presentation">Ningún anuncio con «{texto}»</li>
                        )}
                        {opciones.map((a, i) => (
                            <li key={a.id} id={idOpcion(i)} data-i={i} role="option"
                                aria-selected={i === Math.min(activa, opciones.length - 1)}
                                className="ma-op" onMouseMove={() => setActiva(i)}
                                // `mousedown` y no `click`: el campo no pierde el foco al elegir.
                                onMouseDown={(e) => { e.preventDefault(); elegir(a); }}>
                                <span className="ma-op-k"><Resaltado texto={a.keyword} consulta={consulta} /></span>
                                {a.nombre && plano(a.nombre) !== plano(a.keyword) && (
                                    <span className="ma-op-n trunc"><Resaltado texto={a.nombre} consulta={consulta} /></span>
                                )}
                                <span className="ma-op-der">
                                    {!a.activo && <span className="ma-op-pausa">pausado</span>}
                                    {a.usos > 0 && (
                                        <span className="ma-op-usos num" title={`Lo usaste ${a.usos} ${a.usos === 1 ? 'vez' : 'veces'}`}>
                                            ×{a.usos}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <span className="sr" aria-live="polite">
                {mostrar ? `${opciones.length} ${opciones.length === 1 ? 'anuncio' : 'anuncios'}` : ''}
            </span>
        </div>
    );
});

BuscadorAnuncio.displayName = 'BuscadorAnuncio';

export default BuscadorAnuncio;
