import { useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Archive, CircleDollarSign, Eye, Link2, Power, Search } from 'lucide-react';
import Cifra from '../../../comercial/components/Cifra';
import { CifraConCuenta } from '../../../../components/standard';
import { Segmented, Tip } from '../../../comercial/components/Shared';
import SerieDiaria from './SerieDiaria';
import EditorAgrupacion from './EditorAgrupacion';
import CobradoDelPeriodo from './CobradoDelPeriodo';
import HerramientasTabla from './HerramientasTabla';
import { Borde, Encabezado, Flecha } from './CeldasTabla';
import { FilaAnuncio, FilaGrupo, PieDeResultados } from './FilasAnuncios';
import CajaDeTabla, { BotonPantallaCompleta } from './CajaDeTabla';
import EstadoDeMeta from './EstadoDeMeta';
import { usePantallaCompleta } from './usePantallaCompleta';
import { columnasDelCsv } from './columnasTabla';
import { useVistaDeColumnas } from './useVistaDeColumnas';
import { useFiltrosTabla } from './useFiltrosTabla';
import { clavesUnicas } from './clavesUnicas';
import { referenciasDe } from './tonos';
import { usarFormulas } from './formulas';
import { cuentaDe } from '../todos/comparacion';
import LeyendaTonos from './LeyendaTonos';
import TarjetasAnuncios, { SelectorModo } from './TarjetasAnuncios';
import { useModoVista } from '../../../../components/listas/useModoVista';
import { useVerRegistros } from '../../../../components/standard';
import { contenidoDeKpi } from './registrosDeKpi';
import { EsqueletoKpis, EsqueletoPanelTabla } from '../esqueletos';
import {
    NIVELES, SIN_CAMPANA, agruparFilas, claveDeAnuncio, claveDeCampana, claveDeConjunto, formatear,
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

// `onVer`: el ojo de la tarjeta abre las filas que suman su cifra (`useVerRegistros`), como en Closing.
// `cuenta` ({ a, b } de `cuentaDe`): la cifra va sola y su «N de M» en un tooltip con cada parte clicable (`onCuenta`).
export const Kpi = ({ titulo, valor, sub, tip, i, onVer, cuenta = null, onCuenta = null, marca = null, color = null, rotulo = null }) => {
    const reducir = useReducedMotion();
    const cifra = <Cifra valor={valor} className="kpi-n" desdeAnterior />;
    return (
        <motion.section className="kpi mk-kpi"
            initial={reducir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: i * 0.05, ease: [0.22, 0.7, 0.2, 1] }}>
            <div className="kpi-cab">
                <p className="t-eyebrow">{titulo}</p>
                <Tip texto={tip} titulo={titulo} />
                {marca}
                {onVer && (
                    <button type="button" className="mk-kpi-ver" onClick={onVer} aria-label={`Ver los registros de ${titulo}`}
                        data-tip="Ver las filas que suman esta cifra">
                        <Eye size={15} aria-hidden="true" />
                    </button>
                )}
            </div>
            <div className="kpi-cifra">
                {cuenta ? <CifraConCuenta cuenta={cuenta} onVer={onCuenta} color={color} rotulo={rotulo}>{cifra}</CifraConCuenta> : cifra}
                {sub && <p className="kpi-sub">{sub}</p>}
            </div>
        </motion.section>
    );
};

const NOMBRE_DEL_NIVEL = { campanas: 'Campaña', conjuntos: 'Conjunto', anuncios: 'Palabra clave' };
const UNIDAD = {
    campanas: ['campaña', 'campañas', 'elegidas'], conjuntos: ['conjunto', 'conjuntos', 'elegidos'],
    anuncios: ['palabra clave', 'palabras clave', 'elegidas'],
};

const vacio = () => ({ campanas: new Set(), conjuntos: new Set(), anuncios: new Set() });

