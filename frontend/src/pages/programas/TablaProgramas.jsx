import { CifraConCuenta, Panel } from '../../components/standard';
import { Tip } from '../comercial/components/Shared';
import { formatear } from '../admin/marketing/anuncios/metricas';

/**
 * Por programa (Leadership 1395): una fila por AL, RR y SI (y «Otros» si cobró algo), con el total abajo. Cada cifra
 * abre su lista (`ver({ metrica, programa }, titulo)`); los %, costos y ROAS dicen su cuenta en el tooltip.
 */
const COLUMNAS = [
    { key: 'ventas', label: 'Ventas', tip: 'Pagos de venta nueva (completo o split pay) del período, por el programa del tipo de pago.' },
    { key: 'new_cash', label: 'New Cash', tip: 'Lo cobrado en esas ventas nuevas, neto de la comisión de la pasarela.' },
    { key: 'cash_total', label: 'Cash total', tip: 'Todo lo cobrado del programa en el período (cuotas, señas, renovaciones), neto.' },
    { key: 'ticket', label: 'Ticket', tip: 'El de Analizar: lo cobrado (bruto) por cada venta nueva, con su primera cuota.' },
    { key: 'ltv', label: 'LTV', tip: 'Lo cobrado (neto) por cliente del programa, de todas sus ventas, hasta el fin del período.' },
    { key: 'cuotas', label: '% cobrado', tip: 'De las ventas del período: lo cobrado ÷ lo acordado. Sin las que no tienen total acordado (renovaciones, upsells) ni las canceladas.' },
    { key: 'gasto', label: 'Gasto', tip: 'Meta Ads de las campañas etiquetadas con el programa en Marketing › Meta Ads.' },
    { key: 'cac', label: 'CAC', tip: 'Gasto ÷ compradores (personas distintas con venta nueva).' },
    { key: 'roas', label: 'ROAS', tip: 'New Cash ÷ gasto.' },
];
const SIN_ETIQUETA = 'Falta etiquetar campañas|Ninguna campaña con gasto en el período está etiquetada con este programa. Se etiquetan en Marketing › Meta Ads.';

// `tip`: «Título|texto». Con `Tip` (el «i» de Analizar): el tooltip por `data-tip` no está montado en Dirección comercial.
const Ayuda = ({ tip }) => {
    const [titulo, texto] = tip.split('|');
    return <Tip titulo={titulo} texto={texto} />;
};
const Raya = ({ tip }) => (tip
    ? <span className="ps-celda"><span className="mut num">—</span><Ayuda tip={tip} /></span>
    : <span className="mut num">—</span>);

