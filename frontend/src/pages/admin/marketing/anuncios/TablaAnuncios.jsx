import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ChevronRight, Link2, Pencil, Search } from 'lucide-react';
import Cifra from '../../../comercial/components/Cifra';
import { Segmented, Tip } from '../../../comercial/components/Shared';
import SerieDiaria from './SerieDiaria';
import EditorAgrupacion from './EditorAgrupacion';
import {
    COLUMNAS, NIVELES, SIN_CAMPANA, agruparFilas, claveDeAnuncio, claveDeCampana, claveDeConjunto, formatear,
    ordenar, serieDe, textoMeta, totalesDe,
} from './metricas';

/**
 * La tabla de anuncios de Marketing, al estilo del Administrador de anuncios de Meta: tres niveles
 * (Campañas › Conjuntos › Anuncios, 15/10/2026), los totales del período arriba (KPIs) y abajo (fila de
 * resultados), y el gráfico por día de lo elegido (o de todo). Elegir campañas filtra los conjuntos y los
 * anuncios; elegir conjuntos filtra los anuncios, como en Meta. Un anuncio es una palabra clave de ManyChat.
 *
 * Los números de cada palabra clave los arma el backend (`anuncios_service.tablero`), con su campaña y su
 * conjunto; acá se filtran, se agrupan (`agruparFilas`), se ordenan y se suman.
 */

