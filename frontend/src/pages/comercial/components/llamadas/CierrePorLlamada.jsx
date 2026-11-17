import { Tip } from '../Shared';
import { Delta } from '../VsPrevio';

/**
 * Close rate por llamada, en el panel Cierre (ADR-W144): la primera llamada del lead contra la segunda o más,
 * con las Momentum aparte. La llamada es primera o segunda por ORDEN (a cuántas ya asistió ese lead en los 90 días
 * anteriores), no por una marca de la agenda. Las tres filas suman las llamadas con show up y las ventas del panel.
 *
 * `porLlamada` / `previo`: `bloque.cierres_llamada` de ahora y del período comparado
 * (`{primera | segunda | momentum: {asistieron, ventas, senas}}`). `onVer(que, título, { llamada })` abre la
 * lista de una cifra; sin él, las cifras no se pueden tocar.
 */
const FILAS = [
    { clave: 'primera', nombre: '1ª llamada', largo: 'Primera llamada', color: 'var(--info)' },
    { clave: 'segunda', nombre: '2ª o más', largo: 'Segunda llamada o más', color: 'var(--brand-secondary)' },
    { clave: 'momentum', nombre: 'Momentum', largo: 'Momentum', color: 'var(--text-muted)', aparte: true },
];
// Con menos llamadas que estas, la tasa se apaga y dice su cuenta: 1 de 3 no es un 33% para comparar.
const POCAS = 5;

const tasa = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : null);
const pctTexto = (x) => (x == null ? '—' : `${String(x).replace('.', ',')}%`);

const Cuenta = ({ n, rotulo, onClick }) => (n && onClick ? (
    <button type="button" className="cc-ll-n cc-ll-n--clic num" role="cell" onClick={onClick}
        aria-label={`${rotulo}: ${n}. Ver la lista`}>{n}</button>
) : <span className="cc-ll-n num" role="cell">{n ?? 0}</span>);

const Fila = ({ fila, d, p, onVer, vs }) => {
    const ahora = tasa(d.ventas, d.asistieron);
    const antes = p ? tasa(p.ventas, p.asistieron) : null;
    const pocas = d.asistieron > 0 && d.asistieron < POCAS;
    const terceras = d.terceras ? ` · ${d.terceras} ${d.terceras === 1 ? 'es' : 'son'} la 3ª o más` : '';
    const abrir = (que, rotulo) => (onVer ? () => onVer(que, `${rotulo} · ${fila.largo}`, { llamada: fila.clave }) : null);
    return (
        <div className="cc-ll" role="row" data-aparte={fila.aparte ? '1' : undefined} style={{ '--c': fila.color }}>
            <span className="cc-ll-nombre" role="rowheader"
                title={`${fila.largo}: ${d.ventas} ventas y ${d.senas} señas de ${d.asistieron} llamadas con show up${terceras}`}>
                <i className="cc-punto" style={{ background: fila.color }} />{fila.nombre}
            </span>
            <Cuenta n={d.asistieron} rotulo={`Asistieron, ${fila.largo}`} onClick={abrir('asistieron', 'Asistieron')} />
            <Cuenta n={d.ventas} rotulo={`Ventas, ${fila.largo}`} onClick={abrir('ventas', 'Ventas')} />
            <span className="cc-ll-tasa" role="cell" title={`${d.ventas} de ${d.asistieron} llamadas con show up`}>
                {fila.aparte ? <b className="cc-ll-pct cc-ll-pct--pocas num">—</b> : (
                    <>
                        <b className={`cc-ll-pct${pocas ? ' cc-ll-pct--pocas' : ''} num`}>{pctTexto(ahora)}</b>
                        {pocas && <small className="num">{d.ventas} de {d.asistieron}</small>}
                    </>
                )}
            </span>
            <span className="cc-ll-antes" role="cell"
                title={p ? `${vs || 'Período comparado'}: ${p.ventas} de ${p.asistieron}` : undefined}>
                {p && !fila.aparte && p.asistieron > 0 && (
                    <><small className="num">{pctTexto(antes)}</small><Delta actual={ahora} previo={antes} /></>
                )}
            </span>
        </div>
    );
};

const CierrePorLlamada = ({ porLlamada, previo, vsLabel, onVer }) => {
    if (!porLlamada) return null;
    const filas = FILAS.filter(f => porLlamada[f.clave] && (!f.aparte || porLlamada[f.clave].asistieron > 0));
    return (
        <div className="cc-llamadas" role="table" aria-label="Close rate por llamada">
            {/* El título va en su renglón: al lado de «Asistieron» no entra en el panel angosto. */}
            <span className="cc-ll-tit" role="caption">
                Por llamada
                <Tip titulo="Por llamada" texto="Primera o segunda según a cuántas llamadas ya asistió el lead." />
            </span>
            <div className="cc-ll cc-ll--cab" role="row">
                <span role="columnheader" />
                <small role="columnheader">Asistieron</small>
                <small role="columnheader">Ventas</small>
                <small role="columnheader">Close rate</small>
                <small role="columnheader">{previo ? 'Antes' : ''}</small>
            </div>
            {filas.map(f => (
                <Fila key={f.clave} fila={f} d={porLlamada[f.clave]} p={previo?.[f.clave]} onVer={onVer} vs={vsLabel} />
            ))}
        </div>
    );
};

export default CierrePorLlamada;
