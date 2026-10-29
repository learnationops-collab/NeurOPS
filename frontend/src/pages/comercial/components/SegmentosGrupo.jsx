import { CifraConCuenta } from '../../../components/standard';
import Diferencia from '../../admin/marketing/todos/Diferencia';
import { COLOR_SEGMENTO } from '../../admin/marketing/todos/segmentos';
import { fmt } from './Shared';

/**
 * Los segmentos de UN grupo (todos juntos, un closer, un setter, una fuente…) en Analizar: una fila por segmento y la del
 * total. Cada cifra abre la lista de las agendas que la suman (`onVer(metrica, titulo, segmento, nombre, previo)`); el
 * % de show up y de cierre dice su cuenta («N de M») en un tooltip. Con un período comparado, cada cifra trae su
 * diferencia. Las cuentas son del backend (`app/services/segmentos_comercial.py`).
 *
 * `columnas`: las de `COLUMNAS_PANEL` a la vista (las demás se ocultaron).
 */
const pctTexto = (v) => (v === null || v === undefined ? null : `${String(v).replace('.', ',')}%`);

/** Las columnas del panel. `pct` es la tasa de la columna y `base` lo que la divide (cada una con su lista). */
export const COLUMNAS_PANEL = (texto) => [
    { key: 'agendas', label: texto.agendas, lista: 'agendas' },
    { key: 'asistieron', label: texto.asistieron, lista: 'asistieron', pct: 'show_up', pctRotulo: 'show up',
        base: 'realizadas', baseLista: 'realizadas', baseTexto: 'con resultado', baseTitulo: 'Con resultado' },
    { key: 'ventas', label: texto.ventas, lista: 'ventas', pct: 'cierre', pctRotulo: 'cierre',
        base: 'asistieron', baseLista: 'asistieron', baseTexto: 'que asistieron', baseTitulo: 'Asistieron' },
    { key: 'sin_reporte', label: 'Sin reporte', lista: 'sin_reporte' },
];

const Celda = ({ columna, fila, abrir }) => {
    const valor = fila[columna.key];
    const pct = columna.pct ? pctTexto(fila[columna.pct]) : null;
    const cuenta = pct ? {
        a: { t: fmt.num(valor), m: columna.lista, titulo: columna.label },
        b: { t: `${fmt.num(fila[columna.base])} ${columna.baseTexto}`, m: columna.baseLista, titulo: columna.baseTitulo },
    } : null;
    return (
        <div className="sg-celda">
            <CifraConCuenta metrica={valor > 0 ? columna.lista : null} titulo={columna.label} onVer={valor > 0 ? abrir : null}
                className="t-body num td-fuerte">{fmt.num(valor)}</CifraConCuenta>
            {pct && (
                <span className="sg-pct t-cap">
                    <CifraConCuenta cuenta={cuenta} metrica={columna.lista} titulo={columna.label} onVer={valor > 0 ? abrir : null}>{pct}</CifraConCuenta>
                    {` ${columna.pctRotulo}`}
                    {fila.delta?.[columna.pct] && <Diferencia delta={fila.delta[columna.pct]} previo={fila.previo[columna.pct]} tipo="pp" />}
                </span>
            )}
            {fila.delta?.[columna.key] && (
                <Diferencia delta={fila.delta[columna.key]} previo={fila.previo[columna.key]}
                    onVerPrevio={fila.previo[columna.key] > 0 ? () => abrir(columna.lista, columna.label, true) : null} />
            )}
        </div>
    );
};

const Fila = ({ fila, columnas, plantilla, onVer, total = false }) => {
    const abrir = (metrica, titulo, previo = false) => onVer(metrica, titulo, fila.segmento ?? '', total ? '' : fila.label, previo);
    return (
        <div className={`sg-fila${total ? ' sg-fila--total' : ''}`} style={plantilla} role="row">
            <div className="sg-nombre" role="rowheader">
                {!total && <i className="sg-punto" style={{ background: COLOR_SEGMENTO[fila.segmento] }} aria-hidden="true" />}
                <span className="t-body td-fuerte">{fila.label}</span>
            </div>
            {columnas.map((c) => <Celda key={c.key} columna={c} fila={fila} abrir={abrir} />)}
        </div>
    );
};

const SegmentosGrupo = ({ grupo, columnas, titulo = null, onVer }) => {
    const plantilla = { gridTemplateColumns: `minmax(130px,1.2fr) repeat(${columnas.length},minmax(96px,1fr))`,
        minWidth: `${130 + columnas.length * 100}px` };
    return (
        <div className="sg-grupo">
            {titulo && <p className="t-body td-fuerte">{titulo}</p>}
            <div className="sg-tabla" role="table" aria-label={titulo || 'Agendas por segmento'}>
                <div className="sg-fila sg-fila--cab t-eyebrow mut" style={plantilla} role="row">
                    <span role="columnheader">Segmento</span>
                    {columnas.map((c) => <span key={c.key} role="columnheader">{c.label}</span>)}
                </div>
                {grupo.filas.map((f) => <Fila key={f.segmento} fila={f} columnas={columnas} plantilla={plantilla} onVer={onVer} />)}
                <Fila fila={grupo.total} columnas={columnas} plantilla={plantilla} onVer={onVer} total />
            </div>
        </div>
    );
};

export default SegmentosGrupo;
