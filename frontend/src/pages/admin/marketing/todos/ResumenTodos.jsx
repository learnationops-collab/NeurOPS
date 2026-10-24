import { Skeleton, SkeletonBlock } from '../../../../components/standard';
import { SETTING, WORKSHOP, embudoNormalizado, tarjetasDe } from './comparacion';

/**
 * «Resumen» de Todos: las cuatro cifras que más separan a Setting de Workshop (quién gana y por cuánto)
 * y el embudo normalizado a 1.000 leads, que deja comparar dos embudos de distinto tamaño.
 */
export const EsqueletoResumen = () => (
    <Skeleton label="Cargando la comparación…" className="vista mk-vista">
        <div className="td-tarjetas" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={150} step={i} />)}
        </div>
        <SkeletonBlock height={320} step={2} />
    </Skeleton>
);

const Barra = ({ color, ancho }) => (
    <div className="td-barra-embudo" style={{ width: ancho, background: color }} />
);

const ResumenTodos = ({ grupos, setting, workshop, moneda }) => {
    const tarjetas = tarjetasDe(grupos, moneda);
    const pasos = embudoNormalizado(setting, workshop);
    return (
        <div className="vista mk-vista">
            <section className="td-tarjetas" aria-label="Lo que más separa a Setting de Workshop">
                {tarjetas.map((k) => (
                    <div key={k.id} className="panel td-tarjeta">
                        <p className="t-eyebrow mut">{k.label}</p>
                        <div className="td-tarjeta-cifra">
                            <span className="t-h2 num">{k.big}</span>
                            <span className="td-ganador"><i style={{ background: k.color }} aria-hidden="true" />{k.winner}</span>
                        </div>
                        <div className="td-tarjeta-pie t-cap mut">
                            <span>Setting {k.s}</span><span>Workshop {k.w}</span>
                        </div>
                    </div>
                ))}
            </section>

            <section className="panel td-embudo" aria-labelledby="td-embudo-titulo">
                <div className="mk-cab-txt">
                    <p className="t-eyebrow mut">Embudo normalizado</p>
                    <h2 className="t-h3" id="td-embudo-titulo">De cada 1.000 leads, cuántos llegan a cada paso</h2>
                </div>
                <div className="td-pasos">
                    {pasos.map((p) => (
                        <div key={p.label} className="td-paso">
                            <div className="td-paso-nombre">
                                <span className="t-body td-fuerte">{p.label}</span>
                                <span className="t-cap mut">{p.paso}</span>
                            </div>
                            <div className="td-paso-barras">
                                <div className="td-paso-fila">
                                    <Barra color={SETTING.color} ancho={p.sw} />
                                    <span className="t-sm td-fuerte num">{p.s}</span>
                                    <span className="t-cap mut">{p.sr}</span>
                                </div>
                                <div className="td-paso-fila">
                                    <Barra color={WORKSHOP.color} ancho={p.ww} />
                                    <span className="t-sm td-fuerte num">{p.w}</span>
                                    <span className="t-cap mut">{p.wr}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default ResumenTodos;
