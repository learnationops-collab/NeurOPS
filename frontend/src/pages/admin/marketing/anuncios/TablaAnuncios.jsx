import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Link2, Search } from 'lucide-react';
import Cifra from '../../../comercial/components/Cifra';
import { Tip } from '../../../comercial/components/Shared';
import SerieDiaria from './SerieDiaria';
import { COLUMNAS, formatear, ordenar, serieDe, textoMeta, totalesDe } from './metricas';

/**
 * La tabla de anuncios de Marketing, al estilo del Administrador de anuncios de Meta: una fila por
 * palabra clave de ManyChat, los totales del período arriba (KPIs) y abajo (fila de resultados), y el
 * gráfico por día de las filas elegidas (o de todas). Los números de cada fila los arma el backend
 * (`anuncios_service.tablero`); acá se filtran, se ordenan y se suman.
 */

const Kpi = ({ titulo, valor, sub, tip, i }) => {
    const reducir = useReducedMotion();
    return (
        <motion.section className="kpi mk-kpi"
            initial={reducir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: i * 0.05, ease: [0.22, 0.7, 0.2, 1] }}>
            <div className="kpi-cab">
                <p className="t-eyebrow">{titulo}</p>
                <Tip texto={tip} titulo={titulo} />
            </div>
            <div className="kpi-cifra">
                <Cifra valor={valor} className="kpi-n" desdeAnterior />
                <p className="kpi-sub">{sub}</p>
            </div>
        </motion.section>
    );
};

const Flecha = ({ orden, clave }) => {
    if (orden.clave !== clave) return null;
    return orden.dir === 'desc' ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />;
};

const Punto = ({ meta }) => {
    const estado = !meta?.anuncios ? 'sin' : meta.activos ? 'activo' : 'pausado';
    const titulo = { sin: 'Sin anuncio en Meta', activo: 'Con anuncios activos en Meta', pausado: 'Sus anuncios de Meta no están activos' }[estado];
    return <i className={`mk-punto mk-punto--${estado}`} title={titulo} aria-label={titulo} role="img" />;
};

// Un gasto en cero de una palabra clave sin anuncio en Meta no es un dato medido: «—», no «$0.00».
const sinMedir = (fila, col) => col.key === 'gasto' && !fila.gasto && fila.meta && !fila.meta.anuncios;

const Celda = ({ fila, col, moneda }) => (
    <td className="mk-num num">
        <span className="mk-valor">{sinMedir(fila, col) ? '—' : formatear(fila[col.key], col.formato, moneda)}</span>
        {col.pct && <span className="mk-pct">{formatear(fila[col.pct], 'pct')}</span>}
    </td>
);

