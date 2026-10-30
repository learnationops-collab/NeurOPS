import { CifraConCuenta, Skeleton, SkeletonBlock } from '../../../../components/standard';
import { SETTING, WORKSHOP, TITULO_DE, embudoNormalizado, tarjetasDe } from './comparacion';
import MarcaDeBase from '../anuncios/MarcaDeBase';

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

// Las tasas de un paso del embudo, cada una con su cuenta en el tooltip: «6,6%» y, en el show up, también «61,9% con resultado».
const Tasas = ({ paso, lado, fuente, onVer }) => {
    const principal = paso[`${lado}r`];
    const segunda = paso[`${lado}r2`];
    return (
        <span className="td-tasas">
            <CifraConCuenta color={fuente.color} rotulo={fuente.label} cuenta={principal.cuenta} metrica={paso.metrica} titulo={TITULO_DE[paso.metrica]} onVer={onVer}>{principal.pct}</CifraConCuenta>
            {segunda && (
                <span className="td-tasa2">
                    <CifraConCuenta color={fuente.color} rotulo={fuente.label} cuenta={segunda.cuenta} onVer={onVer}>{segunda.pct}</CifraConCuenta> {segunda.rotulo}
                </span>
            )}
        </span>
    );
};

const ResumenTodos = ({ grupos, setting, workshop, moneda, onVer, rango = null }) => {
    const tarjetas = tarjetasDe(grupos, moneda);
    const pasos = embudoNormalizado(setting, workshop);
    const ver = (fuente) => (onVer ? (metrica, titulo) => onVer(fuente, metrica, titulo) : null);
    return (
        <div className="vista mk-vista">
            <section className="td-tarjetas td-tarjetas--cinco" aria-label="Lo que más separa a Setting de Workshop">
                {tarjetas.map((k) => (
                    <div key={k.id} className="panel td-tarjeta">
                        <p className="t-eyebrow mut td-rotulo">{k.label}{k.id.startsWith('roas') && (
                            <MarcaDeBase base="periodo" color="var(--text-muted)" detalle={k.id === 'roas_total' ? 'incluye cuotas de antes' : 'solo venta nueva'} />
                        )}</p>
                        <div className="td-tarjeta-cifra">
                            <span className="t-h2 num" style={{ color: k.color }} data-tip={k.winner === 'Sin ganador' ? 'Sin ganador' : `Gana ${k.winner}`}
                                tabIndex={0} aria-label={`${k.big}. ${k.winner === 'Sin ganador' ? k.winner : `Gana ${k.winner}`}`}>{k.big}</span>
                        </div>
                        <div className="td-tarjeta-pie">
                            <CifraConCuenta color={SETTING.color} rotulo={SETTING.label} cuenta={k.sd} metrica={k.metrica} titulo={TITULO_DE[k.metrica]} onVer={ver('setting')}>{k.s}</CifraConCuenta>
                            <CifraConCuenta color={WORKSHOP.color} rotulo={WORKSHOP.label} cuenta={k.wd} metrica={k.metrica} titulo={TITULO_DE[k.metrica]} onVer={ver('workshop')}>{k.w}</CifraConCuenta>
                        </div>
                    </div>
                ))}
            </section>

            <section className="panel td-embudo" aria-labelledby="td-embudo-titulo">
                <div className="mk-cab-txt">
                    <p className="t-eyebrow mut">Embudo normalizado</p>
                    <h2 className="t-h3" id="td-embudo-titulo">De cada 1.000 leads, cuántos llegan a cada paso</h2>
                    <p className="t-cap mut">La barra es la cifra llevada a 1.000 leads; a la derecha, la cuenta real y contra qué se divide.</p>
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
                                    <span className="td-cifra num" title={p.st}><b style={{ color: SETTING.color }}>{p.s}</b><small>por 1.000 leads</small></span>
                                    <Tasas paso={p} lado="s" fuente={SETTING} onVer={ver('setting')} />
                                </div>
                                <div className="td-paso-fila">
                                    <Barra color={WORKSHOP.color} ancho={p.ww} />
                                    <span className="td-cifra num" title={p.wt}><b style={{ color: WORKSHOP.color }}>{p.w}</b><small>por 1.000 leads</small></span>
                                    <Tasas paso={p} lado="w" fuente={WORKSHOP} onVer={ver('workshop')} />
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
