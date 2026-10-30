import { Tip } from '../../../comercial/components/Shared';
import useEstadoGuardado from '../../../../hooks/useEstadoGuardado';
import { SETTING, WORKSHOP, TITULO_DE, anchosDe, diferenciaDe, formatos, ganadorDe } from './comparacion';
import { Accordion, CifraConCuenta } from '../../../../components/standard';
import MarcaDeBase from '../anuncios/MarcaDeBase';

/**
 * «Métrica por métrica» de Todos: cada cifra con la de Setting y la de Workshop lado a lado (con su barra,
 * relativa a la mayor de las dos) y quién gana. Los grupos (Embudo, Plata, Costos) son desplegables, no pestañas
 * (Kerwin, 29/10/2026): cerrados dicen cuántas filas gana cada fuente, y lo que se dejó abierto se recuerda.
 *
 * El nombre de la fuente va en la cabecera de columna, en su color; las cifras van neutras y solo la que gana
 * toma el color de su fuente. Las filas resaltadas son tasas o costos, que comparan eficiencia sin importar el
 * tamaño de cada embudo; las de volumen no tienen ganador.
 */
const CLAVE_ABIERTOS = 'mk_todos_detalle_abiertos';

const Valor = ({ texto, cuenta, metrica, onVer, ancho, fuente, gana }) => (
    <div className={`td-valor${gana ? ' td-valor--gana' : ''}`} data-fuente={fuente.label} style={{ '--c': fuente.color }}>
        <CifraConCuenta cuenta={cuenta} metrica={metrica} titulo={TITULO_DE[metrica]} onVer={onVer} className="t-body num td-cifra-t">
            {texto}
        </CifraConCuenta>
        <div className="td-pista"><i style={{ width: ancho }} /></div>
    </div>
);

const Fila = ({ fila, f, onVer }) => {
    const gana = ganadorDe(fila);
    const { s, w } = anchosDe(fila);
    const nombre = gana === SETTING.key ? SETTING.label : WORKSHOP.label;
    const color = gana === SETTING.key ? SETTING.color : WORKSHOP.color;
    return (
        <div className={`td-fila${fila.tipo === 'vol' ? '' : ' td-fila--tasa'}`}>
            <div className="td-fila-nombre" data-tip={fila.hint || undefined}>
                <span className="t-body td-fuerte">{fila.label}</span>
                {fila.hint && <span className="t-cap mut">{fila.hint}</span>}
                {fila.marca && (
                    <span className="td-marcas">
                        <MarcaDeBase base={fila.marca[0]} color={SETTING.color} />
                        <MarcaDeBase base={fila.marca[1]} color={WORKSHOP.color} />
                    </span>
                )}
            </div>
            <Valor texto={f[fila.fmt](fila.s)} cuenta={fila.ds} metrica={fila.metrica} ancho={s} fuente={SETTING} gana={gana === SETTING.key}
                onVer={onVer ? (m, t) => onVer('setting', m, t) : null} />
            <Valor texto={f[fila.fmt](fila.w)} cuenta={fila.dw} metrica={fila.metrica} ancho={w} fuente={WORKSHOP} gana={gana === WORKSHOP.key}
                onVer={onVer ? (m, t) => onVer('workshop', m, t) : null} />
            <div className="td-fila-gana">
                {gana ? (
                    <span className="td-gana num" style={{ color }} data-tip={`Gana ${nombre}`} tabIndex={0} aria-label={`Gana ${nombre}: ${diferenciaDe(fila)}`}>
                        {diferenciaDe(fila)}
                    </span>
                ) : fila.tipo !== 'vol' && <span className="t-cap mut40">Sin dato</span>}
            </div>
        </div>
    );
};

/** Las dos fuentes con su nombre en su color, una vez por grupo abierto (el nombre no se repite en cada cifra). */
const Cabecera = () => (
    <div className="td-fila td-fila--cab t-eyebrow" aria-hidden="true">
        <span className="mut">Métrica</span>
        <span style={{ color: SETTING.color }}>{SETTING.label}</span>
        <span style={{ color: WORKSHOP.color }}>{WORKSHOP.label}</span>
        <span className="td-der mut">Gana</span>
    </div>
);

/** Cuántas filas gana cada fuente: lo que se lee con el grupo cerrado. */
const Ganadas = ({ filas }) => {
    const gana = (key) => filas.filter((x) => ganadorDe(x) === key).length;
    return (
        <>
            {[SETTING, WORKSHOP].map((fuente) => (
                <span key={fuente.key} className="td-ganadas" data-tip={`Filas que gana ${fuente.label}`}>
                    <i style={{ background: fuente.color }} aria-hidden="true" />{fuente.label} <b className="num">{gana(fuente.key)}</b>
                </span>
            ))}
        </>
    );
};

const MetricaPorMetrica = ({ grupos, moneda, onVer }) => {
    const [guardado, poner] = useEstadoGuardado(CLAVE_ABIERTOS, { abiertos: grupos.map((g) => g.id) }, {
        normalizar: (m, ini) => ({ ...m, abiertos: Array.isArray(m.abiertos) ? m.abiertos : ini.abiertos }),
    });
    const f = formatos(moneda);
    const items = grupos.map((g) => ({
        key: g.id, title: g.titulo, meta: <Ganadas filas={g.filas} />,
        children: () => (
            <div className="td-grupo" role="group" aria-label={g.titulo}>
                <Cabecera />
                {g.filas.map((fila) => <Fila key={fila.id} fila={fila} f={f} onVer={onVer} />)}
            </div>
        ),
    }));
    return (
        <section className="td-detalle" aria-label="Métrica por métrica">
            <Accordion items={items} value={guardado.abiertos} onChange={(abiertos) => poner({ abiertos })} />
            <p className="t-cap mut">
                Resaltadas: tasas y costos (comparan eficiencia). Las de volumen no tienen ganador.{' '}
                <Tip texto="Un costo sin ventas, agendas o shows en el período no tiene con qué dividirse: queda sin dato y no gana." titulo="Sin dato" />
            </p>
        </section>
    );
};

export default MetricaPorMetrica;
