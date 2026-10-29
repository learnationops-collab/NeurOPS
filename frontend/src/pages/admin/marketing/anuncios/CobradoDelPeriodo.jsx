import { Bars } from '../../../../components/standard';
import { Tip } from '../../../comercial/components/Shared';
import { dinero } from './metricas';

/**
 * Todo lo cobrado del período y de dónde vino (Kerwin, 17/10/2026: «dice que hay $5.138 reunidos en los últimos
 * 30 días, lo cual me parece poco»). Desde el 29/10 sale de las MISMAS fuentes que las tarjetas (`datos.fuentes`):
 * Setting + Workshop + Otras suman el total cobrado, y el Cash total de cada tarjeta es el de su fila acá (antes se
 * repartía por tipo de pago y los upsells y renovaciones de Workshop caían en «Fulfillment»: $6.164 contra $6.693).
 *
 * Cada fila abre la lista de cobros que suma (`onVer`, la de «Cash total» de esa fuente); «Setting» dice cuánto de
 * eso llegó por una palabra clave y lleva a la tabla.
 */
const COLOR = { setting: 'var(--warning)', workshop: 'var(--info)', otras: 'var(--idle)' };

const CobradoDelPeriodo = ({ fuentes, enTabla, moneda, onVer, irATabla }) => {
    if (!fuentes) return null;
    const setting = fuentes.fuentes.find((f) => f.key === 'setting');
    const workshop = fuentes.fuentes.find((f) => f.key === 'workshop');
    const otras = fuentes.otras;
    const total = (setting?.cash_total || 0) + (workshop?.cash_total || 0) + (otras?.cash_total || 0);
    if (!total) return null;
    const sinClave = Math.max(0, Math.round(((setting?.cash_total || 0) - enTabla) * 100) / 100);
    const anteriores = (f) => (f.cash_anterior ? ` · ${dinero(f.cash_anterior, moneda)} de ventas anteriores` : '');

    const items = [
        { key: 'setting', label: 'Setting', value: setting.cash_total, color: COLOR.setting,
          detail: `${dinero(enTabla, moneda)} por palabra clave · ${dinero(sinClave, moneda)} sin` },
        { key: 'workshop', label: 'Workshop', value: workshop.cash_total, color: COLOR.workshop,
          detail: `${workshop.cuotas} ${workshop.cuotas === 1 ? 'cuota' : 'cuotas'}${anteriores(workshop)}` },
        { key: 'otras', label: 'Otras', value: otras.cash_total, color: COLOR.otras,
          detail: otras.detalle?.length
              ? otras.detalle.map((d) => `${d.label} ${dinero(d.monto, moneda)}`).join(' · ')
              : `${otras.cobros} ${otras.cobros === 1 ? 'pago' : 'pagos'}` },
    ].map((x) => ({
        ...x,
        display: dinero(x.value, moneda),
        title: 'Ver los cobros que suma',
        disabled: !onVer,
    }));
    const elegir = (key) => onVer && onVer(key, 'cash_total', 'Cash total');
    return (
        <section className="panel mk-cobrado">
            <div className="kpi-cab">
                <p className="t-eyebrow">De dónde vino lo cobrado</p>
                <Tip titulo="Lo cobrado" texto="Todo el cash del período, por la fuente del cliente. Tocá una fila para ver sus cobros." />
            </div>
            <p className="mk-cobrado-tit">
                <b className="num">{dinero(total, moneda)}</b>
                <span className="t-cap mut40"> cobrados en el período · {dinero(enTabla, moneda)} llegaron por una palabra clave </span>
                <button type="button" className="link-btn t-cap" onClick={irATabla}>Ver la tabla</button>
            </p>
            <Bars variant="rows" items={items} label="Lo cobrado por fuente" onSelect={elegir} />
        </section>
    );
};

export default CobradoDelPeriodo;
