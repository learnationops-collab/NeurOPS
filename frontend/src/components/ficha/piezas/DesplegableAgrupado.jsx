import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import usarPopover from './usarPopover';

/**
 * Desplegable con las opciones repartidas en grupos por categoría, cada grupo con
 * su tono y su `+ Agregar` para crear una opción nueva en línea.
 *
 * `grupos`: [{ titulo, tono, opciones: [{clave,label}] | ['texto'] }]
 * `valor`:  clave, o lista de claves si `multiple`
 *
 * Las opciones nuevas se agregan a la lista de su grupo y quedan seleccionadas de
 * una: agregarla y después tener que buscarla para tocarla es un paso de más. La
 * clave de una opción nueva ES su texto — el backend la devuelve así en la lectura
 * siguiente y no hay que inventar un slug que él no conoce.
 */
const normalizar = (opciones = []) => opciones.map(o => (
    typeof o === 'string' ? { clave: o, label: o } : { clave: o.clave ?? o.label, label: o.label ?? o.clave }
));

const DesplegableAgrupado = ({
    grupos = [],
    valor,
    multiple = false,
    onChange,
    onAgregar = null,
    placeholder = 'Elegí una opción',
    rotulo = null,
    ayuda = null,
    deshabilitado = false,
    alinear = 'izq',
    etiqueta = null,
}) => {
    const { abierto, alternar, cerrar, caja } = usarPopover();
    // Las opciones creadas acá se muestran de inmediato; persistirlas es de quien nos pasó `onAgregar`.
    const [nuevas, setNuevas] = useState({});
    const [agregandoEn, setAgregandoEn] = useState(null);
    const [borrador, setBorrador] = useState('');

    const seleccion = useMemo(() => {
        if (multiple) return Array.isArray(valor) ? valor : [];
        return valor == null || valor === '' ? [] : [valor];
    }, [valor, multiple]);

    const listas = useMemo(() => grupos.map((g, i) => ({
        ...g,
        opciones: [...normalizar(g.opciones), ...(nuevas[i] || [])],
    })), [grupos, nuevas]);

    const todas = useMemo(() => listas.flatMap(g => g.opciones.map(o => ({ ...o, titulo: g.titulo }))), [listas]);

    const elegir = (clave) => {
        if (!multiple) {
            onChange?.(seleccion[0] === clave ? null : clave);
            cerrar();
            return;
        }
        onChange?.(seleccion.includes(clave)
            ? seleccion.filter(k => k !== clave)
            : [...seleccion, clave]);
    };

    const guardarNueva = (indiceGrupo) => {
        const texto = borrador.trim();
        if (!texto) return;
        const opcion = { clave: texto, label: texto };
        setNuevas(prev => ({ ...prev, [indiceGrupo]: [...(prev[indiceGrupo] || []), opcion] }));
        setAgregandoEn(null);
        setBorrador('');
        onAgregar?.({ grupo: grupos[indiceGrupo]?.titulo ?? null, indice: indiceGrupo, label: texto });
        onChange?.(multiple ? [...seleccion, texto] : texto);
    };

    // Con más de dos elegidos el disparador se vuelve ilegible: se corta y se cuenta.
    const elegidas = seleccion.map(k => todas.find(o => o.clave === k)?.label ?? k);
    const texto = !elegidas.length
        ? placeholder
        : elegidas.length <= 2 ? elegidas.join(', ') : `${elegidas.slice(0, 2).join(', ')} +${elegidas.length - 2}`;
    const pista = !elegidas.length
        ? ''
        : multiple
            ? `${elegidas.length} ${elegidas.length === 1 ? 'elegido' : 'elegidos'}`
            : (todas.find(o => o.clave === seleccion[0])?.titulo ?? '');

    return (
        <div className="fi-campo" ref={caja}>
            {(rotulo || ayuda) && (
                <span className="fi-campo-cab">
                    {rotulo && <small className="t-rotulo">{rotulo}</small>}
                    {ayuda && <span className="t-cap mut40">{ayuda}</span>}
                </span>
            )}
            <button type="button"
                className={`fi-trigger${elegidas.length ? '' : ' fi-trigger--vacio'}`}
                aria-haspopup="listbox"
                aria-expanded={abierto}
                aria-label={etiqueta || rotulo || placeholder}
                disabled={deshabilitado}
                onClick={alternar}>
                <span className="fi-trigger-txt">
                    <span className="trunc">{texto}</span>
                    {pista && <span className="t-cap mut">{pista}</span>}
                </span>
                <span className="mut">{abierto ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
            </button>

            {abierto && (
                <div className={`fi-pop fi-pop--ancho${alinear === 'der' ? ' fi-pop--der' : ''}`}
                    role="listbox" aria-multiselectable={multiple}
                    aria-label={etiqueta || rotulo || placeholder}>
                    <div className="fi-pop-grupos">
                        {listas.map((g, i) => (
                            <div key={g.titulo ?? i} className="fi-grupo" style={{ '--c': `var(--${g.tono || 'idle'})` }}>
                                <small className="t-rotulo" style={{ color: 'var(--c)', padding: '0 var(--s3) var(--s2)' }}>
                                    {g.titulo}
                                </small>
                                {g.opciones.map(o => {
                                    const on = seleccion.includes(o.clave);
                                    return (
                                        <button key={o.clave} type="button" className="fi-opcion"
                                            role="option" aria-selected={on}
                                            onClick={() => elegir(o.clave)}>
                                            <span>{o.label}</span>
                                            {on && <Check size={16} />}
                                        </button>
                                    );
                                })}
                                {/* El `+ Agregar` solo aparece si quien nos usa sabe persistir la
                                    opción nueva: ofrecerlo sin eso crearía opciones que se pierden
                                    al recargar. */}
                                {!onAgregar ? null : agregandoEn === i ? (
                                    <div className="fi-nueva">
                                        {/* Enter guarda, Escape cancela: el teclado alcanza para todo el ciclo. */}
                                        <input autoFocus value={borrador}
                                            placeholder="Nueva opción"
                                            aria-label={`Nueva opción en ${g.titulo}`}
                                            onChange={(e) => setBorrador(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); guardarNueva(i); }
                                                if (e.key === 'Escape') {
                                                    e.stopPropagation();
                                                    setAgregandoEn(null);
                                                    setBorrador('');
                                                }
                                            }} />
                                        <button type="button" aria-label="Guardar opción"
                                            onClick={() => guardarNueva(i)}>
                                            <Check size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" className="fi-agregar"
                                        onClick={() => { setAgregandoEn(i); setBorrador(''); }}>
                                        <Plus size={14} />
                                        <span>Agregar</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {multiple && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end',
                            borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--s3)' }}>
                            <button type="button" className="btn btn--linea btn--sm" onClick={cerrar}>Listo</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DesplegableAgrupado;
