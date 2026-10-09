import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { localToday } from '../../../utils/datetime';
import ElegirTransferencia from '../piezas/ElegirTransferencia';
import {
    FALTA_TRANSFERENCIA, PREGUNTA_TRANSFERENCIA, efectoDeTransferido, esTransferencia,
} from '../transferencia';
import Desplegable from './Desplegable';

/**
 * Los cinco campos de un pago: fecha, monto, medio, programa y tipo. Y, si el medio es una
 * transferencia, un sexto: a quién del equipo se le hizo (pedido de Kerwin, 09/10/2026).
 *
 * Los comparten el editor de una fila de la sección «Pagos» (`FilaPago`) y el formulario para
 * agregar uno (`AgregarPago`): un pago corregido y uno agregado tienen que pedir lo mismo, con las
 * mismas listas, o uno de los dos terminaría escribiendo una grafía que el otro no sabe leer.
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
 * Un pago nuevo pide los cinco campos. Uno que se corrige no: un pago viejo sin medio o sin
 * programa se tiene que poder corregir de monto sin decidir antes de qué programa era. Lo único que
 * pide es el programa cuando lo que cambia es el tipo, que se escribe detrás de él ('RR - Cuota').
 *
 * A quién se le hizo la transferencia lo pide un pago nuevo por transferencia y uno que se corrige
 * PARA pasar a transferencia (`pideTransferencia`): es el momento de registrarlo, como en el
 * backend. Una transferencia vieja «sin marcar» se corrige igual sin decidirlo.
 *
 * Una fecha futura se frena acá igual que en el backend (un día que todavía no llegó no puede ser
 * el de un pago), pero solo si es la que se está escribiendo: la de un pago viejo que nadie tocó
 * no viaja, y no tiene por qué impedir corregirle el monto.
 */
export const faltaParaGuardar = ({ fecha, monto, medio, programa, tipo, transferido_a: transferidoA },
    { nuevo = false, cambiaTipo = false, cambiaFecha = false, pideTransferencia = false } = {}) => {
    if (!fecha) return 'Falta la fecha del pago';
    if ((nuevo || cambiaFecha) && fecha > localToday()) {
        return 'Un pago no puede tener fecha futura: ese día todavía no llegó';
    }
    if (!(Number(monto) > 0)) return 'El monto tiene que ser mayor que cero';
    if (nuevo && !medio) return 'Elegí el medio de pago';
    if (nuevo && !programa) return 'Elegí el programa del pago';
    if (nuevo && !tipo) return 'Elegí el tipo de pago';
    if (cambiaTipo && !programa) return 'Elegí también el programa: el tipo se escribe «programa - tipo»';
    if ((nuevo || pideTransferencia) && esTransferencia(medio) && !transferidoA) return FALTA_TRANSFERENCIA;
    return null;
};

/**
 * La pregunta de a quién se le hizo la transferencia, a todo el ancho debajo de los cinco campos.
 * Aparece sola al elegir un medio de transferencia (con un fundido corto, nada con movimiento
 * reducido) y dice qué pasa con lo elegido: a Pedro y a Jean Carlo se les descuenta en Payroll.
 */
const CampoTransferencia = ({ ids, valor, opciones, sinMarcar, disabled, onCambiar }) => {
    const reducido = useReducedMotion();
    const elegida = opciones.find(o => o.clave === valor);
    return (
        <motion.div className="fi-campo" style={{ gridColumn: '1 / -1' }}
            {...(reducido ? {} : {
                initial: { opacity: 0, y: -4 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.18, ease: [0.22, 0.7, 0.2, 1] },
            })}>
            <span className="t-rotulo" id={`${ids}-transferido`}>{PREGUNTA_TRANSFERENCIA}</span>
            <ElegirTransferencia opciones={opciones} valor={valor} sinMarcar={sinMarcar} disabled={disabled}
                etiqueta={PREGUNTA_TRANSFERENCIA} onElegir={(v) => onCambiar({ transferido_a: v })} />
            <small className="t-cap mut">
                {elegida ? efectoDeTransferido(elegida)
                    : 'La plata quedó en la cuenta de esa persona: a Pedro y a Jean Carlo se les descuenta en Payroll.'}
            </small>
        </motion.div>
    );
};

const CamposPago = ({
    ids, valores, onCambiar, disabled = false, medios = [], programas = [], tipos = [],
    transferencias = [], actual = {}, autoFocus = false,
}) => {
    const { fecha, monto, medio, programa, tipo } = valores;
    const medioFuera = actual.medio && !medios.some(m => m.clave === actual.medio);
    return (
        <div className="fi-agenda-campos">
            <div className="fi-campo">
                <label className="t-rotulo" htmlFor={`${ids}-fecha`}>Fecha del pago</label>
                <span className="ln-field" style={{ height: 44 }}>
                    <input id={`${ids}-fecha`} type="date" value={fecha} required disabled={disabled}
                        max={localToday()} autoFocus={autoFocus}
                        onChange={(e) => onCambiar({ fecha: e.target.value })} />
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

            {esTransferencia(medio) && (
                // «Sin marcar» solo para devolver a ese estado una transferencia que ya estaba
                // marcada: en un alta, o en un pago que recién pasa a transferencia, se pide.
                <CampoTransferencia ids={ids} valor={valores.transferido_a ?? null} opciones={transferencias}
                    sinMarcar={!!actual.transferido_a} disabled={disabled} onCambiar={onCambiar} />
            )}
        </div>
    );
};

export default CamposPago;
