import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { esTablaDeAgendas } from './tablasDef';

/**
 * Panel de Configurar: un solo botón abre TODAS las facetas, cada una en su columna.
 *
 * Se ancla al borde IZQUIERDO de su botón (`.config-panel`): el panel es ancho (680px) y el botón
 * vive a la izquierda de la barra, así que alinearlo a la derecha lo sacaba de la pantalla. Debajo
 * de 900px el CSS lo saca del flujo flotante y lo despliega en su propia fila, empujando la tabla.
 */
const PanelConfigurar = ({ def, filas, facetas, setFacetas, modo, setModo, tabla, basis, setBasis,
    onLimpiar, onCerrar }) => {
    const opcionesDe = (faceta) => {
        // Las opciones se cuentan sobre TODAS las filas del período, no sobre lo ya filtrado: si
        // se contaran sobre lo filtrado, tildar un valor haría desaparecer a sus vecinos.
        const conteo = new Map();
        filas.forEach(f => {
            const v = faceta.de(f);
            if (v) conteo.set(v, (conteo.get(v) || 0) + 1);
        });
        return [...conteo.entries()].sort((a, b) => b[1] - a[1]);
    };

    const alternar = (faceta, valor) => {
        const actuales = facetas[faceta.key] || [];
        setFacetas({
            ...facetas,
            [faceta.key]: actuales.includes(valor)
                ? actuales.filter(v => v !== valor)
                : [...actuales, valor],
        });
    };

    const seleccionados = def.facetas.reduce((a, fa) => a + (facetas[fa.key]?.length || 0), 0);
    // Una faceta `oculta` (el día, con una opción por fecha del período) se aplica igual pero no
    // ocupa una columna del panel: existe para que un dato de Variabilidad tenga a dónde llevar.
    const visibles = def.facetas.filter(fa => !fa.oculta);

    return (
        <div className="config-panel" role="dialog" aria-label="Filtro completo">
            <div className="config-cab">
                <p className="t-h3" style={{ fontSize: 16 }}>Filtro completo</p>
                {seleccionados > 0 && <span className="cuenta-burbuja">{seleccionados}</span>}
                <button type="button" className="ibtn ibtn--sm" style={{ marginLeft: 'auto' }}
                    onClick={onCerrar} aria-label="Cerrar">
                    <X size={15} />
                </button>
            </div>

            <div className="fila" style={{ gap: 'var(--s3)', flexWrap: 'wrap', marginBottom: 'var(--s4)' }}>
                {esTablaDeAgendas(tabla) && (
                    <>
                        <span className="t-rotulo">Fecha</span>
                        <div className="seg">
                            {[['meet', 'Fecha meet'], ['creacion', 'F. creación']].map(([k, label]) => (
                                <button key={k} type="button" aria-pressed={basis === k}
                                    onClick={() => setBasis(k)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
                <span className="t-rotulo">Cumple</span>
                <div className="seg">
                    {[['todas', 'Todas'], ['alguna', 'Alguna']].map(([k, label]) => (
                        <button key={k} type="button" aria-pressed={modo === k}
                            onClick={() => setModo(k)}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="config-grid">
                {visibles.map(faceta => {
                    const sel = facetas[faceta.key] || [];
                    return (
                        <div key={faceta.key} className="config-col">
                            <p className="t-rotulo">
                                {faceta.label}{sel.length > 0 ? ` · ${sel.length}` : ''}
                            </p>
                            <div className="config-lista">
                                {opcionesDe(faceta).map(([valor, n]) => {
                                    const on = sel.includes(valor);
                                    return (
                                        <button key={valor} type="button" className="config-op"
                                            role="checkbox" aria-checked={on}
                                            onClick={() => alternar(faceta, valor)}>
                                            <span className="config-caja">{on ? '✓' : ''}</span>
                                            <span className="trunc">{valor}</span>
                                            <span className="cuenta">{n}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="config-pie">
                <span className="t-cap mut40">
                    {seleccionados === 0
                        ? 'Sin condiciones: se ve todo el período.'
                        : `${seleccionados} ${seleccionados === 1 ? 'condición' : 'condiciones'} sobre ${visibles.length} facetas.`}
                </span>
                <button type="button" className="btn btn--linea btn--sm" style={{ marginLeft: 'auto' }}
                    disabled={seleccionados === 0} onClick={onLimpiar}>
                    <RotateCcw size={13} />
                    Limpiar
                </button>
            </div>
        </div>
    );
};

export default PanelConfigurar;
