import { Skeleton, SkeletonText } from '../../../../components/standard';
import { Kpi } from './TablaAnuncios';
import { GRUPOS_COMPARACION } from './fuentes';
import { formatear } from './metricas';
import './fuentes.css';

/**
 * Marketing por fuente (Setting y Workshop), con las mismas cifras en las dos para ver cuál rinde más
 * (Kerwin, 23/10/2026). Las cuentas, y qué cuenta cada cifra, en `app/services/fuentes_service.py`.
 *
 * `TarjetasFuente`: las ocho cifras de UNA fuente (la vista Setting o Workshop). La comparación de las dos
 * vive en «Todos» (`todos/`). Con `fuente` en null el tablero todavía no llegó y se dibuja el esqueleto.
 *
 * ROAS New Cash = venta nueva del período ÷ gastado. ROAS Total = todo lo cobrado de los clientes que
 * trajo la fuente (cuotas, upsells, ventas de meses anteriores) ÷ gastado.
 */
const TITULOS = ['Leads entrantes', 'Importe gastado', 'Agendas', 'Ventas', 'New Cash', 'Cash total', 'ROAS New Cash', 'ROAS Total'];
// `sinRepetidos` (la vista Setting, que ya tiene los KPIs de su tabla arriba): solo lo que la tabla no dice, la
// asistencia y la plata. Un rótulo sale una sola vez en la pantalla (Kerwin, 28/10/2026).
const SIN_REPETIDOS = ['Show up', ...TITULOS.slice(4)];

export const EsqueletoTarjetasFuente = ({ sinRepetidos = false }) => (
    <Skeleton label="Cargando la fuente…" className={`pareja mk-fuente-kpis${sinRepetidos ? ' mk-fuente-kpis--cinco' : ''}`} style={{ '--min': '170px', '--g': 'var(--s4)' }}>
        {(sinRepetidos ? SIN_REPETIDOS : TITULOS).map((t, i) => (
            <div key={t} className="kpi mk-kpi" aria-hidden="true">
                <p className="t-eyebrow">{t}</p>
                <SkeletonText width={90} height={18} lineHeight={26} step={i} />
                <SkeletonText width={130} height={9} lineHeight={17} step={i + 1} />
            </div>
        ))}
    </Skeleton>
);

// Qué lista abre cada tarjeta de una fuente (`fuentes_registros_service.METRICAS`).
const LISTA_DE = { 'Leads entrantes': 'leads', 'Importe gastado': 'gasto', 'Agendas': 'agendas', 'Ventas': 'ventas', 'New Cash': 'new_cash', 'Cash total': 'cash_total',
    'ROAS New Cash': 'new_cash', 'ROAS Total': 'cash_total', 'Show up': 'reportadas' };

export const TarjetasFuente = ({ fuente, moneda, sinRepetidos = false, onVer = null }) => {
    if (!fuente) return <EsqueletoTarjetasFuente sinRepetidos={sinRepetidos} />;
    const dinero = (v) => formatear(v, 'money', moneda);
    const veces = (v) => formatear(v, 'veces');
    const kpis = [
        { titulo: TITULOS[0], valor: formatear(fuente.leads, 'num'), sub: `${dinero(fuente.cpl)} por lead`,
          tip: GRUPOS_COMPARACION[0].filas[0].ayuda },
        { titulo: TITULOS[1], valor: dinero(fuente.gasto), sub: `${fuente.anuncios} ${fuente.anuncios === 1 ? 'anuncio' : 'anuncios'} en Meta`,
          tip: 'Gasto de Meta de los anuncios del embudo.' },
        { titulo: TITULOS[2], valor: formatear(fuente.agendas, 'num'),
          sub: `${dinero(fuente.costo_agenda)} por agenda · show up ${fuente.pct_show_up === null ? '—' : `${fuente.pct_show_up}%`}`,
          tip: 'Personas con agenda creada en el período. Show up: asistieron ÷ citas con resultado.' },
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
    const showUp = { titulo: 'Show up', valor: fuente.pct_show_up === null ? '—' : `${fuente.pct_show_up}%`,
        sub: `${formatear(fuente.show_up, 'num')} de ${formatear(fuente.reportadas, 'num')} citas con resultado`,
        tip: 'Asistieron ÷ citas con resultado (asistieron + no show).' };
    const mostradas = sinRepetidos ? [showUp, ...kpis.slice(4)] : kpis;
    return (
        <div className={`pareja mk-fuente-kpis${sinRepetidos ? ' mk-fuente-kpis--cinco' : ''}`} style={{ '--min': '170px', '--g': 'var(--s4)' }}>
            {mostradas.map((k, i) => (
                <Kpi key={k.titulo} {...k} i={i}
                    onVer={onVer && LISTA_DE[k.titulo] ? () => onVer(LISTA_DE[k.titulo], k.titulo) : undefined} />
            ))}
        </div>
    );
};
