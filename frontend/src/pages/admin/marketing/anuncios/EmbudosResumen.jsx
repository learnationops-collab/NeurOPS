import { useMemo } from 'react';
import { Tags } from 'lucide-react';
import { Bars } from '../../../../components/standard';
import EnlaceMeta from './EnlaceMeta';
import { enlaceAdministrador } from './enlacesMeta';
import { Columnas } from './SerieDiaria';
import { EMBUDOS, dinero, formatear, serieDeEmbudos } from './metricas';

/**
 * Rendimiento › Todo: cuánto se gastó en Meta en cada embudo del período (Kerwin, 15/10/2026: «así
 * puedo ver cómo se va gastando en workshop, cómo se va gastando en setting»). Una fila por embudo
 * (Setting y Workshop abren su vista) y el gasto de cada día apilado por embudo. El embudo de cada
 * anuncio lo pone la sincronización y se corrige en la pestaña Meta Ads («Clasificar anuncios»,
 * `meta_ads_service.detectar_embudo`); «Abrir Meta» va al Administrador de anuncios de verdad.
 */
const SIN = { key: 'sin', label: 'Sin clasificar', color: 'var(--mk-resto)', ayuda: 'Anuncios que no dicen adónde llevan: se clasifican a mano en Meta Ads.' };

const EmbudosResumen = ({ embudos, desde, hasta, moneda, cuentas, onElegir, irAMeta }) => {
    const porClave = useMemo(() => Object.fromEntries((embudos || []).map((e) => [e.embudo || 'sin', e])), [embudos]);
    const total = (embudos || []).reduce((s, e) => s + e.gasto, 0);
    const tarjetas = [...EMBUDOS, SIN].filter((e) => e.key === 'setting' || e.key === 'workshop' || porClave[e.key]?.gasto);
    const capas = tarjetas.filter((e) => porClave[e.key]?.gasto);
    const dias = useMemo(() => serieDeEmbudos(embudos, desde, hasta), [embudos, desde, hasta]);

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
            <Bars variant="rows" className="mk-embudos-filas" label="Gasto por embudo" onSelect={onElegir} items={tarjetas.map((e) => {
                const fila = porClave[e.key] || { gasto: 0, anuncios: 0 };
                const abre = e.key === 'setting' || e.key === 'workshop';
                return {
                    key: e.key, label: e.label, color: e.color, value: fila.gasto, display: formatear(fila.gasto, 'money', moneda),
                    detail: `${total ? Math.round((fila.gasto / total) * 100) : 0}% del gasto · ${fila.anuncios} anuncios`,
                    tip: e.ayuda ? `${e.label}|${e.ayuda}` : undefined, disabled: !abre, title: abre ? `Ver ${e.label}` : undefined,
                };
            })} />
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
