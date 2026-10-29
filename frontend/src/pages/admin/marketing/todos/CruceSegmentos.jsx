import { CifraConCuenta } from '../../../../components/standard';
import { formatear } from '../anuncios/metricas';
import Diferencia from './Diferencia';
import { COLOR_SEGMENTO } from './segmentos';

/**
 * El cruce grupo × segmento de UNA cifra (Kerwin, 28/10/2026): una fila por closer, fuente, origen o setter y una
 * columna por segmento, con el total del grupo. Sirve para ver de un vistazo, p. ej., qué closer cierra más con los A.
 * Cada celda abre la lista de lo que la suma (`onVer`) y, con un período comparado, trae su diferencia.
 *
 * `campo`: `{ key, label, lista, dinero }`, la cifra que se cruza; las cuentas ya vienen hechas del backend
 * (`fila[campo.key]`). Un clic en el encabezado ordena las filas (y otra vez, las invierte).
 *
 * `onVer({ grupo, campo, segmento, nombre, previo })`: el segmento '' es el total del grupo. `plano`: sin su propia tarjeta
 * (dentro de otro panel, el de Analizar).
 */
const tipoDe = (campo) => (campo.dinero ? 'money' : 'num');

const Celda = ({ fila, campo, grupo, moneda, onVer, segmento }) => {
    const valor = fila[campo.key];
    const abrir = (previo) => () => onVer({ grupo, campo, segmento, nombre: fila.label, previo });
    const sinDato = valor === null || valor === undefined;
    const quieta = sinDato || !valor;
    return (
        <div className="sg-celda">
            <CifraConCuenta metrica={quieta ? null : campo.lista} titulo={campo.label}
                onVer={quieta ? null : (m, t) => onVer({ grupo, campo: { ...campo, lista: m, label: t }, segmento, nombre: fila.label })}
                className="t-body num td-fuerte">
                {sinDato ? '—' : formatear(valor, tipoDe(campo), moneda)}
            </CifraConCuenta>
            {fila.delta && (
                <Diferencia delta={fila.delta[campo.key]} previo={fila.previo[campo.key]} tipo={tipoDe(campo)} moneda={moneda}
                    onVerPrevio={fila.previo[campo.key] ? abrir(true) : null} />
            )}
        </div>
    );
};

const CruceSegmentos = ({ grupos, campo, campos, onCampo, moneda, color, onVer, orden, onOrden, onQuitar = null, plano = false }) => {
    if (!grupos.length) return null;
    const segmentos = grupos[0].filas.map((f) => ({ key: f.segmento, label: f.label }));
    const valorDe = (g, col) => (col === 'nombre' ? g.label.toLowerCase()
        : (col === 'total' ? g.total : g.filas.find((f) => f.segmento === col))?.[campo.key] ?? -Infinity);
    const signo = orden.dir === 'asc' ? 1 : -1;
    const filas = [...grupos].sort((a, b) => {
        const va = valorDe(a, orden.col);
        const vb = valorDe(b, orden.col);
        return va < vb ? -signo : va > vb ? signo : 0;
    });
    const encabezado = (col, texto, punto) => (
        <button type="button" role="columnheader" className="sg-orden t-eyebrow mut" onClick={() => onOrden(col)}
            aria-sort={orden.col === col ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
            {punto && <i className="sg-punto" style={{ background: punto }} aria-hidden="true" />}
            {texto}{orden.col === col ? (orden.dir === 'asc' ? ' ↑' : ' ↓') : ''}
        </button>
    );
    const plantilla = { gridTemplateColumns: `minmax(150px,1.2fr) repeat(${segmentos.length + 1},minmax(92px,1fr))`,
        minWidth: `${150 + (segmentos.length + 1) * 96}px` };
    const Envoltorio = plano ? 'div' : 'section';
    return (
        <Envoltorio className={plano ? 'sg-plano' : 'panel sg-panel'} aria-label={`${campo.label} por grupo y segmento`}>
            {!plano && (
                <div className="panel-cab">
                    <div className="mk-cab-txt">
                        <p className="t-eyebrow mut"><i className="td-punto" style={{ background: color }} aria-hidden="true" />Cruce</p>
                        <h2 className="t-h3">{campo.label} por grupo y segmento</h2>
                    </div>
                </div>
            )}
            <div className="sg-filtro" role="group" aria-label="Cifra del cruce">
                <span className="t-eyebrow mut">Cifra</span>
                {campos.map((c) => (
                    <button key={c.key} type="button" className="chip sg-chip" aria-pressed={c.key === campo.key} onClick={() => onCampo(c.key)}
                        style={{ '--c': 'var(--brand-secondary)' }}>{c.label}</button>
                ))}
            </div>
            <div className="sg-tabla" role="table" aria-label={`${campo.label}: grupo por segmento`}>
                <div className="sg-fila sg-fila--cab" style={plantilla} role="row">
                    {encabezado('nombre', 'Grupo')}
                    {segmentos.map((s) => <span key={s.key} role="presentation">{encabezado(s.key, s.label, COLOR_SEGMENTO[s.key])}</span>)}
                    {encabezado('total', 'Total')}
                </div>
                {filas.map((g) => (
                    <div key={g.key} className="sg-fila" style={plantilla} role="row">
                        <div className="sg-nombre" role="rowheader">
                            <span className="t-body td-fuerte">{g.label}</span>
                            {onQuitar && grupos.length > 1 && (
                                <button type="button" className="sg-quitar" onClick={() => onQuitar(g.key)}
                                    aria-label={`Quitar ${g.label} del análisis`} title="Quitar del análisis">×</button>
                            )}
                        </div>
                        {g.filas.map((f) => (
                            <Celda key={f.segmento} fila={f} campo={campo} grupo={g} moneda={moneda} onVer={onVer} segmento={f.segmento} />
                        ))}
                        <Celda fila={g.total} campo={campo} grupo={g} moneda={moneda} onVer={onVer} segmento="" />
                    </div>
                ))}
            </div>
        </Envoltorio>
    );
};

export default CruceSegmentos;
