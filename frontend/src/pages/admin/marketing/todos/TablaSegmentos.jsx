import { Tip } from '../../../comercial/components/Shared';
import CifraConCuenta from './CifraConCuenta';
import { COLOR_SEGMENTO, COLUMNAS_SEGMENTO, pctDe, tonoDeTasa, valorDe } from './segmentos';

/**
 * La tabla de UNA fuente (Setting o Workshop): una fila por segmento y la del total, con las cifras del embudo
 * y de la plata. Cada cifra abre la lista de lo que la suma, ya cortada por ese segmento
 * (`onVer(metrica, titulo, segmento, nombre)`); el % de show up y de cierre dice su cuenta en un tooltip.
 *
 * Una cifra sin dato (los leads de Workshop por segmento: son clics anónimos) se ve «—» y no abre nada.
 */
const Celda = ({ columna, fila, referencia, moneda, abrir }) => {
    const pct = pctDe(columna, fila);
    const tono = tonoDeTasa(columna, fila, referencia);
    const sinDato = fila[columna.key] === null || fila[columna.key] === undefined;
    const cuenta = columna.base && !sinDato ? {
        a: { t: valorDe(columna, fila, moneda), m: columna.lista },
        b: { t: `${fila[columna.base]} ${columna.baseTexto}`, m: columna.baseLista },
    } : null;
    return (
        <div className="sg-celda">
            <CifraConCuenta metrica={sinDato ? null : columna.lista} onVer={sinDato ? null : abrir} className="t-body num td-fuerte">
                {valorDe(columna, fila, moneda)}
            </CifraConCuenta>
            {pct && (
                <span className={`sg-pct t-cap${tono ? ` sg-pct--${tono}` : ''}`}>
                    <CifraConCuenta cuenta={cuenta} metrica={columna.lista} onVer={abrir}>{pct}</CifraConCuenta>
                    {columna.pctRotulo ? ` ${columna.pctRotulo}` : ''}
                </span>
            )}
        </div>
    );
};

const Fila = ({ fila, color, referencia, moneda, onVer, total = false }) => {
    const abrir = (metrica, titulo) => onVer(metrica, titulo, fila.segmento ?? '', total ? '' : fila.label);
    return (
        <div className={`sg-fila${total ? ' sg-fila--total' : ''}`} role="row">
            <div className="sg-nombre" role="rowheader">
                {color && <i className="sg-punto" style={{ background: color }} aria-hidden="true" />}
                <span className="t-body td-fuerte">{fila.label}</span>
            </div>
            {COLUMNAS_SEGMENTO.map((c) => (
                <Celda key={c.key} columna={c} fila={fila} referencia={referencia} moneda={moneda} abrir={abrir} />
            ))}
            <div className="sg-celda">
                <span className="t-body num">{fila.ticket === null || fila.ticket === undefined ? '—' : valorDe({ key: 'ticket', dinero: true }, fila, moneda)}</span>
            </div>
        </div>
    );
};

const TablaSegmentos = ({ fuente, color, filas, total, moneda, onVer }) => (
    <section className="panel sg-panel" aria-label={`${fuente.label} por segmento`}>
        <div className="panel-cab">
            <div className="mk-cab-txt">
                <p className="t-eyebrow mut"><i className="td-punto" style={{ background: color }} aria-hidden="true" />{fuente.label}</p>
                <h2 className="t-h3">{fuente.label} por segmento</h2>
            </div>
        </div>
        <div className="sg-tabla" role="table" aria-label={`${fuente.label}: cifras por segmento`}>
            <div className="sg-fila sg-fila--cab t-eyebrow mut" role="row">
                <span role="columnheader">Segmento</span>
                {COLUMNAS_SEGMENTO.map((c) => (
                    <span key={c.key} role="columnheader">{c.label} <Tip texto={c.ayuda} titulo={c.label} /></span>
                ))}
                <span role="columnheader">Ticket <Tip texto="New Cash ÷ ventas del grupo." titulo="Ticket" /></span>
            </div>
            {filas.map((f) => (
                <Fila key={f.segmento} fila={f} color={COLOR_SEGMENTO[f.segmento]} referencia={total} moneda={moneda} onVer={onVer} />
            ))}
            <Fila fila={total} referencia={null} moneda={moneda} onVer={onVer} total />
        </div>
        {fuente.key === 'workshop' && (
            <p className="t-cap mut">Los leads de Workshop son clics al grupo de WhatsApp: no traen formulario, así que no se parten por segmento.</p>
        )}
    </section>
);

export default TablaSegmentos;
