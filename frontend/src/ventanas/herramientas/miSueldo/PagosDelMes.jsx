// La columna derecha de Mi sueldo: los pagos del mes que dan comisión, todos o los de un concepto.
// Los sacados de la nómina se ven tachados y no suman; los sin comprobante se pagan igual, marcados.
import { Segmented } from '../../../components/standard';
import { COLORES, dinero } from './useMiSueldo';

const MARCAS = {
    pending: ['sin comprobante', 'var(--ln-warning, #f5b84a)'],
    unverified: ['no cuadra', 'var(--ln-danger, #f87171)'],
};
const punto = (k) => <i className="ms-pt ms-pt--sm" style={{ background: COLORES[k] }} aria-hidden="true" />;
const fecha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');

function Fila({ p, conPunto }) {
    const marca = p.excluida ? ['fuera de la nómina', 'var(--ln-text-faint, #999)'] : MARCAS[p.verificacion];
    const sinFee = Math.abs(p.bruto - p.neto) < 0.005;
    return (
        <tr className={p.excluida ? 'ms-excl' : undefined}>
            <td className="ms-f num">{fecha(p.fecha)}</td>
            <td>
                <span className="ms-tch">{p.cliente || 'Sin nombre'}</span>
                {marca && <span className="ms-marca" style={{ '--c': marca[1] }}>{marca[0]}</span>}
                <small>{conPunto && punto(p.concepto)}{[p.programa, p.tipo, p.metodo, p.closer].filter(Boolean).join(' · ')}</small>
            </td>
            <td className="ms-d num ms-tch">{dinero(p.neto)}<small>{sinFee ? 'sin fee' : `bruto ${dinero(p.bruto)}`}</small></td>
            <td className="ms-d num">{p.porcentaje != null ? `${p.porcentaje}%` : '—'}</td>
            <td className="ms-d num">{p.excluida ? 'Excluida' : <b>{dinero(p.comision)}</b>}</td>
        </tr>
    );
}

export default function PagosDelMes({ pagos, conceptos, filtro, onFiltro }) {
    const lista = pagos.filter(p => !filtro || p.concepto === filtro);
    const suman = lista.filter(p => !p.excluida);
    const excluidos = lista.length - suman.length;
    const elegido = conceptos.find(c => c.k === filtro);
    const neto = suman.reduce((t, p) => t + p.neto, 0);
    const comision = suman.reduce((t, p) => t + p.comision, 0);
    const opciones = [{ value: '', label: 'Todos', count: pagos.filter(p => !p.excluida).length },
        ...conceptos.filter(c => c.monto > 0.004).map(c => ({ value: c.k, label: c.titulo, count: c.pagos, icon: punto(c.k) }))];

    return (
        <div className="ms-der">
            <div className="ms-p-cab">
                <h3>{elegido ? elegido.titulo : 'Todos los pagos'} <span>· {suman.length}</span></h3>
                {conceptos.length > 1 && <Segmented size="sm" label="Filtrar pagos por concepto" value={filtro} options={opciones} onChange={onFiltro} />}
            </div>
            <div className="ms-pagos">
                {lista.length ? (
                    <table>
                        <thead><tr><th>Fecha</th><th>Cliente</th><th className="ms-d">Neto</th><th className="ms-d">%</th><th className="ms-d">Comisión</th></tr></thead>
                        <tbody>{lista.map(p => <Fila key={`${p.concepto}-${p.id}`} p={p} conPunto={!filtro} />)}</tbody>
                    </table>
                ) : <p className="ms-vacio">Sin pagos que den comisión este mes.</p>}
            </div>
            <div className="ms-p-pie">
                <span>{suman.length} {suman.length === 1 ? 'pago' : 'pagos'}{excluidos ? ` (+${excluidos} ${excluidos === 1 ? 'excluido' : 'excluidos'})` : ''} · neto <b className="num">{dinero(neto)}</b></span>
                <span>Comisión <b className="num">{dinero(comision)}</b></span>
            </div>
        </div>
    );
}
