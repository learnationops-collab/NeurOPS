import { Button, EmptyState, Skeleton, SkeletonBlock, SkeletonCircle, SkeletonRow, SkeletonText } from '../../../components/standard';

/**
 * Lo que muestra Marketing mientras le falta un dato, con las clases y las medidas del contenido real
 * (medidas a 1330 px): al llegar el dato no se mueve nada de lo de arriba. Lo que no depende de los
 * datos (rótulos de los KPIs, títulos de los paneles, leyendas) se escribe de verdad desde el principio.
 */

/** Un KPI del tablero (`.kpi`) con su rótulo real; la cifra y el detalle son huesos. */
export const KpiEsqueleto = ({ titulo, className = 'kpi mk-kpi', lineas = 1, i = 0 }) => (
    <section className={className} aria-hidden="true">
        <div className="kpi-cab">
            <p className="t-eyebrow">{titulo}</p>
            <SkeletonCircle size={18} step={i} />
        </div>
        <div className="kpi-cifra">
            <SkeletonBlock height={36} width="58%" radius={10} step={i + 1} />
            <SkeletonText lines={lineas} height={9} lineHeight={16.8} width="86%" lastWidth="52%" step={i + 2} />
        </div>
    </section>
);

/** La fila de KPIs (`.pareja`, como la real) mientras no llegan las cifras. */
export const EsqueletoKpis = ({ titulos, label = 'Cargando los indicadores…', className = 'pareja mk-kpis', kpi, lineas }) => (
    <Skeleton label={label} className={className} style={{ '--min': '220px', '--g': 'var(--s4)' }}>
        {titulos.map((t, i) => <KpiEsqueleto key={t} titulo={t} className={kpi} lineas={lineas} i={i} />)}
    </Skeleton>
);

// Alturas fijas (no al azar) de las columnas del gráfico por día.
const COLUMNAS = [38, 52, 30, 64, 46, 72, 40, 58, 34, 80, 50, 62, 44, 70, 36, 56];

/** El gráfico de columnas por día (`Columnas`): tope, lienzo de 150 px y eje, del alto real. */
export const HuesosSerie = ({ barras = 30, step = 0 }) => (
    <div className="mk-serie" aria-hidden="true">
        <div className="mk-serie-tope"><SkeletonText width={48} height={8} lineHeight={16.5} step={step} /></div>
        <div className="mk-serie-lienzo">
            {Array.from({ length: barras }, (_, i) => (
                <span key={i} className="mk-serie-col">
                    <SkeletonBlock height={`${COLUMNAS[i % COLUMNAS.length]}%`} radius={3} step={step + 1 + (i % 12)} />
                </span>
            ))}
        </div>
        <div className="mk-serie-eje"><SkeletonText height={7} lineHeight={15.75} step={step + 2} /></div>
    </div>
);

/**
 * El panel de una tabla de Marketing (`.mk-panel-tabla`): título y bajada reales, la barra de la derecha
 * en huesos y `filas` renglones del alto de las filas reales (64 px).
 */
export const EsqueletoPanelTabla = ({ titulo, sub, label = 'Cargando la tabla…', filas = 8, alto = 64, barra = [260, 180] }) => (
    <Skeleton as="section" label={label} className="panel mk-panel-tabla">
        <div className="panel-cab mk-tabla-barra" aria-hidden="true">
            <div className="mk-cab-txt">
                <h2 className="t-h3">{titulo}</h2>
                {sub && <p className="t-cap mut40">{sub}</p>}
            </div>
            <div className="panel-cab-der">
                {barra.map((ancho, i) => <SkeletonBlock key={i} width={ancho} height={36} radius={999} step={i} />)}
            </div>
        </div>
        <div className="mk-tabla-caja" aria-hidden="true">
            <SkeletonRow cells={['16px', '50%', '44%', '40%', '44%', '36%', '40%']} height={alto}
                columns="28px minmax(220px, 2.4fr) repeat(5, minmax(0, 1fr))" style={{ padding: '0 12px' }} />
            {Array.from({ length: filas }, (_, i) => (
                <SkeletonRow key={i} cells={['16px', `${56 + ((i * 13) % 30)}%`, '52%', '38%', '46%', '30%', '42%']}
                    height={alto} step={i + 1}
                    columns="28px minmax(220px, 2.4fr) repeat(5, minmax(0, 1fr))" style={{ padding: '0 12px' }} />
            ))}
        </div>
    </Skeleton>
);

/** Si la PRIMERA carga de un bloque falla: el motivo y «Reintentar», nunca un esqueleto eterno. */
export const ErrorDeCarga = ({ titulo, onReintentar, children = 'Revisá la conexión y volvé a intentar.' }) => (
    <section className="panel">
        <EmptyState title={titulo} action={onReintentar ? <Button onClick={onReintentar}>Reintentar</Button> : null}>
            {children}
        </EmptyState>
    </section>
);
