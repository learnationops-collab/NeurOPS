import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, RotateCcw, Trash2 } from 'lucide-react';
import { Switch } from '../../../../components/standard';
import { useEnPantalla } from '../../../../components/ui/useEnPantalla';
import { GRUPOS, PRESETS } from './columnasTabla';

/**
 * El panel «Columnas» de la tabla de Rendimiento (Kerwin, 23/10/2026: «hoy es un quilombo»): tres
 * pasos en el orden en que se usan. 1) Una vista hecha o guardada con nombre. 2) Qué columnas se ven y
 * en qué orden (tildar, subir, bajar o arrastrar). 3) Qué grupos van juntos en una sola columna.
 */

const grupoDe = Object.fromEntries(GRUPOS.flatMap((g) => g.cols.map((k) => [k, g.label])));

const Vistas = ({ vista }) => {
    const [nombre, setNombre] = useState('');
    const guardar = (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        vista.guardarVista(nombre);
        setNombre('');
    };
    return (
        <section className="mk-menu-grupo" aria-label="Vistas">
            <div className="mk-menu-grupo-cab"><small>Vistas</small></div>
            {[...PRESETS, ...vista.vistas].map((v) => (
                <div key={v.id} className="mk-vista-fila">
                    <button type="button" className="menu-item" role="menuitemradio" aria-checked={vista.activa === v.id}
                        onClick={() => vista.aplicar(v)}>
                        <span className="menu-caja" aria-hidden="true">{vista.activa === v.id ? <Check size={11} /> : ''}</span>
                        <span className="trunc">{v.nombre}</span>
                    </button>
                    {!PRESETS.includes(v) && (
                        <button type="button" className="ibtn ibtn--sm" title={`Borrar la vista ${v.nombre}`}
                            aria-label={`Borrar la vista ${v.nombre}`} onClick={() => vista.borrarVista(v.id)}>
                            <Trash2 aria-hidden="true" />
                        </button>
                    )}
                </div>
            ))}
            <form className="mk-vista-nueva" onSubmit={guardar}>
                <input className="mk-input" value={nombre} maxLength={30} onChange={(e) => setNombre(e.target.value)}
                    placeholder="Guardar esta vista como…" aria-label="Nombre de la vista a guardar" />
                <button type="submit" className="btn btn--linea btn--sm" disabled={!nombre.trim()}>Guardar</button>
            </form>
        </section>
    );
};

const Orden = ({ vista }) => {
    const [arrastrando, setArrastrando] = useState(null);
    const ocultas = new Set(vista.ocultas);
    const ultima = vista.columnas.length - 1;
    return (
        <section className="mk-menu-grupo" aria-label="Orden de las columnas">
            <div className="mk-menu-grupo-cab"><small>Columnas y orden</small></div>
            <ul className="mk-orden">
                {vista.columnas.map((c, i) => {
                    const visible = !ocultas.has(c.key);
                    return (
                        <li key={c.key} className={`mk-orden-fila${arrastrando === c.key ? ' is-arrastrando' : ''}`}
                            draggable onDragStart={() => setArrastrando(c.key)} onDragEnd={() => setArrastrando(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => { if (arrastrando) vista.soltar(arrastrando, c.key); setArrastrando(null); }}>
                            <GripVertical className="mk-orden-asa" size={14} aria-hidden="true" />
                            <button type="button" className="menu-item" role="menuitemcheckbox" aria-checked={visible}
                                onClick={() => vista.alternarColumna(c.key)}>
                                <span className="menu-caja" aria-hidden="true">{visible ? <Check size={11} /> : ''}</span>
                                <span className="trunc">{c.label}</span>
                                {grupoDe[c.key] && <small className="mk-orden-grupo" aria-hidden="true">{grupoDe[c.key]}</small>}
                            </button>
                            <button type="button" className="ibtn ibtn--sm" disabled={!i} title="Subir"
                                aria-label={`Subir ${c.label}`} onClick={() => vista.mover(c.key, -1)}>
                                <ArrowUp aria-hidden="true" />
                            </button>
                            <button type="button" className="ibtn ibtn--sm" disabled={i === ultima} title="Bajar"
                                aria-label={`Bajar ${c.label}`} onClick={() => vista.mover(c.key, 1)}>
                                <ArrowDown aria-hidden="true" />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

const Juntar = ({ vista }) => (
    <section className="mk-menu-grupo" aria-label="Juntar columnas">
        <div className="mk-menu-grupo-cab"><small>Juntar en una sola columna</small></div>
        {GRUPOS.map((g) => (
            <label key={g.key} className="mk-menu-juntar mk-menu-juntar--fila">
                <span>{g.label}</span>
                <Switch checked={vista.juntados.includes(g.key)} onChange={() => vista.alternarGrupo(g.key)}
                    label={`Juntar ${g.label} en una columna`} />
            </label>
        ))}
    </section>
);

const PanelColumnas = ({ vista }) => {
    const enPantalla = useEnPantalla();
    return (
        <div className="menu mk-menu-columnas" role="menu" aria-label="Columnas" ref={enPantalla}>
            <Vistas vista={vista} />
            <Orden vista={vista} />
            <Juntar vista={vista} />
            <button type="button" className="menu-item mk-menu-restablecer" onClick={vista.restablecer}
                disabled={!vista.personalizada}>
                <RotateCcw size={13} aria-hidden="true" />
                <span className="trunc">Columnas y anchos por defecto</span>
            </button>
        </div>
    );
};

export default PanelColumnas;
