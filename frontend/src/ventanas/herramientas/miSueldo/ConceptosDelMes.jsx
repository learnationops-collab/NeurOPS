// La columna izquierda de Mi sueldo: el total del mes con su estado, la barra de qué parte es cada cosa
// y la lista de conceptos. Tocar un concepto con pagos los filtra en la columna derecha.
import { COLORES, dinero, filasDelMes } from './useMiSueldo';
import { reglas } from './reglas';

const ESTADOS = {
    curso: ['Mes en curso', 'var(--ln-brand, #ff3fa4)'], pagado: ['Pagado', 'var(--ln-success, #3ecf8e)'],
    transito: ['En camino', 'var(--ln-info, #5aa9ff)'], pendiente: ['Pendiente', 'var(--ln-warning, #f5b84a)'],
    revisar: ['En revisión', 'var(--ln-danger, #f87171)'],
};

const detalleDe = (f) => {
    if (!f.conPagos) return f.detalle;
    const afuera = f.renovaciones_afuera ? ` (${f.renovaciones_afuera} renovaciones quedaron afuera)` : '';
    const pct = f.porcentaje != null ? `${f.porcentaje}% de ` : '';
    return `${f.detalle}${afuera} · ${f.pagos} ${f.pagos === 1 ? 'pago' : 'pagos'} · ${pct}${dinero(f.neto)} neto`;
};

function Fila({ f, bruto, elegida, onElegir }) {
    const pct = bruto > 0.004 && f.monto > 0.004 ? `${Math.round((f.monto / bruto) * 100)}%` : '';
    const contenido = (
        <>
            <span className="ms-pt" style={{ background: COLORES[f.k] }} />
            <span className="ms-tx"><b>{f.titulo}</b><span>{detalleDe(f)}</span></span>
            <span className={`ms-m num${f.monto < -0.004 ? ' ms-neg' : ''}`}>{dinero(f.monto)}</span>
            <span className="ms-pc num">{pct}</span>
            <span className="ms-fl" aria-hidden="true">{f.conPagos ? '›' : ''}</span>
        </>
    );
    if (!f.conPagos) return <div className="ms-fila">{contenido}</div>;
    return (
        <button type="button" className="ms-fila ms-fila--btn" aria-pressed={elegida} style={{ '--c': COLORES[f.k] }}
            onClick={() => onElegir(elegida ? '' : f.k)} title="Ver solo estos pagos a la derecha">{contenido}</button>
    );
}

export default function ConceptosDelMes({ mes, rol, filtro, onFiltro }) {
    const filas = filasDelMes(mes);
    const positivas = filas.filter(f => f.monto > 0.004);
    const suma = positivas.reduce((t, f) => t + f.monto, 0);
    const curso = mes.estado === 'curso';
    const [estado, color] = ESTADOS[mes.estado] || ESTADOS.pendiente;

    return (
        <>
            <div className="ms-total">
                <span className="ms-total-cab">
                    <small className="ms-rotulo">{curso ? 'Llevás este mes' : 'Cobraste'}</small>
                    <span className="ms-ayuda">
                        <button type="button" aria-label="Cómo se calcula" aria-describedby="ms-reglas">?</button>
                        <span className="ms-globo" id="ms-reglas" role="tooltip">
                            <b>Cómo se calcula</b>
                            <ul>{reglas(rol, mes).map(r => <li key={r}>{r}</li>)}</ul>
                        </span>
                    </span>
                </span>
                <span className="ms-n num">{dinero(mes.total)}</span>
                <span className="ms-sub">
                    <span className="ms-estado" style={{ '--c': color }}>{estado}</span>
                    {mes.descuentos > 0.004 && <span>{dinero(mes.bruto)} − {dinero(mes.descuentos)} que recibiste por transferencia</span>}
                    <span>{rol}</span>
                </span>
            </div>
            <div className="ms-apilada" aria-hidden="true">
                {positivas.map(f => <i key={f.k} style={{ width: `${(f.monto / suma) * 100}%`, background: COLORES[f.k] }} title={f.titulo} />)}
            </div>
            <div className="ms-conceptos">
                {filas.map(f => <Fila key={f.k} f={f} bruto={mes.bruto} elegida={filtro === f.k} onElegir={onFiltro} />)}
                {mes.descuentos > 0.004 && (
                    <div className="ms-fila">
                        <span className="ms-pt" style={{ background: 'var(--ln-danger, #f87171)' }} />
                        <span className="ms-tx"><b>Descuentos</b><span>Plata de un cliente que entró a tu cuenta por transferencia: ya la tenés</span></span>
                        <span className="ms-m num ms-neg">{dinero(-mes.descuentos)}</span><span /><span />
                    </div>
                )}
                <div className="ms-pie">
                    <span /><span>{curso ? 'A cobrar hasta hoy' : 'Total'}</span><span className="num">{dinero(mes.total)}</span><span /><span />
                </div>
            </div>
        </>
    );
}
