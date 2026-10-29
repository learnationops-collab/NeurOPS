import { CifraConCuenta } from '../../../components/standard';
import { Tip } from '../../comercial/components/Shared';
import ContenidoRegistros from './anuncios/ContenidoRegistros';
import './otras.css';

/**
 * «De dónde viene cada agenda» de Otras (Kerwin, 28/10/2026): una fila por origen (VSL, Momentum, Referido, un
 * «Setter» genérico, «Sin fuente»…) con sus agendas, cuántas asistieron y el show up. Los grupos suman la cifra
 * de Otras (`fuentes.otras.origenes`, `conteo_agendas_service.por_fuente`) y cada número abre su lista. Debajo,
 * todas las agendas de Otras con su origen a la vista.
 *
 * `abrir(metrica, titulo, origen)`: abre la lista de esa cifra (de un origen, o de todas si `origen` no viene).
 */
const TITULO = { agendas: 'Agendas', show_up: 'Asistieron', reportadas: 'Citas con resultado' };

const Fila = ({ fila, abrir, total = false }) => {
    const ver = (metrica) => (m, titulo) => abrir(m || metrica, titulo, total ? undefined : fila.origen);
    const cuenta = fila.pct_show_up === null ? null : {
        a: { t: `${fila.show_up}`, m: 'show_up', titulo: TITULO.show_up },
        b: { t: `${fila.reportadas} con resultado`, m: 'reportadas', titulo: TITULO.reportadas },
    };
    return (
        <div className={`ot-fila${total ? ' ot-fila--total' : ''}`} role="row">
            <span className="t-body td-fuerte" role="rowheader">{total ? 'Total de Otras' : fila.origen}</span>
            <CifraConCuenta metrica="agendas" titulo={TITULO.agendas} onVer={ver('agendas')} className="t-body num td-fuerte">
                {fila.agendas}
            </CifraConCuenta>
            <span className="t-body num mut">{total ? '100%' : `${fila.pct_agendas}%`}</span>
            <CifraConCuenta metrica="show_up" titulo={TITULO.show_up} onVer={ver('show_up')} className="t-body num">
                {fila.show_up}
            </CifraConCuenta>
            {cuenta
                ? <CifraConCuenta cuenta={cuenta} onVer={ver('show_up')} className="t-body num">{`${fila.pct_show_up}%`}</CifraConCuenta>
                : <span className="t-body num mut">—</span>}
        </div>
    );
};

const OrigenDeOtras = ({ otras, abrir, desde, hasta, moneda, base, segmento = undefined }) => {
    const origenes = otras.origenes || [];
    const total = { agendas: otras.agendas, show_up: otras.show_up, reportadas: otras.reportadas, pct_show_up: otras.pct_show_up };
    return (
        <>
            <section className="panel ot-panel" aria-label="De dónde viene cada agenda">
                <div className="panel-cab">
                    <div className="mk-cab-txt">
                        <p className="t-eyebrow mut">Otras</p>
                        <h2 className="t-h3">De dónde viene cada agenda</h2>
                    </div>
                </div>
                {origenes.length === 0 ? (
                    <p className="t-sm mut">Ninguna agenda de Otras en este período.</p>
                ) : (
                    <div className="ot-tabla" role="table">
                        <div className="ot-fila ot-fila--cab" role="row">
                            <span className="t-eyebrow mut" role="columnheader">Origen</span>
                            <span className="t-eyebrow mut" role="columnheader">Agendas</span>
                            <span className="t-eyebrow mut" role="columnheader">% de Otras</span>
                            <span className="t-eyebrow mut" role="columnheader">Asistieron</span>
                            <span className="t-eyebrow mut" role="columnheader">
                                Show up <Tip texto="Asistieron ÷ citas con resultado." titulo="Show up" />
                            </span>
                        </div>
                        {origenes.map((o) => <Fila key={o.origen} fila={o} abrir={abrir} />)}
                        <Fila fila={total} abrir={abrir} total />
                    </div>
                )}
            </section>
            <section className="panel ot-panel" aria-label="Las agendas de Otras">
                <div className="panel-cab">
                    <div className="mk-cab-txt">
                        <h2 className="t-h3">Todas las agendas de Otras</h2>
                    </div>
                </div>
                <ContenidoRegistros fuente="otras" metrica="agendas" desde={desde} hasta={hasta} moneda={moneda} base={base} segmento={segmento} />
            </section>
        </>
    );
};

export default OrigenDeOtras;
