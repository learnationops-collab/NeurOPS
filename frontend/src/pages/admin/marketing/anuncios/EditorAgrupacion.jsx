import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Elegir a mano la campaña y el conjunto de una palabra clave (15/10/2026). Se escribe el nombre o se elige
 * uno que ya existe (los de la tabla, los guardados y los de Meta); uno nuevo se crea al guardar. «Usar la de
 * Meta» borra la elección y vuelve a la automática. Va en un portal: dentro de la tabla, el desplazamiento
 * lateral lo cortaba.
 */
const ORIGEN = {
    meta: 'Hoy sale de sus anuncios de Meta.',
    manual: 'La eligió alguien a mano.',
    anterior: 'Hoy sale de la carga vieja de anuncios.',
};

const EditorAgrupacion = ({ fila, opciones, guardando, onGuardar, onAutomatica, onCerrar }) => {
    const [campana, setCampana] = useState(fila.campana || '');
    const [conjunto, setConjunto] = useState(fila.conjunto || '');
    const primero = useRef(null);
    const id = useId();
    const conjuntos = opciones.find((o) => o.campana.toLowerCase() === campana.trim().toLowerCase())?.conjuntos || [];

    useEffect(() => {
        primero.current?.focus();
        const escape = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', escape);
        return () => document.removeEventListener('keydown', escape);
    }, [onCerrar]);

    const guardar = (e) => {
        e.preventDefault();
        if (campana.trim()) onGuardar(campana.trim(), conjunto.trim());
    };

    return createPortal(
        <div className="dc-shell mk-capa" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <form className="mk-editor" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onSubmit={guardar}>
                <div className="mk-editor-cab">
                    <div className="mk-cab-txt">
                        <p className="t-eyebrow">Campaña y conjunto</p>
                        <h2 className="t-h3" id={`${id}-t`}>{fila.nombre}</h2>
                    </div>
                    <button type="button" className="ibtn ibtn--sm" onClick={onCerrar} aria-label="Cerrar"><X aria-hidden="true" /></button>
                </div>
                {fila.agrupacion && <p className="t-cap mut">{ORIGEN[fila.agrupacion]}</p>}
                <label className="mk-campo">
                    <span className="t-eyebrow">Campaña</span>
                    <input ref={primero} className="mk-input" list={`${id}-c`} value={campana} maxLength={100}
                        onChange={(e) => setCampana(e.target.value)} placeholder="Escribí o elegí una campaña" />
                    <datalist id={`${id}-c`}>{opciones.map((o) => <option key={o.campana} value={o.campana} />)}</datalist>
                </label>
                <label className="mk-campo">
                    <span className="t-eyebrow">Conjunto</span>
                    <input className="mk-input" list={`${id}-j`} value={conjunto} maxLength={100}
                        onChange={(e) => setConjunto(e.target.value)} placeholder="Opcional" />
                    <datalist id={`${id}-j`}>{conjuntos.map((j) => <option key={j} value={j} />)}</datalist>
                </label>
                <div className="mk-editor-pie">
                    {fila.agrupacion === 'manual' && (
                        <button type="button" className="btn btn--linea btn--sm" disabled={guardando} onClick={onAutomatica}>
                            Usar la de Meta
                        </button>
                    )}
                    <button type="submit" className="btn btn--cta btn--sm" disabled={guardando || !campana.trim()}>
                        {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
};

export default EditorAgrupacion;
