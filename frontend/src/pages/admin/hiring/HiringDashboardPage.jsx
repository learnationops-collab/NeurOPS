import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Inbox, CheckCircle2, Trophy, BarChart3, FileText, Briefcase, Search, X, Filter, Check, ArrowLeft, AlertTriangle,
    SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { abrirSimulacion } from '../../../sesion/simulacion';
import { armarMenuSesion, rotuloDeSesion } from '../../../sesion/menuSesion';
import { useConfiguracion } from '../../../sesion/ConfiguracionContext';
import DockSecciones from '../../comercial/components/DockSecciones';
import MenuSesion from '../../comercial/components/MenuSesion';
import HiringCandidateModal from './components/HiringCandidateModal';
import TablaPostulaciones from './components/TablaPostulaciones';
import MenuVista from './components/MenuVista';
import ResumenInbox from './components/ResumenInbox';
import HiringStats from './components/HiringStats';
import ConfigTalent from './components/ConfigTalent';
import HiringForms from './components/forms/HiringForms';
import { IsotipoTalent } from './components/Piezas';
import PostulacionesCloser, { PESTANAS_CLOSER } from '../postulaciones/PostulacionesCloser';
import {
    PESTANAS, agrupar, colsVisibles, coincide, cuentas as contar, enPestana, filtrosActivos, guardarVista, leerVista,
    normalizar, ordenar, pasaFiltros, vistaDefault,
} from './lib/vista';
import '../../comercial/comercial.css';
import './talent.css';

// Learnation Talent: el panel del rol `hiring` (postulaciones al puesto de
// Asistente Administrativa y Personal). Corre sin MainLayout (ver App.jsx): es
// su propia sub-app, con su dock propio — Inbox, Analyze, Winners, Stats,
// Forms y Closers— y el orbe de Configuración (Clarity y la búsqueda) al final,
// junto a la sesión.
//
// El listado se pide entero una vez y todo lo demás —pestañas, búsqueda, filtros,
// orden, grupos— se resuelve en el navegador (ver `lib/vista.js`).
//
// Closers (10/10/2026): la búsqueda de Closer de ventas (antes Postulaciones, una
// pantalla del admin en /admin/postulaciones) vive acá desde que se retiró la vista
// «Administración». Es una sección más del dock y sus pestañas van en la cabecera,
// como las de Inbox o Stats; el contenido es el de Postulaciones tal cual (ver
// PostulacionesCloser) y va fuera del `.dc-shell` (ver `hospeda` más abajo).

const SECCIONES = [
    { id: 'pend', label: 'Inbox', Icono: Inbox },
    { id: 'anal', label: 'Analyze', Icono: CheckCircle2 },
    { id: 'fin', label: 'Winners', Icono: Trophy },
    { id: 'stats', label: 'Stats', Icono: BarChart3 },
    { id: 'forms', label: 'Forms', Icono: FileText },
    { id: 'closers', label: 'Closers', Icono: Briefcase },
];

const ES_TABLA = new Set(['pend', 'anal', 'fin']);

// `?s=closers` (el redirect de /admin/postulaciones) elige la sección con la que se entra.
const seccionDeEntrada = (s) => (SECCIONES.some((x) => x.id === s) ? s : 'pend');

const Pestanas = ({ lista, actual, onElegir, cuentaDe }) => (
    <div className="tabs" role="group">
        {lista.map((t) => (
            <button key={t.id} type="button" className="tab" aria-pressed={t.id === actual} onClick={() => onElegir(t.id)}>
                {t.c && <span className="punto" style={{ '--c': t.c }} />}
                {t.label}
                {cuentaDe && <span className="cuenta">{cuentaDe(t.id)}</span>}
            </button>
        ))}
    </div>
);

const HiringDashboardPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();

    const [seccion, setSeccion] = useState(() => seccionDeEntrada(params.get('s')));
    const [pestanas, setPestanas] = useState({ pend: 'hibrido', anal: 'seleccionada', fin: 'testeo', closers: 'pendientes' });
    const [statsTab, setStatsTab] = useState('panorama');
    const [statsSeg, setStatsSeg] = useState('gen');
    const [query, setQuery] = useState('');
    const [todas, setTodas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState('');
    const [errorBorrado, setErrorBorrado] = useState('');
    const [cfg, setCfg] = useState(leerVista);
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [config, setConfig] = useState(null);
    const [pesos, setPesos] = useState({});
    const [busquedaCfg, setBusquedaCfg] = useState(null);
    const [abierta, setAbierta] = useState(null);
    const [entradas, setEntradas] = useState(0);
    const buscador = useRef(null);
    const botonVista = useRef(null);

    // --- Datos ---
    const pedido = useRef(0);
    const yaCargo = useRef(false);
    const cargar = useCallback(async ({ silencioso = false } = {}) => {
        const mio = ++pedido.current;
        if (!silencioso) setCargando(true);
        try {
            const res = await api.get('/assistant-applications?filtro=todas');
            if (mio !== pedido.current) return;
            const filas = (res.data.postulaciones || []).map(normalizar);
            setTodas(filas);
            setErrorCarga('');
            // La primera vez, el Inbox abre en la tanda que tiene algo (híbridos primero).
            if (!yaCargo.current) {
                yaCargo.current = true;
                const hay = (m) => filas.some((p) => p.veredicto === 'sin_analizar' && p.modalidad === m);
                if (!hay('hibrido') && hay('online')) setPestanas((prev) => ({ ...prev, pend: 'online' }));
            }
        } catch (err) {
            console.error('Error al cargar postulaciones de Asistente:', err);
            if (mio === pedido.current) setErrorCarga('No se pudieron cargar las postulaciones.');
        } finally {
            if (mio === pedido.current) setCargando(false);
        }
    }, []);

    const cargarPesos = useCallback(() => {
        api.get('/assistant-applications/clarity-weights')
            .then((res) => setPesos(Object.fromEntries((res.data || []).map((p) => [p.criterion, p.weight]))))
            .catch(() => {});
    }, []);

    useEffect(() => {
        cargar();
        cargarPesos();
        api.get('/hiring/config').then((res) => setBusquedaCfg(res.data)).catch(() => setBusquedaCfg(null));
    }, [cargar, cargarPesos]);

    // La `s` solo dice dónde se entra: ya leída, se saca de la URL (con `replace`, sin sumar un paso
    // al historial). La sección no vive en la URL, y si quedaba, recargar después de pasar a Inbox
    // volvía a abrir Closers.
    useEffect(() => {
        if (!params.has('s')) return;
        const resto = new URLSearchParams(params);
        resto.delete('s');
        setParams(resto, { replace: true });
    }, [params, setParams]);

    const cambiarVista = useCallback((nueva) => { setCfg(nueva); guardarVista(nueva); }, []);

    // --- Atajos: ⌘K / Ctrl+K (y Ctrl+P, el de antes) enfocan el buscador; Escape lo limpia; `w` abre Acceso Simulado ---
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && ['k', 'K', 'p', 'P'].includes(e.key)) {
                e.preventDefault();
                buscador.current?.focus();
                return;
            }
            const enCampo = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable;
            if (e.key === 'Escape' && query && (e.target === buscador.current || !enCampo) && !abierta && !config) {
                setQuery('');
                return;
            }
            if (!enCampo && !abierta && e.key.toLowerCase() === 'w' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                abrirSimulacion();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [query, abierta, config]);

    const { abrir: abrirConfiguracion } = useConfiguracion();
    // El menú de sesión de todas las pantallas (sesion/menuSesion.js); lo propio de Hiring son los
    // ajustes de la herramienta (Clarity y búsqueda), que también abre el orbe del dock.
    const gruposDeSesion = armarMenuSesion({
        user, navigate, logout,
        acciones: [{ id: 'talent', label: 'Ajustes de Talent', Icono: SlidersHorizontal, onClick: () => setConfig('clarity') }],
        configuracion: { onClick: () => abrirConfiguracion() },
        // El admin aterriza en Operaciones desde que se retiró su panel (/admin/ventas, 10/10/2026).
        ir: user?.role === 'admin' ? [{ id: 'operaciones', label: 'Volver a Operaciones', Icono: ArrowLeft, onClick: () => navigate('/ops/dashboard') }] : [],
    });

    // --- Lo que se ve ---
    // Closers hospeda Postulaciones (Tailwind, paleta `dash-v6`): ese contenido va FUERA del
    // `.dc-shell`, cuyo reset de botones e inputs y su exención del `!important` tipográfico global
    // le cambiarían el look. El buscador de la cabecera tampoco va: busca entre las candidatas a
    // Asistente, no entre los closers.
    const hospeda = seccion === 'closers';
    const q = hospeda ? '' : query.trim();
    const enBusqueda = q.length > 0;
    const esTabla = enBusqueda || ES_TABLA.has(seccion);
    const c = useMemo(() => contar(todas), [todas]);
    const pestana = pestanas[seccion];

    const base = useMemo(() => {
        if (enBusqueda) return todas.filter((p) => coincide(p, q));
        if (!ES_TABLA.has(seccion)) return [];
        return todas.filter((p) => enPestana(p, seccion, pestana));
    }, [todas, enBusqueda, q, seccion, pestana]);

    const filas = useMemo(() => ordenar(base.filter((p) => pasaFiltros(p, cfg.filtros)), cfg.orden), [base, cfg.filtros, cfg.orden]);
    const grupos = useMemo(() => agrupar(filas, cfg.agrupar), [filas, cfg.agrupar]);
    const ids = useMemo(() => grupos.flatMap((g) => g.filas.map((p) => p.id)), [grupos]);
    const cols = colsVisibles(cfg);

    // La próxima a revisar: la de mejor score entre las que nadie miró (de la tanda elegida si es
    // Híbridos u Online; de todas si se está mirando Incompletas).
    const proxima = useMemo(() => {
        const candidatas = todas.filter((p) => p.veredicto === 'sin_analizar' && (pestanas.pend === 'incompletas' || p.modalidad === pestanas.pend));
        const lista = candidatas.length ? candidatas : todas.filter((p) => p.veredicto === 'sin_analizar');
        return [...lista].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] || null;
    }, [todas, pestanas.pend]);

    const modoDescarte = !enBusqueda && ((seccion === 'anal' && pestana === 'descartado') || (seccion === 'fin' && pestana === 'baja'));

    // Al cambiar de sección o de pestaña las barritas de la tabla vuelven a crecer.
    useEffect(() => { setEntradas((n) => n + 1); }, [seccion, pestana, enBusqueda]);
    useEffect(() => { if (!esTabla) setMenuAbierto(false); }, [esTabla]);

    const elegirSeccion = (id) => {
        setSeccion(id);
        setQuery('');
        setMenuAbierto(false);
    };

    const irA = (sec, pes) => {
        setSeccion(sec);
        if (pes) setPestanas((prev) => ({ ...prev, [sec]: pes }));
        setQuery('');
    };

    const eliminar = useCallback(async (id) => {
        try {
            await api.delete(`/assistant-applications/${id}`);
        } catch (err) {
            setErrorBorrado(err.response?.data?.message || 'No se pudo eliminar la postulación.');
            throw err;
        }
        setErrorBorrado('');
        setTodas((prev) => prev.filter((p) => p.id !== id));
        cargar({ silencioso: true });
    }, [cargar]);

    // La lista por la que se navega con las flechas del modal es la que se veía al abrirlo: al
    // decidir, la postulación sale de la pestaña y la lista viva se movería debajo del modal.
    const [listaModal, setListaModal] = useState([]);
    const abrir = useCallback((id) => {
        setListaModal(ids.includes(id) ? ids : [id]);
        setAbierta(id);
    }, [ids]);

    const titulo = enBusqueda ? `Resultados para «${q}»` : SECCIONES.find((s) => s.id === seccion)?.label;

    // --- Cabecera: las pestañas de cada sección y el botón Vista ---
    let controles = null;
    if (!enBusqueda && ES_TABLA.has(seccion)) {
        controles = <Pestanas lista={PESTANAS[seccion]} actual={pestana} onElegir={(id) => setPestanas((prev) => ({ ...prev, [seccion]: id }))} cuentaDe={(id) => c[id === 'incompletas' ? 'incompletas' : id]} />;
    } else if (!enBusqueda && seccion === 'stats') {
        controles = (
            <>
                <Pestanas lista={[{ id: 'panorama', label: 'Panorama' }, { id: 'paises', label: 'Comparar países' }]} actual={statsTab} onElegir={setStatsTab} />
                <div className="seg" role="group" aria-label="Universo">
                    <button type="button" aria-pressed={statsSeg === 'gen'} onClick={() => setStatsSeg('gen')}>Generales · {c.total}</button>
                    <button type="button" aria-pressed={statsSeg === 'fin'} onClick={() => setStatsSeg('fin')}>
                        Finalistas · {todas.filter((p) => p.completo && p.video_ok).length}
                    </button>
                </div>
            </>
        );
    } else if (hospeda) {
        // Las pestañas que Postulaciones tenía en su menú inferior.
        controles = <Pestanas lista={PESTANAS_CLOSER} actual={pestana} onElegir={(id) => setPestanas((prev) => ({ ...prev, closers: id }))} />;
    }
    const nf = filtrosActivos(cfg);

    const marcas = {
        pend: c.pend ? [{ tipo: 'cuenta', texto: String(c.pend), titulo: `${c.pend} sin analizar` }] : [],
        anal: c.anal ? [{ tipo: 'cuenta', texto: String(c.anal), titulo: `${c.anal} analizadas` }] : [],
        fin: c.fin ? [{ tipo: 'cuenta', texto: String(c.fin), titulo: `${c.fin} finalistas` }] : [],
    };
    const secciones = SECCIONES.map((s) => ({ ...s, marcas: marcas[s.id] || [] }));

    const vacio = (() => {
        if (cargando) return <p className="t-cap mut40">Cargando postulaciones…</p>;
        if (filtrosActivos(cfg) && base.length > 0) {
            return (
                <>
                    <span className="tl-vacio-ico tl-vacio-ico--idle"><Filter size={22} /></span>
                    <p className="t-h3">Nadie cumple los filtros de la vista</p>
                    <p className="mut t-cap">Hay {base.length} en esta lista. Aflojá un filtro o quitalos.</p>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => cambiarVista({ ...cfg, filtros: vistaDefault().filtros })}><X /> Quitar filtros</button>
                </>
            );
        }
        if (enBusqueda) {
            return (
                <>
                    <span className="tl-vacio-ico tl-vacio-ico--idle"><Search size={22} /></span>
                    <p className="t-h3">Nadie coincide con «{q}»</p>
                    <p className="mut t-cap">Probá con el nombre, el país o la provincia.</p>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => setQuery('')}><X /> Limpiar búsqueda</button>
                </>
            );
        }
        if (seccion === 'pend' && pestana !== 'incompletas') {
            const otra = pestana === 'hibrido' ? 'online' : 'hibrido';
            const nombre = (m) => (m === 'hibrido' ? 'híbridas' : 'online');
            return (
                <>
                    <span className="tl-vacio-ico"><Check size={22} /></span>
                    <p className="t-h3">Revisaste todas las {nombre(pestana)}</p>
                    <p className="mut t-cap">{c[otra] ? `Quedan ${c[otra]} postulaciones ${nombre(otra)} sin analizar.` : 'No queda ninguna postulación sin analizar.'}</p>
                    {c[otra] > 0 && <button type="button" className="btn btn--linea btn--sm" onClick={() => irA('pend', otra)}>Ver las {nombre(otra)}</button>}
                </>
            );
        }
        return (
            <>
                <span className="tl-vacio-ico tl-vacio-ico--idle"><Inbox size={22} /></span>
                <p className="t-h3">Todavía nadie en este estado</p>
                <p className="mut t-cap">Las candidatas aparecen acá cuando les asignás este estado desde su postulación.</p>
            </>
        );
    })();

    const formActivoNombre = busquedaCfg?.puesto;

    return (
        <>
            {/* En Closers el `.dc-shell` se achica a la cabecera (y al dock, que es fijo) y
                Postulaciones va debajo, fuera de él; el fondo de la página lo pone una capa fija
                (`.tl-fondo`), así las dos partes se ven como una sola pantalla. */}
            {hospeda && <div className="tl-fondo" aria-hidden="true" />}
            <div className={`dc-shell talent${hospeda ? ' talent--hospeda' : ''}`}>
                <div className="wrap">
                    <header className="tl-tope">
                        <div className="tl-marca">
                            <IsotipoTalent />
                            <div className="tl-tit">
                                <h1 className="t-h1">{titulo}</h1>
                                {!enBusqueda && seccion === 'forms' && formActivoNombre && (
                                    <p className="tl-sub">Búsqueda: <b>{formActivoNombre}</b></p>
                                )}
                                {hospeda && <p className="tl-sub">Búsqueda: <b>Closer de ventas</b></p>}
                            </div>
                        </div>
                        <div className="tl-tope-der">
                            {!hospeda && (
                                <label className="busca" htmlFor="tl-q">
                                    <Search />
                                    <input
                                        id="tl-q"
                                        ref={buscador}
                                        type="text"
                                        autoComplete="off"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Buscar candidata, país o provincia"
                                        aria-label="Buscar postulante"
                                    />
                                    {enBusqueda ? (
                                        <button type="button" className="tl-busca-x" onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={16} /></button>
                                    ) : (
                                        <span className="flex gap-1" aria-hidden="true"><kbd>Ctrl</kbd><kbd>K</kbd></span>
                                    )}
                                </label>
                            )}
                            <div className="tl-controles">
                                {controles}
                                {esTabla && (
                                    <button
                                        ref={botonVista}
                                        type="button"
                                        className="tl-vista-btn"
                                        aria-haspopup="true"
                                        aria-expanded={menuAbierto}
                                        aria-label="Configurar la vista"
                                        title="Vista: filtrar, columnas, ordenar, agrupar"
                                        onClick={() => setMenuAbierto((v) => !v)}
                                    >
                                        <Filter size={19} />
                                        {nf > 0 && <span className="tl-badge">{nf}</span>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </header>

                    {!hospeda && (
                        <main className="tl-vista" key={`${seccion}|${enBusqueda ? 'q' : ''}|${seccion === 'stats' ? statsTab : ''}`}>
                            {errorCarga && <div className="tl-aviso-error"><AlertTriangle size={16} />{errorCarga}</div>}
                            {errorBorrado && <div className="tl-aviso-error"><AlertTriangle size={16} />{errorBorrado}</div>}

                            {!enBusqueda && seccion === 'pend' && !cargando && (
                                <ResumenInbox
                                    proxima={proxima}
                                    cuentas={c}
                                    pesos={pesos}
                                    onAbrir={abrir}
                                    onPesos={() => setConfig('clarity')}
                                    onIr={irA}
                                />
                            )}

                            {esTabla && (
                                <TablaPostulaciones
                                    grupos={grupos}
                                    cols={cols}
                                    cfg={cfg}
                                    totalBase={base.length}
                                    entra={entradas}
                                    ctx={{
                                        conEstado: enBusqueda,
                                        modoDescarte,
                                        etiquetaDescarte: seccion === 'fin' ? 'Motivo' : 'Descarte',
                                        presMax: busquedaCfg?.presupuesto_max || 400,
                                        ahora: Date.now(),
                                    }}
                                    onOrden={(campo) => cambiarVista({
                                        ...cfg,
                                        orden: cfg.orden.campo === campo
                                            ? { campo, dir: cfg.orden.dir === 'asc' ? 'desc' : 'asc' }
                                            : { campo, dir: campo === 'nombre' || campo === 'pide' ? 'asc' : 'desc' },
                                    })}
                                    // Mientras se arrastra el ancho cambia en pantalla; se guarda al soltar
                                    // (`px` null), con flechas o con el doble clic que lo restablece (`undefined`).
                                    onAncho={(id, px, persistir) => setCfg((prev) => {
                                        let nueva = prev;
                                        if (px !== null) {
                                            const anchos = { ...prev.anchos };
                                            if (px === undefined) delete anchos[id];
                                            else anchos[id] = px;
                                            nueva = { ...prev, anchos };
                                        }
                                        if (persistir) guardarVista(nueva);
                                        return nueva;
                                    })}
                                    onAbrir={abrir}
                                    onEliminar={eliminar}
                                    onLimpiarFiltros={() => cambiarVista({ ...cfg, filtros: vistaDefault().filtros })}
                                    vacio={vacio}
                                />
                            )}

                            {!enBusqueda && seccion === 'stats' && <HiringStats todas={todas} pestana={statsTab} segmento={statsSeg} />}
                            {!enBusqueda && seccion === 'forms' && <HiringForms />}
                        </main>
                    )}
                </div>

                <DockSecciones
                    secciones={secciones}
                    activa={seccion}
                    onElegir={elegirSeccion}
                    ariaLabel="Secciones de Learnation Talent"
                    despues={(
                        <>
                            <button
                                type="button"
                                className="tl-orb"
                                aria-label="Configuración de Learnation Talent"
                                aria-expanded={Boolean(config)}
                                title="Configuración: Clarity y búsqueda"
                                onClick={() => setConfig((v) => (v ? null : 'clarity'))}
                            >
                                <IsotipoTalent tam={50} id="tlGDock" className="" etiqueta="" />
                            </button>
                            <MenuSesion
                                nombre={user?.name || user?.username || ''}
                                rol={rotuloDeSesion(user, 'Hiring')}
                                grupos={gruposDeSesion}
                            />
                        </>
                    )}
                />
            </div>

            {hospeda && (
                // `key`: cada pestaña entra con el mismo fundido que las vistas de Talent.
                <main className="tl-hospedado dash-v6 text-base" key={pestana}>
                    <PostulacionesCloser pestana={pestana} />
                </main>
            )}

            {menuAbierto && esTabla && (
                <MenuVista
                    ancla={botonVista}
                    cfg={cfg}
                    onCambiar={cambiarVista}
                    onCerrar={() => setMenuAbierto(false)}
                    onCriterios={() => { setMenuAbierto(false); setConfig('clarity'); }}
                />
            )}

            {config && (
                <ConfigTalent
                    tab={config}
                    onTab={setConfig}
                    onCerrar={() => setConfig(null)}
                    todas={todas}
                    onAbrir={abrir}
                    onPesosGuardados={() => { cargar({ silencioso: true }); cargarPesos(); }}
                    onConfigGuardada={setBusquedaCfg}
                />
            )}


            {abierta && (
                // El modal de la postulación es el de siempre (Tailwind, paleta `dash-v6`): va fuera
                // del `.dc-shell`, cuyas reglas de botón e input le pisarían el padding y los bordes.
                <div className="dash-v6 text-white">
                    <HiringCandidateModal
                        applicationId={abierta}
                        ids={listaModal.includes(abierta) ? listaModal : [abierta]}
                        onClose={() => setAbierta(null)}
                        onNavigate={setAbierta}
                        onDecidido={() => cargar({ silencioso: true })}
                    />
                </div>
            )}
        </>
    );
};

export default HiringDashboardPage;
