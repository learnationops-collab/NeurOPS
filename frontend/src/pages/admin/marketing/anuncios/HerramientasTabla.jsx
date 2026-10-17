import { useEffect, useRef, useState } from 'react';
import { Check, Columns, Download, Layers, Palette, RotateCcw } from 'lucide-react';
import { Switch } from '../../../../components/standard';
import { useEnPantalla } from '../../../../components/ui/useEnPantalla';
import PanelExportar from '../../../comercial/components/PanelExportar';
import { COLUMNAS } from './metricas';
import { GRUPOS } from './columnasTabla';

/**
 * Los botones de la tabla de Rendimiento (17/10/2026): «Columnas» (cuáles se ven y qué grupos van
 * juntos en una sola), «Agrupar» (juntar todos o ninguno de un toque) y «Exportar» (el CSV de las filas
 * y columnas que se elijan, con el mismo panel que Revisar).
 */

const useCerrarAfuera = (abierto, caja, onCerrar) => {
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (!caja.current?.contains(e.target)) onCerrar(); };
        const escape = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [abierto, caja, onCerrar]);
};

const MenuColumnas = ({ vista }) => {
    const enPantalla = useEnPantalla();
    const ocultas = new Set(vista.ocultas);
    const juntados = new Set(vista.juntados);
    const porKey = Object.fromEntries(COLUMNAS.map((c) => [c.key, c]));
    return (
        <div className="menu mk-menu-columnas" role="menu" aria-label="Columnas" ref={enPantalla}>
            {GRUPOS.map((g) => (
                <div key={g.key} className="mk-menu-grupo" role="group" aria-label={g.label}>
                    <div className="mk-menu-grupo-cab">
                        <small>{g.label}</small>
                        <label className="mk-menu-juntar">
                            <span>En una columna</span>
                            <Switch checked={juntados.has(g.key)} onChange={() => vista.alternarGrupo(g.key)}
                                label={`Juntar ${g.label} en una columna`} />
                        </label>
                    </div>
                    {g.cols.map((key) => (
                        <button key={key} type="button" className="menu-item" role="menuitemcheckbox"
                            aria-checked={!ocultas.has(key)} onClick={() => vista.alternarColumna(key)}>
                            <span className="menu-caja" aria-hidden="true">{!ocultas.has(key) ? <Check size={11} /> : ''}</span>
                            <span className="trunc">{porKey[key].label}</span>
                        </button>
                    ))}
                </div>
            ))}
            <button type="button" className="menu-item mk-menu-restablecer" onClick={vista.restablecer}
                disabled={!vista.personalizada}>
                <RotateCcw size={13} aria-hidden="true" />
                <span className="trunc">Columnas y anchos por defecto</span>
            </button>
        </div>
    );
};

const HerramientasTabla = ({ vista, exportar }) => {
    const [abierto, setAbierto] = useState(null);
    const caja = useRef(null);
    const cerrar = () => setAbierto(null);
    useCerrarAfuera(abierto === 'columnas', caja, cerrar);
    const alternar = (cual) => setAbierto((a) => (a === cual ? null : cual));
    const todosJuntos = vista.juntados.length === GRUPOS.length;
    const visibles = COLUMNAS.length - vista.ocultas.length;

    return (
        <div className="mk-herr" ref={caja}>
            <button type="button" className={`pastilla pastilla--sm${abierto === 'columnas' ? ' pastilla--on' : ''}`}
                aria-haspopup="menu" aria-expanded={abierto === 'columnas'} onClick={() => alternar('columnas')}
                title="Elegir qué columnas ver y cuáles juntar">
                <Columns aria-hidden="true" />
                Columnas
                {visibles < COLUMNAS.length && <span className="cuenta">{`${visibles}/${COLUMNAS.length}`}</span>}
            </button>
            <button type="button" className={`pastilla pastilla--sm${vista.juntados.length ? ' pastilla--on' : ''}`}
                aria-pressed={vista.juntados.length > 0} onClick={() => vista.juntarTodos(!todosJuntos)}
                title="Juntar las columnas semejantes: leads, costos y resultados">
                <Layers aria-hidden="true" />
                {vista.juntados.length ? 'Agrupadas' : 'Agrupar'}
            </button>
            <button type="button" className={`pastilla pastilla--sm${vista.colores ? ' pastilla--on' : ''}`}
                aria-pressed={vista.colores} onClick={vista.alternarColores}
                title="Verde o rojo: mejor o peor que el promedio de la tabla">
                <Palette aria-hidden="true" />
                Colores
            </button>
            <button type="button" className={`pastilla pastilla--sm${abierto === 'exportar' ? ' pastilla--on' : ''}`}
                aria-expanded={abierto === 'exportar'} onClick={() => alternar('exportar')}
                title="Bajar un CSV con las filas y columnas que elijas">
                <Download aria-hidden="true" />
                Exportar
            </button>
            {abierto === 'columnas' && <MenuColumnas vista={vista} />}
            {abierto === 'exportar' && <PanelExportar {...exportar} onCerrar={cerrar} />}
        </div>
    );
};

export default HerramientasTabla;