export const Kpi = ({ titulo, valor, sub, tip, i }) => {
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
const sinMedir = (fila, col) => col.key === 'gasto' && !fila.gasto
    && (fila.meta ? !fila.meta.anuncios : fila.medido === false);

const Celda = ({ fila, col, moneda }) => (
    <td className="mk-num num">
        <span className="mk-valor">{sinMedir(fila, col) ? '—' : formatear(fila[col.key], col.formato, moneda)}</span>
        {col.pct && <span className="mk-pct">{formatear(fila[col.pct], 'pct')}</span>}
    </td>
);

const NOMBRE_DEL_NIVEL = { campanas: 'Campaña', conjuntos: 'Conjunto', anuncios: 'Palabra clave' };
const UNIDAD = {
    campanas: ['campaña', 'campañas', 'elegidas'], conjuntos: ['conjunto', 'conjuntos', 'elegidos'],
    anuncios: ['palabra clave', 'palabras clave', 'elegidas'],
};
const ORIGEN = { meta: 'Meta', manual: 'a mano', anterior: 'carga vieja' };

const vacio = () => ({ campanas: new Set(), conjuntos: new Set(), anuncios: new Set() });

const TablaAnuncios = ({ datos, onArchivar, onAgrupar, irAMeta }) => {
    const [busqueda, setBusqueda] = useState('');
    const [verArchivados, setVerArchivados] = useState(false);
    const [orden, setOrden] = useState({ clave: 'entrantes', dir: 'desc' });
    const [nivel, setNivel] = useState('anuncios');
    const [elegidas, setElegidas] = useState(vacio);
    const [editando, setEditando] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const moneda = datos.moneda;

    const archivados = datos.filas.filter((f) => f.archivado).length;
    // Las palabras clave que entran: sin las archivadas y con la búsqueda (que mira también su campaña y su
    // conjunto, así «guía» encuentra el conjunto «Guía Perú»).
    const base = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        return datos.filas.filter((f) => (verArchivados || !f.archivado)
            && (!texto || [f.nombre, f.clave, f.campana, f.conjunto].some((x) => (x || '').toLowerCase().includes(texto))));
    }, [datos.filas, busqueda, verArchivados]);
    // En cascada, como en Meta: las campañas elegidas acotan los conjuntos, y estos los anuncios.
    const deCampanas = useMemo(() => (elegidas.campanas.size
        ? base.filter((f) => elegidas.campanas.has(claveDeCampana(f.campana))) : base), [base, elegidas.campanas]);
    const deConjuntos = useMemo(() => (elegidas.conjuntos.size
        ? deCampanas.filter((f) => elegidas.conjuntos.has(claveDeConjunto(f.campana, f.conjunto))) : deCampanas),
    [deCampanas, elegidas.conjuntos]);

    const idDe = (f) => (nivel === 'anuncios' ? claveDeAnuncio(f) : f.id);
    const visibles = useMemo(() => {
        let filas;
        if (nivel === 'campanas') filas = agruparFilas(base, 'campanas');
        else if (nivel === 'conjuntos') {
            filas = agruparFilas(deCampanas, 'conjuntos');
            if (elegidas.campanas.size) filas = filas.filter((g) => elegidas.campanas.has(claveDeCampana(g.campana)));
        } else filas = deConjuntos;
        return ordenar(filas, orden.clave, orden.dir);
    }, [nivel, base, deCampanas, deConjuntos, elegidas.campanas, orden]);

    const delNivel = elegidas[nivel];
    const elegidasVisibles = visibles.filter((f) => delNivel.has(idDe(f)));
    const totales = useMemo(() => totalesDe(visibles), [visibles]);
    // El gráfico: las palabras clave de lo elegido en este nivel o, sin elección, las de la tabla.
    const paraElGrafico = useMemo(() => {
        if (!delNivel.size) return nivel === 'campanas' ? base : nivel === 'conjuntos' ? deCampanas : deConjuntos;
        if (nivel === 'campanas') return base.filter((f) => delNivel.has(claveDeCampana(f.campana)));
        if (nivel === 'conjuntos') return deCampanas.filter((f) => delNivel.has(claveDeConjunto(f.campana, f.conjunto)));
        return deConjuntos.filter((f) => delNivel.has(claveDeAnuncio(f)));
    }, [nivel, delNivel, base, deCampanas, deConjuntos]);
    const serie = useMemo(() => serieDe(paraElGrafico, datos.desde, datos.hasta), [paraElGrafico, datos.desde, datos.hasta]);
    const [uno, varios, elegidasTxt] = UNIDAD[nivel];
    const alcance = elegidasVisibles.length
        ? (elegidasVisibles.length === 1 ? elegidasVisibles[0].nombre : `${elegidasVisibles.length} ${varios} ${elegidasTxt}`)
        : `Todas las ${UNIDAD.anuncios[1]} de la tabla`;

    const alternar = (fila) => setElegidas((prev) => {
        const nuevo = new Set(prev[nivel]);
        if (nuevo.has(idDe(fila))) nuevo.delete(idDe(fila));
        else nuevo.add(idDe(fila));
        return { ...prev, [nivel]: nuevo };
    });
    const todasElegidas = visibles.length > 0 && elegidasVisibles.length === visibles.length;
    const elegirTodas = () => setElegidas((prev) => ({
        ...prev, [nivel]: todasElegidas ? new Set() : new Set(visibles.map(idDe)),
    }));
    // Tocar el nombre de una campaña o de un conjunto baja al nivel siguiente con solo ese elegido.
    const abrir = (grupo) => {
        if (nivel === 'campanas') {
            setElegidas({ ...vacio(), campanas: new Set([grupo.id]) });
            setNivel('conjuntos');
        } else {
            setElegidas((prev) => ({ ...prev, conjuntos: new Set([grupo.id]), anuncios: new Set() }));
            setNivel('anuncios');
        }
    };

    const guardarAgrupacion = async (campana, conjunto) => {
        setGuardando(true);
        try {
            if (await onAgrupar(editando, campana, conjunto)) setEditando(null);
        } finally {
            setGuardando(false);
        }
    };

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
                        <h2 className="t-h3">Campañas, conjuntos y anuncios</h2>
                        <p className="t-cap mut40">
                            Cada palabra clave que llega de ManyChat es un anuncio. Elegí filas para filtrar el nivel siguiente y el gráfico.
                        </p>
                    </div>
                    <div className="panel-cab-der">
                        <Segmented chico ariaLabel="Nivel de la tabla" valor={nivel} onChange={setNivel}
                            opciones={NIVELES.map((n) => ({ ...n, cuenta: elegidas[n.key].size || null }))} />
                        <label className="busca busca--sm mk-busca">
                            <Search aria-hidden="true" />
                            <input type="search" placeholder="Buscar" value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar palabra clave, campaña o conjunto" />
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
                                        {NOMBRE_DEL_NIVEL[nivel]} <Flecha orden={orden} clave="nombre" />
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
                            {nivel !== 'anuncios' && visibles.map((g) => {
                                const elegida = delNivel.has(g.id);
                                const detalle = nivel === 'campanas'
                                    ? `${g.conjuntos} ${g.conjuntos === 1 ? 'conjunto' : 'conjuntos'} · ${g.palabras} ${g.palabras === 1 ? 'palabra clave' : 'palabras clave'}`
                                    : `${g.campana ?? SIN_CAMPANA} · ${g.palabras} ${g.palabras === 1 ? 'palabra clave' : 'palabras clave'}`;
                                return (
                                    <tr key={g.id} className={elegida ? 'mk-fila--elegida' : ''}>
                                        <td className="mk-col-sel">
                                            <input type="checkbox" checked={elegida} onChange={() => alternar(g)}
                                                aria-label={`Elegir ${g.nombre}`} />
                                        </td>
                                        <td className="mk-col-nombre">
                                            <button type="button" className="mk-nombre mk-abrir" onClick={() => abrir(g)}
                                                title={`Ver ${nivel === 'campanas' ? 'sus conjuntos' : 'sus palabras clave'}`}>
                                                <div className="mk-nombre-txt">
                                                    <span className="mk-nombre-kw trunc" title={g.nombre}>{g.nombre}</span>
                                                    <span className="mk-nombre-sub trunc">
                                                        {detalle}{g.origenes.length === 1 && ` · ${ORIGEN[g.origenes[0]]}`}
                                                    </span>
                                                </div>
                                                <ChevronRight className="mk-abrir-flecha" size={15} aria-hidden="true" />
                                            </button>
                                        </td>
                                        {COLUMNAS.map((c) => <Celda key={c.key} fila={g} col={c} moneda={moneda} />)}
                                        <td className="mk-col-acc" />
                                    </tr>
                                );
                            })}
                            {nivel === 'anuncios' && visibles.map((f) => {
                                const elegida = delNivel.has(claveDeAnuncio(f));
                                const meta = textoMeta(f.meta);
                                return (
                                    <tr key={claveDeAnuncio(f)} className={`${elegida ? 'mk-fila--elegida' : ''}${f.archivado ? ' mk-fila--archivada' : ''}`}>
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
                                                    {f.clave !== null && (
                                                        <button type="button" className="mk-agrupar trunc" onClick={() => setEditando(f)}
                                                            title={f.agrupacion ? `Campaña y conjunto (${ORIGEN[f.agrupacion]}): cambiarlos` : 'Elegir campaña y conjunto'}>
                                                            <Pencil size={11} aria-hidden="true" />
                                                            {f.campana ? `${f.campana} › ${f.conjunto ?? 'Sin conjunto'}` : 'Sin campaña · elegir'}
                                                        </button>
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
                                            ? 'Nada coincide con la búsqueda o con lo elegido.'
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
                                        <span className="mk-total-rot">Resultados de {visibles.length} {visibles.length === 1 ? uno : varios}</span>
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

            {editando && (
                <EditorAgrupacion fila={editando} opciones={datos.agrupaciones || []} guardando={guardando}
                    onGuardar={guardarAgrupacion} onAutomatica={() => guardarAgrupacion(null, null)}
                    onCerrar={() => setEditando(null)} />
            )}
        </div>
    );
};

export default TablaAnuncios;