const Fila = ({ f, moneda, ver, total = false }) => {
    const m = (v) => formatear(v, 'money', moneda);
    const p = total ? 'todos' : f.codigo;
    const abre = (metrica) => (mm, titulo) => ver({ metrica: mm || metrica, programa: p }, `${titulo} · ${f.label}`);
    const dePrograma = !total && f.cuotas !== undefined;
    const cifra = (metrica, titulo, valor) => (
        <CifraConCuenta metrica={metrica} titulo={titulo} onVer={abre(metrica)} className="num">{valor}</CifraConCuenta>
    );
    const cuotas = f.cuotas;
    const fuera = cuotas?.excluidas ? `${cuotas.excluidas} fuera|Ventas sin total acordado (renovaciones, upsells, Specialist sin precio) o canceladas: no entran al %.` : null;
    return (
        <div className={`ps-fila ps-fila--prog${total ? ' ps-fila--total' : ''}`} role="row">
            <span className="t-body td-fuerte" role="rowheader">{total ? 'Total' : f.label}</span>
            {cifra('ventas', 'Ventas', f.ventas)}
            {cifra('new_cash', 'New Cash', m(f.new_cash))}
            {cifra('cash_total', 'Cash total', m(f.cash_total))}
            {f.ticket == null ? <Raya /> : cifra('ventas', 'Ventas', m(f.ticket))}
            {dePrograma && f.ltv.ltv != null ? (
                <CifraConCuenta onVer={abre('ltv')} className="num" cuenta={{
                    a: { t: `${m(f.ltv.cobrado)} cobrado`, m: 'ltv', titulo: 'LTV' },
                    b: { t: `${f.ltv.clientes} clientes`, m: 'ltv', titulo: 'LTV' },
                }}>{m(f.ltv.ltv)}</CifraConCuenta>
            ) : <Raya />}
            {dePrograma ? (
                <span className="ps-celda">
                    {cuotas.pct == null ? <Raya tip={fuera || 'Sin ventas con total acordado en el período'} /> : (
                        <CifraConCuenta onVer={abre('cuotas')} className="num" cuenta={{
                            a: { t: `${m(cuotas.cobrado)} cobrado`, m: 'cuotas', titulo: 'Cobrado de lo acordado' },
                            b: { t: `${m(cuotas.acordado)} acordado en ${cuotas.ventas} ventas`, m: 'cuotas', titulo: 'Cobrado de lo acordado' },
                        }}>{`${cuotas.pct}%`}</CifraConCuenta>
                    )}
                    {fuera && cuotas.pct != null && <small className="mut">{cuotas.excluidas} fuera <Ayuda tip={fuera} /></small>}
                </span>
            ) : <Raya />}
            {dePrograma && f.gasto != null ? cifra('gasto', 'Gasto de Meta', m(f.gasto)) : <Raya tip={dePrograma ? SIN_ETIQUETA : null} />}
            {dePrograma && f.cac != null ? (
                <CifraConCuenta onVer={abre('gasto')} className="num" cuenta={{
                    a: { t: `${m(f.gasto)} de Meta`, m: 'gasto', titulo: 'Gasto de Meta' },
                    b: { t: `${f.compradores} compradores`, m: 'compradores', titulo: 'Compradores' },
                }}>{m(f.cac)}</CifraConCuenta>
            ) : <Raya tip={dePrograma && f.gasto == null ? SIN_ETIQUETA : null} />}
            {dePrograma && f.roas_new_cash != null ? (
                <CifraConCuenta onVer={abre('new_cash')} lado="der" className="num" cuenta={{
                    a: { t: `${m(f.new_cash)} New Cash`, m: 'new_cash', titulo: 'New Cash' },
                    b: { t: `${m(f.gasto)} de Meta`, m: 'gasto', titulo: 'Gasto de Meta' },
                }}>{formatear(f.roas_new_cash, 'veces')}</CifraConCuenta>
            ) : <Raya tip={dePrograma && f.gasto == null ? SIN_ETIQUETA : null} />}
        </div>
    );
};

const TablaProgramas = ({ datos, moneda, ver }) => {
    const { general, sin_etiquetar: sin } = datos.gasto;
    const m = (v) => formatear(v, 'money', moneda);
    return (
        <Panel as="section" className="ps-panel" aria-labelledby="ps-programas">
            <div className="ps-cab">
                <p className="t-eyebrow mut">Leadership 1395</p>
                <h2 className="t-h3" id="ps-programas">Por programa</h2>
            </div>
            <div className="ps-tabla" role="table" aria-label="Cifras por programa">
                <div className="ps-fila ps-fila--prog ps-fila--cab" role="row">
                    <span className="t-eyebrow mut" role="columnheader">Programa</span>
                    {COLUMNAS.map((c) => (
                        <span key={c.key} className="t-eyebrow mut" role="columnheader">{c.label} <Tip texto={c.tip} titulo={c.label} /></span>
                    ))}
                </div>
                {datos.filas.map((f) => <Fila key={f.codigo} f={f} moneda={moneda} ver={ver} />)}
                <Fila f={{ ...datos.total, label: 'Total' }} moneda={moneda} ver={ver} total />
            </div>
            <p className="t-cap mut ps-nota">
                {sin.gasto > 0 ? (
                    <>
                        <CifraConCuenta metrica="gasto" titulo="Gasto sin etiquetar" className="num"
                            onVer={() => ver({ metrica: 'gasto', programa: 'sin' }, 'Gasto sin etiquetar')}>{m(sin.gasto)}</CifraConCuenta>
                        {` de Meta en ${sin.campanas} ${sin.campanas === 1 ? 'campaña' : 'campañas'} sin programa: etiquetalas en Marketing › Meta Ads (columna «Programa»). `}
                    </>
                ) : 'Todas las campañas con gasto del período tienen programa. '}
                {general.gasto > 0 && (
                    <>
                        <CifraConCuenta metrica="gasto" titulo="Gasto de varios programas" className="num"
                            onVer={() => ver({ metrica: 'gasto', programa: 'general' }, 'Gasto de varios programas')}>{m(general.gasto)}</CifraConCuenta>
                        {' va a «Varios programas» y no entra en ningún CAC.'}
                    </>
                )}
            </p>
        </Panel>
    );
};

export default TablaProgramas;
