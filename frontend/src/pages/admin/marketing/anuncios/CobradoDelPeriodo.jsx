import { Bars } from '../../../../components/standard';
import { Tip } from '../../../comercial/components/Shared';
import { dinero } from './metricas';

/**
 * Todo lo cobrado del período y cuánto llegó por una palabra clave (Kerwin, 17/10/2026: «dice que hay
 * $5.138 reunidos en los últimos 30 días, lo cual me parece poco»). El resto no se pierde: es lo que
 * trajeron el workshop, la VSL, las renovaciones o un setter sin conversación de ManyChat, con la misma
 * procedencia de Finanzas (`anuncios_service.cobrado_fuera`).
 */

const COLOR = {
    tabla: 'var(--brand-secondary)', workshop: 'var(--info)', setting: 'var(--warning)', vsl: 'var(--success)',
    fulfillment: 'var(--text-muted)', sin_procedencia: 'var(--idle)',
};

const ROTULO = {
    setting: 'Setting sin palabra clave', workshop: 'Workshop', vsl: 'VSL', fulfillment: 'Renovaciones y upsells',
};

const CobradoDelPeriodo = ({ enTabla, total, fuera, moneda }) => {
    if (!total) return null;
    const items = [
        { key: 'tabla', label: 'Por palabra clave (la tabla)', value: enTabla, color: COLOR.tabla },
        ...fuera.map((p) => ({
            key: p.key, label: ROTULO[p.key] || p.label, value: p.monto, color: COLOR[p.key],
            detail: p.detalle.length > 1 ? p.detalle.map((d) => `${d.label} ${dinero(d.monto, moneda)}`).join(' · ')
                : `${p.cantidad} ${p.cantidad === 1 ? 'pago' : 'pagos'}`,
        })),
    ].map((x) => ({
        ...x,
        display: dinero(x.value, moneda),
        detail: x.detail ?? `${Math.round((x.value / total) * 100)}% del total`,
    }));
    return (
        <section className="panel mk-cobrado">
            <div className="kpi-cab">
                <p className="t-eyebrow">De dónde vino lo cobrado</p>
                <Tip titulo="Lo cobrado" texto="Todo el cash del período. Solo lo de una palabra clave entra en la tabla." />
            </div>
            <p className="mk-cobrado-tit">
                <b className="num">{dinero(total, moneda)}</b>
                <span className="t-cap mut40"> cobrados en el período · {dinero(enTabla, moneda)} llegaron por una palabra clave</span>
            </p>
            <Bars variant="rows" items={items} label="Lo cobrado por procedencia" />
        </section>
    );
};

export default CobradoDelPeriodo;
