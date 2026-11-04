import { Tip } from '../../../comercial/components/Shared';
import { CifraConCuenta } from '../../../../components/standard';
import Diferencia from './Diferencia';
import { TITULO_DE } from './comparacion';
import { COLOR_SEGMENTO, esCero, filaSinDatos, numero, pctDe, tipoDeDiferencia, tonoDeTasa, valorDe } from './segmentos';

/**
 * La tabla de UN grupo (una fuente, un closer, un origen…): una fila por segmento y la del total, con las cifras del
 * embudo y de la plata. Cada cifra abre la lista de lo que la suma, ya cortada por ese segmento
 * (`onVer(metrica, titulo, segmento, nombre, previo)`); el % de show up y de cierre dice su cuenta en un tooltip. Con un
 * período comparado, cada cifra trae su diferencia y un «antes N» que abre la lista del período comparado.
 *
 * `plano`: sin su propia tarjeta (dentro de un desplegable, el de Segmentos de Todos).
 *
 * Una cifra sin dato (los leads de Workshop por segmento: son clics anónimos; los de un closer: un lead no tiene closer)
 * se ve «—» y no abre nada.
 *
 * Lectura rápida (04/11/2026): los segmentos sin nada en ninguna columna no se dibujan (un pie dice cuántos) y cada número
 * lleva el color de su segmento, más fuerte cuanto más alto es frente al resto de su columna; el cero se apaga.
 */
const Celda = ({ columna, fila, referencia, moneda, abrir, maximo = 0, color = null }) => {
    const pct = pctDe(columna, fila);
    const tono = tonoDeTasa(columna, fila, referencia);
    const sinDato = fila[columna.key] === null || fila[columna.key] === undefined;
    const cuenta = columna.base && !sinDato ? {
        a: { t: valorDe(columna, fila, moneda), m: columna.lista, titulo: TITULO_DE[columna.lista] },
        b: { t: `${fila[columna.base]} ${columna.baseTexto}`, m: columna.baseLista, titulo: TITULO_DE[columna.baseLista] },
    } : null;
    // El ticket es una cifra sola: su cuenta («New Cash de N ventas») va en el tooltip de la cifra misma.
    const delTicket = columna.key === 'ticket' && !sinDato ? {
        a: { t: valorDe({ key: 'new_cash', dinero: true }, fila, moneda), m: 'new_cash', titulo: TITULO_DE.new_cash },
        b: { t: `${fila.ventas} ventas`, m: 'ventas', titulo: TITULO_DE.ventas },
    } : null;
    const quieta = esCero(fila[columna.key]);
    const intensidad = maximo > 0 ? Math.sqrt(Math.min(1, numero(fila[columna.key]) / maximo)) : 0;
    const clase = quieta ? 'sg-celda--cero' : (color ? 'sg-celda--calor' : '');
    return (
        <div className={`sg-celda sg-celda--llena ${clase}`.trim()} style={quieta || !color ? undefined : { '--sg-i': intensidad.toFixed(3), '--sg-c': color }}>
            <CifraConCuenta cuenta={delTicket} metrica={sinDato ? null : columna.lista} titulo={TITULO_DE[columna.lista]}
                onVer={sinDato ? null : abrir} className="t-body num td-fuerte">
                {valorDe(columna, fila, moneda)}
            </CifraConCuenta>
            {pct && (
                <span className={`sg-pct t-cap${tono ? ` sg-pct--${tono}` : ''}`}>
                    <CifraConCuenta cuenta={cuenta} metrica={columna.lista} titulo={TITULO_DE[columna.lista]} onVer={abrir}>{pct}</CifraConCuenta>
                    {columna.pctRotulo ? ` ${columna.pctRotulo}` : ''}
                    {fila.delta?.[columna.pct] && (
                        <Diferencia delta={fila.delta[columna.pct]} previo={fila.previo[columna.pct]} tipo="pp" />
                    )}
                </span>
            )}
            {fila.delta?.[columna.key] && (
                <Diferencia delta={fila.delta[columna.key]} previo={fila.previo[columna.key]} tipo={tipoDeDiferencia(columna)} moneda={moneda}
                    onVerPrevio={fila.previo[columna.key] ? () => abrir(columna.lista, TITULO_DE[columna.lista], true) : null} />
            )}
        </div>
    );
};

const Fila = ({ fila, columnas, plantilla, color, referencia, moneda, onVer, maximos = {}, total = false }) => {
    const abrir = (metrica, titulo, previo = false) => onVer(metrica, titulo, fila.segmento ?? '', total ? '' : fila.label, previo);
    return (
        <div className={`sg-fila${total ? ' sg-fila--total' : ''}`} style={plantilla} role="row">
            <div className="sg-nombre" role="rowheader">
                {color && <i className="sg-punto" style={{ background: color }} aria-hidden="true" />}
                <span className="t-body td-fuerte">{fila.label}</span>
            </div>
            {columnas.map((c) => (
                <Celda key={c.key} columna={c} fila={fila} referencia={referencia} moneda={moneda} abrir={abrir}
                    maximo={maximos[c.key] || 0} color={total ? null : color} />
            ))}
        </div>
    );
};

const TablaSegmentos = ({ grupo, color, columnas, moneda, onVer, nota = null, plano = false }) => {
    const plantilla = { gridTemplateColumns: `minmax(130px,1.1fr) repeat(${columnas.length},minmax(96px,1fr))`,
        minWidth: `${130 + columnas.length * 100}px` };
    const Envoltorio = plano ? 'div' : 'section';
    const claves = columnas.map((c) => c.key);
    const filas = grupo.filas.filter((f) => !filaSinDatos(f, claves));
    const ocultos = grupo.filas.length - filas.length;
    // El más alto de cada columna entre los segmentos que se ven: con eso se gradúa el color.
    const maximos = Object.fromEntries(claves.map((k) => [k, Math.max(0, ...filas.map((f) => numero(f[k])))]));
    return (
        <Envoltorio className={plano ? 'sg-plano' : 'panel sg-panel'} aria-label={`${grupo.label} por segmento`}>
            {!plano && (
                <div className="panel-cab">
                    <div className="mk-cab-txt">
                        <p className="t-eyebrow mut"><i className="td-punto" style={{ background: color }} aria-hidden="true" />{grupo.label}</p>
                        <h2 className="t-h3">{grupo.label} por segmento</h2>
                    </div>
                </div>
            )}
            <div className="sg-tabla" role="table" aria-label={`${grupo.label}: cifras por segmento`}>
                <div className="sg-fila sg-fila--cab t-eyebrow mut" style={plantilla} role="row">
                    <span role="columnheader">Segmento</span>
                    {columnas.map((c) => (
                        <span key={c.key} role="columnheader">{c.label} <Tip texto={c.ayuda} titulo={c.label} /></span>
                    ))}
                </div>
                {filas.map((f) => (
                    <Fila key={f.segmento} fila={f} columnas={columnas} plantilla={plantilla} color={COLOR_SEGMENTO[f.segmento]}
                        referencia={grupo.total} moneda={moneda} onVer={onVer} maximos={maximos} />
                ))}
                <Fila fila={grupo.total} columnas={columnas} plantilla={plantilla} referencia={null} moneda={moneda} onVer={onVer} total />
            </div>
            {ocultos > 0 && (
                <p className="sg-ocultos t-eyebrow mut">
                    {ocultos === 1 ? '1 segmento sin datos oculto' : `${ocultos} segmentos sin datos ocultos`}
                </p>
            )}
            {nota && <p className="t-cap mut">{nota}</p>}
        </Envoltorio>
    );
};

export default TablaSegmentos;
