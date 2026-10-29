import { useState } from 'react';
import { Segmented, Tip } from '../../../comercial/components/Shared';
import { SETTING, WORKSHOP, TITULO_DE, anchosDe, diferenciaDe, formatos, ganadorDe } from './comparacion';
import { CifraConCuenta } from '../../../../components/standard';

/**
 * «Métrica por métrica» de Todos: cada cifra con la de Setting y la de Workshop lado a lado (con su barra,
 * relativa a la mayor de las dos) y quién gana. Las filas resaltadas son tasas o costos, que comparan
 * eficiencia sin importar el tamaño de cada embudo; las de volumen no tienen ganador.
 */
const FILTROS = [
    { key: 'todo', label: 'Todo' },
    { key: 'embudo', label: 'Embudo' },
    { key: 'plata', label: 'Plata' },
    { key: 'costos', label: 'Costos' },
];

const Valor = ({ texto, cuenta, metrica, onVer, ancho, fuente, gana }) => (
    <div className="td-valor">
        <CifraConCuenta color={fuente.color} rotulo={fuente.label} cuenta={cuenta} metrica={metrica} titulo={TITULO_DE[metrica]} onVer={onVer}
            className={`t-body num${gana ? ' td-fuerte' : ''}`}>
            {texto}
        </CifraConCuenta>
        <div className="td-pista"><i style={{ width: ancho, background: fuente.color }} /></div>
    </div>
);

const Fila = ({ fila, f, onVer }) => {
    const gana = ganadorDe(fila);
    const { s, w } = anchosDe(fila);
    const nombre = gana === SETTING.key ? SETTING.label : WORKSHOP.label;
    const color = gana === SETTING.key ? SETTING.color : WORKSHOP.color;
    return (
        <div className={`td-fila${fila.tipo === 'vol' ? '' : ' td-fila--tasa'}`}>
            <div className="td-fila-nombre">
                <span className="t-body td-fuerte">{fila.label}</span>
                {fila.hint && <span className="t-cap mut">{fila.hint}</span>}
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
                ) : <span className="t-cap mut40">{fila.tipo === 'vol' ? 'Volumen' : 'Sin dato'}</span>}
            </div>
        </div>
    );
};

const MetricaPorMetrica = ({ grupos, moneda, onVer }) => {
    const [filtro, setFiltro] = useState('todo');
    const f = formatos(moneda);
    const vistos = grupos.filter((g) => filtro === 'todo' || g.id === filtro);
    return (
        <section className="panel td-detalle" aria-labelledby="td-detalle-titulo">
            <div className="panel-cab">
                <div className="mk-cab-txt">
                    <p className="t-eyebrow mut">Detalle</p>
                    <h2 className="t-h3" id="td-detalle-titulo">Métrica por métrica</h2>
                </div>
                <div className="panel-cab-der">
                    <Segmented chico opciones={FILTROS} valor={filtro} onChange={setFiltro} ariaLabel="Qué métricas ver" />
                </div>
            </div>

            <div className="td-fila td-fila--cab t-eyebrow mut" aria-hidden="true">
                <span>Métrica</span>
                <span className="td-fuente" style={{ '--c': SETTING.color }} data-tip={SETTING.label} aria-label={SETTING.label}><i /></span>
                <span className="td-fuente" style={{ '--c': WORKSHOP.color }} data-tip={WORKSHOP.label} aria-label={WORKSHOP.label}><i /></span>
                <span className="td-der">Gana</span>
            </div>
            {vistos.map((g) => (
                <div key={g.id} className="td-grupo" role="group" aria-label={g.titulo}>
                    <p className="t-eyebrow td-grupo-titulo">{g.titulo}</p>
                    {g.filas.map((fila) => <Fila key={fila.id} fila={fila} f={f} onVer={onVer} />)}
                </div>
            ))}
            <p className="t-cap mut">
                Las filas resaltadas son tasas o costos: comparan eficiencia sin importar el tamaño de cada embudo.
                Las de volumen no tienen ganador. <Tip texto="Un costo sin ventas, agendas o shows en el período no tiene con qué dividirse: queda sin dato y no gana." titulo="Sin dato" />
            </p>
        </section>
    );
};

export default MetricaPorMetrica;