const TablaAnuncios = ({ datos, onArchivar, irAMeta }) => {
    const [busqueda, setBusqueda] = useState('');
    const [verArchivados, setVerArchivados] = useState(false);
    const [orden, setOrden] = useState({ clave: 'entrantes', dir: 'desc' });
    const [elegidas, setElegidas] = useState(() => new Set());
    const moneda = datos.moneda;

    const archivados = datos.filas.filter((f) => f.archivado).length;
    const visibles = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        const filas = datos.filas.filter((f) => (verArchivados || !f.archivado)
            && (!texto || (f.nombre || '').toLowerCase().includes(texto) || (f.clave || '').toLowerCase().includes(texto)));
        return ordenar(filas, orden.clave, orden.dir);
    }, [datos.filas, busqueda, verArchivados, orden]);

    const claveDe = (f) => f.clave ?? '__sin';
    const elegidasVisibles = visibles.filter((f) => elegidas.has(claveDe(f)));
    const totales = useMemo(() => totalesDe(visibles), [visibles]);
    const paraElGrafico = elegidasVisibles.length ? elegidasVisibles : visibles;
    const serie = useMemo(() => serieDe(paraElGrafico, datos.desde, datos.hasta), [paraElGrafico, datos.desde, datos.hasta]);
    const alcance = elegidasVisibles.length
        ? (elegidasVisibles.length === 1 ? elegidasVisibles[0].nombre : `${elegidasVisibles.length} palabras clave elegidas`)
        : 'Todas las palabras clave de la tabla';

    const alternar = (fila) => setElegidas((prev) => {
        const nuevo = new Set(prev);
        if (nuevo.has(claveDe(fila))) nuevo.delete(claveDe(fila));
        else nuevo.add(claveDe(fila));
        return nuevo;
    });
    const todasElegidas = visibles.length > 0 && elegidasVisibles.length === visibles.length;
    const elegirTodas = () => setElegidas(todasElegidas ? new Set() : new Set(visibles.map(claveDe)));

    const ordenarPor = (clave, menor) => setOrden((o) => (o.clave === clave
        ? { clave, dir: o.dir === 'desc' ? 'asc' : 'desc' }
        : { clave, dir: clave === 'nombre' || menor ? 'asc' : 'desc' }));
    const ariaOrden = (clave) => (orden.clave === clave ? (orden.dir === 'desc' ? 'descending' : 'ascending') : 'none');

    // Debajo del nombre, sus anuncios de Meta. «Sin anuncio en Meta» solo dice algo cuando Meta está
    // conectado: antes de conectarlo lo dirían todas las filas.
    const sub = (f, meta) => (f.clave === null ? 'Webhooks que llegaron sin palabra clave'
        : meta || (datos.meta?.conectado ? 'Sin anuncio en Meta (orgánico o sin asociar)' : null));

    const conGasto = totales.gasto > 0;
    const kpis = [
        { titulo: 'Leads entrantes', valor: formatear(totales.entrantes, 'num'),
          sub: `${formatear(totales.pct_calificados, 'pct')} calificados · ${formatear(totales.pct_no_calificados, 'pct')} no`,
          tip: 'Personas que llegaron por las palabras clave de la tabla, y qué parte calificó.' },
        { titulo: 'Importe gastado', valor: formatear(totales.gasto, 'money', moneda),
          sub: conGasto ? `${formatear(totales.cpl, 'money', moneda)} por lead · ${formatear(totales.cpl_calificado, 'money', moneda)} por calificado` : 'Sin gasto cargado en el período',
          tip: 'Lo que gastó Meta Ads en los anuncios asociados a estas palabras clave.' },
        { titulo: 'Agendas', valor: formatear(totales.agendas, 'num'),
          sub: conGasto ? `${formatear(totales.costo_agenda, 'money', moneda)} por agenda` : 'Costo por agenda: —',
          tip: 'Agendas creadas en el período de personas que llegaron por estas palabras clave.' },
        { titulo: 'Ventas', valor: formatear(totales.ventas, 'num'),
          sub: conGasto ? `${formatear(totales.costo_venta, 'money', moneda)} por venta · ROAS ${formatear(totales.roas, 'veces')}` : `${formatear(totales.cobrado, 'money', moneda)} cobrado`,
          tip: 'Pagos completos y split pay del período de estas personas. ROAS: cobrado ÷ gastado.' },
    ];

    return (
        <div className="vista mk-vista">
            {!datos.meta?.conectado && (
                <div className="mk-aviso" role="status">
                    <Link2 size={16} aria-hidden="true" />
                    <p className="t-cap">
                        <b>El gasto todavía no llega de Meta Ads.</b> Sin él, los costos quedan en «—».
                        {' '}Mirá cómo conectarlo para que se actualice solo cada día.
                    </p>
                    <button type="button" className="btn btn--linea btn--sm" onClick={irAMeta}>Conectar Meta Ads</button>
                </div>
            )}

            <div className="pareja mk-kpis" style={{ '--min': '220px', '--g': 'var(--s4)' }}>
                {kpis.map((k, i) => <Kpi key={k.titulo} {...k} i={i} />)}
            </div>

            <SerieDiaria serie={serie} moneda={moneda} alcance={alcance} metaConectado={datos.meta?.conectado} />

            <section className="panel mk-panel-tabla">
                <div className="panel-cab mk-tabla-barra">
                    <div className="mk-cab-txt">
                        <h2 className="t-h3">Anuncios por palabra clave</h2>
                        <p className="t-cap mut40">
                            Cada palabra clave que llega de ManyChat es un anuncio. Elegí filas para ver solo esas en el gráfico.
                        </p>
                    </div>
                    <div className="panel-cab-der">
                        <label className="busca busca--sm mk-busca">
                            <Search aria-hidden="true" />
                            <input type="search" placeholder="Buscar palabra clave" value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar palabra clave" />
                        </label>
                        {archivados > 0 && (
                            <button type="button" className={`pastilla pastilla--sm${verArchivados ? ' pastilla--on' : ''}`}
                                aria-pressed={verArchivados} onClick={() => setVerArchivados((v) => !v)}>
                                <Archive aria-hidden="true" />
                                {verArchivados ? 'Ocultar archivadas' : `Ver archivadas (${archivados})`}
                            </button>
                        )}
                    </div>
                </div>

                <div className="mk-tabla-caja">
                    <table className="mk-tabla">
                        <thead>
                            <tr>
                                <th className="mk-col-sel" scope="col">
                                    <input type="checkbox" checked={todasElegidas} onChange={elegirTodas}
                                        aria-label="Elegir todas las filas para el gráfico" />
                                </th>
                                <th className="mk-col-nombre" scope="col" aria-sort={ariaOrden('nombre')}>
                                    <button type="button" className="mk-cab" onClick={() => ordenarPor('nombre')}>
                                        Palabra clave <Flecha orden={orden} clave="nombre" />
                                    </button>
                                </th>
                                {COLUMNAS.map((c) => (
                                    <th key={c.key} scope="col" className="mk-num" aria-sort={ariaOrden(c.key)}>
                                        <span className="mk-cab-celda">
                                            <Tip texto={c.ayuda} titulo={c.label} />
                                            <button type="button" className="mk-cab" onClick={() => ordenarPor(c.key, c.menor)}>
                                                {c.label} <Flecha orden={orden} clave={c.key} />
                                            </button>
                                        </span>
                                    </th>
                                ))}
                                <th className="mk-col-acc" scope="col"><span className="sr-only">Acciones</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibles.map((f) => {
                                const elegida = elegidas.has(claveDe(f));
                                const meta = textoMeta(f.meta);
                                return (
                                    <tr key={claveDe(f)} className={`${elegida ? 'mk-fila--elegida' : ''}${f.archivado ? ' mk-fila--archivada' : ''}`}>
                                        <td className="mk-col-sel">
                                            <input type="checkbox" checked={elegida} onChange={() => alternar(f)}
                                                aria-label={`Ver ${f.nombre} en el gráfico`} />
                                        </td>
                                        <td className="mk-col-nombre">
                                            <div className="mk-nombre">
                                                <Punto meta={f.meta} />
                                                <div className="mk-nombre-txt">
                                                    <span className="mk-nombre-kw trunc" title={f.nombre}>{f.nombre}</span>
                                                    {sub(f, meta) && (
                                                        <span className="mk-nombre-sub trunc" title={(f.meta?.nombres || []).join(' · ')}>
                                                            {sub(f, meta)}
                                                        </span>
                                                    )}
                                                </div>
                                                {f.archivado && <span className="chip mk-chip" style={{ '--c': 'var(--idle)' }}>Archivada</span>}
                                            </div>
                                        </td>
                                        {COLUMNAS.map((c) => <Celda key={c.key} fila={f} col={c} moneda={moneda} />)}
                                        <td className="mk-col-acc">
                                            {f.clave !== null && (
                                                <button type="button" className="ibtn ibtn--sm"
                                                    title={f.archivado ? 'Volver a mostrar' : 'Archivar: esconderla de la tabla'}
                                                    aria-label={f.archivado ? `Volver a mostrar ${f.nombre}` : `Archivar ${f.nombre}`}
                                                    onClick={() => onArchivar(f, !f.archivado)}>
                                                    {f.archivado ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!visibles.length && (
                                <tr>
                                    <td colSpan={COLUMNAS.length + 3} className="mk-vacio">
                                        {datos.filas.length
                                            ? 'Ninguna palabra clave coincide con la búsqueda.'
                                            : 'No llegó ningún lead por ManyChat en este período.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {visibles.length > 0 && (
                            <tfoot>
                                <tr className="mk-total">
                                    <td className="mk-col-sel" />
                                    <td className="mk-col-nombre">
                                        <span className="mk-total-rot">Resultados de {visibles.length} {visibles.length === 1 ? 'palabra clave' : 'palabras clave'}</span>
                                    </td>
                                    {COLUMNAS.map((c) => <Celda key={c.key} fila={totales} col={c} moneda={moneda} />)}
                                    <td className="mk-col-acc" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {(datos.sin_atribuir?.gasto_meta > 0 || datos.sin_atribuir?.agendas > 0) && (
                    <p className="t-cap mut40 mk-pie">
                        {datos.sin_atribuir.gasto_meta > 0 && (
                            <>Hay {formatear(datos.sin_atribuir.gasto_meta, 'money', moneda)} gastados en anuncios de Meta sin palabra clave (no suman en la tabla): asocialos en la pestaña Meta Ads. </>
                        )}
                        {datos.sin_atribuir.agendas > 0 && (
                            <>{formatear(datos.sin_atribuir.agendas, 'num')} agendas del período no vienen de una conversación de ManyChat (talleres, VSL, links directos).</>
                        )}
                    </p>
                )}
            </section>
        </div>
    );
};

export default TablaAnuncios;
