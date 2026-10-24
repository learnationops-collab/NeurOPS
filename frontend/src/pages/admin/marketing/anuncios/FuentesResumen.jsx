import { Check } from 'lucide-react';
import { Skeleton, SkeletonBlock, SkeletonText } from '../../../../components/standard';
import { Tip } from '../../../comercial/components/Shared';
import { Kpi } from './TablaAnuncios';
import { GRUPOS_COMPARACION, ganadoraDe } from './fuentes';
import { formatear } from './metricas';
import './fuentes.css';

/**
 * Marketing por fuente (Setting y Workshop), con las mismas cifras en las dos para ver cuál rinde más
 * (Kerwin, 23/10/2026). Las cuentas, y qué cuenta cada cifra, en `app/services/fuentes_service.py`.
 *
 * `TarjetasFuente`: las ocho cifras de UNA fuente (la vista Setting o Workshop). `CompararFuentes`: las
 * dos lado a lado (la vista General), con una marca en la que rinde más de cada tasa. Con `fuentes` en
 * null el tablero todavía no llegó y se dibuja el esqueleto.
 *
 * ROAS New Cash = venta nueva del período ÷ gastado. ROAS Total = todo lo cobrado de los clientes que
 * trajo la fuente (cuotas, upsells, ventas de meses anteriores) ÷ gastado.
 */
const TITULOS = ['Leads entrantes', 'Importe gastado', 'Agendas', 'Ventas', 'New Cash', 'Cash total', 'ROAS New Cash', 'ROAS Total'];

export const EsqueletoTarjetasFuente = () => (
    <Skeleton label="Cargando la fuente…" className="pareja mk-fuente-kpis" style={{ '--min': '170px', '--g': 'var(--s4)' }}>
        {TITULOS.map((t, i) => (
            <div key={t} className="kpi mk-kpi" aria-hidden="true">
                <p className="t-eyebrow">{t}</p>
                <SkeletonText width={90} height={18} lineHeight={26} step={i} />
                <SkeletonText width={130} height={9} lineHeight={17} step={i + 1} />
            </div>
        ))}
    </Skeleton>
);

export const TarjetasFuente = ({ fuente, moneda }) => {
    if (!fuente) return <EsqueletoTarjetasFuente />;
    const dinero = (v) => formatear(v, 'money', moneda);
    const veces = (v) => formatear(v, 'veces');
    const kpis = [
        { titulo: TITULOS[0], valor: formatear(fuente.leads, 'num'), sub: `${dinero(fuente.cpl)} por lead`,
          tip: GRUPOS_COMPARACION[0].filas[0].ayuda },
        { titulo: TITULOS[1], valor: dinero(fuente.gasto), sub: `${fuente.anuncios} ${fuente.anuncios === 1 ? 'anuncio' : 'anuncios'} en Meta`,
          tip: 'Gasto de Meta de los anuncios del embudo.' },
        { titulo: TITULOS[2], valor: formatear(fuente.agendas, 'num'),
          sub: `${dinero(fuente.costo_agenda)} por agenda · show up ${fuente.pct_show_up === null ? '—' : `${fuente.pct_show_up}%`}`,
          tip: 'Personas con agenda creada en el período. El show up es el % que asistió.' },
        { titulo: TITULOS[3], valor: formatear(fuente.ventas, 'num'), sub: `${dinero(fuente.costo_venta)} por venta`,
          tip: 'Pagos de venta nueva (completo o split) del período.' },
        { titulo: TITULOS[4], valor: dinero(fuente.new_cash), sub: 'venta nueva del período',
          tip: 'Lo cobrado en pagos de venta nueva (completo + split).' },
        { titulo: TITULOS[5], valor: dinero(fuente.cash_total),
          sub: `con ${fuente.cuotas} ${fuente.cuotas === 1 ? 'cuota' : 'cuotas'} y upsells`,
          tip: 'Todo lo cobrado del período de los clientes que trajo la fuente, aunque la venta sea de antes.' },
        { titulo: TITULOS[6], valor: veces(fuente.roas_new_cash), sub: 'New Cash / gastado',
          tip: 'Solo la venta nueva del período, sobre lo gastado. Sin gasto no hay ROAS.' },
        { titulo: TITULOS[7], valor: veces(fuente.roas_total), sub: 'Cash total / gastado',
          tip: 'Todo lo cobrado de los clientes de la fuente, sobre lo gastado.' },
    ];
    return (
        <div className="pareja mk-fuente-kpis" style={{ '--min': '170px', '--g': 'var(--s4)' }}>
            {kpis.map((k, i) => <Kpi key={k.titulo} {...k} i={i} />)}
        </div>
    );
};

const EsqueletoComparar = () => (
    <Skeleton as="section" label="Cargando Setting y Workshop…" className="panel mk-comparar">
        <div className="mk-cab-txt" aria-hidden="true"><SkeletonText width={220} height={16} lineHeight={24} /></div>
        <SkeletonBlock height={220} step={2} />
    </Skeleton>
);

const valorDe = (fila, f, moneda) => {
    const base = formatear(f[fila.key], fila.formato, moneda);
    if (fila.pct && f[fila.pct] !== null && f[fila.pct] !== undefined) return `${base} · ${f[fila.pct]}%`;
    if (fila.monto && f[fila.monto]) return `${base} · ${formatear(f[fila.monto], 'money', moneda)}`;
    return base;
};

export const CompararFuentes = ({ fuentes, moneda }) => {
    if (!fuentes) return <EsqueletoComparar />;
    return (
        <section className="panel mk-comparar" aria-labelledby="mk-comparar-titulo">
            <div className="panel-cab">
                <div className="mk-cab-txt">
                    <p className="t-eyebrow">Mismos datos, dos embudos</p>
                    <h2 className="t-h3" id="mk-comparar-titulo">Setting vs Workshop</h2>
                </div>
                <p className="t-cap mut40 mk-comparar-nota">
                    <Check size={12} aria-hidden="true" /> marca el que rinde más en cada tasa
                </p>
            </div>
            <table className="mk-cmp">
                <thead>
                    <tr>
                        <th scope="col" className="mk-cmp-nombre">Fuente</th>
                        {fuentes.map((f) => <th key={f.key} scope="col" className="mk-cmp-num">{f.label}</th>)}
                    </tr>
                </thead>
                {GRUPOS_COMPARACION.map((g) => (
                    <tbody key={g.titulo}>
                        <tr className="mk-fuentes-grupo"><th scope="rowgroup" colSpan={fuentes.length + 1}>{g.titulo}</th></tr>
                        {g.filas.map((fila) => {
                            const gana = ganadoraDe(fila, fuentes);
                            return (
                                <tr key={fila.key}>
                                    <th scope="row" className="mk-cmp-nombre">
                                        <span className="mk-fuentes-rotulo">{fila.label}<Tip texto={fila.ayuda} titulo={fila.label} /></span>
                                    </th>
                                    {fuentes.map((f) => (
                                        <td key={f.key} className={`mk-cmp-num num${gana === f.key ? ' mk-gana' : ''}`}>
                                            <span className="mk-cmp-val">
                                                {gana === f.key && <Check size={12} aria-label="Rinde más" />}
                                                {valorDe(fila, f, moneda)}
                                            </span>
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                ))}
            </table>
        </section>
    );
};
