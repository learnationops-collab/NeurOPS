import { useMemo } from 'react';
import { Tags } from 'lucide-react';
import { Skeleton, SkeletonBlock, SkeletonCircle, SkeletonText } from '../../../../components/standard';
import { Tip } from '../../../comercial/components/Shared';
import { HuesosSerie } from '../esqueletos';
import EnlaceMeta from './EnlaceMeta';
import { enlaceAdministrador } from './enlacesMeta';
import { Columnas } from './SerieDiaria';
import { EMBUDOS, dinero, formatear, serieDeEmbudos } from './metricas';

/**
 * Rendimiento › Todo: cuánto se gastó en Meta en cada embudo del período (Kerwin, 15/10/2026: «así
 * puedo ver cómo se va gastando en workshop, cómo se va gastando en setting»). Una tarjeta por embudo
 * (Setting y Workshop abren su vista) y el gasto de cada día apilado por embudo. El embudo de cada
 * anuncio lo pone la sincronización y se corrige en la pestaña Meta Ads («Clasificar anuncios»,
 * `meta_ads_service.detectar_embudo`); «Abrir Meta» va al Administrador de anuncios de verdad.
 *
 * `embudos` en null es que el tablero todavía no llegó: se dibuja su esqueleto.
 */
/** Mientras no llegó el tablero: el rótulo y las dos tarjetas que siempre están (Setting y Workshop) con
 *  su nombre; las cifras, la barra y el gráfico son huesos del alto real. */
const EsqueletoEmbudos = () => (
    <Skeleton as="section" label="Cargando el gasto por embudo…" className="panel mk-embudos">
        <div className="panel-cab" aria-hidden="true">
            <div className="mk-cab-txt">
                <p className="t-eyebrow">Gasto en Meta por embudo</p>
                <SkeletonText width={210} height={16} lineHeight={24} />
            </div>
        </div>
        <div className="pareja mk-embudos-tarjetas" style={{ '--min': '170px', '--g': 'var(--s3)' }} aria-hidden="true">
            {EMBUDOS.slice(0, 2).map((e, i) => (
                <div key={e.key} className="tarjeta mk-embudo">
                    <span className="mk-embudo-cab">
                        <i style={{ background: e.color }} />
                        <span className="t-eyebrow">{e.label}</span>
                        <SkeletonCircle size={18} step={i} />
                    </span>
                    <SkeletonText width={96} height={18} lineHeight={24.2} step={i + 1} />
                    <SkeletonText width={150} height={9} lineHeight={17.4} step={i + 2} />
                    <SkeletonBlock height={4} radius={99} step={i + 3} />
                </div>
            ))}
        </div>
        <div className="mk-embudos-serie" aria-hidden="true">
            <div className="panel-cab-der mk-leyenda"><SkeletonText width={170} height={9} lineHeight={18} step={3} /></div>
            <HuesosSerie step={3} />
        </div>
    </Skeleton>
);

const SIN = { key: 'sin', label: 'Sin clasificar', color: 'var(--mk-resto)', ayuda: 'Anuncios que no dicen adónde llevan: se clasifican a mano en Meta Ads.' };

const EmbudosResumen = ({ embudos, desde, hasta, moneda, cuentas, onElegir, irAMeta }) => {
    const cargando = embudos == null;
    const porClave = useMemo(() => Object.fromEntries((embudos || []).map((e) => [e.embudo || 'sin', e])), [embudos]);
    const total = (embudos || []).reduce((s, e) => s + e.gasto, 0);
    const tarjetas = [...EMBUDOS, SIN].filter((e) => e.key === 'setting' || e.key === 'workshop' || porClave[e.key]?.gasto);
    const capas = tarjetas.filter((e) => porClave[e.key]?.gasto);
    const dias = useMemo(() => serieDeEmbudos(embudos || [], desde, hasta), [embudos, desde, hasta]);

    if (cargando) return <EsqueletoEmbudos />;

    return (
        <section className="panel mk-embudos" aria-labelledby="mk-embudos-titulo">
            <div className="panel-cab">
                <div className="mk-cab-txt">
                    <p className="t-eyebrow">Gasto en Meta por embudo</p>
                    <h2 className="t-h3" id="mk-embudos-titulo">{formatear(total, 'money', moneda)} en el período</h2>
                </div>
                <div className="panel-cab-der">
                    {porClave.sin?.gasto > 0 && (
                        <button type="button" className="btn btn--linea btn--sm" onClick={irAMeta}
                            title="Elegir el embudo de los anuncios sin clasificar, en la pestaña Meta Ads">
                            <Tags aria-hidden="true" />
                            Clasificar anuncios
                        </button>
                    )}
                    <EnlaceMeta href={enlaceAdministrador(cuentas?.[0])}>Abrir Meta</EnlaceMeta>
                </div>
            </div>
            <div className="pareja mk-embudos-tarjetas" style={{ '--min': '170px', '--g': 'var(--s3)' }}>
                {tarjetas.map((e) => {
                    const fila = porClave[e.key] || { gasto: 0, anuncios: 0 };
                    const pct = total ? Math.round((fila.gasto / total) * 100) : 0;
                    const abre = e.key === 'setting' || e.key === 'workshop';
                    const Contenido = (
                        <>
                            <span className="mk-embudo-cab">
                                <i style={{ background: e.color }} aria-hidden="true" />
                                <span className="t-eyebrow">{e.label}</span>
                                <Tip texto={e.ayuda} titulo={e.label} />
                            </span>
                            <span className="mk-embudo-n num">{formatear(fila.gasto, 'money', moneda)}</span>
                            <span className="t-cap mut40">{pct}% del gasto · {fila.anuncios} anuncios</span>
                            <span className="mk-embudo-barra" aria-hidden="true"><i style={{ width: `${pct}%`, background: e.color }} /></span>
                        </>
                    );
                    return abre ? (
                        <button key={e.key} type="button" className="tarjeta mk-embudo mk-embudo--abre" onClick={() => onElegir(e.key)}
                            aria-label={`Ver ${e.label}: ${formatear(fila.gasto, 'money', moneda)}`}>
                            {Contenido}
                        </button>
                    ) : (
                        <div key={e.key} className="tarjeta mk-embudo">{Contenido}</div>
                    );
                })}
            </div>
            <div className="mk-embudos-serie">
                <div className="panel-cab-der mk-leyenda" aria-label="Leyenda">
                    {capas.map((c) => <span key={c.key}><i style={{ background: c.color }} />{c.label}</span>)}
                </div>
                <Columnas dias={dias} capas={capas} formato={(v) => dinero(v, moneda)}
                    etiqueta="Gasto en Meta por día y por embudo" vacio="Meta no registró gasto en estos días." />
            </div>
        </section>
    );
};

export default EmbudosResumen;
