import { CifraConCuenta, Panel } from '../../components/standard';
import { Tip } from '../comercial/components/Shared';
import { formatear } from '../admin/marketing/anuncios/metricas';
import { COLOR_SEGMENTO } from '../admin/marketing/todos/segmentos';

/**
 * Por segmento en Setting (Leadership 1403): el gasto de Setting repartido según las agendas de cada segmento
 * (decisión 839: reparto por agendas). Es una ESTIMACIÓN y la tabla lo dice. Workshop no entra: sus leads no traen
 * formulario. Cada cifra abre su lista (`ver({ metrica, segmento }, titulo)`; el total, todo Setting).
 */
const COLUMNAS = [
    { key: 'agendas', label: 'Agendas', tip: 'Personas con agenda de Setting en el período (fecha de alta), como en Marketing › Segmentos.' },
    { key: 'gasto', label: 'Gasto estimado', tip: 'El gasto de Setting × la parte de las agendas que es de este segmento. Meta no conoce al lead: es un reparto.' },
    { key: 'leads', label: 'Leads', tip: 'Entradas por palabra clave con el segmento de quien llenó el formulario.' },
    { key: 'ventas', label: 'Ventas', tip: 'Pagos de venta nueva de leads del segmento.' },
    { key: 'new_cash', label: 'New Cash', tip: 'Lo cobrado en esas ventas nuevas, neto.' },
    { key: 'cac', label: 'CAC', tip: 'Gasto estimado ÷ compradores (personas distintas con venta nueva).' },
    { key: 'roas', label: 'ROAS', tip: 'New Cash ÷ gasto estimado.' },
];

const Raya = () => <span className="mut num">—</span>;

const Fila = ({ f, total, moneda, ver }) => {
    const m = (v) => formatear(v, 'money', moneda);
    const seg = f.segmento || '';
    const abre = (metrica) => (mm, titulo) => ver({ metrica: mm || metrica, segmento: seg }, `${titulo} · ${f.label}`);
    const gasto = { t: `${m(f.gasto)} estimado`, m: 'gasto', titulo: 'Anuncios de Setting (lo que se reparte)' };
    const costo = (valor, b, lado) => (valor == null ? <Raya /> : (
        <CifraConCuenta onVer={abre('gasto')} lado={lado} className="num" cuenta={{ a: gasto, b }}>{m(valor)}</CifraConCuenta>
    ));
    return (
        <div className={`ps-fila ps-fila--seg${f.segmento ? '' : ' ps-fila--total'}`} role="row">
            <span className="t-body td-fuerte ps-seg" role="rowheader" style={{ '--c': COLOR_SEGMENTO[f.segmento] }}>
                {f.segmento && <i aria-hidden="true" />}{f.label}
            </span>
            <span className="ps-celda">
                <CifraConCuenta metrica="agendas" titulo="Agendas" onVer={abre('agendas')} className="num">{f.agendas}</CifraConCuenta>
                {f.segmento && f.pct_agendas != null && <small className="mut num">{f.pct_agendas}%</small>}
            </span>
            {f.gasto == null ? <Raya /> : (
                <CifraConCuenta onVer={abre('gasto')} className="num" cuenta={{
                    a: { t: `${f.agendas} agendas`, m: 'agendas', titulo: 'Agendas' },
                    b: { t: `${total.agendas} de Setting (${m(total.gasto)})`, m: 'gasto', titulo: 'Anuncios de Setting (lo que se reparte)' },
                }}>{m(f.gasto)}</CifraConCuenta>
            )}
            <CifraConCuenta metrica="leads" titulo="Leads" onVer={abre('leads')} className="num">{f.leads}</CifraConCuenta>
            <CifraConCuenta metrica="ventas" titulo="Ventas" onVer={abre('ventas')} className="num">{f.ventas}</CifraConCuenta>
            <CifraConCuenta metrica="new_cash" titulo="New Cash" onVer={abre('new_cash')} className="num">{m(f.new_cash)}</CifraConCuenta>
            {costo(f.cac, { t: `${f.compradores} compradores`, m: 'compradores', titulo: 'Compradores' })}
            {f.roas_new_cash == null ? <Raya /> : (
                <CifraConCuenta onVer={abre('new_cash')} lado="der" className="num" cuenta={{
                    a: { t: `${m(f.new_cash)} New Cash`, m: 'new_cash', titulo: 'New Cash' }, b: gasto,
                }}>{formatear(f.roas_new_cash, 'veces')}</CifraConCuenta>
            )}
        </div>
    );
};

const TablaSegmentos = ({ datos, moneda, ver }) => (
    <Panel as="section" className="ps-panel" aria-labelledby="ps-segmentos">
        <div className="ps-cab">
            <p className="t-eyebrow mut">Leadership 1403 · Setting</p>
            <h2 className="t-h3" id="ps-segmentos">Por segmento del lead</h2>
        </div>
        <p className="t-sm ps-aviso" role="note">
            <b>Reparto estimado.</b> Meta no sabe el segmento del lead: el gasto de Setting
            ({formatear(datos.gasto, 'money', moneda)}) se reparte según las agendas de cada segmento. Por eso el costo por
            agenda es el mismo en todos; lo que cambia es cuánto vende cada uno. Workshop no entra: sus leads no se pueden segmentar.
        </p>
        <div className="ps-tabla" role="table" aria-label="Cifras de Setting por segmento">
            <div className="ps-fila ps-fila--seg ps-fila--cab" role="row">
                <span className="t-eyebrow mut" role="columnheader">Segmento</span>
                {COLUMNAS.map((c) => (
                    <span key={c.key} className="t-eyebrow mut" role="columnheader">{c.label} <Tip texto={c.tip} titulo={c.label} /></span>
                ))}
            </div>
            {datos.filas.map((f) => <Fila key={f.segmento} f={f} total={datos.total} moneda={moneda} ver={ver} />)}
            <Fila f={datos.total} total={datos.total} moneda={moneda} ver={ver} />
        </div>
    </Panel>
);

export default TablaSegmentos;
