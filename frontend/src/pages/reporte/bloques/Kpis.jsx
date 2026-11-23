// Fila de KPIs del día: valor, delta contra el promedio y meta o sparkline.
import { Kpi } from '../piezas';

export default function Kpis({ kpis = [], fecha }) {
    return (
        <div className="rp-hero">
            {kpis.map((k, i) => <Kpi key={k.clave || k.l} k={i} dato={k} fecha={fecha} txtDelta="vs. tu promedio" />)}
        </div>
    );
}
