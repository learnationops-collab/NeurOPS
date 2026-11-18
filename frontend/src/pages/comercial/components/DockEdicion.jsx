import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../../../components/standard';

/**
 * Las secciones del dock mientras se edita la navegación (Dock 2.0, como «Editar navegación» de
 * Leadership): se arrastran para ordenarlas, el ojo las oculta (quedan en Herramientas) y doble clic
 * las renombra. Arriba del dock, la barra con «Restablecer» y «Listo». Escape termina.
 */
const DockEdicion = ({ nav }) => {
    const { todas, ordenar, alternarOculta, renombrar, restablecer, editar } = nav;
    const ids = todas.map((s) => s.id).join('|');
    const [orden, setOrden] = useState(() => todas.map((s) => s.id));
    const [renombrando, setRenombrando] = useState(null);
    const ordenRef = useRef(orden);
    const llevado = useRef(null);
    ordenRef.current = orden;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => setOrden(todas.map((s) => s.id)), [ids]);
    useEffect(() => {
        const tecla = (e) => { if (e.key === 'Escape' && !renombrando) editar(false); };
        document.addEventListener('keydown', tecla);
        return () => document.removeEventListener('keydown', tecla);
    }, [editar, renombrando]);

    const sobre = (e, id) => {
        e.preventDefault();
        const de = llevado.current;
        if (!de || de === id) return;
        const r = e.currentTarget.getBoundingClientRect();
        const despues = e.clientX - r.left > r.width / 2;
        setOrden((o) => {
            const sin = o.filter((x) => x !== de);
            const i = sin.indexOf(id) + (despues ? 1 : 0);
            const nuevo = [...sin.slice(0, i), de, ...sin.slice(i)];
            return nuevo.join('|') === o.join('|') ? o : nuevo;
        });
    };
    const soltar = () => {
        llevado.current = null;
        ordenar(ordenRef.current);
    };
    const porId = new Map(todas.map((s) => [s.id, s]));
    let n = 0;

    return (
        <>
            {orden.map((id) => {
                const s = porId.get(id);
                if (!s) return null;
                if (!s.oculta) n += 1;
                const rotuloOjo = s.oculta ? `Mostrar ${s.label} en el dock` : `Ocultar ${s.label} (queda en Herramientas)`;
                return (
                    <div key={id} className={`dock-item dock-item--edit${s.oculta ? ' dock-item--oculta' : ''}`}
                        draggable={renombrando !== id} onDragStart={() => { llevado.current = id; }}
                        onDragOver={(e) => sobre(e, id)} onDragEnd={soltar} onDrop={(e) => e.preventDefault()}>
                        <span className="dock-num">{s.oculta ? '··' : n}</span>
                        <s.Icono size={20} />
                        {renombrando === id ? (
                            <input className="dock-renombrar" autoFocus defaultValue={s.label} maxLength={24}
                                aria-label={`Nuevo nombre de ${s.labelOriginal}`}
                                onBlur={(e) => { renombrar(id, e.target.value); setRenombrando(null); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                    if (e.key === 'Escape') { e.stopPropagation(); setRenombrando(null); }
                                }} />
                        ) : (
                            <span className="dock-label" title="Doble clic para renombrar"
                                onDoubleClick={() => setRenombrando(id)}>{s.label}</span>
                        )}
                        <button type="button" className="dock-ojo" aria-label={rotuloOjo} title={rotuloOjo}
                            aria-pressed={!s.oculta} onClick={() => alternarOculta(id)}>
                            {s.oculta ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                        </button>
                    </div>
                );
            })}
            {createPortal(
                <div className="dc-shell dock-editar-capa">
                    <div className="dock-editar" role="status">
                        <span><b>Editando la navegación</b> · arrastrá · el ojo oculta · doble clic renombra</span>
                        <Button size="sm" variant="ghost" onClick={() => {
                            if (window.confirm('¿Volver al orden de siempre? Se muestran todas las secciones con su nombre original.')) restablecer();
                        }}>Restablecer</Button>
                        <Button size="sm" variant="primary" onClick={() => editar(false)}>Listo</Button>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
};

export default DockEdicion;
