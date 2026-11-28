import React, { useCallback, useRef, useState } from 'react';
import { Archive, Download, Filter, X } from 'lucide-react';
import { VEREDICTO } from '../comun';
import { cuantosActivos, descargarCsv } from '../../lib/antiguos';
import MenuAntiguos from './MenuAntiguos';

// La cabecera de «Antiguos» en Analyze y Winners con Closers elegido (ADR-W277): una sola pestaña
// que entra y sale, y adentro el filtro y la descarga en CSV de lo que se ve.

const etiqueta = (v) => (VEREDICTO[v] || VEREDICTO.sin_calificar).label;

const ControlesAntiguos = ({ activo, onAlternar, cuenta, filas, lista, ctx, filtro, onFiltro }) => {
    const [abierto, setAbierto] = useState(false);
    const boton = useRef(null);
    const cerrar = useCallback(() => setAbierto(false), []);
    const nf = cuantosActivos(filtro);

    return (
        <>
            <button type="button" className="tl-antiguos" aria-pressed={activo}
                title={activo ? 'Volver a la búsqueda actual' : 'Closers de búsquedas anteriores, de cualquier estado'}
                onClick={onAlternar}>
                <Archive size={14} />Antiguos<span className="cuenta">{activo && nf ? `${lista.length} de ${cuenta}` : cuenta}</span>
                {activo && <X size={14} className="tl-antiguos-x" />}
            </button>
            {activo && (
                <>
                    <button ref={boton} type="button" className="tl-vista-btn" aria-haspopup="true" aria-expanded={abierto}
                        aria-label="Filtrar antiguos" title="Filtrar: estado, a quiénes sacar, cierre mínimo"
                        onClick={() => setAbierto((v) => !v)}>
                        <Filter size={19} />
                        {nf > 0 && <span className="tl-badge">{nf}</span>}
                    </button>
                    <button type="button" className="tl-csv" disabled={!lista.length}
                        title={`Bajar los ${lista.length} que se ven, en CSV`}
                        onClick={() => descargarCsv(lista, etiqueta)}>
                        <Download size={15} />CSV
                    </button>
                    {abierto && (
                        <MenuAntiguos ancla={boton} filas={filas} ctx={ctx} filtro={filtro} onCambiar={onFiltro} onCerrar={cerrar} />
                    )}
                </>
            )}
        </>
    );
};

export default ControlesAntiguos;