const KPIS = ['Leads entrantes', 'Importe gastado', 'Agendas', 'Ventas'];
const TITULO = 'Campañas, conjuntos y anuncios';
const BAJADA = 'Cada palabra clave que llega de ManyChat es un anuncio. Elegí filas para filtrar el nivel siguiente y el gráfico.';
const ALCANCE_INICIAL = `Todas las ${UNIDAD.anuncios[1]} de la tabla`;

/** La tabla mientras no llegó el tablero: KPIs, los dos gráficos y la tabla con sus títulos reales. */
export const EsqueletoTablaAnuncios = ({ bajoKpis = null }) => (
    <div className="vista mk-vista">
        <EsqueletoKpis titulos={KPIS} lineas={2} label="Cargando los indicadores de los anuncios…" />
        {bajoKpis}
        <EsqueletoPanelTabla titulo={TITULO} sub={BAJADA} label="Cargando la tabla de anuncios…" />
        <SerieDiaria serie={null} alcance={ALCANCE_INICIAL} />
    </div>
);

// `bajoKpis`: lo que va entre los KPIs y el resto (el gasto por embudo, en «Todo»).
// `agendasDeFuente`: con «Contar por: fecha de reunión» la tarjeta Agendas es la de Setting en esa base (la de Closing).
const TablaAnuncios = ({ datos, onArchivar, onAgrupar, irAMeta, estadoMeta = null, bajoKpis = null, agendasDeFuente = null, onVerAgendas = null, onVerCobrado = null }) => {
    // Los filtros se recuerdan por usuario (`useFiltrosTabla`, norma del 28/10/2026). «Solo con gasto» y «solo
    // activas» (Kerwin, 23/10/2026): lo que no gastó y lo que no está activo en Meta estorban al mirar costos.
    const {
        busqueda, setBusqueda, verArchivados, setVerArchivados, soloConGasto, setSoloConGasto, soloActivas, setSoloActivas,
        orden, setOrden, nivel, setNivel, elegidas, setElegidas,
    } = useFiltrosTabla(datos.filas);
    const pantalla = usePantallaCompleta();
    const [editando, setEditando] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const moneda = datos.moneda;
    usarFormulas(datos.formulas); // las cuentas del backend, también si el tablero salió de lo recordado
    const vista = useVistaDeColumnas();
    const { modo, setModo } = useModoVista('mk_rendimiento_modo');
    const registros = useVerRegistros();
    const panelTabla = useRef(null);
    const irATabla = () => {
        setOrden({ clave: 'cobrado', dir: 'desc' });
        panelTabla.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const { piezas } = vista;

    const archivados = datos.filas.filter((f) => f.archivado).length;
    // Las palabras clave que entran: sin las archivadas y con la búsqueda (que mira también su campaña y su
    // conjunto, así «guía» encuentra el conjunto «Guía Perú»).
    const base = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        return datos.filas.filter((f) => (verArchivados || !f.archivado)
            && (!soloConGasto || f.gasto > 0)
            && (!soloActivas || f.meta?.activos > 0)
            && (!texto || [f.nombre, f.clave, f.campana, f.conjunto].some((x) => (x || '').toLowerCase().includes(texto))));
    }, [datos.filas, busqueda, verArchivados, soloConGasto, soloActivas]);
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

    // Dos filas con la misma clave no se repiten en pantalla (`clavesUnicas`).
    const clavesDeFilas = useMemo(() => clavesUnicas(visibles, idDe), [visibles, nivel]); // eslint-disable-line react-hooks/exhaustive-deps
    const delNivel = elegidas[nivel];
    const elegidasVisibles = visibles.filter((f) => delNivel.has(idDe(f)));
    const totales = useMemo(() => totalesDe(visibles), [visibles]);
    // Cada fila se pinta contra el total de lo que se ve (`tonos.js`).
    const refs = useMemo(() => (vista.colores ? referenciasDe(totales, visibles.length) : null),
        [vista.colores, totales, visibles.length]);
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
        : ALCANCE_INICIAL;

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

    const anchoTotal = ['sel', 'nombre', ...piezas.map((p) => p.key), 'acc'].reduce((s, k) => s + vista.ancho(k), 0);
    // El CSV: las filas elegidas (o las que se ven) y, como alternativa, todas las del nivel sin filtros.
    const todasDelNivel = nivel === 'anuncios' ? datos.filas : agruparFilas(datos.filas, nivel);
    const exportar = {
        def: { cols: columnasDelCsv(nivel, NOMBRE_DEL_NIVEL[nivel]) },
        tabla: `rendimiento_${nivel}`,
        colsVistas: [{ key: 'nombre' }, { key: 'campana' }, { key: 'conjunto' },
            ...piezas.flatMap((p) => (p.tipo === 'col' ? [p.col] : p.cols))],
        filasVista: elegidasVisibles.length ? elegidasVisibles : visibles,
        filasTodas: ordenar(todasDelNivel, orden.clave, orden.dir),
        fechas: { start: datos.desde, end: datos.hasta },
        rotulos: { vista: elegidasVisibles.length ? 'Las filas elegidas' : 'Lo que estás viendo', todas: 'Toda la tabla, sin filtros' },
    };

    const conGasto = totales.gasto > 0;
    const enDinero = (v) => formatear(v, 'money', moneda);
    // El ojo de cada KPI abre las filas que lo suman: las mismas que ve la tabla, con su aporte.
    const ver = (kpi, titulo, valor) => () => registros.abrir({
        titulo, subtitulo: `${valor} en el período · una fila por ${NOMBRE_DEL_NIVEL[nivel].toLowerCase()}`,
        contenido: contenidoDeKpi({ kpi, filas: visibles, idDe, nivel: NOMBRE_DEL_NIVEL[nivel], moneda }),
    });
    const kpis = [
        { titulo: KPIS[0], valor: formatear(totales.entrantes, 'num'), onVer: ver('entrantes', KPIS[0], formatear(totales.entrantes, 'num')),
          sub: `${formatear(totales.pct_calificados, 'pct')} calificados · ${formatear(totales.pct_descalificados, 'pct')} descalificados · ${formatear(totales.pct_pendientes, 'pct')} pendientes`,
          tip: 'Personas que entraron, por estado en ManyChat.' },
        { titulo: KPIS[1], valor: formatear(totales.gasto, 'money', moneda), onVer: ver('gasto', KPIS[1], formatear(totales.gasto, 'money', moneda)),
          sub: conGasto ? `${formatear(totales.cpl, 'money', moneda)} por lead · ${formatear(totales.cpl_calificado, 'money', moneda)} por calificado` : 'Sin gasto cargado en el período',
          tip: 'Gasto en Meta de estas palabras clave.' },
        { titulo: KPIS[2], valor: formatear(totales.agendas, 'num'), onVer: ver('agendas', KPIS[2], formatear(totales.agendas, 'num')),
          sub: conGasto ? `${formatear(totales.costo_agenda, 'money', moneda)} por agenda` : 'Costo por agenda: —',
          tip: 'Con palabra clave de ManyChat; la tarjeta de Setting cuenta por setter.' },
        { titulo: KPIS[3], valor: formatear(totales.ventas, 'num'), onVer: ver('ventas', KPIS[3], formatear(totales.ventas, 'num')),
          sub: (
              <>
                  <CifraConCuenta cuenta={cuentaDe('costo_venta', totales, enDinero)}>{formatear(totales.costo_venta, 'money', moneda)}</CifraConCuenta>
                  {' '}por venta · CAC{' '}
                  <CifraConCuenta cuenta={cuentaDe('cac', totales, enDinero)}>{formatear(totales.cac, 'money', moneda)}</CifraConCuenta>
              </>
          ),
          tip: 'Pagos de venta nueva (completo o split). El CAC divide por personas que compraron.' },
    ];

    if (agendasDeFuente) {
        kpis[2] = {
            titulo: KPIS[2], valor: formatear(agendasDeFuente.agendas, 'num'),
            onVer: onVerAgendas ? () => onVerAgendas('agendas', KPIS[2]) : undefined,
            sub: agendasDeFuente.costo_agenda != null
                ? `${formatear(agendasDeFuente.costo_agenda, 'money', moneda)} por agenda (de ${formatear(agendasDeFuente.agendas_alta, 'num')} por fecha de alta)`
                : 'por fecha de reunión · costo por agenda: —',
            tip: 'Agendas de Setting cuya reunión cae en el período (las de Closing). El costo por agenda cuenta siempre por fecha de alta.',
        };
    }

    return (
        <div className="vista mk-vista">
            {!datos.meta?.conectado && (
                <div className="mk-aviso" role="status">
                    <Link2 size={16} aria-hidden="true" />
                    <p className="t-cap">
                        <b>El gasto todavía no llega de Meta Ads.</b> Sin él, los costos quedan en «—».
                        {' '}Mirá cómo conectarlo para que se actualice solo cada día.
                    </p>
                    <button type="button" className="btn btn--linea btn--sm" onClick={irAMeta}
                        title="Los pasos para conectar Meta, en la pestaña Meta Ads">
                        Ver cómo conectar
                    </button>
                </div>
            )}

            <div className="pareja mk-kpis" style={{ '--min': '220px', '--g': 'var(--s4)' }}>
                {kpis.map((k, i) => <Kpi key={k.titulo} {...k} i={i} />)}
            </div>

            {bajoKpis}

            {/* Lo accionable primero (28/10/2026): KPIs, la tabla y, después, lo cobrado y los gráficos. */}
            <section className={`panel mk-panel-tabla${pantalla.completa ? ' mk-pantalla' : ''}`} ref={panelTabla}>
                <div className="mk-tabla-barra">
                    <div className="mk-tabla-titulo">
                        <div className="mk-cab-txt">
                            <h2 className="t-h3">{TITULO}</h2>
                            <p className="t-cap mut40">{BAJADA}</p>
                        </div>
                        <EstadoDeMeta meta={datos.meta} estadoMeta={estadoMeta} />
                    </div>
                    {/* Todos los filtros en una sola línea (Kerwin, 17/10/2026: «se ve todo desordenado»). */}
                    <div className="mk-filtros">
                        <Segmented chico ariaLabel="Nivel de la tabla" valor={nivel} onChange={setNivel}
                            opciones={NIVELES.map((n) => ({ ...n, cuenta: elegidas[n.key].size || null }))} />
                        <label className="busca busca--sm mk-busca">
                            <Search aria-hidden="true" />
                            <input type="search" placeholder="Buscar" value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar palabra clave, campaña o conjunto" />
                        </label>
                        {archivados > 0 && (
                            <button type="button" className={`pastilla pastilla--sm${verArchivados ? ' pastilla--on' : ''}`}
                                aria-pressed={verArchivados} onClick={() => setVerArchivados((v) => !v)}
                                title={verArchivados ? 'Ocultar las archivadas' : 'Ver las archivadas'}>
                                <Archive aria-hidden="true" />
                                {verArchivados ? 'Sin archivadas' : `Archivadas (${archivados})`}
                            </button>
                        )}
                        <button type="button" className={`pastilla pastilla--sm${soloConGasto ? ' pastilla--on' : ''}`}
                            aria-pressed={soloConGasto} onClick={() => setSoloConGasto((v) => !v)}
                            title="Esconder las que no gastaron nada en el período">
                            <CircleDollarSign aria-hidden="true" />
                            Solo con gasto
                        </button>
                        <button type="button" className={`pastilla pastilla--sm${soloActivas ? ' pastilla--on' : ''}`}
                            aria-pressed={soloActivas} onClick={() => setSoloActivas((v) => !v)}
                            title="Solo las que tienen algún anuncio activo en Meta ahora">
                            <Power aria-hidden="true" />
                            Solo activas
                        </button>
                        <span className="mk-filtros-hueco" />
                        <SelectorModo modo={modo} setModo={setModo} />
                        <HerramientasTabla vista={vista} exportar={exportar} pantalla={pantalla} />
                    </div>
                    {refs && <LeyendaTonos />}
                </div>

                {modo === 'tarjetas' ? (
                    visibles.length ? (
                        <TarjetasAnuncios filas={visibles} piezas={piezas} moneda={moneda} idDe={idDe} elegidas={delNivel}
                            refs={refs} totales={totales} nivel={nivel}
                            onTocar={nivel === 'anuncios' ? alternar : abrir}
                            subtitulo={(f) => (nivel === 'anuncios'
                                ? (f.campana ? `${f.campana} › ${f.conjunto ?? 'Sin conjunto'}` : sub(f, textoMeta(f.meta)))
                                : nivel === 'conjuntos' ? (f.campana ?? SIN_CAMPANA) : `${f.conjuntos} conjuntos · ${f.palabras} palabras clave`)} />
                    ) : (
                        <p className="t-cap mk-vacio">Nada coincide con la búsqueda o con lo elegido.</p>
                    )
                ) : (
                <CajaDeTabla completa={pantalla.completa}>
                    {/* Anchos fijos (`table-layout: fixed`): los que se eligen arrastrando el borde de cada
                        encabezado, o los de siempre. */}
                    <table className="mk-tabla mk-tabla--anchos" style={{ width: anchoTotal }}>
                        <colgroup>
                            {['sel', 'nombre', ...piezas.map((p) => p.key), 'acc'].map((k) => (
                                <col key={k} style={{ width: vista.ancho(k) }} />
                            ))}
                        </colgroup>
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
                                    <Borde id="nombre" etiqueta={NOMBRE_DEL_NIVEL[nivel]} vista={vista} />
                                </th>
                                {piezas.map((p) => (
                                    <Encabezado key={p.key} pieza={p} orden={orden} ordenarPor={ordenarPor}
                                        ariaOrden={ariaOrden} vista={vista} />
                                ))}
                                <th className="mk-col-acc" scope="col"><span className="sr-only">Acciones</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {nivel !== 'anuncios' && visibles.map((g) => (
                                <FilaGrupo key={g.id} g={g} nivel={nivel} elegida={delNivel.has(g.id)} onAlternar={alternar}
                                    onAbrir={abrir} piezas={piezas} moneda={moneda} refs={refs} />
                            ))}
                            {nivel === 'anuncios' && visibles.map((f, i) => (
                                <FilaAnuncio key={clavesDeFilas[i]} f={f} elegida={delNivel.has(claveDeAnuncio(f))}
                                    onAlternar={alternar} onEditar={setEditando} onArchivar={onArchivar} subtitulo={sub}
                                    piezas={piezas} moneda={moneda} refs={refs} />
                            ))}
                            {!visibles.length && (
                                <tr>
                                    <td colSpan={piezas.length + 3} className="mk-vacio">
                                        {datos.filas.length
                                            ? 'Nada coincide con la búsqueda o con lo elegido.'
                                            : 'No llegó ningún lead por ManyChat en este período.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {visibles.length > 0 && (
                            <PieDeResultados cantidad={visibles.length} unidad={visibles.length === 1 ? uno : varios}
                                totales={totales} piezas={piezas} moneda={moneda} />
                        )}
                    </table>
                </CajaDeTabla>
                )}

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

            <CobradoDelPeriodo fuentes={datos.fuentes} enTabla={datos.totales?.cobrado || 0} moneda={moneda}
                onVer={onVerCobrado} irATabla={irATabla} />

            <SerieDiaria serie={serie} moneda={moneda} alcance={alcance} metaConectado={datos.meta?.conectado} />

            {editando && (
                <EditorAgrupacion fila={editando} opciones={datos.agrupaciones || []} guardando={guardando}
                    onGuardar={guardarAgrupacion} onAutomatica={() => guardarAgrupacion(null, null)}
                    onCerrar={() => setEditando(null)} />
            )}
            {registros.panel}
        </div>
    );
};

export default TablaAnuncios;
