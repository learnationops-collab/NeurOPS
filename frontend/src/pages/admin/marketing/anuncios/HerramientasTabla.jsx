import { useEffect, useRef, useState } from 'react';
import { Columns, Download, Layers, Palette } from 'lucide-react';
import PanelExportar from '../../../comercial/components/PanelExportar';
import { BotonPantallaCompleta } from './CajaDeTabla';
import PanelColumnas from './PanelColumnas';
import { COLUMNAS_TABLA, GRUPOS } from './columnasTabla';

/**
 * Los botones de la tabla de Rendimiento (17/10/2026): «Columnas» (vistas, cuáles se ven y en qué orden,
 * qué grupos van juntos: `PanelColumnas`), «Agrupar» (juntar todos o ninguno de un toque), «Exportar» (el
 * CSV de las filas y columnas que se elijan, con el mismo panel que Revisar) y la pantalla completa.
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

const HerramientasTabla = ({ vista, exportar, pantalla = null }) => {
    const [abierto, setAbierto] = useState(null);
    const caja = useRef(null);
    const cerrar = () => setAbierto(null);
    useCerrarAfuera(abierto === 'columnas', caja, cerrar);
    const alternar = (cual) => setAbierto((a) => (a === cual ? null : cual));
    const todosJuntos = vista.juntados.length === GRUPOS.length;
    const visibles = COLUMNAS_TABLA.length - vista.ocultas.length;

    return (
        <div className="mk-herr" ref={caja}>
            <button type="button" className={`pastilla pastilla--sm${abierto === 'columnas' ? ' pastilla--on' : ''}`}
                aria-haspopup="menu" aria-expanded={abierto === 'columnas'} onClick={() => alternar('columnas')}
                title="Elegir columnas, ordenarlas, guardar vistas y juntarlas">
                <Columns aria-hidden="true" />
                Columnas
                {visibles < COLUMNAS_TABLA.length && <span className="cuenta">{`${visibles}/${COLUMNAS_TABLA.length}`}</span>}
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
            {pantalla && <BotonPantallaCompleta completa={pantalla.completa} onClick={pantalla.alternar} />}
            {abierto === 'columnas' && <PanelColumnas vista={vista} />}
            {abierto === 'exportar' && <PanelExportar {...exportar} onCerrar={cerrar} />}
        </div>
    );
};

export default HerramientasTabla;
