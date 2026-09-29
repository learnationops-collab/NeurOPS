import React from 'react';
import Desplegable from './Desplegable';

/**
 * Los cinco campos de un pago: fecha, monto, medio, programa y tipo, para el editor de una fila de
 * la sección «Pagos» (`FilaPago`).
 *
 * Las listas salen del vocabulario (`medios_pago_venta`, `programas`, `tipos_pago_venta`). Un
 * valor histórico que no está en la lista («Binance», un pago sin programa) se muestra tal cual
 * como opción aparte; lo que no se puede es ELEGIR uno fuera de la lista (mismo criterio que la
 * fuente de una agenda, y que el backend).
 */

/** El nombre legible de un tipo canónico ('cuota' -> 'Cuota'), o la clave si no está. */
export const etiquetaDeTipo = (tipos, clave) => tipos.find(t => t.clave === clave)?.label || clave;

/** El nombre de un programa por su código ('RR' -> 'Residency Roadmap'). */
export const nombreDePrograma = (programas, codigo) => programas.find(p => p.clave === codigo)?.label
    || codigo;

/** Un monto exacto, con los centavos si los tiene: `$1.500`, `$450,5`. */
export const montoExacto = (n) => `$${(Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

/**
 * Lo que falta para poder guardar, o null. Es el `title` del botón deshabilitado.
 *
 * Un pago que se corrige no pide los cinco campos: un pago viejo sin medio o sin programa se tiene
 * que poder corregir de monto sin decidir antes de qué programa era. Lo único que pide es el
 * programa cuando lo que cambia es el tipo, que se escribe detrás de él ('RR - Cuota').
 */
export const faltaParaGuardar = ({ fecha, monto, programa }, { cambiaTipo = false } = {}) => {
    if (!fecha) return 'Falta la fecha del pago';
    if (!(Number(monto) > 0)) return 'El monto tiene que ser mayor que cero';
    if (cambiaTipo && !programa) return 'Elegí también el programa: el tipo se escribe «programa - tipo»';
    return null;
};

const CamposPago = ({
    ids, valores, onCambiar, disabled = false, medios = [], programas = [], tipos = [],
    actual = {}, autoFocus = false,
}) => {
    const { fecha, monto, medio, programa, tipo } = valores;
    const medioFuera = actual.medio && !medios.some(m => m.clave === actual.medio);
    return (
        <div className="fi-agenda-campos">
            <div className="fi-campo">
                <label className="t-rotulo" htmlFor={`${ids}-fecha`}>Fecha del pago</label>
                <span className="ln-field" style={{ height: 44 }}>
                    <input id={`${ids}-fecha`} type="date" value={fecha} required disabled={disabled}
                        autoFocus={autoFocus} onChange={(e) => onCambiar({ fecha: e.target.value })} />
                </span>
            </div>

            <div className="fi-campo">
                <label className="t-rotulo" htmlFor={`${ids}-monto`}>Monto</label>
                <span className="ln-field" style={{ height: 44 }}>
                    <input id={`${ids}-monto`} type="number" min="0.01" step="0.01" inputMode="decimal"
                        value={monto} required disabled={disabled} placeholder="0"
                        onChange={(e) => onCambiar({ monto: e.target.value })} />
                    <span className="ln-unit">USD</span>
                </span>
            </div>

            <div className="fi-campo">
                <label className="t-rotulo" htmlFor={`${ids}-medio`}>Medio</label>
                <Desplegable id={`${ids}-medio`} etiqueta="Medio de pago" valor={medio}
                    disabled={disabled} onCambiar={(v) => onCambiar({ medio: v })}>
                    {!actual.medio && !medio && <option value="">Sin medio · elegí uno</option>}
                    {medioFuera && <option value={actual.medio}>{actual.medio} (fuera de la lista)</option>}
                    {medios.map(m => <option key={m.clave} value={m.clave}>{m.label}</option>)}
                </Desplegable>
            </div>

            <div className="fi-campo">
                <label className="t-rotulo" htmlFor={`${ids}-programa`}>Programa</label>
                <Desplegable id={`${ids}-programa`} etiqueta="Programa del pago" valor={programa}
                    disabled={disabled} onCambiar={(v) => onCambiar({ programa: v })}>
                    {!actual.programa && <option value="">Sin programa · elegí uno</option>}
                    {programas.map(p => <option key={p.clave} value={p.clave}>{p.label}</option>)}
                </Desplegable>
            </div>

            <div className="fi-campo">
                <label className="t-rotulo" htmlFor={`${ids}-tipo`}>Tipo de pago</label>
                <Desplegable id={`${ids}-tipo`} etiqueta="Tipo de pago" valor={tipo}
                    disabled={disabled} onCambiar={(v) => onCambiar({ tipo: v })}>
                    {!actual.tipo && (
                        <option value="">{actual.tipoCrudo ? `${actual.tipoCrudo} · elegí uno` : 'Sin tipo · elegí uno'}</option>
                    )}
                    {tipos.map(t => <option key={t.clave} value={t.clave}>{t.label}</option>)}
                </Desplegable>
            </div>
        </div>
    );
};

export default CamposPago;
