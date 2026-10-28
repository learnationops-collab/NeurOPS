import { useState } from 'react';
import { Segmented, Tip } from '../../../comercial/components/Shared';
import { SETTING, WORKSHOP, anchosDe, diferenciaDe, formatos, ganadorDe } from './comparacion';

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

const Valor = ({ texto, detalle, ancho, color, gana, onVer }) => (
    <div className="td-valor">
        {onVer ? (
            <button type="button" className="td-lado td-lado--valor" onClick={onVer} title="Ver la lista de lo que suma">
                <span className={`t-body num${gana ? ' td-fuerte' : ''}`}>{texto}</span>
                {detalle && <span className="td-det">{detalle}</span>}
            </button>
        ) : (
            <>
                <span className={`t-body num${gana ? ' td-fuerte' : ''}`}>{texto}</span>
                {detalle && <span className="td-det">{detalle}</span>}
            </>
        )}
        <div className="td-pista"><i style={{ width: ancho, background: color }} /></div>
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
            <Valor texto={f[fila.fmt](fila.s)} detalle={fila.ds} ancho={s} color={SETTING.color} gana={gana === SETTING.key}
                onVer={fila.metrica && onVer ? () => onVer('setting', fila.metrica, fila.label) : null} />
            <Valor texto={f[fila.fmt](fila.w)} detalle={fila.dw} ancho={w} color={WORKSHOP.color} gana={gana === WORKSHOP.key}
                onVer={fila.metrica && onVer ? () => onVer('workshop', fila.metrica, fila.label) : null} />
            <div className="td-fila-gana">
                {gana ? (
                    <>
                        <span className="chip" style={{ '--c': 'var(--success)' }} title={`Gana ${nombre}`}>
                            <i className="td-punto" style={{ background: color }} aria-hidden="true" />{nombre}
                        </span>
                        <span className="t-cap mut">{diferenciaDe(fila)}</span>
                    </>
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
                <span>Métrica</span><span>Setting</span><span>Workshop</span><span className="td-der">Gana</span>
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
