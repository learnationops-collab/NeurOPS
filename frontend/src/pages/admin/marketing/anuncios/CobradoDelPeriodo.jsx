import { Bars } from '../../../../components/standard';
import { Tip } from '../../../comercial/components/Shared';
import { destinoProcedencia } from '../../../comercial/components/destinos';
import { dinero } from './metricas';

/**
 * Todo lo cobrado del período y cuánto llegó por una palabra clave (Kerwin, 17/10/2026: «dice que hay
 * $5.138 reunidos en los últimos 30 días, lo cual me parece poco»). El resto no se pierde: es lo que
 * trajeron el workshop, la VSL, las renovaciones o un setter sin conversación de ManyChat, con la misma
 * procedencia de Finanzas (`anuncios_service.cobrado_fuera`).
 *
 * Cada fila lleva a esas ventas (Kerwin, 17/10/2026: «que le dé clic y me lleve a la vista
 * correspondiente»): «Por palabra clave» baja a la tabla de esta pantalla; las demás abren Revisar ›
 * Ventas del dashboard comercial con la fuente y las mismas fechas (`irAVentas`, null si esta persona no
 * puede abrirlo: esas filas quedan quietas).
 */

const COLOR = {
    tabla: 'var(--brand-secondary)', workshop: 'var(--info)', setting: 'var(--warning)', vsl: 'var(--success)',
    fulfillment: 'var(--text-muted)', sin_procedencia: 'var(--idle)',
};

const ROTULO = {
    setting: 'Setting sin palabra clave', workshop: 'Workshop', vsl: 'VSL', fulfillment: 'Renovaciones y upsells',
};

/** Lo de esa procedencia que sí llegó por palabra clave: Revisar lo muestra igual (no hay una faceta que
 *  lo separe), así que se dice cuánto es en vez de dejar que no cierre. */
const tambienEnLaTabla = (p) => Math.max(0, Math.round(((p.monto_total ?? p.monto) - p.monto) * 100) / 100);

/** El destino en Ventas de una procedencia (`p.label` es la etiqueta de la faceta Fuente). */
export const destinoDe = (p, moneda) => {
    const destino = destinoProcedencia(p.label);
    const extra = tambienEnLaTabla(p);
    return extra ? { ...destino, de: `${destino.de} · incluye ${dinero(extra, moneda)} de palabra clave` } : destino;
};

const tituloDe = (p, moneda) => {
    const extra = tambienEnLaTabla(p);
    return extra
        ? `Ver en Revisar › Ventas: ${dinero(p.monto_total, moneda)}, con ${dinero(extra, moneda)} que llegaron por palabra clave (ya en la tabla)`
        : 'Ver estas ventas en Revisar › Ventas';
};

const CobradoDelPeriodo = ({ enTabla, total, fuera, moneda, irAVentas, irATabla }) => {
    if (!total) return null;
    const porKey = Object.fromEntries(fuera.map((p) => [p.key, p]));
    const items = [
        { key: 'tabla', label: 'Por palabra clave (la tabla)', value: enTabla, color: COLOR.tabla,
          title: 'Ver la tabla ordenada por lo cobrado' },
        ...fuera.map((p) => ({
            key: p.key, label: ROTULO[p.key] || p.label, value: p.monto, color: COLOR[p.key],
            detail: p.detalle.length > 1 ? p.detalle.map((d) => `${d.label} ${dinero(d.monto, moneda)}`).join(' · ')
                : `${p.cantidad} ${p.cantidad === 1 ? 'pago' : 'pagos'}`,
            disabled: !irAVentas,
            title: tituloDe(p, moneda),
        })),
    ].map((x) => ({
        ...x,
        display: dinero(x.value, moneda),
        detail: x.detail ?? `${Math.round((x.value / total) * 100)}% del total`,
    }));
    const elegir = (key) => {
        if (key === 'tabla') irATabla();
        else if (irAVentas && porKey[key]) {
            const { tabla, filtro, de } = destinoDe(porKey[key], moneda);
            irAVentas(tabla, { ...filtro, __de: de });
        }
    };
    return (
        <section className="panel mk-cobrado">
            <div className="kpi-cab">
                <p className="t-eyebrow">De dónde vino lo cobrado</p>
                <Tip titulo="Lo cobrado" texto="Todo el cash del período. Tocá una fila para ver esas ventas." />
            </div>
            <p className="mk-cobrado-tit">
                <b className="num">{dinero(total, moneda)}</b>
                <span className="t-cap mut40"> cobrados en el período · {dinero(enTabla, moneda)} llegaron por una palabra clave</span>
            </p>
            <Bars variant="rows" items={items} label="Lo cobrado por procedencia" onSelect={elegir} />
        </section>
    );
};

export default CobradoDelPeriodo;
